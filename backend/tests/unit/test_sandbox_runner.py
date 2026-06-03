"""Testes unitários de SandboxRunner._docker_cmd (sem Docker real).

Verifica que o comando gerado é idêntico ao comportamento atual quando
oracle_dir é None, e que o volume /oracle:ro é injetado antes da imagem
quando oracle_dir está definido.
"""
from __future__ import annotations

from hdd.adapters.sandbox.runner import SandboxConfig, SandboxRunner

_BASE_CMD = ["pytest", "-q"]


def _cmd(cfg: SandboxConfig) -> list[str]:
    return SandboxRunner()._docker_cmd(_BASE_CMD, cfg)


def test_sem_oracle_comando_identico_ao_atual() -> None:
    cfg_none = SandboxConfig(workspace="/ws", oracle_dir=None)
    cfg_omit = SandboxConfig(workspace="/ws")
    assert _cmd(cfg_none) == _cmd(cfg_omit)
    assert "/oracle" not in " ".join(_cmd(cfg_none))


def test_com_oracle_adiciona_volume_ro_antes_da_imagem() -> None:
    cfg = SandboxConfig(workspace="/ws", oracle_dir="/secrets/oracle")
    cmd = _cmd(cfg)
    image_idx = cmd.index("hdd-sandbox:latest")
    oracle_v_idx = cmd.index("/secrets/oracle:/oracle:ro")
    assert oracle_v_idx < image_idx
    assert cmd[oracle_v_idx - 1] == "-v"


def test_com_oracle_workspace_permanece_rw() -> None:
    cfg = SandboxConfig(workspace="/ws", oracle_dir="/o")
    cmd = _cmd(cfg)
    assert "/ws:/workspace:rw" in cmd
    assert "/o:/oracle:ro" in cmd
