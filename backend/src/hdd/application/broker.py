"""CapabilityBroker — ponto de controle do Control Plane (Story 2.4).

Toda ação com efeito externo passa por aqui ANTES de executar. Se a regra a
classifica como destrutiva, levanta GateRequired (a onda suspende e convoca o
humano — RF-03b). Caso contrário, a ação segue com autonomia total.
"""
from __future__ import annotations

from hdd.domain.capability import (
    BrokerDecision,
    GateRequired,
    ProposedAction,
    classify,
)


class CapabilityBroker:
    def evaluate(self, action: ProposedAction) -> BrokerDecision:
        return classify(action)

    def authorize(self, action: ProposedAction) -> None:
        """Autoriza ou levanta GateRequired. Determinístico — não consulta o LLM."""
        decision = classify(action)
        if not decision.allowed:
            assert decision.gate is not None  # invariante: not allowed ⇒ gate
            raise GateRequired(decision.gate, decision.reason)
