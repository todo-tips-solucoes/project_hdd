"""Story 6.1 — produtor da fila: CLI e API enfileiram a onda para o worker.

Prova o ENFILEIRAMENTO (não roda o worker real, que invoca `claude -p` e custa
quota): após iniciar uma feature, há 1 item `pending` em app.work_queue cujo
payload decodifica para {task, thread_id == wave_id}; `WorkQueue.claim()` o devolve.
"""
from __future__ import annotations

import asyncio
import json
import re

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from typer.testing import CliRunner

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.db.queue import WorkQueue
from hdd.api.app import create_app
from hdd.api.deps import require_user
from hdd.api.schemas import User
from hdd.cli.main import app as cli_app
from hdd.config import get_settings

pytestmark = pytest.mark.integration

runner = CliRunner()


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def _clear_queue() -> None:
    sm = _sm()
    async with sm() as s:
        await s.execute(text("DELETE FROM app.work_queue"))
        await s.commit()


def test_cli_start_enfileira_a_onda() -> None:
    asyncio.run(_clear_queue())

    r = runner.invoke(cli_app, ["start", "tarefa via cli 6.1"])
    assert r.exit_code == 0, r.output
    wid = re.search(r"onda (\S+)", r.output).group(1)  # type: ignore[union-attr]
    work_id = re.search(r"enfileirada (\S+)", r.output).group(1)  # type: ignore[union-attr]

    claimed = asyncio.run(WorkQueue(_sm()).claim())
    assert claimed is not None, "fila não devolveu o item enfileirado"
    claimed_id, payload = claimed
    assert claimed_id == work_id  # o item da fila é o que a CLI ecoou
    data = json.loads(payload)
    assert data == {"task": "tarefa via cli 6.1", "thread_id": wid}


def test_api_features_enfileira_a_onda() -> None:
    asyncio.run(_clear_queue())

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")  # painel autenticado
    with TestClient(app) as c:
        resp = c.post("/api/features", json={"task": "tarefa via api 6.1"})
    assert resp.status_code == 201, resp.text
    body = resp.json()

    claimed = asyncio.run(WorkQueue(_sm()).claim())
    assert claimed is not None
    claimed_id, payload = claimed
    assert claimed_id == body["work_id"]
    data = json.loads(payload)
    assert data == {"task": "tarefa via api 6.1", "thread_id": body["wave_id"]}
