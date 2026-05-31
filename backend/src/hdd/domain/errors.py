"""Taxonomia de erros (Addendum R-12 da arquitetura).

A classe do erro decide a política de retry/escalada:

| Classe            | Recuperável? | Conta p/ N? | Ação ao esgotar              |
|-------------------|--------------|-------------|------------------------------|
| TransientError    | sim (backoff)| N_transient | vira FatalError              |
| QuotaExhausted    | não é erro   | não         | PAUSE → retoma em quota livre |
| DomainError       | sim (correção)| N_correction| gate RF-03b.6 (escalada)     |
| FatalError        | não          | —           | aborta onda → gate 6         |
"""
from __future__ import annotations


class HddError(Exception):
    """Raiz de todos os erros de domínio do HDD."""


class TransientError(HddError):
    """Falha transitória (rede, 429, timeout curto) — reintentar com backoff."""


class QuotaExhausted(HddError):
    """Limite de uso/janela da conta atingido — PAUSAR e retomar, não é falha."""


class DomainError(HddError):
    """Falha recuperável de domínio (teste/lint/verificação reprovou) — loop de correção."""


class FatalError(HddError):
    """Falha irrecuperável (invariante violada, input inválido) — abortar e escalar."""
