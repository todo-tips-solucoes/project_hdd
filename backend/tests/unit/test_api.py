"""Testes unitários da API do painel (Epic 4) — sem Postgres.

Usa TestClient + dependency_overrides para isolar os adapters. Prova a construção:
guards de sessão, fluxo de decisão de gate (audit + transição + notificação),
idempotência e a borda do webhook (HMAC + idempotency + schema).
"""
from __future__ import annotations

import hashlib
import hmac

import pytest
from fastapi.testclient import TestClient

from hdd.adapters.db.gate_store import GateDetail
from hdd.api.app import create_app
from hdd.api.deps import (
    ResumeOutcome,
    get_audit,
    get_gate_store,
    get_notifications,
    get_repository,
    get_wave_resumer,
    get_webhook_inbox,
    require_user,
)
from hdd.api.schemas import User
from hdd.api.security import verify_signature
from hdd.application.notifications import NotificationService
from hdd.config import get_settings
from hdd.domain.gate import GateStatus


# --- fakes ----------------------------------------------------------------
class FakeRepo:
    def __init__(self) -> None:
        self.transitions: list[tuple[str, str]] = []

    async def list_sessions(self) -> list[tuple[str, str, str]]:
        return [("s1", "RUNNING", "fazer X")]

    async def list_waves(self) -> list[tuple[str, str, str, int]]:
        return [("w1", "s1", "AWAITING_GATE", 0)]

    async def sync_wave_state(self, wave_id: str, target: object) -> None:
        self.transitions.append((wave_id, str(target)))


class FakeGateStore:
    def __init__(self, detail: GateDetail | None, resolved: GateStatus) -> None:
        self._detail = detail
        self._resolved = resolved

    async def list_pending(self) -> list[tuple[str, str, str, str]]:
        return [("g1", "w1", "MERGE_DEPLOY", "merge na main")]

    async def detail(self, gate_id: str) -> GateDetail | None:
        return self._detail

    async def resolve_authenticated(self, gate_id: str, approve: bool) -> GateStatus:
        return self._resolved


class FakeAudit:
    def __init__(self) -> None:
        self.events: list[object] = []

    async def append(self, event: object) -> str:
        self.events.append(event)
        return "deadbeef"


class FakeNotifier:
    def __init__(self) -> None:
        self.messages: list[str] = []

    async def notify(self, message: str) -> None:
        self.messages.append(message)


class FakeInbox:
    def __init__(self, already: bool = False) -> None:
        self._already = already
        self.calls: list[tuple[str, str]] = []

    async def seen(self, idempotency_key: str, source: str) -> bool:
        self.calls.append((idempotency_key, source))
        return self._already


async def _fake_resume(thread_id: str, approve: bool) -> ResumeOutcome:
    """Stub do resume pós-gate: o checkpoint avança para merged/failed (sem quota)."""
    return ResumeOutcome("merged" if approve else "failed")


def _pending_detail() -> GateDetail:
    from datetime import UTC, datetime, timedelta

    now = datetime.now(UTC)
    return GateDetail(
        id="g1",
        wave_id="w1",
        gate_type="MERGE_DEPLOY",
        reason="merge na main",
        status=GateStatus.PENDING,
        created_at=now,
        expires_at=now + timedelta(hours=1),
    )


# --- guards ---------------------------------------------------------------
def test_health_e_metrics_sem_auth() -> None:
    with TestClient(create_app()) as c:
        assert c.get("/healthz").json() == {"status": "ok"}
        m = c.get("/metrics")
        assert m.status_code == 200
        assert "hdd_" in m.text


def test_rotas_do_painel_exigem_sessao() -> None:
    with TestClient(create_app()) as c:
        assert c.get("/api/waves").status_code == 401
        assert c.get("/api/gates").status_code == 401
        assert c.get("/api/events/stream").status_code == 401
        assert c.get("/auth/me").status_code == 401


def test_snapshot_de_ondas_autenticado() -> None:
    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_repository] = lambda: FakeRepo()
    with TestClient(app) as c:
        body = c.get("/api/waves").json()
    assert body["sessions"][0]["id"] == "s1"
    assert body["waves"][0]["state"] == "AWAITING_GATE"


# --- gates ----------------------------------------------------------------
def test_lista_gates_pendentes() -> None:
    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_gate_store] = lambda: FakeGateStore(None, GateStatus.PENDING)
    with TestClient(app) as c:
        gates = c.get("/api/gates").json()
    assert gates[0]["id"] == "g1"
    assert gates[0]["status"] == "pending"


