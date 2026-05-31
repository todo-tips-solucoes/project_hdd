"""Memória de contexto semântica (pgvector) — RF-05."""

from .pgvector_memory import EMBED_DIM, PgVectorMemory, embed

__all__ = ["PgVectorMemory", "embed", "EMBED_DIM"]
