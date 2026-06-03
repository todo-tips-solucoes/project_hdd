"""Formatação de duração em segundos para leitura humana."""
from __future__ import annotations


def format_duration_human(seconds: int) -> str:
    if seconds < 0:
        raise ValueError(f"seconds must be non-negative, got {seconds}")
    h, remainder = divmod(seconds, 3600)
    m, s = divmod(remainder, 60)
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    if s:
        parts.append(f"{s}s")
    return " ".join(parts) if parts else "0s"
