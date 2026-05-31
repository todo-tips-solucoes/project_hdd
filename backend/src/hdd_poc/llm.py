"""Adapter do driver `subscription`: invoca `claude -p` headless.

Princípios da arquitetura (R-11/R-14):
- STATELESS por nó: o prompt é reconstruído a cada invocação; NÃO usamos
  `--resume` para correção de estado (só seria otimização de custo).
- `--output-format json` e mapeamento exit-code → classe de erro.
- Detecção de exaustão de quota (critério 5).
"""
from __future__ import annotations

import dataclasses
import json
import subprocess

QUOTA_MARKERS = ("usage limit", "rate limit", "quota", "limit reached", "overloaded")

# DESCOBERTA EMPÍRICA (PoC Story 1.1): `claude -p` é um agente Claude Code COMPLETO,
# não um LLM puro — herda ferramentas (Write/Edit/Bash) e o contexto do projeto, e
# produz efeitos colaterais não pedidos (criou memória a partir do texto da tarefa).
# Validou G-1/G-2 da revisão adversarial. Mitigação mínima: bloquear ferramentas de
# escrita/execução por padrão. No produto (Story 2.3) isto soma-se ao sandbox isolado.
DEFAULT_DISALLOWED = ("Write", "Edit", "MultiEdit", "NotebookEdit", "Bash", "WebFetch")


@dataclasses.dataclass
class LlmResult:
    text: str
    session_id: str | None
    exit_code: int
    quota_exhausted: bool
    raw: str


class ClaudeSubscriptionProvider:
    """LLMProvider — driver subscription (claude -p)."""

    def __init__(
        self,
        model: str | None = None,
        timeout: int = 120,
        disallowed_tools: tuple[str, ...] = DEFAULT_DISALLOWED,
    ) -> None:
        self.model = model
        self.timeout = timeout
        self.disallowed_tools = disallowed_tools

    def invoke(self, prompt: str) -> LlmResult:
        cmd = ["claude", "-p", prompt, "--output-format", "json"]
        if self.model:
            cmd += ["--model", self.model]
        if self.disallowed_tools:
            cmd += ["--disallowedTools", *self.disallowed_tools]
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=self.timeout
        )
        out = proc.stdout.strip()
        text, session_id = out, None
        try:
            data = json.loads(out)
            text = data.get("result", out)
            session_id = data.get("session_id")
        except json.JSONDecodeError:
            pass
        combined = (proc.stdout + proc.stderr).lower()
        quota = proc.returncode != 0 and any(m in combined for m in QUOTA_MARKERS)
        return LlmResult(
            text=text,
            session_id=session_id,
            exit_code=proc.returncode,
            quota_exhausted=quota,
            raw=out,
        )


def detect_quota(stdout: str, stderr: str, exit_code: int) -> bool:
    """Lógica de detecção isolada (testável sem chamar o CLI) — critério 5."""
    combined = (stdout + stderr).lower()
    return exit_code != 0 and any(m in combined for m in QUOTA_MARKERS)
