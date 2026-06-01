"""Story 2.6/6.7 — pipeline da Onda (fakes + checkpointer em memória, sem quota)."""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver

from hdd.adapters.orchestrator import WaveOrchestrator
from hdd.contracts.dtos import LlmResult, PrRef


class FakeLLM:
    def invoke(self, prompt: str) -> LlmResult:
        return LlmResult(text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok")


class FakeVcs:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, str]] = []

    async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
        self.calls.append((branch, title, body))
        return PrRef(number=42, url="https://github.com/x/y/pull/42", branch=branch)


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


# --- Story 6.7: nó de PR rascunho -----------------------------------------
async def test_pr_aberto_antes_do_gate():
    vcs = FakeVcs()
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: True, checkpointer=MemorySaver(), vcs=vcs
    )
    out = await orch.run_wave("w-pr", "criar feature", workspace="/ws", branch="hdd/wave-w-pr")
    assert out["wave_state"] == "awaiting_gate"  # PR aberto, depois pausa no gate
    assert out["pr_number"] == 42
    assert out["pr_url"].endswith("/pull/42")
    assert vcs.calls and vcs.calls[0][0] == "hdd/wave-w-pr"  # branch da onda
    assert vcs.calls[0][1].startswith("HDD: ")  # título derivado da tarefa


async def test_verificacao_reprovada_nao_abre_pr():
    vcs = FakeVcs()
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: False, checkpointer=MemorySaver(), max_corrections=1, vcs=vcs
    )
    out = await orch.run_wave("w-nopr", "x", workspace="/ws", branch="hdd/wave-w-nopr")
    assert out["wave_state"] == "escalated"
    assert vcs.calls == []  # reprovado → loop/escala, nunca abre PR


async def test_falha_ao_abrir_pr_nao_trava_a_onda():
    class BoomVcs:
        async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
            raise RuntimeError("gh indisponível")

    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: True, checkpointer=MemorySaver(), vcs=BoomVcs()
    )
    out = await orch.run_wave("w-boom", "x", workspace="/ws", branch="b")
    assert out["wave_state"] == "awaiting_gate"  # chega ao gate apesar do erro
    assert "gh indisponível" in out.get("pr_error", "")
    assert not out.get("pr_url")


async def test_sem_vcs_nem_branch_segue_ao_gate_sem_pr():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: True, checkpointer=MemorySaver())
    out = await orch.run_wave("w-novcs", "x")  # sem workspace/branch/vcs
    assert out["wave_state"] == "awaiting_gate"
    assert not out.get("pr_url")
