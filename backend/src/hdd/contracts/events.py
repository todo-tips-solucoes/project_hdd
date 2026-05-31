"""Envelope de evento + catálogo versionado (Addendum R-13).

Eventos alimentam a auditoria (hash-chain). O envelope é canonicalizado de forma
determinística para que o hash seja reprodutível.
"""
from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from enum import StrEnum

import uuid_utils
from pydantic import BaseModel, Field


class EventType(StrEnum):
    """Catálogo FECHADO de eventos (adicionar = mudança versionada)."""

    SESSION_CREATED = "session.created"
    SESSION_RESUMED = "session.resumed"
    WAVE_STARTED = "wave.started"
    WAVE_VERIFIED = "wave.verified"
    WAVE_MERGED = "wave.merged"
    GATE_REQUESTED = "gate.requested"
    GATE_APPROVED = "gate.approved"
    GATE_REJECTED = "gate.rejected"
    ERROR_RAISED = "error.raised"
    # LGPD: registro (sem PII) de que o titular exerceu o direito à exclusão.
    LGPD_ERASED = "lgpd.erased"


def new_event_id() -> str:
    """UUIDv7 — ordenável temporalmente (pattern de naming)."""
    return str(uuid_utils.uuid7())


class EventEnvelope(BaseModel):
    """Envelope comum a todos os eventos de auditoria."""

    event_id: str = Field(default_factory=new_event_id)
    type: EventType
    schema_version: int = 1
    occurred_at: datetime
    correlation_id: str
    actor: str
    payload: dict[str, object] = Field(default_factory=dict)

    def canonical(self) -> str:
        """Serialização determinística (chaves ordenadas) para o hash-chain."""
        data = self.model_dump(mode="json")
        return json.dumps(data, sort_keys=True, separators=(",", ":"))

    def chain_hash(self, prev_hash: str) -> str:
        """SHA-256 encadeando o hash do evento anterior (R-13)."""
        return hashlib.sha256((prev_hash + self.canonical()).encode()).hexdigest()


GENESIS_HASH = "0" * 64


def make_event(
    event_type: EventType,
    correlation_id: str,
    actor: str,
    payload: dict[str, object] | None = None,
) -> EventEnvelope:
    """Constrói um evento com timestamp UTC — usado nas transições (RF-04/3.2)."""
    return EventEnvelope(
        type=event_type,
        occurred_at=datetime.now(UTC),
        correlation_id=correlation_id,
        actor=actor,
        payload=payload or {},
    )
