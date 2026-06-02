"""Story 5.2 — controle de fluxo do WorkerLoop (fakes, sem Postgres/quota)."""
from __future__ import annotations

from hdd.domain.errors import QuotaExhausted
from hdd.observability.metrics import REGISTRY
from hdd.worker.loop import WorkerLoop


def _sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


class FakeQuota:
    def __init__(self, slots: int) -> None:
        self.slots = slots
        self.acquired: list[str] = []
        self.released: list[str] = []
        self.renewed: list[str] = []

    async def acquire(self, worker_id: str) -> str | None:
        if self.slots <= 0:
            return None
        self.slots -= 1
        lease_id = f"L{len(self.acquired)}"
        self.acquired.append(lease_id)
        return lease_id

    async def release(self, lease_id: str) -> None:
        self.released.append(lease_id)
        self.slots += 1

    async def renew(self, lease_id: str) -> bool:
        self.renewed.append(lease_id)
        return True


class FakeQueue:
    def __init__(self, items: list[tuple[str, str]]) -> None:
        self.items = list(items)
        self.completed: list[str] = []
        self.failed: list[str] = []

    async def claim(self) -> tuple[str, str] | None:
        return self.items.pop(0) if self.items else None

    async def complete(self, work_id: str) -> None:
        self.completed.append(work_id)

    async def fail(self, work_id: str) -> None:
        self.failed.append(work_id)


async def _noop(work_id: str, payload: str) -> None:
    return None


async def test_sem_quota_aguarda_e_nao_consome_a_fila():
    q = FakeQueue([("w1", "p")])
    quota = FakeQuota(slots=0)
    loop = WorkerLoop(q, quota, _noop, "t")

    assert await loop.run_once() == "no_quota"
    assert q.items == [("w1", "p")]  # fila intacta (quota-first)
    assert quota.acquired == []


async def test_fila_vazia_libera_o_lease():
    q = FakeQueue([])
    quota = FakeQuota(slots=1)
    loop = WorkerLoop(q, quota, _noop, "t")

    assert await loop.run_once() == "empty"
    assert quota.released == quota.acquired  # adquiriu e liberou


async def test_roda_a_onda_completa_e_libera():
    ran: list[tuple[str, str]] = []

    async def rw(work_id: str, payload: str) -> None:
        ran.append((work_id, payload))

    q = FakeQueue([("w1", "p1")])
    quota = FakeQuota(slots=1)
    loop = WorkerLoop(q, quota, rw, "t")

    assert await loop.run_once() == "done"
    assert ran == [("w1", "p1")]
    assert q.completed == ["w1"]
    assert quota.released == quota.acquired  # lease sempre liberado


async def test_onda_que_falha_marca_failed_e_libera_o_lease():
    async def rw(work_id: str, payload: str) -> None:
        raise RuntimeError("boom")

    q = FakeQueue([("w1", "p")])
    quota = FakeQuota(slots=1)
    loop = WorkerLoop(q, quota, rw, "t")

    assert await loop.run_once() == "done"  # processou (e falhou) um item
    assert q.failed == ["w1"]
    assert q.completed == []
    assert quota.released == quota.acquired  # não vaza slot mesmo em falha


async def test_metricas_quota_e_falha_incrementam():
    base_acq = _sample("hdd_quota_acquisitions_total", result="acquired")
    base_noq = _sample("hdd_quota_acquisitions_total", result="no_quota")
    base_fail = _sample("hdd_wave_failures_total")

    # sem quota → no_quota++ (sinal de quota/teto p/ alerta)
    await WorkerLoop(FakeQueue([("w", "p")]), FakeQuota(0), _noop, "t").run_once()
    assert _sample("hdd_quota_acquisitions_total", result="no_quota") == base_noq + 1

    # onda ok → acquired++
    await WorkerLoop(FakeQueue([("w", "p")]), FakeQuota(1), _noop, "t").run_once()
    assert _sample("hdd_quota_acquisitions_total", result="acquired") == base_acq + 1

    # onda falha → wave_failures++
    async def boom(work_id: str, payload: str) -> None:
        raise RuntimeError("x")

    await WorkerLoop(FakeQueue([("w", "p")]), FakeQuota(1), boom, "t").run_once()
    assert _sample("hdd_wave_failures_total") == base_fail + 1


# --- Story 7.1: harness de dogfood — desfechos no worker --------------------

async def test_quota_hit_nao_conta_como_falha_de_capacidade():
    """Limite real da conta (D-032): incrementa quota_limit_hits e outcome=quota_hit,
    mas NÃO wave_failures (senão a taxa de falha de H-A fica enganosa)."""
    base_hits = _sample("hdd_quota_limit_hits_total")
    base_fail = _sample("hdd_wave_failures_total")
    base_qhit = _sample("hdd_wave_outcomes_total", outcome="quota_hit")

    async def quota(work_id: str, payload: str) -> None:
        raise QuotaExhausted("limite da conta")

    q = FakeQueue([("w", "p")])
    assert await WorkerLoop(q, FakeQuota(1), quota, "t").run_once() == "done"
    assert q.failed == ["w"]  # sem pausa-e-retoma ainda: a fila marca failed (gap)
    assert _sample("hdd_quota_limit_hits_total") == base_hits + 1
    assert _sample("hdd_wave_outcomes_total", outcome="quota_hit") == base_qhit + 1
    assert _sample("hdd_wave_failures_total") == base_fail  # quota ≠ falha


async def test_falha_generica_conta_outcome_failed():
    base = _sample("hdd_wave_outcomes_total", outcome="failed")

    async def boom(work_id: str, payload: str) -> None:
        raise RuntimeError("x")

    await WorkerLoop(FakeQueue([("w", "p")]), FakeQuota(1), boom, "t").run_once()
    assert _sample("hdd_wave_outcomes_total", outcome="failed") == base + 1
