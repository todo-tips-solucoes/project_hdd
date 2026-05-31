"""Story 5.2 — controle de fluxo do WorkerLoop (fakes, sem Postgres/quota)."""
from __future__ import annotations

from hdd.worker.loop import WorkerLoop


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
