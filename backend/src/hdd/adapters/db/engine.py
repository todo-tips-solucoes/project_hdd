"""Engine/session async. psycopg3 é o driver único (padronizado na arquitetura)."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def _normalize(dsn: str) -> str:
    """Garante o driver psycopg3 (postgresql+psycopg://)."""
    if dsn.startswith("postgresql+"):
        return dsn
    return dsn.replace("postgresql://", "postgresql+psycopg://", 1)


def make_engine(dsn: str) -> AsyncEngine:
    return create_async_engine(_normalize(dsn), pool_pre_ping=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
