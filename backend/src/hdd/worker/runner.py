"""Wiring de produção do WaveRunner (Story 5.2 + 6.2): roda a onda e faz a ponte
do `interrupt()` do LangGraph para o estado observável (app.waves + app.gates).

Constrói o WaveOrchestrator com o driver `claude -p` (subscription) e o
checkpointer durável (AsyncPostgresSaver) via `open_orchestrator` — mesmo padrão
provado na PoC: a durabilidade vem do checkpoint Postgres, nunca de `--resume`.

⚠️ Roda a onda invocando `claude -p` (custa quota) — só em deploy real. Por isso
o WorkerLoop recebe o runner injetado e é testado com fakes; a PONTE pós-onda
(`bridge_after_wave`) é pura e testável com DB real, sem quota.

Fluxo (6.2): a onda corre até o gate de merge (`interrupt()` → a graph pausa e
`run_wave` retorna com `wave_state=awaiting_gate`). A ponte então projeta
`app.waves.state` e ABRE um gate em `app.gates` para o painel decidir. O resume
após a decisão acontece na API (routers/gates.py), não aqui.

`payload` é JSON: {"task": "...", "thread_id": "<opcional, default=work_id>"}.
"""
from __future__ import annotations

import json
from typing import Any

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.repository import Repository
from hdd.adapters.orchestrator.factory import open_orchestrator
from hdd.adapters.sandbox.verifier import make_sandbox_verifier
from hdd.adapters.workspace import WorkspaceProvisioner, wave_branch
from hdd.config.settings import Settings
from hdd.domain import wave as wv
from hdd.domain.capability import GateType
from hdd.worker.loop import WaveRunner


async def bridge_after_wave(
    repo: Repository, gate_store: GateStore, thread_id: str, result: dict[str, Any]
) -> None:
    """Projeta o resultado da onda (checkpoint = SoT) para o estado observável.

    - Sincroniza `app.waves.state` com o `wave_state` do checkpoint (read-model).
    - Se a onda pausou no gate de merge, abre o gate (`app.gates`) para o painel.
    """
    raw = str(result.get("wave_state", ""))
    if not raw:
        return
    state = wv.WaveState(raw)
    await repo.sync_wave_state(thread_id, state)
    if state is wv.WaveState.AWAITING_GATE:
        pr_url = str(result.get("pr_url", ""))
        pr_error = str(result.get("pr_error", ""))
        if pr_url:
            reason = f"aprovar merge — PR {pr_url}"
        elif pr_error:  # PR não aberto: o operador vê o motivo ao decidir
            reason = f"aprovar merge — ⚠️ PR não aberto: {pr_error}"
        else:
            reason = "aprovar merge?"
        await gate_store.open_gate(thread_id, GateType.MERGE_DEPLOY, reason)


def build_wave_runner(settings: Settings) -> WaveRunner:
    sm = make_sessionmaker(make_engine(settings.pg_dsn))
    repo = Repository(sm, AuditSink(sm))
    gate_store = GateStore(sm)
    verify = make_sandbox_verifier(settings)  # Story 6.3: testes reais no sandbox
    provisioner = WorkspaceProvisioner(  # Story 6.6: clone efêmero por onda
        settings.repo_url, base_dir=settings.workspace_root or None
    )

    async def run_wave(work_id: str, payload: str) -> None:
        data = json.loads(payload)
        task = str(data["task"])
        thread_id = str(data.get("thread_id", work_id))
        # Sem repo_url configurado não há provisionamento (workspace=""): o
        # execute roda sem write e o verify defere ao gate (comportamento pré-6.6).
        workspace = provisioner.provision(thread_id) if settings.repo_url else ""
        branch = wave_branch(thread_id) if workspace else ""
        try:
            async with open_orchestrator(
                settings, verify=verify, workspace=workspace, allow_write=bool(workspace)
            ) as orchestrator:
                result = await orchestrator.run_wave(
                    thread_id, task, workspace=workspace, branch=branch
                )
            await bridge_after_wave(repo, gate_store, thread_id, result)
        finally:
            if workspace:
                provisioner.cleanup(workspace)

    return run_wave
