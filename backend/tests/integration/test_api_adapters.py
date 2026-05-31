"""Epic 4 — adapters com DB real (opt-in): gate autenticado, webhook inbox,
leaky-bucket do notifier e EventReader. Comportamento, não só construção (D-053)."""
from __future__ import annotations

import time

import pytest
from sqlalchemy import text

from hdd.adapters.audit.reader import EventReader
from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.webhook_inbox import WebhookInbox
from hdd.adapters.notifier import ClihelperNotifier
from hdd.config import get_settings
from hdd.contracts.events import EventType, make_event
from hdd.domain.capability import GateType
from hdd.domain.gate import GateStatus

pytestmark = pytest.mark.integration


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


# --- Story 4.3: aprovação autenticada (sem PIN) ---------------------------
async def test_resolve_authenticated_aprova_e_e_idempotente():
    st = GateStore(_sm())
    gid, _pin = await st.open_gate("wave-auth-1", GateType.MERGE_DEPLOY, "merge?")
    assert await st.resolve_authenticated(gid, approve=True) == GateStatus.APPROVED
    # idempotente: estado terminal não muda
    assert await st.resolve_authenticated(gid, approve=False) == GateStatus.APPROVED


async def test_resolve_authenticated_rejeita():
    st = GateStore(_sm())
    gid, _pin = await st.open_gate("wave-auth-2", GateType.INFRA, "mexer infra?")
    assert await st.resolve_authenticated(gid, approve=False) == GateStatus.REJECTED


async def test_resolve_authenticated_expirado_nao_auto_aprova():
    st = GateStore(_sm(), ttl_seconds=-1)
    gid, _pin = await st.open_gate("wave-auth-3", GateType.MERGE_DEPLOY, "x")
    assert await st.resolve_authenticated(gid, approve=True) == GateStatus.EXPIRED


async def test_detail_retorna_contexto():
    st = GateStore(_sm())
    gid, _pin = await st.open_gate("wave-auth-4", GateType.SPEND_CREDENTIALS, "gastar?")
    d = await st.detail(gid)
    assert d is not None
    assert d.wave_id == "wave-auth-4"
    assert d.status == GateStatus.PENDING
    assert await st.detail("inexistente") is None


# --- Story 4.5: dedup idempotente do webhook ------------------------------
async def test_webhook_inbox_dedup():
    inbox = WebhookInbox(_sm())
    key = f"idem-{time.monotonic_ns()}"
    assert await inbox.seen(key, "n8n") is False  # primeira vez
    assert await inbox.seen(key, "n8n") is True  # duplicata


# --- Story 4.4: leaky-bucket persistente (≤1 req/s) -----------------------
async def test_notifier_leaky_bucket_espaca_envios():
    sm = _sm()
    async with sm() as s:
        await s.execute(text("UPDATE app.notifier_bucket SET available_at = now()"))
        await s.commit()

    times: list[float] = []

    async def sender(_msg: str) -> None:
        times.append(time.monotonic())

    n = ClihelperNotifier(sm, min_interval_s=0.2, sender=sender)
    await n.notify("a")
    await n.notify("b")
    await n.notify("c")

    assert len(times) == 3
    assert times[1] - times[0] >= 0.18
    assert times[2] - times[1] >= 0.18


# --- Story 4.2: EventReader tail da auditoria -----------------------------
async def test_event_reader_tail():
    sm = _sm()
    sink = AuditSink(sm)
    reader = EventReader(sm)
    before = await reader.latest_seq()
    await sink.append(make_event(EventType.WAVE_STARTED, "corr-r1", actor="t", payload={}))
    await sink.append(make_event(EventType.WAVE_VERIFIED, "corr-r1", actor="t", payload={}))
    recs = await reader.after(before)
    assert len(recs) == 2
    assert recs[0].type == str(EventType.WAVE_STARTED)
    assert recs[1].seq > recs[0].seq
    assert await reader.latest_seq() == before + 2
