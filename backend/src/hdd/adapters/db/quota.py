"""Lease de quota GLOBAL com TTL/reaper (Story 5.2 — supersede o counter inteiro).

O teto de `claude -p` concorrentes é o número de leases ATIVOS (não expirados)
em app.quota_lease, comparado com app.quota_counter.max_concurrent. N workers
(Swarm + SKIP LOCKED) compartilham a mesma tabela → o teto é global.

Robustez a crash: um worker que morre sem `release` deixa um lease que EXPIRA
(`expires_at`); a próxima aquisição roda o reaper (DELETE dos expirados) e o slot
volta — sem vazamento. A serialização das aquisições vem do FOR UPDATE na linha
singleton de quota_counter. Ondas longas renovam o lease via `renew` (heartbeat).
"""
from __future__ import annotations

import uuid_utils
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

DEFAULT_TTL_S = 120


class QuotaLease:
    def __init__(
        self, sessionmaker: async_sessionmaker[AsyncSession], ttl_s: int = DEFAULT_TTL_S
    ) -> None:
        self._sm = sessionmaker
        self._ttl_s = ttl_s

    async def acquire(self, worker_id: str) -> str | None:
        """Adquire um slot. Retorna o lease_id, ou None se o teto foi atingido."""
        lease_id = str(uuid_utils.uuid7())
        async with self._sm() as s:
            max_c = int(
                (
                    await s.execute(
                        text(
                            "SELECT max_concurrent FROM app.quota_counter "
                            "WHERE id = 1 FOR UPDATE"
                        )
                    )
                ).scalar_one()
            )
            # Reaper: recupera slots de workers mortos (lease expirado).
            await s.execute(text("DELETE FROM app.quota_lease WHERE expires_at <= now()"))
            active = int(
                (await s.execute(text("SELECT count(*) FROM app.quota_lease"))).scalar_one()
            )
            if active >= max_c:
                await s.commit()
                return None
            await s.execute(
                text(
                    "INSERT INTO app.quota_lease (id, worker_id, expires_at) "
                    "VALUES (:i, :w, now() + make_interval(secs => :t))"
                ),
                {"i": lease_id, "w": worker_id, "t": self._ttl_s},
            )
            await s.commit()
            return lease_id

    async def renew(self, lease_id: str) -> bool:
        """Estende o lease (heartbeat). False se ele já não existe / expirou."""
        async with self._sm() as s:
            row = (
                await s.execute(
                    text(
                        "UPDATE app.quota_lease "
                        "SET expires_at = now() + make_interval(secs => :t), "
                        "heartbeat_at = now() "
                        "WHERE id = :i AND expires_at > now() RETURNING id"
                    ),
                    {"i": lease_id, "t": self._ttl_s},
                )
            ).first()
            await s.commit()
            return row is not None

    async def release(self, lease_id: str) -> None:
        async with self._sm() as s:
            await s.execute(
                text("DELETE FROM app.quota_lease WHERE id = :i"), {"i": lease_id}
            )
            await s.commit()

    async def reap(self) -> int:
        """Remove leases expirados explicitamente. Retorna quantos recuperou."""
        async with self._sm() as s:
            rows = (
                await s.execute(
                    text(
                        "DELETE FROM app.quota_lease WHERE expires_at <= now() RETURNING id"
                    )
                )
            ).fetchall()
            await s.commit()
            return len(rows)

    async def active_count(self) -> int:
        """Leases ativos (reapa os expirados primeiro)."""
        async with self._sm() as s:
            await s.execute(text("DELETE FROM app.quota_lease WHERE expires_at <= now()"))
            cnt = int(
                (await s.execute(text("SELECT count(*) FROM app.quota_lease"))).scalar_one()
            )
            await s.commit()
            return cnt

    async def set_max(self, value: int) -> None:
        async with self._sm() as s:
            await s.execute(
                text("UPDATE app.quota_counter SET max_concurrent = :m WHERE id = 1"),
                {"m": value},
            )
            await s.commit()
