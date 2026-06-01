"""Driver `subscription`: invoca `claude -p` headless (conta de assinatura).

Implementa a porta LLMProvider. Reaproveita o que a PoC (Story 1.1) provou.

⚠️ DESCOBERTA da PoC: `claude -p` é um agente Claude Code COMPLETO (ferramentas
Write/Edit/Bash + contexto do projeto), não um LLM puro — produz efeitos
colaterais a partir do texto da tarefa (G-1/G-2). Mitigação obrigatória aqui:
bloquear ferramentas de escrita/execução por padrão. No worker (Story 2.x) isto
soma-se ao sandbox isolado e ao capability broker.
"""
from __future__ import annotations

import json
import subprocess

from hdd.contracts.dtos import LlmResult
from hdd.domain.errors import QuotaExhausted, TransientError

QUOTA_MARKERS = ("usage limit", "rate limit", "quota", "limit reached", "overloaded")
# Padrão (plan/verify, sem workspace): bloqueia TODA escrita/execução (G-1/G-2).
DEFAULT_DISALLOWED = ("Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "WebFetch")
# Modo workspace (execute, Story 6.6): libera escrita — contida ao clone efêmero
# pelo cwd — mas mantém Bash/WebFetch bloqueados (sem exec arbitrário no host nem
# egress). A execução de testes acontece no sandbox isolado (verify, Story 6.3).
WORKSPACE_DISALLOWED = ("Bash", "WebFetch")


def detect_quota(stdout: str, stderr: str, exit_code: int) -> bool:
    combined = (stdout + stderr).lower()
    return exit_code != 0 and any(m in combined for m in QUOTA_MARKERS)


class ClaudeSubscriptionProvider:
    """LLMProvider — driver subscription."""

    def __init__(
        self,
        model: str | None = None,
        timeout: int = 120,
        disallowed_tools: tuple[str, ...] = DEFAULT_DISALLOWED,
        cwd: str | None = None,
    ) -> None:
        self.model = model
        self.timeout = timeout
        self.disallowed_tools = disallowed_tools
        # cwd do `claude -p`: no modo workspace é o clone efêmero da onda, o que
        # contém Write/Edit ao diretório descartável (Story 6.6).
        self.cwd = cwd

    def invoke(self, prompt: str) -> LlmResult:
        cmd = ["claude", "-p", prompt, "--output-format", "json"]
        if self.model:
            cmd += ["--model", self.model]
        if self.disallowed_tools:
            cmd += ["--disallowedTools", *self.disallowed_tools]

        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=self.timeout, cwd=self.cwd
            )
        except subprocess.TimeoutExpired as exc:  # transitório: vale reintentar
            raise TransientError(f"claude -p excedeu timeout ({self.timeout}s)") from exc

        # Mapeamento exit-code → classe de erro (taxonomia R-12).
        if proc.returncode != 0:
            if detect_quota(proc.stdout, proc.stderr, proc.returncode):
                raise QuotaExhausted("claude -p atingiu limite de uso da conta")
            raise TransientError(f"claude -p falhou (exit {proc.returncode})")

        out = proc.stdout.strip()
        text, session_id = out, None
        try:
            data = json.loads(out)
            text = str(data.get("result", out))
            sid = data.get("session_id")
            session_id = str(sid) if sid is not None else None
        except json.JSONDecodeError:
            pass
        return LlmResult(
            text=text,
            session_id=session_id,
            exit_code=proc.returncode,
            quota_exhausted=False,
            raw=out,
        )
