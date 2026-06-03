"""Story 6.3 — verificador do sandbox (fakes, sem Docker/quota).

Prova a lógica: exit 0 → verdadeiro; exit ≠ 0 → falso (loop de correção); sem
workspace → defere ao gate; falha de execução do sandbox → falso. E a fiação no
orquestrador: reprovado escala, aprovado vai ao gate.
"""
from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver

from hdd.adapters.orchestrator import WaveOrchestrator
from hdd.adapters.sandbox.runner import SandboxConfig, SandboxResult
from hdd.adapters.sandbox.verifier import make_sandbox_verifier
from hdd.config.settings import Settings
from hdd.contracts.dtos import LlmResult


class FakeRunner:
    def __init__(self, exit_code: int = 0, *, boom: bool = False) -> None:
        self.exit_code = exit_code
        self.boom = boom
        self.calls: list[tuple[list[str], SandboxConfig]] = []

    def run(self, command: list[str], cfg: SandboxConfig) -> SandboxResult:
        self.calls.append((command, cfg))
        if self.boom:
            raise RuntimeError("docker indisponível")
        return SandboxResult(self.exit_code, "out", "err")


class FakeLLM:
    def invoke(self, prompt: str) -> LlmResult:
        return LlmResult(text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok")


def test_verify_true_quando_testes_passam() -> None:
    runner = FakeRunner(0)
    settings = Settings(
        verify_command="pytest -q", sandbox_image="img", sandbox_network="none"
    )
    assert make_sandbox_verifier(settings, runner=runner)("/ws") == (True, "")
    command, cfg = runner.calls[0]
    assert command == ["pytest", "-q"]  # verify_command via shlex
    assert cfg.workspace == "/ws"
    assert cfg.image == "img"
    assert cfg.network == "none"  # deny-all, sem credenciais


def test_verify_false_quando_testes_falham() -> None:
    ok, _ = make_sandbox_verifier(Settings(), runner=FakeRunner(1))("/ws")
    assert ok is False


def test_verify_sem_workspace_defere_ao_gate() -> None:
    runner = FakeRunner(1)  # exit 1 não importa: nem deve rodar
    assert make_sandbox_verifier(Settings(), runner=runner)("") == (True, "")
    assert runner.calls == []  # sandbox não foi invocado


def test_verify_falha_de_execucao_dispara_correcao() -> None:
    ok, _ = make_sandbox_verifier(Settings(), runner=FakeRunner(boom=True))("/ws")
    assert ok is False


async def test_orquestrador_com_verify_reprovado_escala() -> None:
    verify = make_sandbox_verifier(Settings(), runner=FakeRunner(1))
    orch = WaveOrchestrator(
        FakeLLM(), verify=verify, checkpointer=MemorySaver(), max_corrections=1
    )
    out = await orch.run_wave("wv-red", "tarefa", workspace="/ws")
    assert out["wave_state"] == "escalated"  # reprovado → loop → escala, sem merge


async def test_orquestrador_com_verify_aprovado_vai_ao_gate() -> None:
    verify = make_sandbox_verifier(Settings(), runner=FakeRunner(0))
    orch = WaveOrchestrator(FakeLLM(), verify=verify, checkpointer=MemorySaver())
    out = await orch.run_wave("wv-green", "tarefa", workspace="/ws")
    assert out["wave_state"] == "awaiting_gate"  # aprovado → gate humano de merge


def test_devolve_output_na_reprovacao() -> None:
    runner = FakeRunner(1)  # SandboxResult(1, "out", "err")
    _, output = make_sandbox_verifier(Settings(), runner=runner)("/ws")
    assert output == "errout"  # stderr + stdout


def test_ok_nao_devolve_output() -> None:
    assert make_sandbox_verifier(Settings(), runner=FakeRunner(0))("/ws") == (True, "")


def test_verify_propaga_oracle_dir_para_config() -> None:
    runner = FakeRunner(0)
    settings = Settings(oracle_dir="/secrets/oracle", sandbox_image="img")
    make_sandbox_verifier(settings, runner=runner)("/ws")
    _, cfg = runner.calls[0]
    assert cfg.oracle_dir == "/secrets/oracle"


def test_verify_sem_oracle_nao_monta_volume() -> None:
    runner = FakeRunner(0)
    settings = Settings(sandbox_image="img")  # oracle_dir omitido → None
    make_sandbox_verifier(settings, runner=runner)("/ws")
    _, cfg = runner.calls[0]
    assert cfg.oracle_dir is None
