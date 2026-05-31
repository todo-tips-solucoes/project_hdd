"""Sandbox de execução — isola o `claude -p` num container efêmero (Story 2.3)."""

from .runner import SandboxConfig, SandboxResult, SandboxRunner

__all__ = ["SandboxConfig", "SandboxResult", "SandboxRunner"]
