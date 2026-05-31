"""Âncora WORM da auditoria (Story 3.3, R-5).

Publica periodicamente o head-hash da cadeia ASSINADO (HMAC) num armazenamento
externo imutável (R2/S3 com object-lock). Isso prova autenticidade/ordenação
mesmo contra um superusuário de DB que tente truncar e reescrever a cadeia — a
chain prova ordem; a âncora assinada prova que o head é autêntico.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Protocol

from .sink import AuditSink


class AnchorBackend(Protocol):
    """Armazenamento imutável. Em produção: R2/S3 com object-lock (WORM)."""

    def put(self, key: str, data: bytes) -> None: ...


class AnchorPublisher:
    def __init__(self, sink: AuditSink, backend: AnchorBackend, signing_key: bytes) -> None:
        self._sink = sink
        self._backend = backend
        self._key = signing_key

    async def publish(self, timestamp: str) -> dict[str, str]:
        head = await self._sink.head()
        signature = hmac.new(self._key, head.encode(), hashlib.sha256).hexdigest()
        anchor = {"head_hash": head, "signature": signature, "timestamp": timestamp}
        self._backend.put(f"audit-anchor-{timestamp}.json", json.dumps(anchor).encode())
        return anchor

    def verify(self, anchor: dict[str, str]) -> bool:
        expected = hmac.new(self._key, anchor["head_hash"].encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, anchor["signature"])
