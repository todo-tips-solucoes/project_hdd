"""Driver `api`: API da Claude (fase de escala). Stub — implementado ao escalar."""
from __future__ import annotations

from hdd.contracts.dtos import LlmResult


class ApiProvider:
    """LLMProvider — driver api (diferido para a fase de escala, RF-12)."""

    def __init__(self, model: str | None = None) -> None:
        self.model = model

    def invoke(self, prompt: str) -> LlmResult:
        raise NotImplementedError(
            "driver 'api' é diferido para a fase de escala; use 'subscription' no MVP"
        )
