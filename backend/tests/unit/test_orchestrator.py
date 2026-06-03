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
        self.merged: list[int] = []

    async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
        self.calls.append((branch, title, body))
        return PrRef(number=42, url="https://github.com/x/y/pull/42", branch=branch)

    async def merge_pr(self, pr_number: int) -> None:
        self.merged.append(pr_number)


async def test_happy_path_pausa_no_gate_e_faz_merge():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver())
    out = await orch.run_wave("w1", "criar feature")
    assert out["wave_state"] == "awaiting_gate"  # suspendeu no gate de merge
    final = await orch.resume("w1", True)
    assert final["wave_state"] == "merged"
    assert final["result"] == "merged"


async def test_feedback_da_verificacao_injetado_na_correcao():
    prompts: list[str] = []

    class RecordingLLM:
        def invoke(self, prompt: str) -> LlmResult:
            prompts.append(prompt)
            return LlmResult(
                text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok"
            )

    tentativas = 0

    def once_failing(ws: str) -> tuple[bool, str]:
        nonlocal tentativas
        tentativas += 1
        return (False, "saída de erro") if tentativas == 1 else (True, "")

    orch = WaveOrchestrator(
        RecordingLLM(), verify=once_failing, checkpointer=MemorySaver(), max_corrections=3
    )
    await orch.run_wave("w-fb", "tarefa")
    execute_prompts = [p for p in prompts if p.startswith("Implemente")]
    assert len(execute_prompts) == 2
    assert "saída de erro" not in execute_prompts[0]
    assert "saída de erro" in execute_prompts[1]


async def test_verificacao_reprova_gera_loop_e_escala_sem_merge():
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (False, ""), checkpointer=MemorySaver(), max_corrections=2
    )
    out = await orch.run_wave("w2", "criar feature")
    # n=1,2 (≤2) re-executam; n=3 (>2) escala. Nunca faz merge.
    assert out["n_corrections"] == 3
    assert out["wave_state"] == "escalated"
    assert out.get("result") != "merged"


async def test_gate_rejeitado_nao_faz_merge():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver())
    await orch.run_wave("w3", "criar feature")
    final = await orch.resume("w3", False)
    assert final["wave_state"] == "failed"
    assert final["result"] == "rejected"


# --- Story 6.7: nó de PR rascunho -----------------------------------------
async def test_pr_aberto_antes_do_gate():
    vcs = FakeVcs()
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver(), vcs=vcs
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
        FakeLLM(),
        verify=lambda ws: (False, ""),
        checkpointer=MemorySaver(),
        max_corrections=1,
        vcs=vcs,
    )
    out = await orch.run_wave("w-nopr", "x", workspace="/ws", branch="hdd/wave-w-nopr")
    assert out["wave_state"] == "escalated"
    assert vcs.calls == []  # reprovado → loop/escala, nunca abre PR


async def test_falha_ao_abrir_pr_nao_trava_a_onda():
    class BoomVcs:
        async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
            raise RuntimeError("gh indisponível")

    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver(), vcs=BoomVcs()
    )
    out = await orch.run_wave("w-boom", "x", workspace="/ws", branch="b")
    assert out["wave_state"] == "awaiting_gate"  # chega ao gate apesar do erro
    assert "gh indisponível" in out.get("pr_error", "")
    assert not out.get("pr_url")


async def test_sem_vcs_nem_branch_segue_ao_gate_sem_pr():
    orch = WaveOrchestrator(FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver())
    out = await orch.run_wave("w-novcs", "x")  # sem workspace/branch/vcs
    assert out["wave_state"] == "awaiting_gate"
    assert not out.get("pr_url")


# --- Story 6.8: merge real ao aprovar o gate ------------------------------
async def test_aprovar_gate_mergeia_o_pr():
    vcs = FakeVcs()
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver(), vcs=vcs
    )
    await orch.run_wave("w-m", "x", workspace="/ws", branch="b")  # abre PR #42
    final = await orch.resume("w-m", True)
    assert final["wave_state"] == "merged"
    assert vcs.merged == [42]  # merge_pr chamado com o número do PR


async def test_rejeitar_gate_nao_mergeia():
    vcs = FakeVcs()
    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver(), vcs=vcs
    )
    await orch.run_wave("w-r", "x", workspace="/ws", branch="b")
    final = await orch.resume("w-r", False)
    assert final["wave_state"] == "failed"
    assert vcs.merged == []  # rejeição nunca mergeia


async def test_merge_falho_nao_trava_o_resume():
    class HalfVcs:
        async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
            return PrRef(number=7, url="u", branch=branch)

        async def merge_pr(self, pr_number: int) -> None:
            raise RuntimeError("merge bloqueado por checks")

    orch = WaveOrchestrator(
        FakeLLM(), verify=lambda ws: (True, ""), checkpointer=MemorySaver(), vcs=HalfVcs()
    )
    await orch.run_wave("w-mf", "x", workspace="/ws", branch="b")
    final = await orch.resume("w-mf", True)
    assert final["wave_state"] == "merged"  # decisão humana de merge mantém-se
    assert "merge bloqueado" in final.get("merge_error", "")
