"""AuditSink — grava eventos encadeados por hash (Story 3.1).

Cada evento encadeia o hash do anterior (SHA-256). Um advisory lock serializa
os appends para a cadeia ser consistente sob concorrência. A imutabilidade é
garantida em três camadas: trigger de DB, role append-only e este hash-chain.
"""
from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.contracts.events import GENESIS_HASH, EventEnvelope

_LOCK_KEY = 4242  # advisory lock dedicado à cadeia de auditoria


class AuditSink:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def append(self, event: EventEnvelope) -> str:
        """Grava o evento encadeado e retorna o hash resultante."""
        async with self._sm() as s:
            await s.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_KEY})
            head = (
                await s.execute(
                    text("SELECT hash FROM audit.events ORDER BY seq DESC LIMIT 1")
                )
            ).scalar()
            prev = head or GENESIS_HASH
            digest = event.chain_hash(prev)
            await s.execute(
                text(
                    """
                    INSERT INTO audit.events
                        (event_id, type, schema_version, occurred_at, correlation_id,
                         actor, payload, prev_hash, hash)
                    VALUES
                        (:event_id, :type, :schema_version, :occurred_at, :correlation_id,
                         :actor, CAST(:payload AS jsonb), :prev_hash, :hash)
                    """
                ),
                {
                    "event_id": event.event_id,
                    "type": str(event.type),
                    "schema_version": event.schema_version,
                    "occurred_at": event.occurred_at,
                    "correlation_id": event.correlation_id,
                    "actor": event.actor,
                    "payload": json.dumps(event.payload),
                    "prev_hash": prev,
                    "hash": digest,
                },
            )
            await s.commit()
            return digest

    async def head(self) -> str:
        async with self._sm() as s:
            h = (
                await s.execute(
                    text("SELECT hash FROM audit.events ORDER BY seq DESC LIMIT 1")
                )
            ).scalar()
            return str(h) if h else GENESIS_HASH

    async def verify_chain(self) -> bool:
        """Recomputa a cadeia inteira e confirma que nada foi adulterado."""
        async with self._sm() as s:
            rows = (
                await s.execute(
                    text(
                        "SELECT type, schema_version, occurred_at, correlation_id, "
                        "actor, payload, event_id, prev_hash, hash "
                        "FROM audit.events ORDER BY seq"
                    )
                )
            ).all()
        prev = GENESIS_HASH
        for r in rows:
            env = EventEnvelope(
                event_id=r[6],
                type=r[0],
                schema_version=r[1],
                occurred_at=r[2],
                correlation_id=r[3],
                actor=r[4],
                payload=r[5],
            )
            expected = env.chain_hash(prev)
            if expected != r[8] or r[7] != prev:
                return False
            prev = r[8]
        return True
