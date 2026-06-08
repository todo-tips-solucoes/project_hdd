"""RF-12 / Epic 8 — ApiProvider e helpers auxiliares (mock de subprocess, sem rede)."""
from __future__ import annotations

import subprocess as _sub

import pytest

from hdd.adapters.llm import api as api_mod
from hdd.adapters.llm.api import ApiProvider
from hdd.adapters.llm.subscription import ClaudeSubscriptionProvider
from hdd.adapters.orchestrator.factory import make_provider
from hdd.contracts.dtos import LlmResult
from hdd.domain.errors import QuotaExhausted, TransientError
from hdd.observability.metrics import record_llm_usage, render_metrics


class _FakeProc:
    def __init__(self, returncode: int, stdout: str, stderr: str = "") -> None:
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _patch(monkeypatch, proc, capture: dict):
    def fake_run(cmd, **kw):
        capture["cmd"] = cmd
        capture["env"] = kw.get("env", {})
        capture["cwd"] = kw.get("cwd")
        return proc

    monkeypatch.setattr(api_mod.subprocess, "run", fake_run)


# ---------------------------------------------------------------------------
# Parse de usage → LlmResult
# ---------------------------------------------------------------------------


def test_parse_usage_preenche_campos_de_resultado(monkeypatch):
    payload = (
        '{"result":"feito","session_id":"s1",'
        '"usage":{"input_tokens":10,"output_tokens":20},"total_cost_usd":0.005}'
    )
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, payload), cap)
    res = ApiProvider(api_key="k").invoke("oi")
    assert res.input_tokens == 10
    assert res.output_tokens == 20
    assert res.cost_usd == pytest.approx(0.005)
    assert res.text == "feito"
    assert res.session_id == "s1"


def test_parse_usage_ausente_deixa_campos_none(monkeypatch):
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, '{"result":"ok"}'), cap)
    res = ApiProvider(api_key="k").invoke("oi")
    assert res.input_tokens is None
    assert res.output_tokens is None
    assert res.cost_usd is None


def test_parse_usage_parcial_so_preenche_campos_presentes(monkeypatch):
    payload = '{"result":"ok","usage":{"input_tokens":5}}'
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, payload), cap)
    res = ApiProvider(api_key="k").invoke("oi")
    assert res.input_tokens == 5
    assert res.output_tokens is None
    assert res.cost_usd is None


# ---------------------------------------------------------------------------
# Injeção da ANTHROPIC_API_KEY: env sim, argv não
# ---------------------------------------------------------------------------


def test_api_key_injetada_no_env_nao_em_argv(monkeypatch):
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, '{"result":"ok"}'), cap)
    ApiProvider(api_key="sk-real-key").invoke("oi")
    assert cap["env"].get("ANTHROPIC_API_KEY") == "sk-real-key"
    assert "sk-real-key" not in " ".join(str(a) for a in cap["cmd"])


def test_env_herda_os_environ(monkeypatch):
    monkeypatch.setenv("SOME_VAR", "valor")
    cap: dict = {}
    _patch(monkeypatch, _FakeProc(0, '{"result":"ok"}'), cap)
    ApiProvider(api_key="k").invoke("oi")
    assert cap["env"].get("SOME_VAR") == "valor"


# ---------------------------------------------------------------------------
# Mapeamento de erros
# ---------------------------------------------------------------------------


def test_quota_levanta_quotaexhausted(monkeypatch):
    _patch(monkeypatch, _FakeProc(1, "", "Usage limit reached"), {})
    with pytest.raises(QuotaExhausted):
        ApiProvider(api_key="k").invoke("x")


def test_falha_generica_levanta_transient(monkeypatch):
    _patch(monkeypatch, _FakeProc(2, "", "some error"), {})
    with pytest.raises(TransientError):
        ApiProvider(api_key="k").invoke("x")


def test_timeout_levanta_transient(monkeypatch):
    def boom(cmd, **kw):
        raise _sub.TimeoutExpired(cmd, 1)

    monkeypatch.setattr(api_mod.subprocess, "run", boom)
    with pytest.raises(TransientError):
        ApiProvider(api_key="k", timeout=1).invoke("x")


# ---------------------------------------------------------------------------
# Seleção do provider por llm_driver
# ---------------------------------------------------------------------------


class _FakeSettings:
    model = None
    claude_timeout_s = 120
    llm_driver: str
    anthropic_api_key: str


def test_make_provider_api_retorna_api_provider():
    cfg = _FakeSettings()
    cfg.llm_driver = "api"
    cfg.anthropic_api_key = "test-key"
    assert isinstance(make_provider(cfg), ApiProvider)  # type: ignore[arg-type]


def test_make_provider_subscription_retorna_subscription_provider():
    cfg = _FakeSettings()
    cfg.llm_driver = "subscription"
    cfg.anthropic_api_key = ""
    assert isinstance(make_provider(cfg), ClaudeSubscriptionProvider)  # type: ignore[arg-type]


def test_make_provider_api_passa_api_key():
    cfg = _FakeSettings()
    cfg.llm_driver = "api"
    cfg.anthropic_api_key = "my-key"
    p = make_provider(cfg)  # type: ignore[arg-type]
    assert isinstance(p, ApiProvider)
    assert p._api_key == "my-key"


# ---------------------------------------------------------------------------
# Helper de métricas
# ---------------------------------------------------------------------------


def test_record_llm_usage_incrementa_contadores():
    res = LlmResult(
        text="ok",
        session_id=None,
        exit_code=0,
        quota_exhausted=False,
        raw="ok",
        input_tokens=100,
        output_tokens=50,
        cost_usd=0.01,
    )
    record_llm_usage(res)
    out = render_metrics().decode()
    assert "hdd_llm_tokens_total" in out
    assert "hdd_llm_cost_usd_total" in out


def test_record_llm_usage_noop_para_campos_none():
    res = LlmResult(
        text="ok", session_id=None, exit_code=0, quota_exhausted=False, raw="ok"
    )
    record_llm_usage(res)  # não deve lançar exceção
