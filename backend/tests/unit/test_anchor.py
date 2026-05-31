"""Story 3.3 — âncora WORM (fakes; sem R2)."""
from __future__ import annotations

from hdd.adapters.audit.anchor import AnchorPublisher


class _FakeSink:
    async def head(self) -> str:
        return "abc123"


class _FakeBackend:
    def __init__(self) -> None:
        self.store: dict[str, bytes] = {}

    def put(self, key: str, data: bytes) -> None:
        self.store[key] = data


async def test_publica_ancora_assinada_e_verificavel():
    backend = _FakeBackend()
    pub = AnchorPublisher(_FakeSink(), backend, signing_key=b"k")  # type: ignore[arg-type]
    anchor = await pub.publish("2026-05-31T00:00:00Z")
    assert anchor["head_hash"] == "abc123"
    assert pub.verify(anchor) is True
    assert any("audit-anchor" in k for k in backend.store)


async def test_assinatura_adulterada_e_detectada():
    pub = AnchorPublisher(_FakeSink(), _FakeBackend(), signing_key=b"k")  # type: ignore[arg-type]
    anchor = await pub.publish("t")
    anchor["head_hash"] = "adulterado"
    assert pub.verify(anchor) is False
