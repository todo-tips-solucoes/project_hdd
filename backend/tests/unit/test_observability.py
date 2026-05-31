"""Stories 3.5/3.6 — métricas, tracing e health."""
from __future__ import annotations

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from hdd.observability.health import liveness
from hdd.observability.logging import redact_secrets
from hdd.observability.metrics import gate_convocations, render_metrics
from hdd.observability.tracing import configure_tracing, get_tracer


def test_metrica_incrementa_e_renderiza():
    gate_convocations.labels(gate_type="merge_deploy").inc()
    out = render_metrics().decode()
    assert "hdd_gate_convocations_total" in out


def test_tracing_cria_span():
    exporter = InMemorySpanExporter()
    configure_tracing(exporter=exporter)
    with get_tracer().start_as_current_span("op-teste"):
        pass
    assert any(s.name == "op-teste" for s in exporter.get_finished_spans())


def test_liveness_ok():
    assert liveness()["status"] == "ok"


# --- Story 5.4: redaction de segredos em logs --------------------------------

def _redact(event_dict):
    return redact_secrets(None, "info", event_dict)


def test_redige_chaves_sensiveis():
    out = _redact(
        {
            "session_secret": "abc",
            "clihelper_token": "t0k",
            "webhook_hmac_secret": "h",
            "github_client_secret": "cs",
            "authorization": "Bearer xyz",
            "cookie": "session=...",
        }
    )
    assert all(v == "«redacted»" for v in out.values())


def test_redige_senha_em_dsn_dentro_de_mensagem():
    out = _redact({"event": "falha ao conectar em postgresql://hdd:senha123@db:5432/hdd"})
    assert "senha123" not in out["event"]
    assert "postgresql://hdd:«redacted»@db:5432/hdd" in out["event"]


def test_preserva_telemetria_nao_sensivel():
    out = _redact({"tokens_used": 1500, "idempotency_key": "ev-42", "component": "worker"})
    assert out == {"tokens_used": 1500, "idempotency_key": "ev-42", "component": "worker"}


def test_redige_em_dict_aninhado():
    out = _redact({"payload": {"pg_dsn": "postgresql://u:p@h/db", "ok": True}})
    assert out["payload"]["pg_dsn"] == "«redacted»"
    assert out["payload"]["ok"] is True
