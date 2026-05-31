"""Métricas Prometheus (Story 3.5) — RED + métricas de negócio do HDD."""
from __future__ import annotations

from prometheus_client import CollectorRegistry, Counter, Histogram, generate_latest

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


def render_metrics() -> bytes:
    """Exposição no formato Prometheus (endpoint /metrics)."""
    return generate_latest(REGISTRY)
