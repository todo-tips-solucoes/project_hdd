"""Provisionamento de workspace efêmero por onda (Story 6.6).

Clona o repo-alvo num diretório descartável e cria a branch da onda. O `claude`
do nó `execute` roda com cwd nesse dir (Write/Edit contidos ao clone, Story 6.6);
o `verify` (Story 6.3) roda a suíte contra ele no sandbox; ao fim da onda o dir
é removido. Nenhum segredo de produção entra no sandbox — o token git é injetado
por ambiente no host (não no container de verificação).

Lifecycle (decisão MVP): o workspace é limpo ao retornar de `run_wave` (a onda
pausou no gate ou terminou). Quando houver merge/push REAL — que precisaria do
workspace no resume (na API) — a lifecycle terá de ser estendida (follow-up).
"""
from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable
from pathlib import Path
from tempfile import gettempdir

# Executa um comando git; lança em falha (clone/checkout). Injetável p/ testes.
Runner = Callable[[list[str]], None]


def _default_runner(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, capture_output=True, text=True)


def wave_branch(wave_id: str) -> str:
    """Nome da branch da onda — convenção partilhada (provisioner + nó de PR, 6.7)."""
    return f"hdd/wave-{wave_id}"


class WorkspaceProvisioner:
    def __init__(
        self,
        repo_url: str,
        base_dir: str | None = None,
        runner: Runner = _default_runner,
    ) -> None:
        self._repo_url = repo_url
        self._base = Path(base_dir) if base_dir else Path(gettempdir())
        self._run = runner

    def provision(self, wave_id: str) -> str:
        """Clona o repo num dir efêmero e cria a branch da onda. Devolve o caminho."""
        self._base.mkdir(parents=True, exist_ok=True)
        path = str(self._base / f"hdd-wave-{wave_id}")
        self._run(["git", "clone", "--depth", "1", self._repo_url, path])
        self._run(["git", "-C", path, "checkout", "-b", wave_branch(wave_id)])
        return path

    def cleanup(self, path: str) -> None:
        shutil.rmtree(path, ignore_errors=True)
