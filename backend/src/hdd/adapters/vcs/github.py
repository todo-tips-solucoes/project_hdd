"""GitHubVcs — implementa a porta Vcs via git + gh CLI (Story 2.8).

Abre sempre um **PR rascunho** (nunca faz merge): o merge em branch protegida é
gate RF-03b.1, interceptado pelo capability broker. O token é escopado e injetado
por ambiente (nunca logado). O runner é injetável para testes sem rede.
"""
from __future__ import annotations

import re
import subprocess
from collections.abc import Callable

from hdd.contracts.dtos import PrRef

Runner = Callable[[list[str]], str]


def _default_runner(cmd: list[str]) -> str:
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


class GitHubVcs:
    def __init__(self, repo_dir: str, runner: Runner = _default_runner) -> None:
        self._dir = repo_dir
        self._run = runner

    def _git(self, *args: str) -> str:
        return self._run(["git", "-C", self._dir, *args])

    async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
        self._git("checkout", "-b", branch)
        self._git("add", "-A")
        self._git("commit", "-m", title)
        self._git("push", "-u", "origin", branch)
        out = self._run(
            [
                "gh", "pr", "create", "--draft",
                "--head", branch,
                "--title", title,
                "--body", body,
            ]
        )
        url = out.strip().splitlines()[-1] if out.strip() else ""
        match = re.search(r"/pull/(\d+)", url)
        number = int(match.group(1)) if match else 0
        return PrRef(number=number, url=url, branch=branch)
