"""Story 2.3 — controles do sandbox provados com Docker real (opt-in).

Usa `alpine` (leve) para validar os controles de isolamento independentemente da
imagem de produção. `pytest -m integration`.
"""
from __future__ import annotations

import os

import pytest

from hdd.adapters.sandbox import SandboxConfig, SandboxRunner

pytestmark = pytest.mark.integration

IMAGE = "alpine:3.20"


def _cfg(workspace: str, **kw) -> SandboxConfig:
    return SandboxConfig(workspace=workspace, image=IMAGE, **kw)


def test_egress_bloqueado_por_padrao(tmp_path):
    r = SandboxRunner().run(
        ["sh", "-c", "wget -T 5 -q -O- https://example.com || echo BLOCKED"],
        _cfg(str(tmp_path)),
    )
    assert "BLOCKED" in r.stdout or r.exit_code != 0


def test_executa_como_uid_nao_root(tmp_path):
    r = SandboxRunner().run(["id", "-u"], _cfg(str(tmp_path)))
    assert r.stdout.strip() == "10001"


def test_fs_fora_do_workspace_read_only(tmp_path):
    r = SandboxRunner().run(
        ["sh", "-c", "echo x > /etc/hacked 2>&1 || echo READONLY"],
        _cfg(str(tmp_path)),
    )
    assert "READONLY" in r.stdout or r.exit_code != 0


def test_workspace_e_gravavel(tmp_path):
    os.chmod(tmp_path, 0o777)  # permite o uid 10001 escrever no bind mount
    r = SandboxRunner().run(
        ["sh", "-c", "echo ok > /workspace/out.txt && cat /workspace/out.txt"],
        _cfg(str(tmp_path)),
    )
    assert "ok" in r.stdout
    assert (tmp_path / "out.txt").exists()
