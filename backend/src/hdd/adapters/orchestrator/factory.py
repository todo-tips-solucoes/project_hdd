"""Construção do WaveOrchestrator com checkpoint Postgres durável (Story 6.2).

Fábrica compartilhada entre o worker (rodar a onda até o gate) e a API (retomar
a onda após a decisão do painel). A durabilidade vem do checkpoint Postgres —
nunca de `--resume` do claude (invariante provado na PoC).

⚠️ `ClaudeSubscriptionProvider` é construído aqui mas só invoca `claude -p` quando
um nó do grafo o chama. O `resume` após o gate só roda o nó `gate` → END (sem
LLM), então retomar uma onda NÃO custa quota.
"""
from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from hdd.adapters.llm.subscription import (
    DEFAULT_DISALLOWED,
    WORKSPACE_DISALLOWED,
    ClaudeSubscriptionProvider,
)
from hdd.adapters.orchestrator.wave import Verifier, WaveOrchestrator
from hdd.adapters.vcs import GitHubVcs
from hdd.config.settings import Settings


def _always_ok(_workspace: str) -> bool:
    # Default para o caminho de RESUME (API), onde o nó `verify` nunca é
    # reexecutado. O worker injeta o verificador real do sandbox (Story 6.3).
    return True


@contextlib.asynccontextmanager
async def open_orchestrator(
    settings: Settings,
    verify: Verifier = _always_ok,
    *,
    workspace: str = "",
    allow_write: bool = False,
) -> AsyncIterator[WaveOrchestrator]:
    # Story 6.6: com workspace, o `claude` roda com cwd no clone efêmero e escrita
    # liberada (contida ao dir); sem workspace, mantém o bloqueio total (pré-6.6).
    disallowed = WORKSPACE_DISALLOWED if allow_write else DEFAULT_DISALLOWED
    provider = ClaudeSubscriptionProvider(
        model=settings.model,
        cwd=workspace or None,
        disallowed_tools=disallowed,
        # Modo workspace: auto-aceita edições (senão o claude -p não escreve nada).
        permission_mode="acceptEdits" if allow_write else None,
    )
    # Worker (com workspace): nó `pr` abre o PR a partir do clone (6.7).
    # Resume na API (sem workspace, com repo_slug): nó `gate` mergeia via `gh
    # --repo` (6.8). Sem nenhum dos dois → sem VCS (dev).
    vcs = None
    if workspace or settings.repo_slug:
        vcs = GitHubVcs(workspace or ".", repo_slug=settings.repo_slug or None)
    async with AsyncPostgresSaver.from_conn_string(settings.pg_dsn) as checkpointer:
        await checkpointer.setup()
        yield WaveOrchestrator(
            provider, verify=verify, checkpointer=checkpointer, vcs=vcs
        )
