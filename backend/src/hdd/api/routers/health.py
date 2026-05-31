"""Health & métricas (Story 3.5) — infra, sem autenticação.

/healthz: liveness. /readyz: readiness (DB). /metrics: Prometheus.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.observability.health import check_db, liveness
from hdd.observability.metrics import render_metrics

from ..deps import get_sessionmaker

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return liveness()


@router.get("/readyz")
async def readyz(
    response: Response,
    sm: async_sessionmaker[AsyncSession] = Depends(get_sessionmaker),
) -> dict[str, str]:
    ok = await check_db(sm)
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "db_unavailable"}
    return {"status": "ok"}


@router.get("/metrics")
def metrics() -> Response:
    return Response(content=render_metrics(), media_type="text/plain; version=0.0.4")
