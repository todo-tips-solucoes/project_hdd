"""Stream SSE de eventos ao vivo (Story 4.2; hardening Story 6.11).

Tail incremental de `audit.events` por `seq`. Ao conectar, faz um pequeno backfill
(histórico recente) e depois transmite cada novo evento. Fonte única de verdade =
a trilha de auditoria, então é durável e cross-process. Exige sessão (require_user).

Resiliência (6.11): o gerador NÃO morre a erros transitórios do reader (Postgres
indisponível, restart de rotina, hipido de pool, timeout). Antes, uma exceção após
os headers `200` já enviados abortava o stream no meio → `RST_STREAM` HTTP/2 →
`ERR_HTTP2_PROTOCOL_ERROR` no navegador → todos os `EventSource` reconectando a cada
poll, martelando o DB em recuperação (thundering-herd). Agora cada ciclo de leitura
é guardado: em erro, loga e faz backoff, mantendo a conexão viva. Um heartbeat
(`ping`) preserva a conexão ociosa e detecta desconexão de forma limpa.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator, Awaitable, Callable

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from hdd.adapters.audit.reader import AuditRecord, EventReader
from hdd.observability.logging import get_logger

from ..deps import get_event_reader, require_user
from ..schemas import User

router = APIRouter(tags=["events"])
log = get_logger("api.events")

_BACKFILL = 50
_POLL_S = 1.0
_ERROR_BACKOFF_S = 2.0  # espera após erro transitório do reader antes de retentar
_PING_S = 15  # heartbeat de keep-alive (comentário SSE) emitido pelo sse-starlette


def _format(rec: AuditRecord) -> dict[str, str]:
    return {
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


async def event_stream(
    reader: EventReader,
    is_disconnected: Callable[[], Awaitable[bool]],
    *,
    poll_s: float = _POLL_S,
    error_backoff_s: float = _ERROR_BACKOFF_S,
) -> AsyncGenerator[dict[str, str]]:
    """Tail resiliente de `audit.events`. Erros do reader NÃO encerram o gerador:
    são logados e seguidos de backoff (a conexão SSE permanece aberta). `last` só
    avança nos eventos efetivamente emitidos, então o retry é idempotente."""
    last: int | None = None
    while True:
        if await is_disconnected():
            return
        try:
            if last is None:
                latest = await reader.latest_seq()
                last = max(0, latest - _BACKFILL)
            for rec in await reader.after(last, limit=100):
                last = rec.seq
                yield _format(rec)
        except Exception as exc:  # transitório (DB down/restart/timeout): mantém vivo
            log.warning("events.stream.reader_error", error=str(exc))
            await asyncio.sleep(error_backoff_s)
            continue
        await asyncio.sleep(poll_s)


@router.get("/events/stream")
async def stream(
    request: Request,
    _user: User = Depends(require_user),
    reader: EventReader = Depends(get_event_reader),
) -> EventSourceResponse:
    return EventSourceResponse(
        event_stream(reader, request.is_disconnected), ping=_PING_S
    )
