"""Memória semântica sobre pgvector (Story 3.4).

Implementa a porta Memory. O embedder padrão é local e determinístico (hashing
de tokens) — suficiente para busca por similaridade e testes sem API externa.
Em produção, troca-se por um modelo de embeddings real (mesma interface).
PII é pseudonimizada ANTES de embeddar/armazenar.
"""
from __future__ import annotations

import hashlib
import math
from collections.abc import Callable

import uuid_utils
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.domain.pii import pseudonymize

EMBED_DIM = 64
Embedder = Callable[[str], list[float]]


def embed(content: str, dim: int = EMBED_DIM) -> list[float]:
    """Embedding local determinístico (bag-of-words com hashing). Normalizado."""
    vec = [0.0] * dim
    for token in content.lower().split():
        bucket = int(hashlib.md5(token.encode()).hexdigest(), 16) % dim
        vec[bucket] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"


class PgVectorMemory:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        embedder: Embedder = embed,
    ) -> None:
        self._sm = sessionmaker
        self._embed = embedder

    async def remember(self, text_in: str) -> None:
        clean = pseudonymize(text_in)
        vec = _literal(self._embed(clean))
        async with self._sm() as s:
            await s.execute(
                text(
                    "INSERT INTO memory.items (id, content, embedding) "
                    "VALUES (:i, :c, CAST(:e AS vector))"
                ),
                {"i": str(uuid_utils.uuid7()), "c": clean, "e": vec},
            )
            await s.commit()

    async def recall(self, query: str, limit: int = 5) -> list[str]:
        vec = _literal(self._embed(pseudonymize(query)))
        async with self._sm() as s:
            rows = (
                await s.execute(
                    text(
                        "SELECT content FROM memory.items "
                        "ORDER BY embedding <=> CAST(:q AS vector) LIMIT :n"
                    ),
                    {"q": vec, "n": limit},
                )
            ).all()
        return [r[0] for r in rows]
