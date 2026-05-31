"""GateStore — persistência e resolução de gates (Story 2.5).

PIN single-use ligado ao gate_id, rate-limit (max_attempts) e timeout. Estados
terminais (APPROVED/REJECTED/EXPIRED/LOCKED) nunca voltam a PENDING. Gates 1–4
nunca auto-aprovam: timeout → EXPIRED, ação fica pendente.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import uuid_utils
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.domain.capability import GateType
from hdd.domain.errors import DomainError
from hdd.domain.gate import GateStatus, generate_pin, pin_hash, verify_pin

from .models import GateRow


@dataclass(frozen=True, slots=True)
class GateDetail:
    """Contexto completo de um gate para o painel autenticado (Story 4.3)."""

    id: str
    wave_id: str
    gate_type: str
    reason: str
    status: GateStatus
    created_at: datetime
    expires_at: datetime


class GateStore:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        ttl_seconds: int = 3600,
        max_attempts: int = 3,
    ) -> None:
        self._sm = sessionmaker
        self._ttl = ttl_seconds
        self._max_attempts = max_attempts

    async def open_gate(
        self, wave_id: str, gate_type: GateType, reason: str
    ) -> tuple[str, str]:
        """Cria um gate PENDING e retorna (gate_id, pin). O PIN só é notificado."""
        gid = str(uuid_utils.uuid7())
        pin = generate_pin()
        row = GateRow(
            id=gid,
            wave_id=wave_id,
            gate_type=str(gate_type),
            reason=reason,
            status=str(GateStatus.PENDING),
            pin_hash=pin_hash(gid, pin),
            max_attempts=self._max_attempts,
            expires_at=datetime.now(UTC) + timedelta(seconds=self._ttl),
        )
        async with self._sm() as s:
            s.add(row)
            await s.commit()
        return gid, pin

    async def list_pending(self) -> list[tuple[str, str, str, str]]:
        async with self._sm() as s:
            result = await s.execute(
                select(GateRow.id, GateRow.wave_id, GateRow.gate_type, GateRow.reason)
                .where(GateRow.status == str(GateStatus.PENDING))
            )
            return [(r[0], r[1], r[2], r[3]) for r in result.all()]

    async def status(self, gate_id: str) -> GateStatus:
        async with self._sm() as s:
            row = await s.get(GateRow, gate_id)
            if row is None:
                raise DomainError(f"gate inexistente: {gate_id}")
            return GateStatus(row.status)

    async def detail(self, gate_id: str) -> GateDetail | None:
        async with self._sm() as s:
            row = await s.get(GateRow, gate_id)
            if row is None:
                return None
            return GateDetail(
                id=row.id,
                wave_id=row.wave_id,
                gate_type=row.gate_type,
                reason=row.reason,
                status=GateStatus(row.status),
                created_at=row.created_at,
                expires_at=row.expires_at,
            )

    async def resolve_authenticated(self, gate_id: str, approve: bool) -> GateStatus:
        """Resolve um gate pelo **canal autenticado** (painel), sem PIN.

        Decisão de arquitetura: o painel exige OAuth + allowlist, então a própria
        sessão é a autorização — o PIN (segredo) nunca trafega por canal não-confiável
        (WhatsApp). Mantém os invariantes de borda: estados terminais não mudam e
        gates expirados viram EXPIRED. O PIN (`resolve`) segue válido para a CLI local.
        """
        async with self._sm() as s:
            row = await s.get(GateRow, gate_id)
            if row is None:
                raise DomainError(f"gate inexistente: {gate_id}")
            if row.status != GateStatus.PENDING:
                return GateStatus(row.status)  # idempotente / terminal
            if datetime.now(UTC) >= row.expires_at:
                row.status = str(GateStatus.EXPIRED)
                await s.commit()
                return GateStatus.EXPIRED
            row.status = str(GateStatus.APPROVED if approve else GateStatus.REJECTED)
            await s.commit()
            return GateStatus(row.status)

    async def resolve(self, gate_id: str, pin: str, approve: bool) -> GateStatus:
        async with self._sm() as s:
            row = await s.get(GateRow, gate_id)
            if row is None:
                raise DomainError(f"gate inexistente: {gate_id}")
            if row.status != GateStatus.PENDING:
                return GateStatus(row.status)  # idempotente / terminal
            if datetime.now(UTC) >= row.expires_at:
                row.status = str(GateStatus.EXPIRED)
                await s.commit()
                return GateStatus.EXPIRED

            row.attempts += 1
            if row.attempts > row.max_attempts:
                row.status = str(GateStatus.LOCKED)
                await s.commit()
                return GateStatus.LOCKED

            if not verify_pin(gate_id, pin, row.pin_hash):
                await s.commit()  # registra a tentativa falha (rate-limit)
                return GateStatus.PENDING

            row.status = str(GateStatus.APPROVED if approve else GateStatus.REJECTED)
            await s.commit()
            return GateStatus(row.status)
