"""FSM de Onda (Addendum R-10).

PLANNED → EXECUTING → VERIFYING → {CORRECTING → EXECUTING}[≤N]
        → AWAITING_GATE → MERGED | ESCALATED | FAILED

Pura, sem I/O. O loop de correção é limitado por N (taxonomia R-12) — controlado
pela camada de aplicação; a FSM apenas valida que a transição é legal.
"""
from __future__ import annotations

from enum import StrEnum

from hdd.domain.errors import DomainError


class WaveState(StrEnum):
    PLANNED = "planned"
    EXECUTING = "executing"
    VERIFYING = "verifying"
    CORRECTING = "correcting"
    AWAITING_GATE = "awaiting_gate"
    MERGED = "merged"
    ESCALATED = "escalated"
    FAILED = "failed"


_TRANSITIONS: dict[WaveState, frozenset[WaveState]] = {
    WaveState.PLANNED: frozenset({WaveState.EXECUTING}),
    WaveState.EXECUTING: frozenset({WaveState.VERIFYING, WaveState.FAILED}),
    WaveState.VERIFYING: frozenset(
        {
            WaveState.CORRECTING,
            WaveState.AWAITING_GATE,
            WaveState.MERGED,
            WaveState.FAILED,
        }
    ),
    WaveState.CORRECTING: frozenset({WaveState.EXECUTING, WaveState.ESCALATED}),
    WaveState.AWAITING_GATE: frozenset(
        {WaveState.MERGED, WaveState.ESCALATED, WaveState.FAILED}
    ),
    WaveState.MERGED: frozenset(),
    WaveState.ESCALATED: frozenset(),
    WaveState.FAILED: frozenset(),
}


def can_transition(current: WaveState, target: WaveState) -> bool:
    return target in _TRANSITIONS[current]


def assert_transition(current: WaveState, target: WaveState) -> None:
    if not can_transition(current, target):
        raise DomainError(f"transição de onda ilegal: {current} → {target}")