@pytest.mark.parametrize(
    ("verb", "approve", "status_esperado", "evento_idx"),
    [("approve", True, GateStatus.APPROVED, 0), ("reject", False, GateStatus.REJECTED, 0)],
)
def test_decisao_de_gate_emite_audit_e_transiciona(
    verb: str, approve: bool, status_esperado: GateStatus, evento_idx: int
) -> None:
    repo = FakeRepo()
    audit = FakeAudit()
    notifier = FakeNotifier()
    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="alice")
    app.dependency_overrides[get_gate_store] = lambda: FakeGateStore(
        _pending_detail(), status_esperado
    )
    app.dependency_overrides[get_audit] = lambda: audit
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_notifications] = lambda: NotificationService(
        notifier, "http://painel"
    )
    app.dependency_overrides[get_wave_resumer] = lambda: _fake_resume
    with TestClient(app) as c:
        resp = c.post(f"/api/gates/g1/{verb}").json()

    assert resp["status"] == str(status_esperado)
    assert len(audit.events) == 1  # decisão registrada na trilha
    # onda retomada do checkpoint e projetada: approve→merged, reject→failed (6.2)
    assert repo.transitions == [("w1", "merged" if approve else "failed")]
    assert notifier.messages  # operador notificado
    assert "alice" in notifier.messages[0]


def test_decisao_idempotente_nao_reemite() -> None:
    """Gate já terminal: resolver de novo não duplica audit nem transição."""
    repo = FakeRepo()
    audit = FakeAudit()
    detail = GateDetail(
        id="g1",
        wave_id="w1",
        gate_type="MERGE_DEPLOY",
        reason="merge",
        status=GateStatus.APPROVED,  # já decidido
        created_at=_pending_detail().created_at,
        expires_at=_pending_detail().expires_at,
    )
    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_gate_store] = lambda: FakeGateStore(detail, GateStatus.APPROVED)
    app.dependency_overrides[get_audit] = lambda: audit
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_notifications] = lambda: NotificationService(
        FakeNotifier(), "http://painel"
    )
    app.dependency_overrides[get_wave_resumer] = lambda: _fake_resume
    with TestClient(app) as c:
        resp = c.post("/api/gates/g1/approve").json()
    assert resp["status"] == "approved"
    assert audit.events == []
    assert repo.transitions == []  # gate terminal → nada retomado/reemitido


def test_merge_falho_audita_error_raised() -> None:
    """Merge falho no resume → além do GATE_APPROVED, audita ERROR_RAISED (Story 6.4)."""
    repo = FakeRepo()
    audit = FakeAudit()

    async def resume_com_falha(thread_id: str, approve: bool) -> ResumeOutcome:
        return ResumeOutcome("merged", merge_error="merge bloqueado por checks")

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="alice")
    app.dependency_overrides[get_gate_store] = lambda: FakeGateStore(
        _pending_detail(), GateStatus.APPROVED
    )
    app.dependency_overrides[get_audit] = lambda: audit
    app.dependency_overrides[get_repository] = lambda: repo
    app.dependency_overrides[get_notifications] = lambda: NotificationService(
        FakeNotifier(), "http://painel"
    )
    app.dependency_overrides[get_wave_resumer] = lambda: resume_com_falha
    with TestClient(app) as c:
        resp = c.post("/api/gates/g1/approve").json()
    assert resp["status"] == "approved"
    assert len(audit.events) == 2  # decisão (GATE_APPROVED) + erro (ERROR_RAISED)
    assert repo.transitions == [("w1", "merged")]  # ainda projeta merged


def test_gate_inexistente_404() -> None:
    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_gate_store] = lambda: FakeGateStore(None, GateStatus.PENDING)
    with TestClient(app) as c:
        assert c.get("/api/gates/zzz").status_code == 404
        assert c.post("/api/gates/zzz/approve").status_code == 404


# --- webhook --------------------------------------------------------------
def _sign(raw: bytes, secret: str) -> str:
    return "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def test_webhook_hmac_e_idempotencia(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HDD_WEBHOOK_HMAC_SECRET", "s3cr3t")
    get_settings.cache_clear()
    inbox = FakeInbox(already=False)
    app = create_app()
    app.dependency_overrides[get_webhook_inbox] = lambda: inbox
    body = b'{"message_id": "m1", "from": "55119", "text": "oi", "lixo": 1}'

    with TestClient(app) as c:
        # assinatura inválida → fail-closed
        bad = c.post("/webhooks/n8n", content=body, headers={"x-hub-signature-256": "sha256=00"})
        assert bad.status_code == 401
        # assinatura válida → aceito (schema mínimo descarta "lixo")
        good = c.post(
            "/webhooks/n8n",
            content=body,
            headers={"x-hub-signature-256": _sign(body, "s3cr3t")},
        )
        assert good.json() == {"status": "accepted"}
        # duplicata (mesma idempotency key) → descartada
        inbox._already = True
        dup = c.post(
            "/webhooks/n8n",
            content=body,
            headers={"x-hub-signature-256": _sign(body, "s3cr3t")},
        )
        assert dup.json() == {"status": "duplicate"}
    get_settings.cache_clear()


