"""Fila de gates — aprovar/rejeitar no canal autenticado (Story 4.3, RF-03b).

A aprovação ocorre AQUI (painel OAuth), nunca pelo WhatsApp: a sessão é a
autorização, então o PIN não precisa trafegar. Cada decisão: (1) resolve o gate,
(2) registra GATE_APPROVED/REJECTED na auditoria com o `actor` real, (3) retoma/
encerra a onda correspondente e (4) notifica o operador (best-effort).
"""
from __future__ import annotations

import contextlib

from fastapi import APIRouter, Depends, HTTPException, status

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.repository import Repository
from hdd.application.notifications import NotificationService
from hdd.contracts.events import EventType, make_event
from hdd.domain.gate import GateStatus
from hdd.domain.wave import WaveState

from ..deps import (
    WaveResumer,
    get_audit,
    get_gate_store,
    get_notifications,
    get_repository,
    get_wave_resumer,
    require_user,
)
from ..schemas import GateDecisionOut, GateOut, User

router = APIRouter(tags=["gates"])


@router.get("/gates", response_model=list[GateOut])
async def list_gates(
    _user: User = Depends(require_user),
    gate_store: GateStore = Depends(get_gate_store),
) -> list[GateOut]:
    pending = await gate_store.list_pending()
    return [
        GateOut(
            id=gid, wave_id=wid, gate_type=gt, reason=reason, status=str(GateStatus.PENDING)
        )
        for gid, wid, gt, reason in pending
    ]


@router.get("/gates/{gate_id}", response_model=GateOut)
async def get_gate(
    gate_id: str,
    _user: User = Depends(require_user),
    gate_store: GateStore = Depends(get_gate_store),
) -> GateOut:
    detail = await gate_store.detail(gate_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "gate inexistente")
    return GateOut(
        id=detail.id,
        wave_id=detail.wave_id,
        gate_type=detail.gate_type,
        reason=detail.reason,
        status=str(detail.status),
        created_at=detail.created_at,
        expires_at=detail.expires_at,
    )


async def _decide(
    gate_id: str,
    approve: bool,
    user: User,
    gate_store: GateStore,
    audit: AuditSink,
    repo: Repository,
    notifications: NotificationService,
    resume: WaveResumer,
) -> GateDecisionOut:
    detail = await gate_store.detail(gate_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "gate inexistente")

    was_pending = detail.status == GateStatus.PENDING
    new_status = await gate_store.resolve_authenticated(gate_id, approve)

    # Só há efeitos colaterais quando esta requisição de fato decidiu o gate
    # (idempotência: um 2º POST encontra o gate terminal → was_pending False).
    if was_pending and new_status in (GateStatus.APPROVED, GateStatus.REJECTED):
        evt = EventType.GATE_APPROVED if approve else EventType.GATE_REJECTED
        await audit.append(
            make_event(
                evt,
                correlation_id=detail.wave_id,
                actor=user.login,
                payload={"gate_id": gate_id, "gate_type": detail.gate_type},
            )
        )
        # Retoma a onda a partir do checkpoint LangGraph (SoT) — Story 6.2.
        # O grafo avança o nó `gate` → END (aprovação=merged, rejeição=failed) e
        # projetamos o estado final em app.waves (read-model). thread_id == wave_id.
        outcome = await resume(detail.wave_id, approve)
        if outcome.wave_state:
            await repo.sync_wave_state(detail.wave_id, WaveState(outcome.wave_state))
        if outcome.merge_error:  # merge falhou: registra na trilha (visível no painel)
            await audit.append(
                make_event(
                    EventType.ERROR_RAISED,
                    correlation_id=detail.wave_id,
                    actor=user.login,
                    payload={"context": "merge", "error": outcome.merge_error},
                )
            )
        # Notifica o operador (best-effort: falha de canal não invalida a decisão).
        with contextlib.suppress(Exception):
            await notifications.gate_resolved(
                gate_id, detail.gate_type, approve, user.login
            )

    return GateDecisionOut(id=gate_id, status=str(new_status))


@router.post("/gates/{gate_id}/approve", response_model=GateDecisionOut)
async def approve_gate(
    gate_id: str,
    user: User = Depends(require_user),
    gate_store: GateStore = Depends(get_gate_store),
    audit: AuditSink = Depends(get_audit),
    repo: Repository = Depends(get_repository),
    notifications: NotificationService = Depends(get_notifications),
    resume: WaveResumer = Depends(get_wave_resumer),
) -> GateDecisionOut:
    return await _decide(
        gate_id, True, user, gate_store, audit, repo, notifications, resume
    )


@router.post("/gates/{gate_id}/reject", response_model=GateDecisionOut)
async def reject_gate(
    gate_id: str,
    user: User = Depends(require_user),
    gate_store: GateStore = Depends(get_gate_store),
    audit: AuditSink = Depends(get_audit),
    repo: Repository = Depends(get_repository),
    notifications: NotificationService = Depends(get_notifications),
    resume: WaveResumer = Depends(get_wave_resumer),
) -> GateDecisionOut:
    return await _decide(
        gate_id, False, user, gate_store, audit, repo, notifications, resume
    )
