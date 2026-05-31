"""Stories 3.1/3.2 — auditoria hash-chain + emissão nas transições (DB real)."""
from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from hdd.adapters.audit import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.repository import Repository
from hdd.config import get_settings
from hdd.contracts.events import EventType, make_event

pytestmark = pytest.mark.integration


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def test_append_encadeia_e_verifica_cadeia():
    sink = AuditSink(_sm())
    h1 = await sink.append(make_event(EventType.WAVE_STARTED, "c1", "actor", {"a": 1}))
    h2 = await sink.append(make_event(EventType.WAVE_MERGED, "c1", "actor", {"b": 2}))
    assert h1 != h2
    assert await sink.verify_chain() is True


async def test_trigger_rejeita_update_e_delete():
    sm = _sm()
    async with sm() as s:
        with pytest.raises(DBAPIError):
            await s.execute(text("UPDATE audit.events SET actor = 'x'"))
            await s.commit()
    async with sm() as s:
        with pytest.raises(DBAPIError):
            await s.execute(text("DELETE FROM audit.events"))
            await s.commit()


async def test_repository_emite_evento_de_transicao():
    sink = AuditSink(_sm())
    repo = Repository(_sm(), audit=sink)
    await repo.create_session("tarefa auditada")
    assert await sink.verify_chain() is True
