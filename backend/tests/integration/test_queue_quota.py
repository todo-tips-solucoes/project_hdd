"""Story 2.2 — fila (SKIP LOCKED) e lease de quota global, com DB real."""
from __future__ import annotations

import pytest
from sqlalchemy import text

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.quota import QuotaLease
from hdd.config import get_settings

pytestmark = pytest.mark.integration


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def test_fila_nao_entrega_o_mesmo_item_duas_vezes():
    sm = _sm()
    q = WorkQueue(sm)
    wid = await q.enqueue("payload-unico")
    seen: set[str] = set()
    while True:
        claimed = await q.claim()
        if claimed is None:
            break
        assert claimed[0] not in seen  # nunca duas vezes
        seen.add(claimed[0])
        await q.complete(claimed[0])
    assert wid in seen


async def test_quota_respeita_teto_global():
    sm = _sm()
    ql = QuotaLease(sm)
    # estado limpo
    async with sm() as s:
        await s.execute(text("UPDATE app.quota_counter SET in_use = 0, max_concurrent = 2"))
        await s.commit()

    assert await ql.acquire() is True
    assert await ql.acquire() is True
    assert await ql.acquire() is False  # teto = 2 atingido → aguardar
    await ql.release()
    assert await ql.acquire() is True  # liberou um slot
    await ql.release()
    await ql.release()
