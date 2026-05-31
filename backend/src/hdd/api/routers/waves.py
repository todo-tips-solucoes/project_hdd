"""Snapshot de ondas/sessões para o painel (Story 4.2)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from hdd.adapters.db.repository import Repository

from ..deps import get_repository, require_user
from ..schemas import SessionOut, User, WaveOut, WavesSnapshot

router = APIRouter(tags=["waves"])


@router.get("/waves", response_model=WavesSnapshot)
async def list_waves(
    _user: User = Depends(require_user),
    repo: Repository = Depends(get_repository),
) -> WavesSnapshot:
    sessions = await repo.list_sessions()
    waves = await repo.list_waves()
    return WavesSnapshot(
        sessions=[SessionOut(id=s, state=st, task=t) for s, st, t in sessions],
        waves=[
            WaveOut(id=w, session_id=sid, state=state, n_corrections=n)
            for w, sid, state, n in waves
        ],
    )
