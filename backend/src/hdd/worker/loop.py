"""Loop do worker (Story 5.2): claim → lease → roda a onda → libera.

Ordem **quota-first**: sem lease o worker AGUARDA (não toca a fila), respeitando
o teto global de `claude -p` entre N workers (Swarm). Durante a onda, um
heartbeat renova o lease; em crash, o lease expira e o reaper recupera o slot
(sem vazamento — ver adapters/db/quota.py).

As dependências são injetadas via Protocol (testável com fakes, sem Postgres).
"""
from __future__ import annotations

import asyncio
import contextlib
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Protocol

from hdd.observability import get_logger
from hdd.observability.metrics import (
    quota_acquisitions,
    wave_duration,
    wave_failures,
)

log = get_logger("worker")

# (work_id, payload) → executa a onda. Lança exceção em falha.
WaveRunner = Callable[[str, str], Awaitable[None]]


class Queue(Protocol):
    async def claim(self) -> tuple[str, str] | None: ...
    async def complete(self, work_id: str) -> None: ...
    async def fail(self, work_id: str) -> None: ...


class Quota(Protocol):
    async def acquire(self, worker_id: str) -> str | None: ...
    async def release(self, lease_id: str) -> None: ...
    async def renew(self, lease_id: str) -> bool: ...


class WorkerLoop:
    def __init__(
        self,
        queue: Queue,
        quota: Quota,
        run_wave: WaveRunner,
        worker_id: str,
        *,
        poll_interval: float = 2.0,
        full_backoff: float = 5.0,
        heartbeat_interval: float = 30.0,
        liveness_path: str | None = None,
    ) -> None:
        self._queue = queue
        self._quota = quota
        self._run_wave = run_wave
        self._worker_id = worker_id
        self._poll = poll_interval
        self._backoff = full_backoff
        self._hb_interval = heartbeat_interval
        # Arquivo de liveness para o HEALTHCHECK do container: atualizado a cada
        # iteração e durante ondas longas (prova que o loop não travou).
        self._liveness = Path(liveness_path) if liveness_path else None

    def _beat(self) -> None:
        if self._liveness is not None:
            self._liveness.write_text(str(time.time()))

    async def _heartbeat(self, lease_id: str) -> None:
        while True:
            await asyncio.sleep(self._hb_interval)
            if not await self._quota.renew(lease_id):
                # TTL >> heartbeat: só chega aqui se o worker ficou preso > TTL.
                log.warning("worker.lease_perdido", lease_id=lease_id)
            self._beat()

    async def _run_item(self, work_id: str, payload: str, lease_id: str) -> None:
        hb = asyncio.create_task(self._heartbeat(lease_id))
        started = time.time()
        try:
            await self._run_wave(work_id, payload)
            await self._queue.complete(work_id)
            log.info("worker.onda_concluida", work_id=work_id)
        except Exception:
            wave_failures.inc()  # sinal p/ alerta de taxa de falha de ondas
            await self._queue.fail(work_id)
            log.exception("worker.onda_falhou", work_id=work_id)
        finally:
            wave_duration.observe(time.time() - started)
            hb.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await hb

    async def run_once(self) -> str:
        """Uma iteração. Retorna 'no_quota' | 'empty' | 'done' (observabilidade/teste)."""
        lease_id = await self._quota.acquire(self._worker_id)
        if lease_id is None:
            quota_acquisitions.labels(result="no_quota").inc()  # teto/quota → alerta
            return "no_quota"  # teto global atingido → aguardar (AC 5.2)
        quota_acquisitions.labels(result="acquired").inc()
        try:
            item = await self._queue.claim()
            if item is None:
                return "empty"
            work_id, payload = item
            await self._run_item(work_id, payload, lease_id)
            return "done"
        finally:
            await self._quota.release(lease_id)

    async def run_forever(self, stop: asyncio.Event) -> None:
        log.info("worker.loop_iniciado", worker_id=self._worker_id)
        while not stop.is_set():
            self._beat()
            outcome = await self.run_once()
            if outcome == "done":
                delay = 0.0
            elif outcome == "no_quota":
                delay = self._backoff
            else:
                delay = self._poll
            if delay:
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(stop.wait(), timeout=delay)
        log.info("worker.loop_encerrado", worker_id=self._worker_id)
