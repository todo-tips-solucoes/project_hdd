"""Repositório de sessões/ondas — persiste estado e ENFORÇA a FSM na borda.

Toda mudança de estado passa pela FSM do domínio (`assert_transition`): mesmo
um caller errado não consegue gravar uma transição ilegal.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.domain import session as session_fsm
from hdd.domain import wave as wave_fsm
from hdd.domain.errors import DomainError

from .models import SessionRow, WaveRow


class Repository:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    # --- sessões -----------------------------------------------------------
    async def create_session(self, task: str) -> str:
        row = SessionRow(state=session_fsm.SessionState.CREATED, task=task)
        async with self._sm() as s:
            s.add(row)
            await s.commit()
            return row.id

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
            return row.id

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

    async def all_sessions(self) -> list[str]:
        async with self._sm() as s:
            result = await s.execute(select(SessionRow.id))
            return list(result.scalars().all())
