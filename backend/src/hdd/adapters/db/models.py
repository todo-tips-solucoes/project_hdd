"""Modelos ORM (schema `app`) — persistência de sessões e ondas."""
from __future__ import annotations

from datetime import datetime

import uuid_utils
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
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
