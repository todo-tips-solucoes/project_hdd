"""CLI do operador (Story 2.9, RF-06).

Comandos: iniciar uma feature, ver estado de sessões/ondas, listar gates
pendentes e aprová-los/rejeitá-los. A CLI é um entrypoint: compõe os adapters.
"""
from __future__ import annotations

import asyncio
import json

import typer
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.gate_store import GateStore
from hdd.adapters.db.queue import WorkQueue
from hdd.adapters.db.repository import Repository
from hdd.adapters.lgpd import PiiVault
from hdd.config import get_settings
from hdd.contracts.events import EventType, make_event
from hdd.domain.session import SessionState

app = typer.Typer(help="HDD — orquestração autônoma de software (operador).", no_args_is_help=True)


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


@app.command()
def start(task: str) -> None:
    """Inicia uma feature: cria sessão + onda e enfileira a onda para o worker."""

    async def _go() -> tuple[str, str, str]:
        sm = _sessionmaker()
        repo = Repository(sm, AuditSink(sm))
        sid = await repo.create_session(task)
        await repo.set_session_state(sid, SessionState.RUNNING)
        wid = await repo.create_wave(sid)
        # thread_id = id da onda → casa o checkpoint LangGraph com a onda (Story 6.1).
        work_id = await WorkQueue(sm).enqueue(json.dumps({"task": task, "thread_id": wid}))
        return sid, wid, work_id

    sid, wid, work_id = asyncio.run(_go())
    typer.echo(f"sessão {sid} iniciada · onda {wid} · enfileirada {work_id}")


@app.command()
def status() -> None:
    """Lista sessões e seus estados."""

    async def _go() -> list[tuple[str, str, str]]:
        return await Repository(_sessionmaker()).list_sessions()

    rows = asyncio.run(_go())
    if not rows:
        typer.echo("(nenhuma sessão)")
        return
    for sid, state, task in rows:
        typer.echo(f"{sid}  {state:<14}  {task}")


@app.command()
def gates() -> None:
    """Lista gates pendentes de decisão."""

    async def _go() -> list[tuple[str, str, str, str]]:
        return await GateStore(_sessionmaker()).list_pending()

    rows = asyncio.run(_go())
    if not rows:
        typer.echo("(nenhum gate pendente)")
        return
    for gid, wave_id, gate_type, reason in rows:
        typer.echo(f"{gid}  [{gate_type}]  onda={wave_id}  {reason}")


@app.command()
def approve(gate_id: str, pin: str) -> None:
    """Aprova um gate pendente (PIN)."""

    async def _go() -> str:
        return str(await GateStore(_sessionmaker()).resolve(gate_id, pin, approve=True))

    typer.echo(asyncio.run(_go()))


@app.command()
def reject(gate_id: str, pin: str) -> None:
    """Rejeita um gate pendente (PIN)."""

    async def _go() -> str:
        return str(await GateStore(_sessionmaker()).resolve(gate_id, pin, approve=False))

    typer.echo(asyncio.run(_go()))


@app.command()
def forget(subject_id: str) -> None:
    """Direito à exclusão (LGPD): crypto-shredding dos dados do titular.

    Descarta a chave de cifra do titular (dado torna-se irrecuperável) e registra
    o ato na auditoria — sem PII. SUBJECT_ID deve ser o identificador pseudónimo.
    """

    async def _go() -> bool:
        sm = _sessionmaker()
        shredded = await PiiVault(sm).shred(subject_id)
        if shredded:
            await AuditSink(sm).append(
                make_event(
                    EventType.LGPD_ERASED,
                    correlation_id=subject_id,
                    actor="operator",
                    payload={"subject_id": subject_id},
                )
            )
        return shredded

    if asyncio.run(_go()):
        typer.echo(f"titular {subject_id}: chave descartada — dados irrecuperáveis")
    else:
        typer.echo(f"titular {subject_id}: nada a descartar (sem chave)")


def main() -> None:
    app()


if __name__ == "__main__":
    main()
