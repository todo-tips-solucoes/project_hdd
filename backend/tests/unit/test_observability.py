"""Stories 3.5/3.6 — métricas, tracing e health."""
from __future__ import annotations

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from hdd.observability.health import liveness
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
