"""Story 5.6 — crypto-shredding do cofre de PII, com DB real (pgcrypto)."""
from __future__ import annotations

import pytest
import uuid_utils
from sqlalchemy import text

from hdd.adapters.audit.sink import AuditSink
from hdd.adapters.db import make_engine, make_sessionmaker
from hdd.adapters.lgpd import PiiVault
from hdd.config import get_settings

pytestmark = pytest.mark.integration


def _sm():
    return make_sessionmaker(make_engine(get_settings().pg_dsn))


async def test_crypto_shredding_torna_pii_irrecuperavel():
    sm = _sm()
    vault = PiiVault(sm)
    subject = f"subj-{uuid_utils.uuid7()}"

    await vault.store(subject, "email", "alice@example.com")
    await vault.store(subject, "phone", "+5511999998888")

    got = dict(await vault.retrieve(subject))
    assert got == {"email": "alice@example.com", "phone": "+5511999998888"}
    assert await vault.is_recoverable(subject) is True

    # Crypto-shredding: descarta a chave do titular.
    assert await vault.shred(subject) is True
    assert await vault.is_recoverable(subject) is False
    assert await vault.retrieve(subject) == []  # sem chave → nada a decifrar

    # O ciphertext residual permanece (modela cópias em backups) mas é indecifrável:
    assert await vault.residual_count(subject) == 2
    with pytest.raises(Exception):  # noqa: B017 — pgcrypto: "Wrong key or corrupt data"
        async with sm() as s:
            await s.execute(
                text(
                    "SELECT pgp_sym_decrypt(ciphertext, encode(gen_random_bytes(32), 'hex')) "
                    "FROM lgpd.pii_vault WHERE subject_id = :s LIMIT 1"
                ),
                {"s": subject},
            )

    # Shred de novo é idempotente (nada mais a descartar).
    assert await vault.shred(subject) is False


async def test_shred_nao_altera_a_hash_chain_de_auditoria():
    sm = _sm()
    head_before = await AuditSink(sm).head()
    await PiiVault(sm).shred(f"inexistente-{uuid_utils.uuid7()}")
    assert await AuditSink(sm).head() == head_before  # auditoria intocada
