"""Entrypoint do worker (`python -m hdd.worker`).

Story 5.1 entrega a **casca runnable**: configura logging, instala handlers de
sinal (encerramento gracioso no `docker stack` / Swarm) e mantém o processo vivo
com heartbeat — suficiente para o serviço subir no Swarm com 1 nó.

O **loop real** (claim da fila com SKIP LOCKED → lease de quota global → executa
a onda → libera o lease, com lease TTL/reaper para slots vazados em crash) entra
na **Story 5.2**, substituindo o corpo do laço abaixo.
"""
from __future__ import annotations

import asyncio
import signal

from hdd.config import get_settings
from hdd.observability import configure_logging, get_logger

_HEARTBEAT_S = 30.0


async def _run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    log = get_logger("worker")

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)

    log.info("worker.iniciado", llm_driver=settings.llm_driver, model=settings.model)
    while not stop.is_set():
        # Story 5.2: claim → quota lease → executa onda → release.
        try:
            await asyncio.wait_for(stop.wait(), timeout=_HEARTBEAT_S)
        except TimeoutError:
            log.debug("worker.heartbeat")
    log.info("worker.encerrado")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
