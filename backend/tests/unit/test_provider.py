"""Story 1.5 — contrato do driver subscription (mock do subprocess, sem quota)."""
from __future__ import annotations

import pytest

from hdd.adapters.llm import subscription as sub
from hdd.adapters.llm.subscription import ClaudeSubscriptionProvider
from hdd.domain.errors import QuotaExhausted, TransientError


class _FakeProc:
    def __init__(self, returncode: int, stdout: str, stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _patch(monkeypatch, proc, capture: dict):
    def fake_run(cmd, **kw):
        capture["cmd"] = cmd
        return proc

    monkeypatch.setattr(sub.subprocess, "run", fake_run)


def test_cmd_tem_flags_obrigatorias(monkeypatch):
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, '{"result":"FEITO","session_id":"s1"}'), cap)
    res = ClaudeSubscriptionProvider(model="haiku").invoke("oi")
    cmd = cap["cmd"]
    assert "--output-format" in cmd and "json" in cmd
    assert "--model" in cmd and "haiku" in cmd
    assert "--disallowedTools" in cmd  # mitigação da descoberta da PoC
    assert "Write" in cmd
    assert res.text == "FEITO" and res.session_id == "s1"


def test_exit_zero_retorna_result(monkeypatch):
    _patch(monkeypatch, _FakeProc(0, '{"result":"OK"}'), {})
    res = ClaudeSubscriptionProvider().invoke("x")
    assert res.exit_code == 0
    assert res.quota_exhausted is False


def test_quota_levanta_quotaexhausted(monkeypatch):
    _patch(monkeypatch, _FakeProc(1, "", "Usage limit reached"), {})
    with pytest.raises(QuotaExhausted):
        ClaudeSubscriptionProvider().invoke("x")


def test_falha_generica_levanta_transient(monkeypatch):
    _patch(monkeypatch, _FakeProc(2, "", "some other failure"), {})
    with pytest.raises(TransientError):
        ClaudeSubscriptionProvider().invoke("x")
