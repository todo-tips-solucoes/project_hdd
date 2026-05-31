"""Story 2.7 — política de retry/escalada."""
from __future__ import annotations

from hdd.application.retry import RetryAction, RetryLimits, backoff, decide
from hdd.domain.errors import DomainError, FatalError, QuotaExhausted, TransientError


def test_quota_pausa():
    assert decide(QuotaExhausted(), 0, 0).action == RetryAction.PAUSE


def test_transient_reintenta_com_backoff_e_depois_escala():
    d = decide(TransientError(), 0, 0)
    assert d.action == RetryAction.RETRY
    assert d.delay_seconds > 0
    esgotado = decide(TransientError(), 5, 0, RetryLimits(max_transient=5))
    assert esgotado.action == RetryAction.ESCALATE


def test_domain_corrige_e_depois_escala():
    assert decide(DomainError(), 0, 0).action == RetryAction.CORRECT
    esgotado = decide(DomainError(), 0, 3, RetryLimits(max_correction=3))
    assert esgotado.action == RetryAction.ESCALATE


def test_fatal_aborta():
    assert decide(FatalError(), 0, 0).action == RetryAction.ABORT


def test_backoff_cresce_e_respeita_teto():
    assert backoff(0) < backoff(1) < backoff(2)
    assert backoff(100, cap=60.0) == 60.0
