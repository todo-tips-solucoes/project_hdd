"""Parsing de valores escalares de configuração."""
from __future__ import annotations

_TRUE_VALUES: frozenset[str] = frozenset({"1", "true", "yes", "on"})
_FALSE_VALUES: frozenset[str] = frozenset({"0", "false", "no", "off"})


def parse_bool(s: str) -> bool:
    normalised = s.strip().lower()
    if normalised in _TRUE_VALUES:
        return True
    if normalised in _FALSE_VALUES:
        return False
    raise ValueError(f"Valor booleano não reconhecido: {s!r}")
