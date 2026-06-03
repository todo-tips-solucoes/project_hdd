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


async def test_sync_wave_state_persiste_n_corrections():
    repo = _repo()
    sid = await repo.create_session("n_corrections write")
    wid = await repo.create_wave(sid)
    await repo.sync_wave_state(wid, WaveState.AWAITING_GATE, n_corrections=7)
    waves = {w: n for w, _sid, _st, n in await repo.list_waves()}
    assert waves[wid] == 7


async def test_sync_wave_state_sem_n_corrections_nao_altera():
    repo = _repo()
    sid = await repo.create_session("n_corrections preserve")
    wid = await repo.create_wave(sid)
    await repo.sync_wave_state(wid, WaveState.AWAITING_GATE, n_corrections=5)
    await repo.sync_wave_state(wid, WaveState.AWAITING_GATE)  # sem n_corrections
    waves = {w: n for w, _sid, _st, n in await repo.list_waves()}
    assert waves[wid] == 5  # valor anterior preservado
