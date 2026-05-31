"""Story 2.9 — CLI ponta-a-ponta contra o DB (opt-in)."""
from __future__ import annotations

import pytest
from typer.testing import CliRunner

from hdd.cli.main import app

pytestmark = pytest.mark.integration

runner = CliRunner()


def test_start_e_status():
    r = runner.invoke(app, ["start", "tarefa via cli"])
    assert r.exit_code == 0, r.output
    assert "iniciada" in r.output

    r2 = runner.invoke(app, ["status"])
    assert r2.exit_code == 0
    assert "running" in r2.output
