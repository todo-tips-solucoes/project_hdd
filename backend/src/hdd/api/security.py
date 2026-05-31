"""Verificação HMAC do webhook inbound (Story 4.5, NFR-SEG).

n8n é a fronteira de confiança upstream. O corpo bruto é assinado com HMAC-SHA256
(`X-Hub-Signature-256: sha256=<hex>`), compatível com a assinatura nativa da Meta
Cloud API. Fail-closed: sem segredo ou sem assinatura → rejeita.
"""
from __future__ import annotations

import hashlib
import hmac


def verify_signature(raw: bytes, header: str, secret: str) -> bool:
    if not secret or not header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)
