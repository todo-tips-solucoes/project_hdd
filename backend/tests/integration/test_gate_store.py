"""Story 2.5 — GateStore (PIN single-use, rate-limit, timeout) com DB real."""
from __future__ import annotations

import pytest

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.config import get_settings
from hdd.domain.capability import GateType
from hdd.domain.gate import GateStatus

pytestmark = pytest.mark.integration


def _store(**kw) -> GateStore:
    engine = make_engine(get_settings().pg_dsn)
    return GateStore(make_sessionmaker(engine), **kw)


async def test_aprovacao_com_pin_correto():
    st = _store()
    gid, pin = await st.open_gate("wave-1", GateType.MERGE_DEPLOY, "aprovar merge?")
    assert await st.resolve(gid, pin, approve=True) == GateStatus.APPROVED


async def test_rejeicao_com_pin_correto():
    st = _store()
    gid, pin = await st.open_gate("wave-1b", GateType.MERGE_DEPLOY, "x")
    assert await st.resolve(gid, pin, approve=False) == GateStatus.REJECTED


async def test_pin_errado_conta_tentativa_e_bloqueia():
    st = _store(max_attempts=2)
    gid, _pin = await st.open_gate("wave-2", GateType.DESTRUCTIVE_DATA, "x")
    assert await st.resolve(gid, "000000", approve=True) == GateStatus.PENDING  # 1
    assert await st.resolve(gid, "000000", approve=True) == GateStatus.PENDING  # 2
    assert await st.resolve(gid, "000000", approve=True) == GateStatus.LOCKED  # 3 > 2


async def test_timeout_expira_sem_auto_aprovar():
    st = _store(ttl_seconds=-1)  # já expirado
    gid, pin = await st.open_gate("wave-3", GateType.MERGE_DEPLOY, "x")
    assert await st.resolve(gid, pin, approve=True) == GateStatus.EXPIRED
