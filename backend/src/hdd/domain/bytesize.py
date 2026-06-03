"""Formatação de tamanho em bytes para leitura humana."""
from __future__ import annotations

_UNITS = ("B", "KB", "MB", "GB", "TB", "PB")


def format_bytes(n: int) -> str:
    if n < 0:
        raise ValueError(f"n must be non-negative, got {n}")
    value = float(n)
    for unit in _UNITS[:-1]:
        if value < 1024:
            if unit == "B":
                return f"{int(value)} B"
            return f"{value:.2f} {unit}"
        value /= 1024
    return f"{value:.2f} {_UNITS[-1]}"
