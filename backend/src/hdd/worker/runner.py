"""Wiring de produção do WaveRunner (Story 5.2): orquestrador real + checkpoint.

Constrói o WaveOrchestrator com o driver `claude -p` (subscription) e o
checkpointer durável (AsyncPostgresSaver) — mesmo padrão provado na PoC
(hdd_poc/engine.py): a durabilidade vem do checkpoint Postgres, nunca de
`--resume` do claude.

⚠️ Esta função invoca `claude -p` (custa quota) e só roda em deploy real — por
isso o WorkerLoop recebe o runner injetado e é testado com fakes.

`payload` é JSON: {"task": "...", "thread_id": "<opcional, default=work_id>"}.
A verificação automática (rodar testes no sandbox) é um follow-up; por ora um
verificador conservador encaminha ao gate de merge humano (RF-03b).
"""
from __future__ import annotations

import json

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from hdd.adapters.llm.subscription import ClaudeSubscriptionProvider
from hdd.adapters.orchestrator import WaveOrchestrator
from hdd.config.settings import Settings
from hdd.worker.loop import WaveRunner


def _verify(_workspace: str) -> bool:
    # Follow-up: rodar a suíte de testes no sandbox. Por ora encaminha ao gate
    # humano de merge (verificação automática "ok" → AWAITING_GATE).
    return True


def build_wave_runner(settings: Settings) -> WaveRunner:
    provider = ClaudeSubscriptionProvider(model=settings.model)
    dsn = settings.pg_dsn

    async def run_wave(work_id: str, payload: str) -> None:
        data = json.loads(payload)
        task = str(data["task"])
        thread_id = str(data.get("thread_id", work_id))
        async with AsyncPostgresSaver.from_conn_string(dsn) as checkpointer:
            await checkpointer.setup()
            orchestrator = WaveOrchestrator(provider, verify=_verify, checkpointer=checkpointer)
            await orchestrator.run_wave(thread_id, task)

    return run_wave
