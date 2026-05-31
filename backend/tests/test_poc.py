"""PoC de fundação (Story 1.1) — os 5 critérios do gate como testes executáveis."""
from __future__ import annotations

import os
import subprocess
import sys

import pytest

from hdd_poc import db, engine, llm
from hdd_poc.llm import ClaudeSubscriptionProvider, detect_quota

TASK = "registrar um marcador"


def _run_module(args, extra_env=None):
    env = dict(os.environ)
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-m", "hdd_poc.runner", *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=180,
    )


@pytest.fixture(autouse=True)
async def _setup():
    await db.setup_effects()


# ---------------------------------------------------------------------------
# Critério 1 — idempotência de nó que fez commit sob KILL → resume
# ---------------------------------------------------------------------------
async def test_crit1_idempotencia_sob_kill():
    tid = "poc-crit1"
    await db.reset(tid)

    # (a) Roda num processo separado que é MORTO logo após o commit.
    p = _run_module(["run", tid, TASK], {"HDD_CRASH_AFTER_COMMIT": "1"})
    assert p.returncode == 137, f"esperado kill(137); stderr={p.stderr}"
    assert await db.count_effects(tid) == 1  # o efeito ocorreu uma vez

    # (b) Retoma do checkpoint: o nó `execute` re-executa, mas o commit é idempotente.
    await engine.continue_run(tid)
    assert await db.count_effects(tid) == 1  # NÃO duplicou

    # (c) Aprova o gate e conclui.
    await engine.resume_gate(tid, True)
    snap = await engine.get_state(tid)
    assert snap.values.get("approved") is True


# ---------------------------------------------------------------------------
# Critério 2 — contexto reconstruído do banco; `claude -p` nunca usa --resume
# ---------------------------------------------------------------------------
async def test_crit2_sem_claude_resume(monkeypatch):
    captured = {}

    class FakeProc:
        returncode = 0
        stdout = '{"result":"FEITO","session_id":"sess-abc"}'
        stderr = ""

    def fake_run(cmd, **kw):
        captured["cmd"] = cmd
        return FakeProc()

    monkeypatch.setattr(llm.subprocess, "run", fake_run)
    res = ClaudeSubscriptionProvider().invoke("x")

    assert "--resume" not in captured["cmd"]  # durabilidade vem do checkpoint, não da sessão
    assert res.session_id == "sess-abc"  # session_id é capturado, mas não usado p/ correção


# ---------------------------------------------------------------------------
# Critério 3 — interrupt() retoma sem repetir efeitos (nó puro até o interrupt)
# ---------------------------------------------------------------------------
async def test_crit3_interrupt_puro():
    tid = "poc-crit3"
    await db.reset(tid)

    await engine.run_until_gate(tid, TASK)  # execute (1 efeito) e para no interrupt
    assert await db.count_effects(tid) == 1

    await engine.resume_gate(tid, True)  # retoma do gate
    assert await db.count_effects(tid) == 1  # gate não cria efeito; execute não repete

    snap = await engine.get_state(tid)
    assert snap.values.get("approved") is True


# ---------------------------------------------------------------------------
# Critério 4 — viabilidade de --model no driver subscription
# ---------------------------------------------------------------------------
async def test_crit4_model_flag():
    res = ClaudeSubscriptionProvider(model="haiku").invoke("Responda apenas: OK")
    assert res.exit_code == 0, f"--model rejeitado? raw={res.raw}"
    assert res.text.strip(), "sem resposta do modelo"


# ---------------------------------------------------------------------------
# Critério 5 — detecção de exaustão de quota (lógica isolada, sem chamar o CLI)
# ---------------------------------------------------------------------------
def test_crit5_deteccao_quota():
    assert detect_quota("", "Usage limit reached", 1) is True
    assert detect_quota("", "rate limit exceeded", 1) is True
    assert detect_quota("ok", "", 0) is False  # sucesso normal não é quota
