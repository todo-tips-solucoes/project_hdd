"""Story 2.5 — lógica pura de PIN do gate."""
from __future__ import annotations

from hdd.domain.gate import generate_pin, pin_hash, verify_pin


def test_pin_tem_6_digitos():
    p = generate_pin()
    assert len(p) == 6 and p.isdigit()


def test_pin_ligado_ao_gate_id():
    h = pin_hash("gate-1", "123456")
    assert verify_pin("gate-1", "123456", h) is True
    assert verify_pin("gate-2", "123456", h) is False  # mesmo PIN, outro gate → inválido


def test_pin_errado_falha():
    h = pin_hash("gate-1", "111111")
    assert verify_pin("gate-1", "000000", h) is False
