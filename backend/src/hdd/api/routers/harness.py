"""Sumário do harness de ondas para o painel."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from hdd.adapters.db.repository import Repository
from hdd.domain.wave import WaveState

from ..deps import get_repository, require_user
from ..schemas import HarnessSummary, User

router = APIRouter(tags=["harness"])


@router.get("/harness", response_model=HarnessSummary)
async def get_harness(
    _user: User = Depends(require_user),
    repo: Repository = Depends(get_repository),
) -> HarnessSummary:
    waves = await repo.list_waves()
    gates_pending = await repo.count_pending_gates()

    total_waves = len(waves)
    by_state: dict[str, int] = {s.value: 0 for s in WaveState}
    total_corrections = 0
    reached_gate = 0
    escalated = 0
    failed = 0

    for _id, _sid, state, n_corrections in waves:
        total_corrections += n_corrections
        if state in by_state:
            by_state[state] += 1
        if state in (WaveState.AWAITING_GATE, WaveState.MERGED):
            reached_gate += 1
        if state == WaveState.ESCALATED:
            escalated += 1
        if state == WaveState.FAILED:
            failed += 1

    mean_corrections = total_corrections / total_waves if total_waves > 0 else 0.0

    _active_states = {
        WaveState.PLANNED,
        WaveState.EXECUTING,
        WaveState.VERIFYING,
        WaveState.CORRECTING,
    }
    active_waves = sum(by_state[s.value] for s in _active_states)

    merged = by_state[WaveState.MERGED.value]

    return HarnessSummary(
        total_waves=total_waves,
        by_state=by_state,
        total_corrections=total_corrections,
        mean_corrections=mean_corrections,
        reached_gate=reached_gate,
        escalated=escalated,
        failed=failed,
        merged=merged,
        gates_pending=gates_pending,
        active_waves=active_waves,
    )
