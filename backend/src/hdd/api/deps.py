"""Composição/injeção da API (entrypoint) — constrói os adapters a partir de Settings.

Replica o padrão de wiring da CLI. Cada provider é um Depends do FastAPI; os testes
substituem qualquer um via `app.dependency_overrides` sem tocar a app.
"""
from __future__ import annotations

import functools

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.adapters.audit.reader import EventReader
from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.repository import Repository
from hdd.adapters.db.webhook_inbox import WebhookInbox
from hdd.adapters.notifier import ClihelperNotifier
from hdd.application.notifications import NotificationService
from hdd.config import get_settings

from .schemas import User


@functools.lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


def get_repository() -> Repository:
    return Repository(get_sessionmaker(), AuditSink(get_sessionmaker()))


def get_gate_store() -> GateStore:
    return GateStore(get_sessionmaker())


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
