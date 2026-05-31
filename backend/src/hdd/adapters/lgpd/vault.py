"""Cofre de PII cifrado por titular + crypto-shredding (Story 5.6).

Cada titular tem uma DEK própria (lgpd.subject_key, bytes aleatórios via
gen_random_bytes). A PII recuperável fica cifrada com essa DEK
(pgcrypto/pgp_sym_encrypt) em lgpd.pii_vault. A DEK nunca trafega pela aplicação:
cifra e decifra acontecem no SQL, lendo a chave da própria linha.

**Crypto-shredding** (`shred`): apaga apenas a DEK do titular. Todo o ciphertext
dele torna-se permanentemente indecifrável — inclusive cópias em backups/replicas
que não se pode alcançar fisicamente. NUNCA toca audit.events (hash-chain
imutável, já sem plaintext) — invariante da Story 5.6.

⚠️ `subject_id` deve ser um identificador PSEUDÓNIMO (ex.: hash salgado do
telefone/e-mail), nunca a PII em claro — coerente com domain/pii.py.
"""
from __future__ import annotations

import uuid_utils
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


class PiiVault:
    def __init__(self, sessionmaker: async_sessionmaker[AsyncSession]) -> None:
        self._sm = sessionmaker

    async def store(self, subject_id: str, field: str, value: str) -> str:
        """Cifra e guarda um campo de PII do titular. Cria a DEK se for o 1º campo."""
        item_id = str(uuid_utils.uuid7())
        async with self._sm() as s:
            await s.execute(
                text(
                    "INSERT INTO lgpd.subject_key (subject_id, dek) "
                    "VALUES (:s, gen_random_bytes(32)) ON CONFLICT (subject_id) DO NOTHING"
                ),
                {"s": subject_id},
            )
            await s.execute(
                text(
                    "INSERT INTO lgpd.pii_vault (id, subject_id, field, ciphertext) "
                    "SELECT :i, :s, :f, pgp_sym_encrypt(:v, encode(dek, 'hex')) "
                    "FROM lgpd.subject_key WHERE subject_id = :s"
                ),
                {"i": item_id, "s": subject_id, "f": field, "v": value},
            )
            await s.commit()
        return item_id

    async def retrieve(self, subject_id: str) -> list[tuple[str, str]]:
        """Decifra os campos do titular. Vazio se a chave foi descartada (shredded)."""
        async with self._sm() as s:
            rows = (
                await s.execute(
                    text(
                        "SELECT v.field, pgp_sym_decrypt(v.ciphertext, encode(k.dek, 'hex')) "
                        "FROM lgpd.pii_vault v JOIN lgpd.subject_key k USING (subject_id) "
                        "WHERE v.subject_id = :s ORDER BY v.created_at"
                    ),
                    {"s": subject_id},
                )
            ).all()
        return [(str(r[0]), str(r[1])) for r in rows]

    async def shred(self, subject_id: str) -> bool:
        """Crypto-shredding: descarta a DEK do titular. True se havia chave."""
        async with self._sm() as s:
            row = (
                await s.execute(
                    text(
                        "DELETE FROM lgpd.subject_key WHERE subject_id = :s RETURNING subject_id"
                    ),
                    {"s": subject_id},
                )
            ).first()
            await s.commit()
            return row is not None

    async def is_recoverable(self, subject_id: str) -> bool:
        """True enquanto a DEK existe (dado ainda decifrável)."""
        async with self._sm() as s:
            found = (
                await s.execute(
                    text("SELECT 1 FROM lgpd.subject_key WHERE subject_id = :s"),
                    {"s": subject_id},
                )
            ).first()
        return found is not None

    async def residual_count(self, subject_id: str) -> int:
        """Linhas de ciphertext ainda na tabela (indecifráveis após o shred)."""
        async with self._sm() as s:
            cnt = (
                await s.execute(
                    text("SELECT count(*) FROM lgpd.pii_vault WHERE subject_id = :s"),
                    {"s": subject_id},
                )
            ).scalar_one()
        return int(cnt)
