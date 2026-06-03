"""Story 2.8 — GitHubVcs (runner mockado, sem rede) + validação de slug de repo."""
from __future__ import annotations

import pytest

from hdd.adapters.vcs import GitHubVcs
from hdd.contracts.ports import Vcs
from hdd.domain.vcs import parse_repo_slug


def test_github_satisfaz_porta_vcs():
    assert isinstance(GitHubVcs("/repo"), Vcs)


async def test_open_pr_cria_draft_e_parseia_numero():
    calls: list[list[str]] = []

    def runner(cmd: list[str]) -> str:
        calls.append(cmd)
        if cmd[0] == "gh":
            return "https://github.com/o/r/pull/42\n"
        if "status" in cmd:
            return " M README.md\n"  # há diff a submeter
        return ""

    vcs = GitHubVcs("/repo", runner)
    pr = await vcs.open_pr("feature/x", "título", "corpo")

    assert pr.number == 42
    assert pr.branch == "feature/x"
    assert "/pull/42" in pr.url

    gh = next(c for c in calls if c[0] == "gh")
    assert "--draft" in gh  # abre rascunho
    assert any("checkout" in c and "-B" in c for c in calls)  # garante a branch (idempotente)
    commit = next(c for c in calls if "commit" in c)
    assert "user.email=hdd-bot@todo-tips.com" in commit  # identidade explícita do bot
    assert any("push" in c for c in calls)  # publicou


async def test_open_pr_sem_diff_levanta_erro_claro():
    # status --porcelain vazio = o execute não mudou nada → nada a submeter.
    def runner(cmd: list[str]) -> str:
        return "" if cmd[0] != "gh" else "https://github.com/o/r/pull/1\n"

    with pytest.raises(ValueError, match="sem mudanças"):
        await GitHubVcs("/repo", runner).open_pr("b", "t", "corpo")


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


# ---------------------------------------------------------------------------
# parse_repo_slug — validação de slug de repositório no domínio
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "slug,expected",
    [
        ("owner/repo", ("owner", "repo")),
        ("my-org/my-repo", ("my-org", "my-repo")),
        ("Org123/Repo_name", ("Org123", "Repo_name")),
        ("a/b.c", ("a", "b.c")),
        ("A1/B2-C3_D4.E5", ("A1", "B2-C3_D4.E5")),
    ],
)
def test_parse_repo_slug_validos(slug: str, expected: tuple[str, str]):
    assert parse_repo_slug(slug) == expected


@pytest.mark.parametrize(
    "slug,match",
    [
        ("", "vazio"),
        ("sem-barra", "uma barra"),
        ("owner/", "vazio"),
        ("/repo", "vazio"),
        ("a/b/c", "uma barra"),
        ("owner repo/x", "espaços"),
        ("owner/repo name", "espaços"),
        ("./repo", "inválido"),
        ("owner/..", "inválido"),
    ],
)
def test_parse_repo_slug_invalidos(slug: str, match: str):
    with pytest.raises(ValueError, match=match):
        parse_repo_slug(slug)
