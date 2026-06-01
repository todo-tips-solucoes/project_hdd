"""Produtor da fila — iniciar uma feature enfileira uma onda (Story 6.1).

O painel autenticado dispara ondas: cria sessão + onda e enfileira o trabalho
para o worker (claim SKIP LOCKED). `thread_id` do payload = id da onda, para o
checkpoint LangGraph casar com a onda. Mesmo wiring da CLI `hdd start`.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends

from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.repository import Repository
from hdd.domain.session import SessionState

from ..deps import get_repository, get_work_queue, require_user
from ..schemas import FeatureStart, FeatureStarted, User

router = APIRouter(tags=["features"])


@router.post("/features", response_model=FeatureStarted, status_code=201)
async def start_feature(
    body: FeatureStart,
    _user: User = Depends(require_user),
    repo: Repository = Depends(get_repository),
    queue: WorkQueue = Depends(get_work_queue),
) -> FeatureStarted:
    sid = await repo.create_session(body.task)
    await repo.set_session_state(sid, SessionState.RUNNING)
    wid = await repo.create_wave(sid)
    work_id = await queue.enqueue(json.dumps({"task": body.task, "thread_id": wid}))
    return FeatureStarted(session_id=sid, wave_id=wid, work_id=work_id)
