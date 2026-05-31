"""Testes de unidade da fundação hexagonal (sem I/O — rápidos)."""
from __future__ import annotations

from datetime import UTC, datetime

from hdd.adapters.llm import ApiProvider, ClaudeSubscriptionProvider, get_provider
from hdd.contracts.events import GENESIS_HASH, EventEnvelope, EventType
from hdd.contracts.ports import LLMProvider
from hdd.domain.errors import (
    DomainError,
    FatalError,
    HddError,
    QuotaExhausted,
    TransientError,
)


def test_taxonomia_de_erros_herda_de_hdderror():
    for cls in (TransientError, QuotaExhausted, DomainError, FatalError):
        assert issubclass(cls, HddError)


def test_subscription_satisfaz_porta_llmprovider():
    provider = ClaudeSubscriptionProvider()
    assert isinstance(provider, LLMProvider)  # runtime_checkable


def test_factory_seleciona_driver():
    assert isinstance(get_provider("subscription"), ClaudeSubscriptionProvider)
    assert isinstance(get_provider("api"), ApiProvider)


def test_factory_rejeita_driver_invalido():
    try:
        get_provider("nope")
    except ValueError:
        return
    raise AssertionError("driver inválido deveria levantar ValueError")


def test_hash_chain_encadeia_e_e_deterministico():
    ev = EventEnvelope(
        type=EventType.WAVE_STARTED,
        occurred_at=datetime(2026, 5, 31, tzinfo=UTC),
        correlation_id="corr-1",
        actor="orchestrator",
        payload={"task": "x"},
    )
    h1 = ev.chain_hash(GENESIS_HASH)
    h2 = ev.chain_hash(GENESIS_HASH)
    assert h1 == h2  # determinístico
    assert len(h1) == 64  # SHA-256 hex
    # encadear a partir de um head diferente muda o hash
    assert ev.chain_hash("a" * 64) != h1
