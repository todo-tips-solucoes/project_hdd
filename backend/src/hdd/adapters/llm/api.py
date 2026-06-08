"""Driver `api`: invoca `claude -p` headless com ANTHROPIC_API_KEY (RF-12, Epic 8).

Espelha ClaudeSubscriptionProvider — mesmo comando, mesmo mapeamento de erros.
Diferenças: credencial injetada via env do subprocess (nunca em argv), e os
campos usage.input_tokens / usage.output_tokens / total_cost_usd do JSON de
saída são parseados nos campos opcionais do LlmResult.
"""
from __future__ import annotations

import json
import os
import subprocess

from hdd.adapters.llm.subscription import DEFAULT_DISALLOWED, detect_quota
from hdd.contracts.dtos import LlmResult
from hdd.domain.errors import QuotaExhausted, TransientError


class ApiProvider:
    """LLMProvider — driver api (RF-12): mesmo agente `claude -p`, com API key."""

    def __init__(
        self,
        model: str | None = None,
        timeout: int = 120,
        disallowed_tools: tuple[str, ...] = DEFAULT_DISALLOWED,
        cwd: str | None = None,
        permission_mode: str | None = None,
        api_key: str = "",
    ) -> None:
        self.model = model
        self.timeout = timeout
        self.disallowed_tools = disallowed_tools
        self.cwd = cwd
        self.permission_mode = permission_mode
        self._api_key = api_key

    def invoke(self, prompt: str) -> LlmResult:
        cmd = ["claude", "-p", prompt, "--output-format", "json"]
        if self.model:
            cmd += ["--model", self.model]
        if self.disallowed_tools:
            cmd += ["--disallowedTools", *self.disallowed_tools]
        if self.permission_mode:
            cmd += ["--permission-mode", self.permission_mode]

        # Credencial injetada SOMENTE via env do subprocesso — nunca em argv.
        env = {**os.environ, "ANTHROPIC_API_KEY": self._api_key}
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                cwd=self.cwd,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            raise TransientError(f"claude -p excedeu timeout ({self.timeout}s)") from exc

        if proc.returncode != 0:
            if detect_quota(proc.stdout, proc.stderr, proc.returncode):
                raise QuotaExhausted("claude -p atingiu limite de uso da conta")
            raise TransientError(f"claude -p falhou (exit {proc.returncode})")

        out = proc.stdout.strip()
        text, session_id = out, None
        input_tokens: int | None = None
        output_tokens: int | None = None
        cost_usd: float | None = None
        try:
            data = json.loads(out)
            text = str(data.get("result", out))
            sid = data.get("session_id")
            session_id = str(sid) if sid is not None else None
            usage = data.get("usage") or {}
            it = usage.get("input_tokens")
            ot = usage.get("output_tokens")
            tc = data.get("total_cost_usd")
            input_tokens = int(it) if it is not None else None
            output_tokens = int(ot) if ot is not None else None
            cost_usd = float(tc) if tc is not None else None
        except json.JSONDecodeError:
            pass
        return LlmResult(
            text=text,
            session_id=session_id,
            exit_code=proc.returncode,
            quota_exhausted=False,
            raw=out,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )
