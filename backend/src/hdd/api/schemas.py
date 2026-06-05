"""Schemas da API (request/response) — fonte do contrato OpenAPI → tipos TS.

snake_case end-to-end. Estes modelos são a fronteira pública do painel; mudá-los
muda os tipos TS gerados (sem drift, Story 4.2).
"""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class User(BaseModel):
    login: str
    name: str | None = None
    avatar_url: str | None = None


class SessionOut(BaseModel):
    id: str
    state: str
    task: str


class WaveOut(BaseModel):
    id: str
    session_id: str
    state: str
    n_corrections: int


class WavesSnapshot(BaseModel):
    sessions: list[SessionOut]
    waves: list[WaveOut]


class FeatureStart(BaseModel):
    """Pedido para iniciar uma feature (produtor da fila, Story 6.1)."""

    task: str


class FeatureStarted(BaseModel):
    """Onda criada e enfileirada para o worker.

    `wave_id == thread_id` do payload da fila → casa o checkpoint LangGraph com a onda.
    """

    session_id: str
    wave_id: str
    work_id: str


class GateOut(BaseModel):
    id: str
    wave_id: str
    gate_type: str
    reason: str
    status: str
    created_at: datetime | None = None
    expires_at: datetime | None = None


class GateDecisionOut(BaseModel):
    id: str
    status: str


class InboundMessage(BaseModel):
    """Schema MÍNIMO do webhook n8n — conteúdo é não-confiável (drop-at-ingress).

    `extra="ignore"`: campos desconhecidos são descartados na borda.
    """

    model_config = {"extra": "ignore"}

    message_id: str | None = None
    from_: str | None = None
    text: str | None = None


class WebhookAck(BaseModel):
    status: str


class HarnessSummary(BaseModel):
    total_waves: int
    by_state: dict[str, int]
    total_corrections: int
    mean_corrections: float
    reached_gate: int
    escalated: int
    failed: int
    merged: int
    gates_pending: int
    active_waves: int
