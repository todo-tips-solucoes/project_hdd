"""Gate de testes adicionados — exige arquivos de teste modificados no workspace."""
from __future__ import annotations

import fnmatch
import subprocess
from collections.abc import Callable

from hdd.adapters.orchestrator.wave import Verifier
from hdd.config.settings import Settings

GitRunner = Callable[[str], str]


def _run_git_status(workspace: str) -> str:
    result = subprocess.run(
        ["git", "-C", workspace, "status", "--porcelain"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def make_git_tests_gate(
    settings: Settings,
    *,
    git_runner: GitRunner | None = None,
) -> Verifier:
    """Verifier que falha se nenhum arquivo de teste corresponde ao glob configurado."""
    runner: GitRunner = git_runner if git_runner is not None else _run_git_status
    glob_pattern = settings.require_tests_glob

    def acceptance(workspace: str) -> tuple[bool, str]:
        if not workspace:
            return (True, "")
        output = runner(workspace)
        matched = any(
            fnmatch.fnmatch(line[3:], glob_pattern)
            for line in output.splitlines()
            if len(line) > 3
        )
        if not matched:
            return (
                False,
                f"Nenhum arquivo de teste modificado corresponde ao padrão "
                f"'{glob_pattern}'. Adicione ou atualize testes de aceitação "
                "antes de prosseguir com a verificação.",
            )
        return (True, "")

    return acceptance
