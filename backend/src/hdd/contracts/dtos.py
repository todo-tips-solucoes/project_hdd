"""DTOs Pydantic v2 — formas de dado que cruzam as portas (snake_case end-to-end)."""
from __future__ import annotations

from pydantic import BaseModel


class LlmResult(BaseModel):
    """Resultado de uma invocação do LLMProvider."""

    text: str
    session_id: str | None = None
    exit_code: int
    quota_exhausted: bool
    raw: str
    # RF-12 / Epic 8: consumo real — só preenchido pelo driver `api`.
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float | None = None


class PrRef(BaseModel):
    """Referência a um Pull Request aberto pelo adapter de VCS."""

    number: int
    url: str
    branch: str
