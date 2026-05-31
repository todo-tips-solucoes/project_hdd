"""CLI fino para a PoC — usado também pelos testes para o cenário de KILL.

Uso:
  python -m hdd_poc.runner setup
  python -m hdd_poc.runner run <thread_id> <task>      # roda até o gate (ou crash via env)
  python -m hdd_poc.runner continue <thread_id>        # retoma após kill
  python -m hdd_poc.runner resume <thread_id> <true|false>
"""
from __future__ import annotations

import asyncio
import sys

from . import db, engine


async def _main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "setup":
        await db.setup_effects()
        print("ok")
    elif cmd == "run":
        await engine.run_until_gate(sys.argv[2], sys.argv[3])
        print("run-reached-gate")
    elif cmd == "continue":
        await engine.continue_run(sys.argv[2])
        print("continued")
    elif cmd == "resume":
        await engine.resume_gate(sys.argv[2], sys.argv[3].lower() == "true")
        print("resumed")
    else:
        print(f"comando desconhecido: {cmd}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))
