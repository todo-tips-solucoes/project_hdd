"""Story 2.6 — pipeline da Onda (fakes + checkpointer em memória, sem quota)."""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver

from hdd.adapters.orchestrator import WaveOrchestrator
from hdd.contracts.dtos import LlmResult


class FakeLLM:
    def invoke(self, prompt: str) -> LlmResult:
        return LlmResult(text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok")


async def test_happy_path_pausa_no_gate_e_faz_merge():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: True, checkpointer=MemorySaver())
    out = await orch.run_wave("w1", "criar feature")
    assert out["wave_state"] == "awaiting_gate"  # suspendeu no gate de merge
    final = await orch.resume("w1", True)
    assert final["wave_state"] == "merged"
    assert final["result"] == "merged"


async def test_verificacao_reprova_gera_loop_e_escala_sem_merge():
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: False, checkpointer=MemorySaver(), max_corrections=2
    )
    out = await orch.run_wave("w2", "criar feature")
    # n=1,2 (≤2) re-executam; n=3 (>2) escala. Nunca faz merge.
    assert out["n_corrections"] == 3
    assert out["wave_state"] == "escalated"
    assert out.get("result") != "merged"


async def test_gate_rejeitado_nao_faz_merge():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: True, checkpointer=MemorySaver())
    await orch.run_wave("w3", "criar feature")
    final = await orch.resume("w3", False)
    assert final["wave_state"] == "failed"
    assert final["result"] == "rejected"
