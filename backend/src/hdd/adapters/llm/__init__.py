"""Adapter de LLM — driver subscription (claude -p) ou api (escala). RF-12."""
from __future__ import annotations

from hdd.contracts.ports import LLMProvider

from .api import ApiProvider
from .subscription import ClaudeSubscriptionProvider


def get_provider(driver: str, model: str | None = None) -> LLMProvider:
    """Factory por configuração (R-15). Trocar driver é só config, não arquitetura."""
    if driver == "subscription":
        return ClaudeSubscriptionProvider(model=model)
    if driver == "api":
        return ApiProvider(model=model)
    raise ValueError(f"driver LLM desconhecido: {driver!r}")


__all__ = ["get_provider", "ClaudeSubscriptionProvider", "ApiProvider"]
