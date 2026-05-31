"""EventReader — leitura incremental da trilha de auditoria (Story 4.2).

O painel observa ondas/decisões "ao vivo" tailando a tabela `audit.events` por
`seq` (monotônico). É a mesma fonte de verdade da auditoria (hash-chain), então o
stream é durável e cross-process: qualquer worker que emita um evento aparece no
painel, sem barramento em memória. Read-only (apenas SELECT).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@dataclass(frozen=True, slots=True)
class AuditRecord:
    """Projeção de um evento de auditoria para consumo do painel."""

    seq: int
    event_id: str
    type: str
    occurred_at: datetime
    correlation_id: str
    actor: str
    payload: dict[str, object]


class EventReader:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def latest_seq(self) -> int:
        """Maior `seq` já gravado (0 se a trilha está vazia)."""
        async with self._sm() as s:
            head = (
                await s.execute(text("SELECT max(seq) FROM audit.events"))
            ).scalar()
            return int(head) if head is not None else 0

    async def after(self, seq: int, limit: int = 100) -> list[AuditRecord]:
        """Eventos com `seq` > `seq`, em ordem cronológica."""
        async with self._sm() as s:
            rows = (
                await s.execute(
                    text(
                        "SELECT seq, event_id, type, occurred_at, correlation_id, "
                        "actor, payload "
                        "FROM audit.events WHERE seq > :after ORDER BY seq LIMIT :n"
                    ),
                    {"after": seq, "n": limit},
                )
            ).all()
        return [
            AuditRecord(
                seq=r[0],
                event_id=r[1],
                type=r[2],
                occurred_at=r[3],
                correlation_id=r[4],
                actor=r[5],
                payload=r[6] or {},
            )
            for r in rows
        ]
