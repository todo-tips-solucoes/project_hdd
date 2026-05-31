"""Portas (Protocols) — interfaces que os adapters implementam.

Hexagonal: a aplicação depende destas abstrações, nunca de implementações
concretas. A composição (injeção dos adapters) acontece em api/cli.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from .dtos import LlmResult, PrRef
from .events import EventEnvelope


@runtime_checkable
class LLMProvider(Protocol):
    """Motor LLM. Driver `subscription` (claude -p) ou `api` (escala) — RF-12."""

    def invoke(self, prompt: str) -> LlmResult: ...


@runtime_checkable
class AuditSink(Protocol):
    """Trilha de auditoria append-only com hash-chain — RF-04."""

    async def append(self, event: EventEnvelope) -> str: ...


@runtime_checkable
class Notifier(Protocol):
    """Notificação assíncrona ao operador (WhatsApp/clihelper) — RF-08."""

    async def notify(self, message: str) -> None: ...


@runtime_checkable
class Vcs(Protocol):
    """Integração GitHub (branch/commit/PR) — RF-09."""

    async def open_pr(self, branch: str, title: str, body: str) -> PrRef: ...


@runtime_checkable
class Memory(Protocol):
    """Memória de contexto semântica (pgvector) — RF-05."""

    async def recall(self, query: str, limit: int = 5) -> list[str]: ...
    async def remember(self, text: str) -> None: ...


@runtime_checkable
class Orchestrator(Protocol):
    """Conduz uma onda de trabalho de ponta a ponta — RF-01."""

    async def run_wave(self, thread_id: str, task: str) -> dict[str, object]: ...
