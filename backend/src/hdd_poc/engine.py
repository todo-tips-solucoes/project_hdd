"""Orquestração durável: monta o AsyncPostgresSaver e dirige o grafo.

Distingue dois tipos de retomada (R-11):
- `continue_run`: retoma após KILL no meio de um nó (re-executa o nó) — `ainvoke(None)`.
- `resume_gate`: retoma de um `interrupt()` humano — `ainvoke(Command(resume=...))`.

Em nenhum caso o `claude -p` recebe `--resume`: a durabilidade vem 100% do
checkpoint Postgres, não da sessão Claude.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.types import Command

from .db import DSN
from .graph import build_graph


@asynccontextmanager
async def _graph():
    async with AsyncPostgresSaver.from_conn_string(DSN) as cp:
        await cp.setup()
        yield build_graph(cp)


def _cfg(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


async def run_until_gate(thread_id: str, task: str) -> dict:
    async with _graph() as g:
        return await g.ainvoke(
            {"task": task, "thread_id": thread_id}, _cfg(thread_id)
        )


async def continue_run(thread_id: str) -> dict:
    """Retoma após kill (nó não completou). Re-executa do último checkpoint."""
    async with _graph() as g:
        return await g.ainvoke(None, _cfg(thread_id))


async def resume_gate(thread_id: str, decision: bool) -> dict:
    async with _graph() as g:
        return await g.ainvoke(Command(resume=decision), _cfg(thread_id))


async def get_state(thread_id: str):
    async with _graph() as g:
        return await g.aget_state(_cfg(thread_id))
