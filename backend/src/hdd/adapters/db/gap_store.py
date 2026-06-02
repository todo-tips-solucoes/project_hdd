"""GapStore — loop gaps→backlog do dogfood (Story 7.2).

Cada escalada/falha/quota de uma onda vira um "gap" estruturado e persistido,
que realimenta o backlog (fecha o ciclo da meta-tese). Os gaps são listáveis
para a retrospectiva (Story 7.10) e exportáveis como candidatos a story
(markdown via `gaps_to_markdown`, função pura/testável).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import uuid_utils
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .models import DogfoodGapRow


@dataclass(frozen=True, slots=True)
class GapDetail:
    id: str
    wave_id: str | None
    stage: str
    reason: str
    context: dict[str, object]
    status: str
    created_at: datetime


class GapStore:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def record_gap(
        self,
        wave_id: str | None,
        stage: str,
        reason: str,
        context: dict[str, object] | None = None,
    ) -> str:
        """Registra um gap. Retorna o id. `stage` ∈ escalation|failure|quota."""
        gid = str(uuid_utils.uuid7())
        async with self._sm() as s:
            s.add(
                DogfoodGapRow(
                    id=gid,
                    wave_id=wave_id,
                    stage=stage,
                    reason=reason,
                    context=context or {},
                    status="open",
                )
            )
            await s.commit()
        return gid

    async def list_gaps(self, status: str | None = None) -> list[GapDetail]:
        stmt = select(DogfoodGapRow).order_by(DogfoodGapRow.created_at)
        if status is not None:
            stmt = stmt.where(DogfoodGapRow.status == status)
        async with self._sm() as s:
            rows = (await s.execute(stmt)).scalars().all()
            return [
                GapDetail(
                    id=r.id,
                    wave_id=r.wave_id,
                    stage=r.stage,
                    reason=r.reason,
                    context=dict(r.context),
                    status=r.status,
                    created_at=r.created_at,
                )
                for r in rows
            ]


def gaps_to_markdown(gaps: list[GapDetail]) -> str:
    """Exporta gaps como markdown — candidatos a story para o backlog (pura)."""
    if not gaps:
        return "# Gaps de dogfood\n\n_Nenhum gap registrado._\n"
    lines = ["# Gaps de dogfood", "", f"Total: {len(gaps)}", ""]
    for g in gaps:
        origem = f"onda `{g.wave_id}`" if g.wave_id else "pré-identificado"
        meta = " · candidato a meta-onda" if g.context.get("candidate_meta_wave") else ""
        lines.append(f"## [{g.stage}] {origem}{meta}")
        lines.append("")
        lines.append(f"- **Status:** {g.status}")
        lines.append(f"- **Quando:** {g.created_at.isoformat()}")
        lines.append(f"- **Motivo:** {g.reason}")
        refs = g.context.get("refs")
        if isinstance(refs, list) and refs:
            lines.append(f"- **Refs:** {', '.join(str(r) for r in refs)}")
        lines.append("")
    return "\n".join(lines)
