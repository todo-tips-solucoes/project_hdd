"""Modelos ORM (schema `app`) — persistência de sessões e ondas."""
from __future__ import annotations

from datetime import datetime

import uuid_utils
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid7() -> str:
    return str(uuid_utils.uuid7())


class SessionRow(Base):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "app"}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid7)
    state: Mapped[str] = mapped_column(String, nullable=False)
    task: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class WaveRow(Base):
    __tablename__ = "waves"
    __table_args__ = {"schema": "app"}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid7)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("app.sessions.id"), nullable=False
    )
    state: Mapped[str] = mapped_column(String, nullable=False)
    n_corrections: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class GateRow(Base):
    __tablename__ = "gates"
    __table_args__ = {"schema": "app"}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid7)
    wave_id: Mapped[str] = mapped_column(String, nullable=False)
    gate_type: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    pin_hash: Mapped[str] = mapped_column(String, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DogfoodGapRow(Base):
    """Gap de dogfood (Story 7.2): aprendizado que o dogfood gera (escalada,
    falha, quota) e que realimenta o backlog. `wave_id` é nulo nos gaps seed
    (pré-identificados, sem onda de origem)."""

    __tablename__ = "dogfood_gaps"
    __table_args__ = {"schema": "app"}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid7)
    wave_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # stage ∈ escalation | failure | quota | preexisting
    stage: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    context: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    # status ∈ open | triaged | converted | dismissed
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# app.work_queue e app.quota_counter são manipuladas por SQL direto
# (SKIP LOCKED / FOR UPDATE) em adapters/db/{queue,quota}.py.
