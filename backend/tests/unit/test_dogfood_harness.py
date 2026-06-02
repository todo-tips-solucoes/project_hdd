"""Story 7.1 — harness de métricas de dogfood: desfecho da execução autônoma
(bridge_after_wave) + validade do painel Grafana de dogfood."""
from __future__ import annotations

import json
from pathlib import Path

from hdd.domain import wave as wv
from hdd.observability.metrics import REGISTRY
from hdd.worker.runner import bridge_after_wave


def _sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


class FakeRepo:
    def __init__(self) -> None:
        self.synced: list[tuple[str, wv.WaveState]] = []

    async def sync_wave_state(self, thread_id: str, state: wv.WaveState) -> None:
        self.synced.append((thread_id, state))


class FakeGateStore:
    def __init__(self) -> None:
        self.opened: list[tuple[str, object, str]] = []

    async def open_gate(self, thread_id: str, gate_type: object, reason: str) -> None:
        self.opened.append((thread_id, gate_type, reason))


async def test_reached_gate_conta_sucesso_autonomo_e_correcoes():
    repo, gs = FakeRepo(), FakeGateStore()
    base = _sample("hdd_wave_outcomes_total", outcome="reached_gate")
    base_cnt = _sample("hdd_wave_corrections_count")
    base_sum = _sample("hdd_wave_corrections_sum")

    await bridge_after_wave(
        repo,  # type: ignore[arg-type]
        gs,  # type: ignore[arg-type]
        "w1",
        {"wave_state": str(wv.WaveState.AWAITING_GATE), "n_corrections": 2, "pr_url": "http://pr/1"},
    )

    assert _sample("hdd_wave_outcomes_total", outcome="reached_gate") == base + 1
    assert _sample("hdd_wave_corrections_count") == base_cnt + 1  # uma onda observada
    assert _sample("hdd_wave_corrections_sum") == base_sum + 2  # 2 correções
    assert gs.opened  # sucesso autônomo abre o gate de merge
    assert repo.synced == [("w1", wv.WaveState.AWAITING_GATE)]


async def test_escalated_conta_como_nao_autonomo_e_nao_abre_gate_de_merge():
    repo, gs = FakeRepo(), FakeGateStore()
    base = _sample("hdd_wave_outcomes_total", outcome="escalated")

    await bridge_after_wave(
        repo,  # type: ignore[arg-type]
        gs,  # type: ignore[arg-type]
        "w2",
        {"wave_state": str(wv.WaveState.ESCALATED), "n_corrections": 4},
    )

    assert _sample("hdd_wave_outcomes_total", outcome="escalated") == base + 1
    assert gs.opened == []  # escalada não é gate de merge


def test_dashboard_dogfood_referencia_as_novas_metricas():
    path = Path(__file__).resolve().parents[3] / "ops" / "grafana" / "hdd-dashboard.json"
    dash = json.loads(path.read_text())  # parseável
    exprs = " ".join(
        t.get("expr", "") for p in dash["panels"] for t in p.get("targets", [])
    )
    assert "hdd_wave_outcomes_total" in exprs
    assert "hdd_wave_corrections_bucket" in exprs
    assert "hdd_quota_limit_hits_total" in exprs
