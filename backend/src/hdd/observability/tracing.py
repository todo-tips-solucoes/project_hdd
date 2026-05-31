"""Tracing distribuído (Story 3.6) — OpenTelemetry.

Configura um TracerProvider. O exporter é injetável: console/OTLP em produção
(Tempo/Grafana), InMemory nos testes. Liga API→orquestrador→worker→claude -p.
"""
from __future__ import annotations

from typing import Any

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor


def configure_tracing(service_name: str = "hdd", exporter: Any | None = None) -> None:
    provider = TracerProvider()
    if exporter is not None:
        provider.add_span_processor(SimpleSpanProcessor(exporter))
    trace.set_tracer_provider(provider)


def get_tracer(name: str = "hdd") -> trace.Tracer:
    return trace.get_tracer(name)
