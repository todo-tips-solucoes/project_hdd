"""Hardening do stream SSE (Story 6.11) — sem Postgres.

Garante que o gerador `event_stream` sobrevive a erros transitórios do reader
(o que antes abortava o stream → ERR_HTTP2_PROTOCOL_ERROR + reconexão em loop).
"""
from __future__ import annotations

import json
from datetime import UTC, datetime

from hdd.adapters.audit.reader import AuditRecord
from hdd.api.routers.events import event_stream

_REC = AuditRecord(
    seq=1,
    event_id="e1",
    type="WAVE_CREATED",
    occurred_at=datetime(2026, 1, 1, tzinfo=UTC),
    correlation_id="c1",
    actor="operador",
    payload={"k": "v"},
)


class _FlakyReader:
    """latest_seq falha na 1ª chamada (DB down), depois recupera e emite um evento."""

    def __init__(self) -> None:
        self.latest_calls = 0
        self.after_calls = 0

    async def latest_seq(self) -> int:
        self.latest_calls += 1
        if self.latest_calls == 1:
            raise RuntimeError("connection refused (db down)")
        return 0

    async def after(self, seq: int, limit: int = 100) -> list[AuditRecord]:
        self.after_calls += 1
        return [_REC] if self.after_calls == 1 else []


async def test_event_stream_sobrevive_a_erro_transitorio_do_reader() -> None:
    reader = _FlakyReader()
    ticks = {"n": 0}

    async def is_disconnected() -> bool:
        ticks["n"] += 1
        return ticks["n"] > 4  # falhar → recuperar → emitir → drenar → encerrar

    events = [
        e
        async for e in event_stream(
            reader, is_disconnected, poll_s=0, error_backoff_s=0
        )
    ]

    # Não morreu no erro inicial: retentou latest_seq e seguiu emitindo.
    assert reader.latest_calls >= 2, "deveria retentar latest_seq após o erro"
    emitted = [e for e in events if e["id"] == "1"]
    assert emitted, "o evento pós-recuperação deveria ter sido emitido"
    payload = json.loads(emitted[0]["data"])
    assert payload["type"] == "WAVE_CREATED"
    assert payload["seq"] == 1


async def test_event_stream_para_ao_desconectar() -> None:
    """Desconexão imediata encerra o gerador sem tocar o reader."""

    class _Unused:
        async def latest_seq(self) -> int:  # pragma: no cover - não deve ser chamado
            raise AssertionError("não deveria ler com cliente desconectado")

        async def after(self, seq: int, limit: int = 100) -> list[AuditRecord]:
            raise AssertionError("não deveria ler com cliente desconectado")

    async def already_disconnected() -> bool:
        return True

    events = [e async for e in event_stream(_Unused(), already_disconnected)]
    assert events == []
