"""Lease de quota GLOBAL — teto de concorrência de `claude -p` (Story 2.2, NFR-ESC-3).

Counter único com FOR UPDATE serializa aquisições: N workers (Swarm + SKIP LOCKED)
nunca excedem o teto da conta única. Sem lease, o worker aguarda.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class QuotaLease:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def acquire(self) -> bool:
        """Tenta adquirir um slot de quota. True se conseguiu, False se cheio."""
        async with self._sm() as s:
            row = (
                await s.execute(
                    text(
                        "SELECT in_use, max_concurrent FROM app.quota_counter "
                        "WHERE id = 1 FOR UPDATE"
                    )
                )
            ).one()
            in_use, max_concurrent = int(row[0]), int(row[1])
            if in_use >= max_concurrent:
                await s.commit()
                return False
            await s.execute(
                text("UPDATE app.quota_counter SET in_use = in_use + 1 WHERE id = 1")
            )
            await s.commit()
            return True

    async def release(self) -> None:
        async with self._sm() as s:
            await s.execute(
                text(
                    "UPDATE app.quota_counter "
                    "SET in_use = GREATEST(in_use - 1, 0) WHERE id = 1"
                )
            )
            await s.commit()

    async def in_use(self) -> int:
        async with self._sm() as s:
            result = await s.execute(
                text("SELECT in_use FROM app.quota_counter WHERE id = 1")
            )
            return int(result.scalar_one())

    async def set_max(self, value: int) -> None:
        async with self._sm() as s:
            await s.execute(
                text("UPDATE app.quota_counter SET max_concurrent = :m WHERE id = 1"),
                {"m": value},
            )
            await s.commit()
