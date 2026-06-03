"""Validação de identificadores de repositório (domínio puro, zero I/O)."""
from __future__ import annotations

import re

_PART_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def parse_repo_slug(slug: str) -> tuple[str, str]:
    """Valida e decompõe um slug 'owner/repo' em (owner, repo).

    Lança ValueError com mensagem descritiva para qualquer formato inválido.
    """
    if not slug:
        raise ValueError("repo_slug não pode ser vazio")
    if " " in slug:
        raise ValueError(f"repo_slug não pode conter espaços: {slug!r}")
    parts = slug.split("/")
    if len(parts) != 2:
        raise ValueError(
            f"repo_slug deve ter exatamente uma barra (owner/repo), recebido: {slug!r}"
        )
    owner, repo = parts
    if not owner:
        raise ValueError(f"owner não pode ser vazio em repo_slug: {slug!r}")
    if not repo:
        raise ValueError(f"repo não pode ser vazio em repo_slug: {slug!r}")
    if owner in (".", ".."):
        raise ValueError(f"owner inválido em repo_slug: {slug!r}")
    if repo in (".", ".."):
        raise ValueError(f"repo inválido em repo_slug: {slug!r}")
    if not _PART_RE.match(owner):
        raise ValueError(f"owner contém caracteres inválidos em repo_slug: {slug!r}")
    if not _PART_RE.match(repo):
        raise ValueError(f"repo contém caracteres inválidos em repo_slug: {slug!r}")
    return owner, repo
