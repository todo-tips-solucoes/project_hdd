"""Efeitos externos idempotentes — prova o critério 1 (não duplicar sob resume).

Um "commit" do agente é simulado por um INSERT idempotente em app.effects.
A idempotency key deriva do thread_id, então re-executar o nó (após kill/resume)
nunca duplica o efeito.
"""
from __future__ import annotations

import os

import psycopg

DSN = os.environ.get("HDD_PG_DSN", "postgresql://hdd:hdd_dev@localhost:5433/hdd")


async def setup_effects() -> None:
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        await conn.execute("create schema if not exists app")
        await conn.execute(
            """
            create table if not exists app.effects (
                idempotency_key text primary key,
                payload text not null,
                created_at timestamptz not null default now()
            )
            """
        )


async def commit_effect(key: str, payload: str) -> bool:
    """Insere um efeito. Retorna True se NOVO, False se já existia (idempotente)."""
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        cur = await conn.execute(
            "insert into app.effects (idempotency_key, payload) values (%s, %s) "
            "on conflict (idempotency_key) do nothing returning idempotency_key",
            (key, payload),
        )
        return (await cur.fetchone()) is not None


async def count_effects(prefix: str) -> int:
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        cur = await conn.execute(
            "select count(*) from app.effects where idempotency_key like %s",
            (prefix + "%",),
        )
        return (await cur.fetchone())[0]


async def reset(prefix: str) -> None:
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        await conn.execute(
            "delete from app.effects where idempotency_key like %s", (prefix + "%",)
        )
