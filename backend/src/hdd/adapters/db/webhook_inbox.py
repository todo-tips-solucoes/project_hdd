"""WebhookInbox — deduplicação idempotente do webhook inbound (Story 4.5).

A idempotency key é PK em `app.webhook_inbox`. `seen()` tenta inserir: se a key já
existe (conflito), a mensagem é repetida e deve ser descartada (at-ingress). Isto
torna o endpoint inbound seguro contra retries do n8n.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class WebhookInbox:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def seen(self, idempotency_key: str, source: str) -> bool:
        """Registra a key. Retorna True se já fora vista antes (duplicata)."""
        async with self._sm() as s:
            result = await s.execute(
                text(
                    "INSERT INTO app.webhook_inbox (idempotency_key, source) "
                    "VALUES (:k, :src) ON CONFLICT (idempotency_key) DO NOTHING "
                    "RETURNING idempotency_key"
                ),
                {"k": idempotency_key, "src": source},
            )
            inserted = result.first() is not None
            await s.commit()
            # Sem linha retornada → conflito → já tínhamos visto esta key.
            return not inserted
