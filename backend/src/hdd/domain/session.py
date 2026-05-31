"""FSM de Sessão (Addendum R-10).

CREATED → RUNNING → {AWAITING_GATE ⇄ RUNNING} → {PAUSED_QUOTA → RUNNING}
        → DONE | FAILED | ABORTED

A FSM é pura (sem I/O). Transições ilegais levantam DomainError.
"""
from __future__ import annotations

from enum import StrEnum

from hdd.domain.errors import DomainError


class SessionState(StrEnum):
    CREATED = "created"
    RUNNING = "running"
    AWAITING_GATE = "awaiting_gate"
    PAUSED_QUOTA = "paused_quota"
    DONE = "done"
    FAILED = "failed"
    ABORTED = "aborted"


_TRANSITIONS: dict[SessionState, frozenset[SessionState]] = {
    SessionState.CREATED: frozenset({SessionState.RUNNING, SessionState.ABORTED}),
    SessionState.RUNNING: frozenset(
        {
            SessionState.AWAITING_GATE,
            SessionState.PAUSED_QUOTA,
            SessionState.DONE,
            SessionState.FAILED,
            SessionState.ABORTED,
        }
    ),
    SessionState.AWAITING_GATE: frozenset(
        {SessionState.RUNNING, SessionState.ABORTED}
    ),
    SessionState.PAUSED_QUOTA: frozenset({SessionState.RUNNING, SessionState.ABORTED}),
    SessionState.DONE: frozenset(),
    SessionState.FAILED: frozenset(),
    SessionState.ABORTED: frozenset(),
}


def can_transition(current: SessionState, target: SessionState) -> bool:
    return target in _TRANSITIONS[current]


def assert_transition(current: SessionState, target: SessionState) -> None:
    if not can_transition(current, target):
        raise DomainError(f"transição de sessão ilegal: {current} → {target}")
