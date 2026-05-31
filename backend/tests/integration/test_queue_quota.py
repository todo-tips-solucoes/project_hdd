"""Story 2.2/5.2 — fila (SKIP LOCKED) e lease de quota global, com DB real."""
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


async def _reset(sm, max_c: int) -> None:
    async with sm() as s:
        await s.execute(text("DELETE FROM app.quota_lease"))
        await s.execute(text("DELETE FROM app.work_queue"))
        await s.execute(
            text("UPDATE app.quota_counter SET max_concurrent = :m WHERE id = 1"),
            {"m": max_c},
        )
        await s.commit()


async def test_fila_nao_entrega_o_mesmo_item_duas_vezes():
    sm = _sm()
    await _reset(sm, max_c=2)
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


async def test_requeue_devolve_a_pendente_e_fail_tira_da_fila():
    sm = _sm()
    await _reset(sm, max_c=2)
    q = WorkQueue(sm)
    wid = await q.enqueue("p")

    first = await q.claim()
    assert first is not None and first[0] == wid
    assert await q.claim() is None  # já 'running', não reentregue

    await q.requeue(wid)
    again = await q.claim()
    assert again is not None and again[0] == wid  # voltou a 'pending'

    await q.fail(wid)
    assert await q.claim() is None  # 'failed' não é reentregue


async def test_quota_respeita_teto_global():
    sm = _sm()
    await _reset(sm, max_c=2)
    ql = QuotaLease(sm)

    l1 = await ql.acquire("w1")
    l2 = await ql.acquire("w2")
    assert l1 and l2
    assert await ql.acquire("w3") is None  # teto = 2 → aguardar

    await ql.release(l1)
    l3 = await ql.acquire("w3")
    assert l3  # slot liberado
    await ql.release(l2)
    await ql.release(l3)
    assert await ql.active_count() == 0


async def test_reaper_recupera_slot_de_worker_morto():
    sm = _sm()
    await _reset(sm, max_c=1)
    # TTL negativo simula um worker que morreu sem liberar (lease já expirado).
    dead = QuotaLease(sm, ttl_s=-1)
    leaked = await dead.acquire("w-morto")
    assert leaked is not None  # slot ocupado por um lease morto

    alive = QuotaLease(sm, ttl_s=120)
    revived = await alive.acquire("w-vivo")
    assert revived is not None  # reaper limpou o lease morto e cedeu o slot
    assert await alive.active_count() == 1  # só o lease vivo
    await alive.release(revived)


async def test_renew_estende_e_falha_em_lease_inexistente():
    sm = _sm()
    await _reset(sm, max_c=1)
    ql = QuotaLease(sm, ttl_s=120)
    lease = await ql.acquire("w1")
    assert lease is not None

    assert await ql.renew(lease) is True
    assert await ql.renew("inexistente") is False  # nada para renovar
    await ql.release(lease)
