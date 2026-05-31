"""Story 3.4 — memória semântica pgvector + pseudonimização (DB real)."""
from __future__ import annotations

import pytest

from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.memory import PgVectorMemory
from hdd.config import get_settings

pytestmark = pytest.mark.integration


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def test_recall_retorna_o_mais_similar():
    mem = PgVectorMemory(_sm())
    await mem.remember("deploy do serviço de pagamento falhou no kubernetes")
    await mem.remember("a receita de bolo de chocolate leva farinha e ovos")
    got = await mem.recall("problema no deploy kubernetes pagamento", limit=1)
    assert got and "deploy" in got[0]


async def test_pii_pseudonimizada_ao_lembrar():
    mem = PgVectorMemory(_sm())
    await mem.remember("meu contato e teste@exemplo.com para o projeto")
    got = await mem.recall("contato projeto", limit=10)
    assert all("teste@exemplo.com" not in g for g in got)
