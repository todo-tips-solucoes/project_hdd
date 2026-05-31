"""GateStore — persistência e resolução de gates (Story 2.5).

PIN single-use ligado ao gate_id, rate-limit (max_attempts) e timeout. Estados
terminais (APPROVED/REJECTED/EXPIRED/LOCKED) nunca voltam a PENDING. Gates 1–4
nunca auto-aprovam: timeout → EXPIRED, ação fica pendente.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import uuid_utils
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.domain.capability import GateType
from hdd.domain.errors import DomainError
from hdd.domain.gate import GateStatus, generate_pin, pin_hash, verify_pin

from .models import GateRow


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

    async def status(self, gate_id: str) -> GateStatus:
        async with self._sm() as s:
            row = await s.get(GateRow, gate_id)
            if row is None:
                raise DomainError(f"gate inexistente: {gate_id}")
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