def test_webhook_sem_idempotency_key_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HDD_WEBHOOK_HMAC_SECRET", "s3cr3t")
    get_settings.cache_clear()
    app = create_app()
    app.dependency_overrides[get_webhook_inbox] = lambda: FakeInbox()
    body = b'{"text": "sem id"}'
    with TestClient(app) as c:
        resp = c.post(
            "/webhooks/n8n",
            content=body,
            headers={"x-hub-signature-256": _sign(body, "s3cr3t")},
        )
        assert resp.status_code == 400
    get_settings.cache_clear()


# --- unidades puras -------------------------------------------------------
def test_verify_signature() -> None:
    raw = b"payload"
    assert verify_signature(raw, _sign(raw, "k"), "k")
    assert not verify_signature(raw, _sign(raw, "k"), "outro")
    assert not verify_signature(raw, "", "k")  # fail-closed sem assinatura
    assert not verify_signature(raw, _sign(raw, "k"), "")  # fail-closed sem segredo


def test_notification_service_deep_link() -> None:
    notifier = FakeNotifier()
    svc = NotificationService(notifier, "http://painel/")
    assert svc.gate_link("g1") == "http://painel/gates/g1"


# --- harness --------------------------------------------------------------
def test_harness_caso_normal() -> None:
    class _Repo:
        async def list_waves(self) -> list[tuple[str, str, str, int]]:
            return [
                ("w1", "s1", "awaiting_gate", 2),
                ("w2", "s1", "merged", 1),
                ("w3", "s1", "failed", 0),
            ]

        async def count_pending_gates(self) -> int:
            return 5

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_repository] = lambda: _Repo()
    with TestClient(app) as c:
        body = c.get("/api/harness").json()

    assert body["total_waves"] == 3
    assert body["total_corrections"] == 3
    assert abs(body["mean_corrections"] - 1.0) < 1e-9
    assert body["reached_gate"] == 2
    assert body["escalated"] == 0
    assert body["failed"] == 1
    assert body["merged"] == 1
    assert body["gates_pending"] == 5
    assert body["by_state"]["awaiting_gate"] == 1
    assert body["by_state"]["merged"] == 1
    assert body["by_state"]["failed"] == 1
    assert body["by_state"]["planned"] == 0


def test_harness_caso_vazio() -> None:
    class _Repo:
        async def list_waves(self) -> list[tuple[str, str, str, int]]:
            return []

        async def count_pending_gates(self) -> int:
            return 0

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_repository] = lambda: _Repo()
    with TestClient(app) as c:
        body = c.get("/api/harness").json()

    assert body["total_waves"] == 0
    assert body["mean_corrections"] == 0.0
    assert body["total_corrections"] == 0
    assert all(v == 0 for v in body["by_state"].values())
    assert body["merged"] == 0
    assert body["gates_pending"] == 0


def test_harness_active_waves() -> None:
    """active_waves conta apenas ondas em estados não-terminais e não-gate."""

    class _Repo:
        async def list_waves(self) -> list[tuple[str, str, str, int]]:
            return [
                ("w1", "s1", "planned", 0),
                ("w2", "s1", "executing", 1),
                ("w3", "s1", "verifying", 0),
                ("w4", "s1", "correcting", 2),
                ("w5", "s1", "awaiting_gate", 0),
                ("w6", "s1", "merged", 0),
                ("w7", "s1", "failed", 0),
            ]

        async def count_pending_gates(self) -> int:
            return 1

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_repository] = lambda: _Repo()
    with TestClient(app) as c:
        body = c.get("/api/harness").json()

    assert body["active_waves"] == 4


def test_harness_merged() -> None:
    """merged reflete exclusivamente ondas no estado merged."""

    class _Repo:
        async def list_waves(self) -> list[tuple[str, str, str, int]]:
            return [
                ("w1", "s1", "merged", 0),
                ("w2", "s1", "merged", 1),
                ("w3", "s1", "failed", 0),
            ]

        async def count_pending_gates(self) -> int:
            return 0

    app = create_app()
    app.dependency_overrides[require_user] = lambda: User(login="op")
    app.dependency_overrides[get_repository] = lambda: _Repo()
    with TestClient(app) as c:
        body = c.get("/api/harness").json()

    assert body["merged"] == 2
    assert body["by_state"]["merged"] == 2
    assert body["by_state"]["failed"] == 1


def test_harness_exige_sessao() -> None:
    with TestClient(create_app()) as c:
        assert c.get("/api/harness").status_code == 401
