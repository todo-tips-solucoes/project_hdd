"""Healthcheck (Story 3.5) — liveness simples + readiness (DB)."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


async def check_db(sessionmaker: async_sessionmaker[AsyncSession]) -> bool:
    try:
        async with sessionmaker() as s:
            await s.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def liveness() -> dict[str, str]:
    return {"status": "ok"}
