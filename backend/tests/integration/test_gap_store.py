"""Story 7.2 — GapStore (loop gaps→backlog) com DB real + seed da migration."""
from __future__ import annotations

import pytest

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gap_store import GapStore
from hdd.config import get_settings

pytestmark = pytest.mark.integration


def _store() -> GapStore:
    return GapStore(make_sessionmaker(make_engine(get_settings().pg_dsn)))


async def test_record_e_list_gap():
    st = _store()
    gid = await st.record_gap("wave-x", "escalation", "loop esgotou N", {"n_corrections": 3})
    found = [g for g in await st.list_gaps() if g.id == gid]
    assert len(found) == 1
    assert found[0].stage == "escalation"
    assert found[0].wave_id == "wave-x"
    assert found[0].context.get("n_corrections") == 3
    assert found[0].status == "open"


async def test_filtra_por_status():
    st = _store()
    await st.record_gap("wave-y", "failure", "boom")
    abertos = await st.list_gaps(status="open")
    assert all(g.status == "open" for g in abertos)
    assert await st.list_gaps(status="converted") == [] or all(
        g.status == "converted" for g in await st.list_gaps(status="converted")
    )


async def test_seed_pre_identificado_presente():
    """A migration 0010 semeia os 3 gaps da análise de 2026-06-02 (idempotente)."""
    ids = {g.id for g in await _store().list_gaps()}
    assert {
        "seed-7.2-quota-pause",
        "seed-7.2-quota-exhausted-flag",
        "seed-7.2-quota-detection-fragile",
    } <= ids
