"""Testes para hdd.domain.marker — detect_quota_exhausted."""
from __future__ import annotations

import pytest

from hdd.domain.marker import detect_quota_exhausted


@pytest.mark.parametrize(
    "stdout,stderr",
    [
        ("", "usage limit reached"),
        ("", "rate limit exceeded"),
        ("quota exceeded", ""),
        ("", "limit reached"),
        ("system overloaded", ""),
        # marcador no stdout
        ("approaching usage limit", ""),
        # marcador fragmentado entre stdout e stderr não deve disparar (cada um é verificado junto)
        ("Rate Limit", ""),  # case-insensitive
        ("", "QUOTA EXHAUSTED"),
    ],
)
def test_detecta_quota_esgotada(stdout: str, stderr: str) -> None:
    assert detect_quota_exhausted(stdout, stderr) is True


@pytest.mark.parametrize(
    "stdout,stderr",
    [
        ('{"result":"OK"}', ""),
        ("", ""),
        ("sucesso", "nenhum erro"),
        ("", "permission denied"),
        ("timed out waiting", ""),
    ],
)
def test_nao_detecta_sem_marcadores(stdout: str, stderr: str) -> None:
    assert detect_quota_exhausted(stdout, stderr) is False
