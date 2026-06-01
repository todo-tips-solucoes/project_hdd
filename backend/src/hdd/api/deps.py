"""Composição/injeção da API (entrypoint) — constrói os adapters a partir de Settings.

Replica o padrão de wiring da CLI. Cada provider é um Depends do FastAPI; os testes
substituem qualquer um via `app.dependency_overrides` sem tocar a app.
"""
from __future__ import annotations

import functools
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.adapters.audit.reader import EventReader
from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.repository import Repository
from hdd.adapters.db.webhook_inbox import WebhookInbox
from hdd.adapters.notifier import ClihelperNotifier
from hdd.adapters.orchestrator.factory import open_orchestrator
from hdd.application.notifications import NotificationService
from hdd.config import get_settings

from .schemas import User


@dataclass(frozen=True)
class ResumeOutcome:
    """Resultado do resume pós-gate: estado final + erro de merge (se houve)."""

    wave_state: str
    merge_error: str | None = None


# Retoma uma onda a partir do checkpoint após a decisão de gate. Injetável →
# testes usam um fake (sem quota).
WaveResumer = Callable[[str, bool], Awaitable[ResumeOutcome]]


@functools.lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


def get_repository() -> Repository:
    return Repository(get_sessionmaker(), AuditSink(get_sessionmaker()))


def get_gate_store() -> GateStore:
    return GateStore(get_sessionmaker())


def get_work_queue() -> WorkQueue:
    return WorkQueue(get_sessionmaker())


def get_wave_resumer() -> WaveResumer:
    """Resume pós-gate (Story 6.2). O grafo só roda o nó `gate` → END: SEM `claude -p`."""
    settings = get_settings()

    async def _resume(thread_id: str, approve: bool) -> ResumeOutcome:
        async with open_orchestrator(settings) as orchestrator:
            result = await orchestrator.resume(thread_id, approve)
        merge_error = result.get("merge_error")
        return ResumeOutcome(
            str(result.get("wave_state", "")),
            str(merge_error) if merge_error else None,
        )

    return _resume


def get_event_reader() -> EventReader:
    return EventReader(get_sessionmaker())


def get_audit() -> AuditSink:
    return AuditSink(get_sessionmaker())


def get_webhook_inbox() -> WebhookInbox:
    return WebhookInbox(get_sessionmaker())


def get_notifier() -> ClihelperNotifier:
    s = get_settings()
    return ClihelperNotifier(
        get_sessionmaker(),
        base_url=s.clihelper_base_url,
        token=s.clihelper_token,
        min_interval_s=s.notifier_min_interval_s,
    )


def get_notifications() -> NotificationService:
    return NotificationService(get_notifier(), get_settings().panel_base_url)


def require_user(request: Request) -> User:
    """Guard de sessão: rotas do painel exigem OAuth válido (Story 4.1)."""
    data = request.session.get("user")
    if not data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "não autenticado")
    return User.model_validate(data)
