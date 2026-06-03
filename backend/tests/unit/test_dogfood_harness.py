"""Stories 7.1/7.2 — harness de métricas de dogfood (bridge_after_wave),
validade do painel Grafana, captura de gaps e export markdown."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from hdd.adapters.db.gap_store import GapDetail, gaps_to_markdown
from hdd.domain import wave as wv
from hdd.observability.metrics import REGISTRY
from hdd.worker.runner import _safe_record_gap, bridge_after_wave


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


class FakeGapStore:
    def __init__(self, *, fail: bool = False) -> None:
        self.recorded: list[tuple[str | None, str, str]] = []
        self._fail = fail

    async def record_gap(
        self, wave_id: str | None, stage: str, reason: str,
        context: dict[str, object] | None = None,
    ) -> str:
        if self._fail:
            raise RuntimeError("db down")
        self.recorded.append((wave_id, stage, reason))
        return f"g{len(self.recorded)}"


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


# --- Story 7.2: captura de gaps + export markdown ---------------------------

async def test_escalada_registra_gap():
    repo, gs, gap = FakeRepo(), FakeGateStore(), FakeGapStore()
    await bridge_after_wave(
        repo, gs, "w9",  # type: ignore[arg-type]
        {"wave_state": str(wv.WaveState.ESCALATED), "n_corrections": 3},
        gap_store=gap,  # type: ignore[arg-type]
    )
    assert len(gap.recorded) == 1
    assert gap.recorded[0][0] == "w9"
    assert gap.recorded[0][1] == "escalation"


async def test_sucesso_autonomo_nao_registra_gap():
    repo, gs, gap = FakeRepo(), FakeGateStore(), FakeGapStore()
    await bridge_after_wave(
        repo, gs, "w10",  # type: ignore[arg-type]
        {"wave_state": str(wv.WaveState.AWAITING_GATE), "n_corrections": 0},
        gap_store=gap,  # type: ignore[arg-type]
    )
    assert gap.recorded == []


async def test_safe_record_gap_nao_propaga_erro_de_db():
    # registro de gap é best-effort: não pode mascarar/quebrar o fluxo da onda.
    await _safe_record_gap(FakeGapStore(fail=True), "w", "failure", "x")  # type: ignore[arg-type]


def _gap(**kw: object) -> GapDetail:
    base: dict[str, object] = {
        "id": "g1", "wave_id": None, "stage": "preexisting", "reason": "pausa de quota",
        "context": {}, "status": "open", "created_at": datetime(2026, 6, 2, tzinfo=UTC),
    }
    base.update(kw)
    return GapDetail(**base)  # type: ignore[arg-type]


def test_markdown_inclui_motivo_meta_e_refs():
    md = gaps_to_markdown([_gap(context={"candidate_meta_wave": True, "refs": ["a.py"]})])
    assert "pausa de quota" in md
    assert "candidato a meta-onda" in md
    assert "a.py" in md


def test_markdown_vazio():
    assert "Nenhum gap" in gaps_to_markdown([])


# --- Correct-course OOM: pré-flight de capacidade do calibration_wave -----------

def _load_calibration_wave():
    import importlib.util

    path = Path(__file__).resolve().parents[2] / "scripts" / "calibration_wave.py"
    spec = importlib.util.spec_from_file_location("calibration_wave", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_capacidade_segura_nao_tem_violacoes():
    cw = _load_calibration_wave()
    # swap ativo, 4 GiB de folga, max_concurrent=1 → seguro.
    assert cw.evaluate_capacity(4 * 1024 * 1024, 4 * 1024 * 1024, 1) == []


def test_capacidade_sem_swap_viola():
    cw = _load_calibration_wave()
    v = cw.evaluate_capacity(0, 4 * 1024 * 1024, 1)
    assert any("swap" in m for m in v)


def test_capacidade_max_concurrent_alto_viola():
    cw = _load_calibration_wave()
    v = cw.evaluate_capacity(4 * 1024 * 1024, 4 * 1024 * 1024, 2)
    assert any("max_concurrent" in m for m in v)


def test_capacidade_ram_baixa_viola():
    cw = _load_calibration_wave()
    v = cw.evaluate_capacity(4 * 1024 * 1024, 256 * 1024, 1)  # 256 MiB de folga
    assert any("MemAvailable" in m for m in v)
