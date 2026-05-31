"""Gate manager — lógica pura de PIN/estado (Story 2.5, R-4).

O PIN é single-use, ligado ao gate_id (não confiar só no remetente), com
rate-limit e timeout. A aprovação acontece no canal autenticado (Painel); o
WhatsApp apenas notifica. Estados terminais nunca voltam a pendente.
"""
from __future__ import annotations

import hashlib
import secrets
from enum import StrEnum


class GateStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    LOCKED = "locked"  # excedeu tentativas de PIN


def generate_pin() -> str:
    """PIN numérico de 6 dígitos, aleatório criptográfico."""
    return f"{secrets.randbelow(1_000_000):06d}"


def pin_hash(gate_id: str, pin: str) -> str:
    """Hash ligado ao gate_id (R-4): um PIN só vale para o seu gate."""
    return hashlib.sha256(f"{gate_id}:{pin}".encode()).hexdigest()


def verify_pin(gate_id: str, pin: str, stored_hash: str) -> bool:
    return secrets.compare_digest(pin_hash(gate_id, pin), stored_hash)
