"""CapabilityBroker — ponto de controle do Control Plane (Story 2.4).

Wrapper de caso-de-uso sobre a regra pura `domain.capability`. Toda ação com
efeito externo passa por aqui ANTES de executar; se a regra a classifica como
destrutiva, levanta GateRequired (a onda suspende e convoca o humano — RF-03b).
"""
from __future__ import annotations

from hdd.domain import capability
from hdd.domain.capability import BrokerDecision, ProposedAction


class CapabilityBroker:
    def evaluate(self, action: ProposedAction) -> BrokerDecision:
        return capability.classify(action)

    def authorize(self, action: ProposedAction) -> None:
        """Autoriza ou levanta GateRequired. Determinístico — não consulta o LLM."""
        capability.authorize(action)
