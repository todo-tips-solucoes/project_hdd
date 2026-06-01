"""Story 2.8 — GitHubVcs (runner mockado, sem rede)."""
from __future__ import annotations

from hdd.adapters.vcs import GitHubVcs
from hdd.contracts.ports import Vcs


def test_github_satisfaz_porta_vcs():
    assert isinstance(GitHubVcs("/repo"), Vcs)


async def test_open_pr_cria_draft_e_parseia_numero():
    calls: list[list[str]] = []

    def runner(cmd: list[str]) -> str:
        calls.append(cmd)
        return "https://github.com/o/r/pull/42\n" if cmd[0] == "gh" else ""

    vcs = GitHubVcs("/repo", runner)
    pr = await vcs.open_pr("feature/x", "título", "corpo")

    assert pr.number == 42
    assert pr.branch == "feature/x"
    assert "/pull/42" in pr.url

    gh = next(c for c in calls if c[0] == "gh")
    assert "--draft" in gh  # abre rascunho
    assert any("checkout" in c and "-b" in c for c in calls)  # criou branch
    assert any("push" in c for c in calls)  # publicou


async def test_merge_pr_ready_depois_squash_com_repo_slug():
    calls: list[list[str]] = []

    def runner(cmd: list[str]) -> str:
        calls.append(cmd)
        return ""

    await GitHubVcs("/repo", runner, repo_slug="o/r").merge_pr(42)

    assert ["gh", "pr", "ready", "42", "--repo", "o/r"] in calls  # draft → ready
    merge = next(c for c in calls if "merge" in c)
    assert merge[:4] == ["gh", "pr", "merge", "42"]
    assert "--squash" in merge and "--delete-branch" in merge
    assert "--repo" in merge and "o/r" in merge  # explícito (resume na API sem cwd git)
