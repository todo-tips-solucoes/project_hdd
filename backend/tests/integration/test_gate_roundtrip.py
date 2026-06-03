"""Story 6.2 — round-trip do gate com DB e checkpoint Postgres reais (opt-in).

Sem quota: o orquestrador roda com um LLM falso; o `resume` após o gate só
percorre o nó `gate` → END (nunca invocaria `claude -p` mesmo em produção).

Cobre as duas pontas:
1. Worker: a onda pausa no gate → `bridge_after_wave` projeta AWAITING_GATE em
   app.waves e ABRE o gate em app.gates.
2. Painel: aprovar/rejeitar retoma a onda do checkpoint (`orchestrator.resume`),
   projeta MERGED/FAILED e audita — idempotente (2º POST não reemite).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.repository import Repository
from hdd.adapters.orchestrator import WaveOrchestrator
from hdd.api.app import create_app
from hdd.api.deps import ResumeOutcome, get_wave_resumer, require_user
from hdd.api.schemas import User
from hdd.config import get_settings
from hdd.contracts.dtos import LlmResult
from hdd.domain.gate import GateStatus
from hdd.domain.wave import WaveState
from hdd.worker.runner import bridge_after_wave

pytestmark = pytest.mark.integration


class _FakeLLM:
    def invoke(self, prompt: str) -> LlmResult:
        return LlmResult(text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok")


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def _new_wave(repo: Repository, task: str) -> str:
    """Cria sessão + onda e devolve o wave_id (== thread_id da onda)."""
    sid = await repo.create_session(task)
    return await repo.create_wave(sid)


async def test_bridge_abre_gate_e_projeta_awaiting_gate() -> None:
    sm = _sm()
    repo, gate_store = Repository(sm), GateStore(sm)
    wid = await _new_wave(repo, "onda que pausa no gate")

    # Simula o retorno do orquestrador ao pausar no interrupt() de merge.
    await bridge_after_wave(repo, gate_store, wid, {"wave_state": "awaiting_gate"})

    states = {w: st for w, _sid, st, _n in await repo.list_waves()}
    assert states[wid] == str(WaveState.AWAITING_GATE)  # projeção do checkpoint
    pending = {w for _g, w, _t, _r in await gate_store.list_pending()}
    assert wid in pending  # gate aberto para o painel


@pytest.mark.parametrize(
    ("approve", "verb", "final_status", "final_state"),
    [
        (True, "approve", GateStatus.APPROVED, WaveState.MERGED),
        (False, "reject", GateStatus.REJECTED, WaveState.FAILED),
    ],
)
async def test_resume_apos_decisao_retoma_a_onda_e_projeta_estado(
    approve: bool, verb: str, final_status: GateStatus, final_state: WaveState
) -> None:
    sm = _sm()
    dsn = get_settings().pg_dsn
    repo, gate_store = Repository(sm, AuditSink(sm)), GateStore(sm)
    wid = await _new_wave(repo, "round-trip do gate")

    # 1) Roda a onda (checkpoint Postgres real) até pausar no gate de merge.
    async with AsyncPostgresSaver.from_conn_string(dsn) as cp:
        await cp.setup()
        out = await WaveOrchestrator(
            _FakeLLM(), verify=lambda _ws: (True, ""), checkpointer=cp
        ).run_wave(wid, "round-trip do gate")
    assert out["wave_state"] == str(WaveState.AWAITING_GATE)

    # 2) Ponte do worker: projeta AWAITING_GATE + abre o gate.
    await bridge_after_wave(repo, gate_store, wid, out)
    gid = next(g for g, w, _t, _r in await gate_store.list_pending() if w == wid)

    # 3) Resumer real: retoma o MESMO checkpoint (thread_id == wid), sem quota.
    async def _resume(thread_id: str, decision: bool) -> ResumeOutcome:
        async with AsyncPostgresSaver.from_conn_string(dsn) as cp2:
            await cp2.setup()
            result = await WaveOrchestrator(
                _FakeLLM(), verify=lambda _ws: (True, ""), checkpointer=cp2
            ).resume(thread_id, decision)
        return ResumeOutcome(str(result.get("wave_state", "")))

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_wave_resumer] = lambda: _resume
    with TestClient(app) as c:
        resp = c.post(f"/api/gates/{gid}/{verb}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == str(final_status)
        # idempotência: 2º POST não muda nada (gate já terminal).
        again = c.post(f"/api/gates/{gid}/{verb}")
        assert again.json()["status"] == str(final_status)

    assert await gate_store.status(gid) == final_status
    states = {w: st for w, _sid, st, _n in await repo.list_waves()}
    assert states[wid] == str(final_state)  # app.waves projetado do checkpoint


async def test_bridge_persiste_n_corrections_no_banco() -> None:
    sm = _sm()
    repo, gate_store = Repository(sm), GateStore(sm)
    wid = await _new_wave(repo, "n_corrections round-trip")

    await bridge_after_wave(
        repo,
        gate_store,
        wid,
        {"wave_state": str(WaveState.AWAITING_GATE), "n_corrections": 5},
    )

    waves = {w: n for w, _sid, _st, n in await repo.list_waves()}
    assert waves[wid] == 5
