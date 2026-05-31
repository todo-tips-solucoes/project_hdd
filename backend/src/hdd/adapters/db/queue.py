"""Fila de trabalho durável — Postgres com FOR UPDATE SKIP LOCKED (Story 2.2).

Garante que um item nunca é processado por dois workers ao mesmo tempo.
"""
from __future__ import annotations

import uuid_utils
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

_CLAIM = text(
    """
    UPDATE app.work_queue SET status = 'running'
    WHERE id = (
        SELECT id FROM app.work_queue
        WHERE status = 'pending'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING id, payload
    """
)


class WorkQueue:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def enqueue(self, payload: str) -> str:
        work_id = str(uuid_utils.uuid7())
        async with self._sm() as s:
            await s.execute(
                text(
                    "INSERT INTO app.work_queue (id, payload, status) "
                    "VALUES (:i, :p, 'pending')"
                ),
                {"i": work_id, "p": payload},
            )
            await s.commit()
        return work_id

    async def claim(self) -> tuple[str, str] | None:
        """Reivindica o próximo item pendente (atômico). None se a fila está vazia."""
        async with self._sm() as s:
            row = (await s.execute(_CLAIM)).first()
            await s.commit()
            return (row[0], row[1]) if row else None

    async def complete(self, work_id: str) -> None:
        async with self._sm() as s:
            await s.execute(
                text("UPDATE app.work_queue SET status = 'done' WHERE id = :i"),
                {"i": work_id},
            )
            await s.commit()
