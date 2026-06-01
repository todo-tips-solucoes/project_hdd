"""Story 6.3 — verificador no sandbox com Docker real (opt-in).

Usa `alpine` + comandos `true`/`false` (busybox) para provar que a verificação
de fato roda dentro do container endurecido e mapeia exit-code → bool, sem
depender da imagem de produção. `pytest -m integration`.
"""
from __future__ import annotations

import pytest

from hdd.adapters.sandbox.verifier import make_sandbox_verifier
from hdd.config.settings import Settings

pytestmark = pytest.mark.integration


def _settings(command: str) -> Settings:
    return Settings(
        verify_command=command, sandbox_image="alpine:3.20", sandbox_network="none"
    )


def test_verify_passa_com_suite_verde(tmp_path) -> None:
    verify = make_sandbox_verifier(_settings("true"))
    assert verify(str(tmp_path)) is True


def test_verify_reprova_com_suite_vermelha(tmp_path) -> None:
    verify = make_sandbox_verifier(_settings("false"))
    assert verify(str(tmp_path)) is False
