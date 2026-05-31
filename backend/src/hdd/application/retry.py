"""Política de retry/escalada (Story 2.7, Addendum R-12).

Decide a ação a partir da CLASSE do erro e dos contadores. A unidade de
"tentativa" é uma passagem EXECUTING→VERIFYING da onda (contada pela aplicação).

| Erro            | Ação                                                       |
|-----------------|------------------------------------------------------------|
| QuotaExhausted  | PAUSE (retoma quando a quota liberar) — não conta p/ N      |
| TransientError  | RETRY com backoff (≤ max_transient); ao esgotar → ESCALATE  |
| DomainError     | CORRECT (loop ≤ max_correction); ao esgotar → ESCALATE (g6) |
| FatalError      | ABORT → escalar (gate 6)                                    |
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from hdd.domain.errors import DomainError, FatalError, QuotaExhausted, TransientError


class RetryAction(StrEnum):
    RETRY = "retry"
    PAUSE = "pause"
    CORRECT = "correct"
    ESCALATE = "escalate"
    ABORT = "abort"


@dataclass(frozen=True)
class RetryLimits:
    max_transient: int = 5
    max_correction: int = 3


@dataclass(frozen=True)
class RetryDecision:
    action: RetryAction
    delay_seconds: float
    reason: str


_DEFAULT_LIMITS = RetryLimits()


def backoff(attempt: int, base: float = 1.0, cap: float = 60.0, jitter: float = 0.0) -> float:
    """Backoff exponencial com teto e jitter (jitter injetável p/ testes)."""
    return min(cap, base * (2.0**attempt)) + jitter


def decide(
    error: Exception,
    n_transient: int,
    n_correction: int,
    limits: RetryLimits = _DEFAULT_LIMITS,
    jitter: float = 0.0,
) -> RetryDecision:
    if isinstance(error, QuotaExhausted):
        return RetryDecision(RetryAction.PAUSE, 0.0, "quota esgotada — pausar e retomar")
    if isinstance(error, TransientError):
        if n_transient < limits.max_transient:
            return RetryDecision(
                RetryAction.RETRY,
                backoff(n_transient, jitter=jitter),
                f"transitório {n_transient + 1}/{limits.max_transient}",
            )
        return RetryDecision(RetryAction.ESCALATE, 0.0, "transitório esgotou N — escalar")
    if isinstance(error, DomainError):
        if n_correction < limits.max_correction:
            return RetryDecision(
                RetryAction.CORRECT,
                0.0,
                f"correção {n_correction + 1}/{limits.max_correction}",
            )
        return RetryDecision(RetryAction.ESCALATE, 0.0, "correção esgotou N — gate 6")
    if isinstance(error, FatalError):
        return RetryDecision(RetryAction.ABORT, 0.0, "fatal — abortar e escalar")
    return RetryDecision(RetryAction.ABORT, 0.0, "erro desconhecido — abortar")
