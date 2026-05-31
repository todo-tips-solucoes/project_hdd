"""Stream SSE de eventos ao vivo (Story 4.2).

Tail incremental de `audit.events` por `seq`. Ao conectar, faz um pequeno backfill
(histórico recente) e depois transmite cada novo evento. Fonte única de verdade =
a trilha de auditoria, então é durável e cross-process. Exige sessão (require_user).
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from hdd.adapters.audit.reader import EventReader

from ..deps import get_event_reader, require_user
from ..schemas import User

router = APIRouter(tags=["events"])

_BACKFILL = 50
_POLL_S = 1.0


@router.get("/events/stream")
async def stream(
    request: Request,
    _user: User = Depends(require_user),
    reader: EventReader = Depends(get_event_reader),
) -> EventSourceResponse:
    async def gen() -> AsyncGenerator[dict[str, str]]:
        latest = await reader.latest_seq()
        last = max(0, latest - _BACKFILL)
        while True:
            if await request.is_disconnected():
                break
            for rec in await reader.after(last, limit=100):
                last = rec.seq
                yield {
                    "event": "audit",
                    "id": str(rec.seq),
                    "data": json.dumps(
                        {
                            "seq": rec.seq,
                            "event_id": rec.event_id,
                            "type": rec.type,
                            "occurred_at": rec.occurred_at.isoformat(),
                            "correlation_id": rec.correlation_id,
                            "actor": rec.actor,
                            "payload": rec.payload,
                        }
                    ),
                }
            await asyncio.sleep(_POLL_S)

    return EventSourceResponse(gen())
