"""ClihelperNotifier — porta `Notifier` sobre o clihelper (Story 4.4, RF-08).

O clihelper é a camada outbound proprietária do operador sobre a Meta Cloud API.
O HDD é um cliente HTTP simples com **leaky-bucket persistente** (teto de 1 req/s,
configurável): o estado do bucket vive em `app.notifier_bucket`, então o limite é
respeitado mesmo após restart e entre workers concorrentes (NFR-ESC).

`silence > noise`: este adapter só transporta a mensagem; a narrativa é construída
na camada de aplicação (`application.notifications`). O sender HTTP é injetável
para testes sem rede.
"""
from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# advisory lock dedicado à reserva de slots do bucket (distinto do 4242 da auditoria)
_LOCK_KEY = 4243

Sender = Callable[[str], Awaitable[None]]


class ClihelperNotifier:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        base_url: str = "",
        token: str = "",
        min_interval_s: float = 1.0,
        sender: Sender | None = None,
    ) -> None:
        self._sm = sessionmaker
        self._base_url = base_url
        self._token = token
        self._interval = min_interval_s
        self._sender = sender or self._http_send

    async def notify(self, message: str) -> None:
        wait = await self._reserve()
        if wait > 0:
            await asyncio.sleep(wait)
        await self._sender(message)

    async def _reserve(self) -> float:
        """Reserva atomicamente o próximo slot e devolve quanto esperar (s).

        Sob advisory lock, lê `available_at`, agenda o envio para `max(now,
        available_at)` e avança `available_at` em `interval`. Cada chamador recebe
        um slot futuro distinto, então o espaçamento de 1 req/s é mantido mesmo que
        vários durmam concorrentemente. O lock é liberado no commit (antes do sleep).
        """
        async with self._sm() as s:
            await s.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_KEY})
            row = (
                await s.execute(
                    text("SELECT available_at FROM app.notifier_bucket WHERE id = 1 FOR UPDATE")
                )
            ).scalar_one()
            now = datetime.now(UTC)
            emit_at = row if row > now else now
            await s.execute(
                text("UPDATE app.notifier_bucket SET available_at = :a WHERE id = 1"),
                {"a": emit_at + timedelta(seconds=self._interval)},
            )
            await s.commit()
        return max(0.0, (emit_at - now).total_seconds())

    async def _http_send(self, message: str) -> None:
        if not self._base_url:
            return  # notifier desativado em dev (sem clihelper configurado)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                self._base_url,
                json={"message": message},
                headers={"Authorization": f"Bearer {self._token}"},
            )
            resp.raise_for_status()
