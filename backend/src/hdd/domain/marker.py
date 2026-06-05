"""Detecção de marcadores de saída do driver LLM — lógica pura, sem I/O."""
from __future__ import annotations

VERSION = '1'

_QUOTA_MARKERS: frozenset[str] = frozenset({
    "usage limit",
    "rate limit",
    "quota",
    "limit reached",
    "overloaded",
})


def detect_quota_exhausted(stdout: str, stderr: str) -> bool:
    """Retorna True se a saída combinada contiver marcadores de esgotamento de quota."""
    combined = (stdout + stderr).lower()
    return any(m in combined for m in _QUOTA_MARKERS)
