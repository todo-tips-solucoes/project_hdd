"""Story 2.1 — persistência real e enforcement da FSM na borda (opt-in).

Requer Postgres (compose) com migrations aplicadas. `pytest -m integration`.
"""
from __future__ import annotations

import pytest

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.repository import Repository
from hdd.config import get_settings
from hdd.domain.errors import DomainError
from hdd.domain.session import SessionState
from hdd.domain.wave import WaveState

pytestmark = pytest.mark.integration


def _repo() -> Repository:
    engine = make_engine(get_settings().pg_dsn)
    return Repository(make_sessionmaker(engine))


async def test_sessao_persiste_e_transita():
    repo = _repo()
    sid = await repo.create_session("tarefa de teste")
    assert await repo.session_state(sid) == SessionState.CREATED
    await repo.set_session_state(sid, SessionState.RUNNING)
    assert await repo.session_state(sid) == SessionState.RUNNING


async def test_transicao_ilegal_e_rejeitada_na_persistencia():
    repo = _repo()
    sid = await repo.create_session("x")
    with pytest.raises(DomainError):
        await repo.set_session_state(sid, SessionState.DONE)  # CREATED↛DONE


async def test_onda_conta_correcoes():
    repo = _repo()
    sid = await repo.create_session("y")
    await repo.set_session_state(sid, SessionState.RUNNING)
    wid = await repo.create_wave(sid)
    await repo.set_wave_state(wid, WaveState.EXECUTING)
    await repo.set_wave_state(wid, WaveState.VERIFYING)
    await repo.set_wave_state(wid, WaveState.CORRECTING)  # n_corrections += 1
    await repo.set_wave_state(wid, WaveState.EXECUTING)
