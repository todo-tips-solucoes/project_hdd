"""Story 3.4 — pseudonimização de PII (LGPD)."""
from __future__ import annotations

from hdd.domain.pii import pseudonymize


def test_mascara_email():
    out = pseudonymize("contato joao@exemplo.com aqui")
    assert "[email]" in out
    assert "joao@exemplo.com" not in out


def test_mascara_telefone():
    out = pseudonymize("ligue +55 11 99999-8888 agora")
    assert "[phone]" in out


def test_texto_sem_pii_inalterado():
    assert pseudonymize("apenas um texto comum") == "apenas um texto comum"
