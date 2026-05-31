"""Entrypoint do worker (`python -m hdd.worker`) — Story 5.2.

Compõe os adapters reais (fila SKIP LOCKED + lease de quota global) e roda o
WorkerLoop até receber SIGTERM/SIGINT (encerramento gracioso no Swarm).
"""
from __future__ import annotations

import asyncio
import signal
import socket

import uuid_utils

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.quota import QuotaLease
from hdd.config import get_settings
from hdd.observability import configure_logging, get_logger
from hdd.worker.loop import WorkerLoop
from hdd.worker.runner import build_wave_runner


async def _run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    log = get_logger("worker")

    sm = make_sessionmaker(make_engine(settings.pg_dsn))
    worker_id = f"{socket.gethostname()}-{uuid_utils.uuid7()}"
    loop = WorkerLoop(
        queue=WorkQueue(sm),
        quota=QuotaLease(sm),
        run_wave=build_wave_runner(settings),
        worker_id=worker_id,
    )

    stop = asyncio.Event()
    event_loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        event_loop.add_signal_handler(sig, stop.set)

    log.info("worker.iniciado", worker_id=worker_id, llm_driver=settings.llm_driver)
    await loop.run_forever(stop)
    log.info("worker.encerrado", worker_id=worker_id)


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
