"""Repositório de sessões/ondas — persiste estado e ENFORÇA a FSM na borda.

Toda mudança de estado passa pela FSM do domínio (`assert_transition`): mesmo
um caller errado não consegue gravar uma transição ilegal.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.contracts.events import EventType, make_event
from hdd.contracts.ports import AuditSink
from hdd.domain import session as session_fsm
from hdd.domain import wave as wave_fsm
from hdd.domain.errors import DomainError

from .models import SessionRow, WaveRow

# Mapa transição-da-onda → evento de auditoria (catálogo fechado, 3.2).
_WAVE_EVENT: dict[wave_fsm.WaveState, EventType] = {
    wave_fsm.WaveState.VERIFYING: EventType.WAVE_VERIFIED,
    wave_fsm.WaveState.MERGED: EventType.WAVE_MERGED,
}


class Repository:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        audit: AuditSink | None = None,
    ) -> None:
        self._sm = sessionmaker
        self._audit = audit

    async def _emit(
        self, event_type: EventType, correlation_id: str, payload: dict[str, object]
    ) -> None:
        if self._audit is not None:
            await self._audit.append(
                make_event(event_type, correlation_id, actor="orchestrator", payload=payload)
            )

    # --- sessões -----------------------------------------------------------
    async def create_session(self, task: str) -> str:
        row = SessionRow(state=session_fsm.SessionState.CREATED, task=task)
        async with self._sm() as s:
            s.add(row)
            await s.commit()
            sid = row.id
        await self._emit(EventType.SESSION_CREATED, sid, {"task": task})
        return sid

    async def session_state(self, session_id: str) -> session_fsm.SessionState:
        async with self._sm() as s:
            row = await s.get(SessionRow, session_id)
            if row is None:
                raise DomainError(f"sessão inexistente: {session_id}")
            return session_fsm.SessionState(row.state)

    async def set_session_state(
        self, session_id: str, target: session_fsm.SessionState
    ) -> None:
        async with self._sm() as s:
            row = await s.get(SessionRow, session_id)
            if row is None:
                raise DomainError(f"sessão inexistente: {session_id}")
            session_fsm.assert_transition(session_fsm.SessionState(row.state), target)
            row.state = target
            await s.commit()

    # --- ondas -------------------------------------------------------------
    async def create_wave(self, session_id: str) -> str:
        row = WaveRow(session_id=session_id, state=wave_fsm.WaveState.PLANNED)
        async with self._sm() as s:
            s.add(row)
            await s.commit()
            wid = row.id
        await self._emit(EventType.WAVE_STARTED, wid, {"session_id": session_id})
        return wid

    async def set_wave_state(self, wave_id: str, target: wave_fsm.WaveState) -> None:
        async with self._sm() as s:
            row = await s.get(WaveRow, wave_id)
            if row is None:
                raise DomainError(f"onda inexistente: {wave_id}")
            wave_fsm.assert_transition(wave_fsm.WaveState(row.state), target)
            if target == wave_fsm.WaveState.CORRECTING:
                row.n_corrections += 1
            row.state = target
            await s.commit()
        event = _WAVE_EVENT.get(target)
        if event is not None:
            await self._emit(event, wave_id, {"state": str(target)})

    async def all_sessions(self) -> list[str]:
        async with self._sm() as s:
            result = await s.execute(select(SessionRow.id))
            return list(result.scalars().all())

    async def list_sessions(self) -> list[tuple[str, str, str]]:
        async with self._sm() as s:
            result = await s.execute(
                select(SessionRow.id, SessionRow.state, SessionRow.task)
            )
            return [(r[0], r[1], r[2]) for r in result.all()]

    async def list_waves(self) -> list[tuple[str, str, str, int]]:
        """(id, session_id, state, n_corrections) — snapshot para o painel (4.2)."""
        async with self._sm() as s:
            result = await s.execute(
                select(
                    WaveRow.id, WaveRow.session_id, WaveRow.state, WaveRow.n_corrections
                ).order_by(WaveRow.created_at)
            )
            return [(r[0], r[1], r[2], r[3]) for r in result.all()]
