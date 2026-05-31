"""Pseudonimização de PII (LGPD, NFR-LGPD-1).

PII nunca entra em claro no audit nem nos embeddings: e-mails e telefones são
mascarados antes de qualquer persistência. Produção complementa com pgcrypto +
crypto-shredding para o direito à exclusão (Story 5.6).
"""
from __future__ import annotations

import re

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def pseudonymize(text: str) -> str:
    text = _EMAIL.sub("[email]", text)
    text = _PHONE.sub("[phone]", text)
    return text
