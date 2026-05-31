"""Story 2.9 — CLI: comandos registrados (sem DB)."""
from __future__ import annotations

from typer.testing import CliRunner

from hdd.cli.main import app

runner = CliRunner()


def test_help_lista_os_comandos():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for cmd in ("start", "status", "gates", "approve", "reject"):
        assert cmd in result.output
