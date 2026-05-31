"""Orquestrador da Onda (Story 2.6) — grafo LangGraph que conduz uma feature.

Fluxo: PLAN → EXECUTE → VERIFY → {CORRECT → EXECUTE}[≤N] → GATE(merge) | ESCALATE

- Cada transição é validada pela FSM da Onda (domain.wave) — ilegais são bloqueadas.
- A verificação automática reprovando gera LOOP DE CORREÇÃO (não merge); ao
  esgotar N, escala via gate (interrupt).
- O merge é um gate humano (interrupt → AWAITING_GATE).
- `llm` (LLMProvider) e `verify` são injetados: em produção, o LLM roda em
  `claude -p` dentro do sandbox e as ações destrutivas passam pelo capability
  broker; nos testes, fakes determinísticos (sem quota).
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

from hdd.contracts.ports import LLMProvider
from hdd.domain import wave as wv

Verifier = Callable[[str], bool]


class WaveGraphState(TypedDict, total=False):
    task: str
    workspace: str
    wave_state: str
    plan: str
    n_corrections: int
    result: str


class WaveOrchestrator:
    def __init__(
        self,
        llm: LLMProvider,
        verify: Verifier,
        checkpointer: Any,
        max_corrections: int = 3,
    ) -> None:
        self._llm = llm
        self._verify = verify
        self._max = max_corrections
        self._graph = self._build(checkpointer)

    # --- helpers -----------------------------------------------------------
    def _to(self, state: WaveGraphState, target: wv.WaveState) -> str:
        wv.assert_transition(wv.WaveState(state["wave_state"]), target)
        return str(target)

    # --- nós ---------------------------------------------------------------
    def _plan(self, state: WaveGraphState) -> dict[str, Any]:
        plan = self._llm.invoke(f"Planeje a tarefa: {state['task']}").text
        return {"plan": plan, "wave_state": self._to(state, wv.WaveState.EXECUTING)}

    def _execute(self, state: WaveGraphState) -> dict[str, Any]:
        self._llm.invoke(f"Implemente conforme o plano:\n{state.get('plan', '')}")
        return {"wave_state": self._to(state, wv.WaveState.VERIFYING)}

    def _verify_node(self, state: WaveGraphState) -> dict[str, Any]:
        ok = self._verify(state.get("workspace", ""))
        target = wv.WaveState.AWAITING_GATE if ok else wv.WaveState.CORRECTING
        return {"wave_state": self._to(state, target)}

    def _correct(self, state: WaveGraphState) -> dict[str, Any]:
        n = state.get("n_corrections", 0) + 1
        target = wv.WaveState.EXECUTING if n <= self._max else wv.WaveState.ESCALATED
        return {"n_corrections": n, "wave_state": self._to(state, target)}

    def _gate(self, state: WaveGraphState) -> dict[str, Any]:
        approved = bool(interrupt({"gate": "merge_deploy", "reason": "aprovar merge?"}))
        target = wv.WaveState.MERGED if approved else wv.WaveState.FAILED
        return {
            "wave_state": self._to(state, target),
            "result": "merged" if approved else "rejected",
        }

    def _escalate(self, state: WaveGraphState) -> dict[str, Any]:
        interrupt({"gate": "escalation", "reason": "loop de correção esgotou N"})
        return {"result": "escalated"}

    # --- roteamento --------------------------------------------------------
    def _after_verify(self, state: WaveGraphState) -> str:
        is_gate = wv.WaveState(state["wave_state"]) == wv.WaveState.AWAITING_GATE
        return "gate" if is_gate else "correct"

    def _after_correct(self, state: WaveGraphState) -> str:
        is_exec = wv.WaveState(state["wave_state"]) == wv.WaveState.EXECUTING
        return "execute" if is_exec else "escalate"

    def _build(self, checkpointer: Any) -> Any:
        g = StateGraph(WaveGraphState)
        g.add_node("plan", self._plan)
        g.add_node("execute", self._execute)
        g.add_node("verify", self._verify_node)
        g.add_node("correct", self._correct)
        g.add_node("gate", self._gate)
        g.add_node("escalate", self._escalate)
        g.add_edge(START, "plan")
        g.add_edge("plan", "execute")
        g.add_edge("execute", "verify")
        g.add_conditional_edges(
            "verify", self._after_verify, {"gate": "gate", "correct": "correct"}
        )
        g.add_conditional_edges(
            "correct", self._after_correct, {"execute": "execute", "escalate": "escalate"}
        )
        g.add_edge("gate", END)
        g.add_edge("escalate", END)
        return g.compile(checkpointer=checkpointer)

    # --- API ---------------------------------------------------------------
    async def run_wave(
        self, thread_id: str, task: str, workspace: str = ""
    ) -> dict[str, Any]:
        cfg: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
        init: WaveGraphState = {
            "task": task,
            "workspace": workspace,
            "wave_state": str(wv.WaveState.PLANNED),
            "n_corrections": 0,
        }
        result: dict[str, Any] = await self._graph.ainvoke(init, cfg)
        return result

    async def resume(self, thread_id: str, decision: bool) -> dict[str, Any]:
        cfg: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
        result: dict[str, Any] = await self._graph.ainvoke(Command(resume=decision), cfg)
        return result
