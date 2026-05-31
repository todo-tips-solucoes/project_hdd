"""Grafo LangGraph mínimo — FSM durável cujos nós invocam `claude -p`.

Fluxo: START → execute → gate(interrupt) → finalize → END

- `execute`: invoca claude -p (stateless) e faz um efeito externo idempotente
  (commit). Opcionalmente simula kill no meio do superstep (após o efeito).
- `gate`: PURO até `interrupt()` — prova que retomar não repete efeitos (crit. 3).
- O checkpoint (AsyncPostgresSaver) é a única fonte de durabilidade (crit. 1/2).
"""
from __future__ import annotations

import os
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from . import db
from .llm import ClaudeSubscriptionProvider


class State(TypedDict, total=False):
    task: str
    thread_id: str
    claude_said: str
    session_id: str
    effect_committed: bool
    approved: bool


async def node_execute(state: State) -> dict:
    provider = ClaudeSubscriptionProvider(model=os.environ.get("HDD_MODEL"))
    # Prompt reconstruído do state — NÃO usa --resume da sessão Claude (R-11).
    res = provider.invoke(f"Tarefa: {state['task']}. Responda apenas: FEITO")

    # Efeito externo idempotente (simula commit). Mesmo thread → mesma key.
    key = f"{state['thread_id']}:commit"
    await db.commit_effect(key, res.text[:200])

    # Simula kill DETERMINÍSTICO após o efeito, antes do checkpoint do superstep.
    if os.environ.get("HDD_CRASH_AFTER_COMMIT") == "1":
        os._exit(137)

    return {
        "claude_said": res.text,
        "session_id": res.session_id or "",
        "effect_committed": True,
    }


def node_gate(state: State) -> dict:
    # PURO até aqui: nenhum efeito antes do interrupt (R-11).
    decision = interrupt({"reason": "aprovar conclusão?", "task": state.get("task")})
    return {"approved": bool(decision)}


def node_finalize(state: State) -> dict:
    return {}


def build_graph(checkpointer):
    g = StateGraph(State)
    g.add_node("execute", node_execute)
    g.add_node("gate", node_gate)
    g.add_node("finalize", node_finalize)
    g.add_edge(START, "execute")
    g.add_edge("execute", "gate")
    g.add_edge("gate", "finalize")
    g.add_edge("finalize", END)
    return g.compile(checkpointer=checkpointer)
