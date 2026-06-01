"""Story 6.6 — provisionamento com git REAL (opt-in): clona um repo local,
cria a branch da onda e limpa. Sem rede nem quota. `pytest -m integration`."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from hdd.adapters.workspace import WorkspaceProvisioner

pytestmark = pytest.mark.integration


def _git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)


def test_provision_real_clona_e_ramifica_e_limpa(tmp_path) -> None:
    origin = tmp_path / "origin"
    origin.mkdir()
    _git(origin, "init", "-q")
    _git(origin, "-c", "user.email=t@t", "-c", "user.name=t",
         "commit", "--allow-empty", "-q", "-m", "init")

    prov = WorkspaceProvisioner(str(origin), base_dir=str(tmp_path / "ws"))
    path = prov.provision("w-int")

    assert (Path(path) / ".git").exists()  # é um clone git
    branch = subprocess.run(
        ["git", "-C", path, "branch", "--show-current"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    assert branch == "hdd/wave-w-int"  # branch da onda criada

    prov.cleanup(path)
    assert not Path(path).exists()  # dir efêmero removido
