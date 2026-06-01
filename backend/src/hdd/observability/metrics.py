"""Métricas Prometheus (Story 3.5) — RED + métricas de negócio do HDD."""
from __future__ import annotations

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest

REGISTRY = CollectorRegistry()

gate_convocations = Counter(
    "hdd_gate_convocations_total",
    "Convocações de gate humano por tipo (RF-03b).",
    ["gate_type"],
    registry=REGISTRY,
)
quota_acquisitions = Counter(
    "hdd_quota_acquisitions_total",
    "Tentativas de aquisição de lease de quota.",
    ["result"],
    registry=REGISTRY,
)
wave_duration = Histogram(
    "hdd_wave_duration_seconds",
    "Duração de uma onda (wallclock).",
    registry=REGISTRY,
)
sessions_active = Counter(
    "hdd_sessions_started_total",
    "Sessões iniciadas.",
    registry=REGISTRY,
)
wave_failures = Counter(
    "hdd_wave_failures_total",
    "Ondas que falharam no worker (exceção → queue.fail).",
    registry=REGISTRY,
)
merge_failures = Counter(
    "hdd_merge_failures_total",
    "Merges que falharam ao aprovar o gate (Story 6.8).",
    registry=REGISTRY,
)
gate_backlog = Gauge(
    "hdd_gate_backlog",
    "Gates pendentes de decisão (atualizado ao listar no painel).",
    registry=REGISTRY,
)


def render_metrics() -> bytes:
    """Exposição no formato Prometheus (endpoint /metrics)."""
    return generate_latest(REGISTRY)
