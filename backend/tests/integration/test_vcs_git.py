"""Story 6.4 — regressão: open_pr contra git REAL (bugs achados no smoke E2E).

Os testes de `test_vcs.py` usam runner FAKE (não executam git), por isso não
pegaram dois bugs reais do smoke: (1) o `checkout -b` colidia com a branch que o
provisionador (6.6) já cria; (2) o commit falhava sem identidade git no clone
efêmero. Aqui o git roda de verdade (o `gh` é stubado — não há GitHub local) e o
ambiente é hermético (sem config git global), provando que `open_pr`:
  - é idempotente quanto à branch pré-existente (`checkout -B`);
  - commita com identidade própria mesmo sem git config no host/clone.
"""
from __future__ import annotations

import os
import subprocess

import pytest

from hdd.adapters.vcs.github import GitHubVcs

pytestmark = pytest.mark.integration

# Ambiente git hermético: sem identidade/herança do host → o teste é determinístico.
_HERMETIC = {**os.environ, "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null"}


def _git(cwd: str, *args: str) -> None:
    subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True, env=_HERMETIC
    )


def _runner_git_real_gh_stub(cmd: list[str]) -> str:
    """git roda de verdade (ambiente hermético); `gh` é stubado."""
    if cmd[0] == "gh":
        return "https://github.com/o/r/pull/99\n"
    return subprocess.run(cmd, check=True, capture_output=True, text=True, env=_HERMETIC).stdout


async def test_open_pr_branch_preexistente_e_sem_identidade_git(tmp_path):
    origin = str(tmp_path / "origin.git")
    subprocess.run(["git", "init", "--bare", origin], check=True, capture_output=True)

    # Seed do remoto: clone, commit inicial, push para main.
    seed = str(tmp_path / "seed")
    _git(str(tmp_path), "clone", origin, seed)
    (tmp_path / "seed" / "README.md").write_text("inicial\n")
    _git(seed, "add", "-A")
    _git(seed, "-c", "user.email=s@s", "-c", "user.name=s", "commit", "-m", "init")
    _git(seed, "push", "origin", "HEAD:refs/heads/main")

    # Workspace estilo provisionador (6.6): clone + branch da onda JÁ criada.
    ws = str(tmp_path / "ws")
    _git(str(tmp_path), "clone", origin, ws)
    _git(ws, "checkout", "-b", "hdd/wave-x")  # branch pré-existe (como na produção)
    (tmp_path / "ws" / "README.md").write_text("inicial\nmudança da onda\n")  # "execute"

    # open_pr NÃO deve falhar: checkout -B idempotente + commit com identidade do bot.
    vcs = GitHubVcs(ws, _runner_git_real_gh_stub)
    pr = await vcs.open_pr("hdd/wave-x", "HDD: smoke", "corpo")

    assert pr.number == 99  # parseou o número do PR (gh stubado)
    log = subprocess.run(
        ["git", "-C", ws, "log", "--oneline", "-1"],
        check=True, capture_output=True, text=True, env=_HERMETIC,
    ).stdout
    assert "HDD: smoke" in log  # o commit foi criado (identidade aplicada)
    refs = subprocess.run(
        ["git", "-C", origin, "branch"], check=True, capture_output=True, text=True, env=_HERMETIC,
    ).stdout
    assert "hdd/wave-x" in refs  # a branch da onda foi publicada no origin
