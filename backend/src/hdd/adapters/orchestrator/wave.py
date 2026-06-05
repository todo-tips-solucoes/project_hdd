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

from hdd.contracts.ports import LLMProvider, Vcs
from hdd.domain import wave as wv
from hdd.observability import get_logger

log = get_logger("orchestrator")

Verifier = Callable[[str], tuple[bool, str]]


class WaveGraphState(TypedDict, total=False):
    task: str
    workspace: str
    branch: str
    wave_state: str
    plan: str
    n_corrections: int
    verify_feedback: str
    result: str
    pr_url: str
    pr_number: int
    pr_error: str
    merge_error: str


class WaveOrchestrator:
    def __init__(
        self,
        llm: LLMProvider,
        verify: Verifier,
        checkpointer: Any,
        max_corrections: int = 3,
        vcs: Vcs | None = None,
        codegen: Verifier | None = None,
        acceptance: Verifier | None = None,
    ) -> None:
        self._llm = llm
        self._verify = verify
        self._max = max_corrections
        self._vcs = vcs
        self._codegen = codegen
        self._acceptance = acceptance
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
        prompt = f"Implemente conforme o plano:\n{state.get('plan', '')}"
        feedback = state.get("verify_feedback", "")
        if state.get("n_corrections", 0) > 0 and feedback:
            prompt += (
                f"\n\nA verificação anterior falhou com:\n{feedback}\n"
                "Corrija a implementação."
            )
        self._llm.invoke(prompt)
        return {"wave_state": self._to(state, wv.WaveState.VERIFYING)}

    def _verify_node(self, state: WaveGraphState) -> dict[str, Any]:
        workspace = state.get("workspace", "")
        if self._codegen is not None:
            cg_ok, cg_fb = self._codegen(workspace)
            if not cg_ok:
                return {
                    "wave_state": self._to(state, wv.WaveState.CORRECTING),
                    "verify_feedback": cg_fb,
                }
        if self._acceptance is not None:
            acc_ok, acc_fb = self._acceptance(workspace)
            if not acc_ok:
                return {
                    "wave_state": self._to(state, wv.WaveState.CORRECTING),
                    "verify_feedback": acc_fb,
                }
        ok, feedback = self._verify(workspace)
        target = wv.WaveState.AWAITING_GATE if ok else wv.WaveState.CORRECTING
        out: dict[str, Any] = {"wave_state": self._to(state, target)}
        if not ok:
            out["verify_feedback"] = feedback
        return out

    def _correct(self, state: WaveGraphState) -> dict[str, Any]:
        n = state.get("n_corrections", 0) + 1
        target = wv.WaveState.EXECUTING if n <= self._max else wv.WaveState.ESCALATED
        return {"n_corrections": n, "wave_state": self._to(state, target)}

    async def _pr(self, state: WaveGraphState) -> dict[str, Any]:
        """Abre o PR rascunho com as mudanças da onda antes do gate (Story 6.7).

        No-op se não há VCS/branch (ex.: onda sem workspace). Falha ao abrir NÃO
        trava a onda: segue ao gate sem PR, com o erro registrado no estado.
        """
        branch = state.get("branch", "")
        if self._vcs is None or not branch:
            return {}
        title = f"HDD: {state.get('task', '')}"[:72]
        body = state.get("plan", "") or "(sem plano registrado)"
        try:
            pr = await self._vcs.open_pr(branch, title, body)
        except Exception as exc:  # noqa: BLE001 — degradar p/ gate sem PR, não travar
            log.exception("orchestrator.pr_falhou", branch=branch)
            return {"pr_error": str(exc)}
        return {"pr_url": pr.url, "pr_number": pr.number}

    async def _gate(self, state: WaveGraphState) -> dict[str, Any]:
        approved = bool(interrupt({"gate": "merge_deploy", "reason": "aprovar merge?"}))
        out: dict[str, Any] = {}
        if approved and self._vcs is not None and state.get("pr_number"):
            # Merge real do PR ao aprovar (Story 6.8). Roda no resume (sem quota).
            try:
                await self._vcs.merge_pr(int(state["pr_number"]))
            except Exception as exc:  # noqa: BLE001 — registra; a decisão de merge vale
                log.exception("orchestrator.merge_falhou", pr=state.get("pr_number"))
                out["merge_error"] = str(exc)
        target = wv.WaveState.MERGED if approved else wv.WaveState.FAILED
        out["wave_state"] = self._to(state, target)
        out["result"] = "merged" if approved else "rejected"
        return out

    def _escalate(self, state: WaveGraphState) -> dict[str, Any]:
        interrupt({"gate": "escalation", "reason": "loop de correção esgotou N"})
        return {"result": "escalated"}

    # --- roteamento --------------------------------------------------------
    def _after_verify(self, state: WaveGraphState) -> str:
        is_gate = wv.WaveState(state["wave_state"]) == wv.WaveState.AWAITING_GATE
        return "pr" if is_gate else "correct"  # aprovado → abre PR antes do gate (6.7)

    def _after_correct(self, state: WaveGraphState) -> str:
        is_exec = wv.WaveState(state["wave_state"]) == wv.WaveState.EXECUTING
        return "execute" if is_exec else "escalate"

    def _build(self, checkpointer: Any) -> Any:
        g = StateGraph(WaveGraphState)
        g.add_node("plan", self._plan)
        g.add_node("execute", self._execute)
        g.add_node("verify", self._verify_node)
        g.add_node("correct", self._correct)
        g.add_node("pr", self._pr)
        g.add_node("gate", self._gate)
        g.add_node("escalate", self._escalate)
        g.add_edge(START, "plan")
        g.add_edge("plan", "execute")
        g.add_edge("execute", "verify")
        g.add_conditional_edges(
            "verify", self._after_verify, {"pr": "pr", "correct": "correct"}
        )
        g.add_conditional_edges(
            "correct", self._after_correct, {"execute": "execute", "escalate": "escalate"}
        )
        g.add_edge("pr", "gate")  # PR rascunho aberto, depois o gate humano (6.7)
        g.add_edge("gate", END)
        g.add_edge("escalate", END)
        return g.compile(checkpointer=checkpointer)

    # --- API ---------------------------------------------------------------
    async def run_wave(
        self, thread_id: str, task: str, workspace: str = "", branch: str = ""
    ) -> dict[str, Any]:
        cfg: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
        init: WaveGraphState = {
            "task": task,
            "workspace": workspace,
            "branch": branch,
            "wave_state": str(wv.WaveState.PLANNED),
            "n_corrections": 0,
        }
        result: dict[str, Any] = await self._graph.ainvoke(init, cfg)
        return result

    async def resume(self, thread_id: str, decision: bool) -> dict[str, Any]:
        cfg: dict[str, Any] = {"configurable": {"thread_id": thread_id}}
        result: dict[str, Any] = await self._graph.ainvoke(Command(resume=decision), cfg)
        return result
