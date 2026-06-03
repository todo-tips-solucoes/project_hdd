"""Invariantes de segurança executáveis (Story 6.4 hardening) — ver docs/SECURITY.md.

Falham na CI se alguém violar um invariante crítico sem reavaliação explícita.
"""
from __future__ import annotations

from pathlib import Path

import yaml

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


def test_pc1_execute_contido_pelo_boundary_do_worker() -> None:
    # PC-1 (Story 7.7 / ADR 0006): na Fase 2 (meta-dogfood) o nó `execute` roda
    # `claude -p` DENTRO do container `worker`. A contenção de filesystem é o
    # MOUNT NAMESPACE do container: a árvore de produção (`/var/lib/projeto_hdd`)
    # e o diretório `./secrets` NÃO são montados no worker, então um Write com
    # path absoluto do agente não os alcança — eles não existem ali. Se alguém
    # montar a árvore de prod ou os secrets no worker, este invariante FALHA na CI
    # e reabre PC-1 (ver docs/decisions/0006). Segredos só via Docker secrets
    # (→ /run/secrets), nunca bind do diretório host.
    compose = yaml.safe_load(
        (Path(__file__).resolve().parents[3] / "compose.prod.yaml").read_text()
    )
    worker = compose["services"]["worker"]
    vols = worker.get("volumes", [])
    joined = "\n".join(vols)
    assert "projeto_hdd" not in joined, f"worker não pode montar a árvore de prod: {vols}"
    assert "secrets" not in joined, f"worker não pode bind-montar secrets: {vols}"
    # Só docker.sock (verify, ADR 0004) + o workspace root efêmero são montados.
    assert any("docker.sock" in v for v in vols)
    assert any("HDD_WORKSPACE_ROOT" in v or "hdd-workspaces" in v for v in vols)
    assert len(vols) == 2, f"mounts inesperados no worker — revise PC-1: {vols}"
    assert isinstance(worker.get("secrets"), list) and worker["secrets"]
