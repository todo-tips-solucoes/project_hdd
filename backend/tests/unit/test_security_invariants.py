"""Invariantes de segurança executáveis (Story 6.4 hardening) — ver docs/SECURITY.md.

Falham na CI se alguém violar um invariante crítico sem reavaliação explícita.
"""
from __future__ import annotations

from hdd.adapters.llm.subscription import DEFAULT_DISALLOWED, WORKSPACE_DISALLOWED


def test_execute_nunca_libera_bash_nem_webfetch() -> None:
    # Invariante S-1/broker: o modo workspace (execute) bloqueia exec arbitrário no
    # host e egress. Liberar Bash sem wirar o CapabilityBroker + sandbox real é
    # proibido — se este teste falhar, leia docs/SECURITY.md (invariante #1).
    assert "Bash" in WORKSPACE_DISALLOWED
    assert "WebFetch" in WORKSPACE_DISALLOWED


def test_modo_padrao_bloqueia_toda_escrita_e_execucao() -> None:
    # plan/verify (sem workspace) não devem escrever/executar nada (G-1/G-2).
    for tool in ("Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "WebFetch"):
        assert tool in DEFAULT_DISALLOWED
