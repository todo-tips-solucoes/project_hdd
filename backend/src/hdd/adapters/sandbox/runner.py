"""Runner do sandbox — `docker run` efêmero e endurecido (Story 2.3, R-7).

Controles aplicados (defesa em profundidade contra a descoberta da PoC):
- `--user` não-root (10001) — sem privilégios de root no container.
- `--read-only` raiz + `--tmpfs /tmp` — FS read-only FORA do workspace.
- `-v workspace:/workspace:rw` — única área gravável.
- `--network none` (deny-all) por padrão — egress allowlist (Anthropic + repos
  da org) é o relaxamento controlado via proxy egress em produção (`network`).
- `--cap-drop ALL`, `--security-opt no-new-privileges`, limites de pids/memória.
- Sem credenciais de produção no ambiente do container.
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass, field


@dataclass(frozen=True)
class SandboxConfig:
    workspace: str
    image: str = "hdd-sandbox:latest"
    network: str = "none"  # deny-all; "allowlist-net" (proxy) libera Anthropic+GitHub
    user: str = "10001:10001"
    memory: str = "512m"
    pids_limit: int = 256
    timeout: int = 120
    extra_args: tuple[str, ...] = field(default_factory=tuple)
    oracle_dir: str | None = None  # montado em /oracle:ro apenas no nó verify


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str


class SandboxRunner:
    def _docker_cmd(self, command: list[str], cfg: SandboxConfig) -> list[str]:
        oracle_args = ["-v", f"{cfg.oracle_dir}:/oracle:ro"] if cfg.oracle_dir is not None else []
        return [
            "docker", "run", "--rm",
            "--user", cfg.user,
            "--read-only",
            "--tmpfs", "/tmp:rw,size=64m",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges",
            "--pids-limit", str(cfg.pids_limit),
            "--memory", cfg.memory,
            "--network", cfg.network,
            "-v", f"{cfg.workspace}:/workspace:rw",
            "-w", "/workspace",
            *cfg.extra_args,
            *oracle_args,
            cfg.image,
            *command,
        ]

    def run(self, command: list[str], cfg: SandboxConfig) -> SandboxResult:
        proc = subprocess.run(
            self._docker_cmd(command, cfg),
            capture_output=True,
            text=True,
            timeout=cfg.timeout,
        )
        return SandboxResult(proc.returncode, proc.stdout, proc.stderr)
