"""Driver de uma onda de calibração (Epic 7, Fase 1 — Stories 7.4/7.5/pool).

Roda UMA onda real ponta a ponta contra o repo-alvo (`HDD_REPO_URL`):
`enqueue → worker (claude → verify no sandbox → PR) → [gate]`. A aprovação do
gate é o ponto humano (hipótese H-A): por padrão o driver PARA no gate; o
sub-comando `approve` resolve o gate (resume → merge real).

Espelha o que `hdd start` (produtor) e a API (`routers/gates._decide` + resume)
fazem em produção, num único processo no host — útil para dirigir a calibração
sem subir o stack inteiro.

Uso (dentro de backend/, com o env das ondas exportado):
    uv run python scripts/calibration_wave.py run "Implemente ... com testes"
    uv run python scripts/calibration_wave.py approve <wave_id>
    uv run python scripts/calibration_wave.py status <wave_id>
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gap_store import GapStore
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.quota import QuotaLease
from hdd.adapters.db.repository import Repository
from hdd.adapters.orchestrator.factory import open_orchestrator
from hdd.config import get_settings
from hdd.contracts.events import EventType, make_event
from hdd.domain import wave as wv
from hdd.domain.session import SessionState
from hdd.observability import configure_logging
from hdd.observability.metrics import REGISTRY
from hdd.worker.loop import WorkerLoop
from hdd.worker.runner import build_wave_runner


def _m(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


def _print_metrics() -> None:
    print(
        "  métricas dogfood:",
        f"reached_gate={_m('hdd_wave_outcomes_total', outcome='reached_gate')}",
        f"escalated={_m('hdd_wave_outcomes_total', outcome='escalated')}",
        f"failed={_m('hdd_wave_outcomes_total', outcome='failed')}",
        f"quota_hit={_m('hdd_wave_outcomes_total', outcome='quota_hit')}",
        f"corrections_sum={_m('hdd_wave_corrections_sum')}",
    )


# --- Pré-flight de capacidade (correct-course OOM 2026-06-02, gate verificável) ---
# Salvaguarda do Epic 7: o `claude -p` do worker tem pico de RSS ~1.5-1.7 G; rodar o
# driver-no-host junto com worker-dev e prod numa máquina sem folga foi o que causou o
# OOM. Recusamos rodar a calibração sem as pré-condições mínimas. Ver
# docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md e docs/dogfood-calibragem.md.

MIN_MEM_AVAILABLE_KB = 2 * 1024 * 1024  # 2 GiB de folga mínima
SKIP_ENV = "HDD_CALIB_SKIP_PREFLIGHT"


def evaluate_capacity(
    swap_total_kb: int, mem_available_kb: int, max_concurrent: int
) -> list[str]:
    """Pura/testável: retorna as violações de capacidade (vazio = seguro)."""
    violations: list[str] = []
    if swap_total_kb <= 0:
        violations.append("swap inativo (SwapTotal=0) — habilite swap antes de calibrar")
    if max_concurrent != 1:
        violations.append(
            f"app.quota_counter.max_concurrent={max_concurrent} (esperado 1 nesta máquina)"
        )
    if mem_available_kb < MIN_MEM_AVAILABLE_KB:
        violations.append(
            f"MemAvailable={mem_available_kb} kB < {MIN_MEM_AVAILABLE_KB} kB de folga mínima "
            "(driver-no-host + worker-dev + prod competindo é o cenário do incidente)"
        )
    return violations


def _read_meminfo() -> tuple[int, int]:
    """(SwapTotal_kB, MemAvailable_kB) lidos de /proc/meminfo (Linux)."""
    swap_total = mem_available = 0
    try:
        with open("/proc/meminfo", encoding="ascii") as fh:
            for line in fh:
                if line.startswith("SwapTotal:"):
                    swap_total = int(line.split()[1])
                elif line.startswith("MemAvailable:"):
                    mem_available = int(line.split()[1])
    except OSError:
        pass
    return swap_total, mem_available


async def _preflight_capacity(sm: async_sessionmaker[AsyncSession]) -> None:
    swap_total, mem_available = _read_meminfo()
    max_concurrent = await QuotaLease(sm).current_max()
    violations = evaluate_capacity(swap_total, mem_available, max_concurrent)
    if not violations:
        print(
            f"  pré-flight de capacidade OK: swap={swap_total // 1024}MB "
            f"mem_avail={mem_available // 1024}MB max_concurrent={max_concurrent}"
        )
        return
    msg = "pré-flight de capacidade FALHOU:\n  - " + "\n  - ".join(violations)
    if os.getenv(SKIP_ENV) == "1":
        print(f"⚠️  {msg}")
        print(
            f"⚠️  {SKIP_ENV}=1 — prosseguindo SOB RISCO DECLARADO (possível OOM). "
            "Este é o atalho com custo explícito; o default seguro recusaria."
        )
        return
    raise SystemExit(
        f"{msg}\n\nCorrija (swap on / max_concurrent=1 / liberar RAM) ou, "
        f"assumindo o custo, rode com {SKIP_ENV}=1."
    )


async def cmd_run(task: str) -> None:
    settings = get_settings()
    if not settings.repo_url:
        raise SystemExit("HDD_REPO_URL vazio — configure o repo-alvo de calibração")
    sm = make_sessionmaker(make_engine(settings.pg_dsn))
    await _preflight_capacity(sm)
    repo = Repository(sm, AuditSink(sm))
    sid = await repo.create_session(task)
    await repo.set_session_state(sid, SessionState.RUNNING)
    wid = await repo.create_wave(sid)
    work_id = await WorkQueue(sm).enqueue(json.dumps({"task": task, "thread_id": wid}))
    print(f"onda {wid} enfileirada (work {work_id}) — repo={settings.repo_slug}")

    loop = WorkerLoop(WorkQueue(sm), QuotaLease(sm), build_wave_runner(settings), "calib-driver")
    print("rodando a onda (claude → verify → PR)…")
    outcome = await loop.run_once()
    print(f"run_once → {outcome}")
    _print_metrics()

    state = await repo.wave_state(wid) if hasattr(repo, "wave_state") else None
    print(f"  estado da onda: {state}")
    pend = [g for g in await GateStore(sm).list_pending() if g[1] == wid]
    for gid, _wid, gtype, reason in pend:
        print(f"  GATE pendente {gid} [{gtype}]: {reason}")
    if pend:
        print("\nrevise o PR e aprove com:")
        print(f"  uv run python scripts/calibration_wave.py approve {wid}")
    else:
        print("\n(sem gate — onda não chegou ao merge; ver métricas/gaps acima)")


async def cmd_approve(wid: str) -> None:
    settings = get_settings()
    sm = make_sessionmaker(make_engine(settings.pg_dsn))
    repo = Repository(sm, AuditSink(sm))
    audit = AuditSink(sm)
    gate_store = GateStore(sm)
    pend = [g for g in await gate_store.list_pending() if g[1] == wid]
    if not pend:
        raise SystemExit(f"sem gate pendente para a onda {wid}")
    gate_id = pend[0][0]
    status = await gate_store.resolve_authenticated(gate_id, approve=True)
    print(f"gate {gate_id} → {status}")
    async with open_orchestrator(settings) as orch:
        result = await orch.resume(wid, True)
    await repo.sync_wave_state(wid, wv.WaveState(str(result["wave_state"])))
    await audit.append(
        make_event(
            EventType.GATE_APPROVED,
            correlation_id=wid,
            actor="operador",
            payload={"gate_id": gate_id},
        )
    )
    print(f"onda → {result.get('wave_state')}  merge_error={result.get('merge_error')}")


async def cmd_status(wid: str) -> None:
    sm = make_sessionmaker(make_engine(get_settings().pg_dsn))
    gaps = [g for g in await GapStore(sm).list_gaps() if g.wave_id == wid]
    print(f"gaps da onda {wid}: {[(g.stage, g.reason[:60]) for g in gaps]}")
    _print_metrics()


def main() -> None:
    configure_logging("INFO")
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("task")
    a = sub.add_parser("approve")
    a.add_argument("wave_id")
    s = sub.add_parser("status")
    s.add_argument("wave_id")
    args = p.parse_args()
    if args.cmd == "run":
        asyncio.run(cmd_run(args.task))
    elif args.cmd == "approve":
        asyncio.run(cmd_approve(args.wave_id))
    elif args.cmd == "status":
        asyncio.run(cmd_status(args.wave_id))


if __name__ == "__main__":
    main()
