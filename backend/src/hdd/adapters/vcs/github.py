"""GitHubVcs — implementa a porta Vcs via git + gh CLI (Story 2.8 + 6.8).

Abre um **PR rascunho** (`open_pr`, no worker, a partir do clone da onda) e o
**integra ao aprovar o gate** (`merge_pr`, no resume da API — só precisa do número
do PR, não do workspace). `repo_slug` torna o `gh` explícito quanto ao repo
(`--repo owner/name`), necessário no merge na API onde não há git no cwd. O token
é escopado e injetado por ambiente (nunca logado). Runner injetável p/ testes.
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
    def __init__(
        self,
        repo_dir: str,
        runner: Runner = _default_runner,
        repo_slug: str | None = None,
    ) -> None:
        self._dir = repo_dir
        self._run = runner
        self._slug = repo_slug

    def _git(self, *args: str) -> str:
        return self._run(["git", "-C", self._dir, *args])

    def _repo_args(self) -> list[str]:
        return ["--repo", self._slug] if self._slug else []

    async def open_pr(self, branch: str, title: str, body: str) -> PrRef:
        # `-B` (idempotente): o provisionador da onda (Story 6.6) já cria e faz
        # checkout da branch ao montar o workspace; `-b` falharia ("already exists").
        self._git("checkout", "-B", branch)
        self._git("add", "-A")
        # Sem diff (o execute/claude não mudou nada) não há PR a abrir — sinaliza
        # de forma clara em vez do `git commit` falhar com "nothing to commit".
        if not self._git("status", "--porcelain").strip():
            raise ValueError("sem mudanças no workspace — nada a submeter")
        # Identidade explícita do bot: o clone efêmero (e o worker uid 10001) não
        # têm git config — sem isto o commit falha ("unable to auto-detect email").
        self._git(
            "-c", "user.email=hdd-bot@todo-tips.com", "-c", "user.name=HDD Bot",
            "commit", "-m", title,
        )
        self._git("push", "-u", "origin", branch)
        out = self._run(
            [
                "gh", "pr", "create", "--draft",
                "--head", branch,
                "--title", title,
                "--body", body,
                *self._repo_args(),
            ]
        )
        url = out.strip().splitlines()[-1] if out.strip() else ""
        match = re.search(r"/pull/(\d+)", url)
        number = int(match.group(1)) if match else 0
        return PrRef(number=number, url=url, branch=branch)

    async def merge_pr(self, pr_number: int) -> None:
        """Integra o PR: draft → ready → merge (squash, remove a branch da onda)."""
        n = str(pr_number)
        repo = self._repo_args()
        self._run(["gh", "pr", "ready", n, *repo])
        self._run(["gh", "pr", "merge", n, "--squash", "--delete-branch", *repo])
