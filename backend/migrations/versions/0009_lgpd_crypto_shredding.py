"""schema lgpd — cofre de PII cifrado por titular (crypto-shredding, Story 5.6)

Direito à exclusão (LGPD): cada titular tem uma DEK (chave de cifra) própria em
lgpd.subject_key; a PII recuperável fica em lgpd.pii_vault cifrada com essa chave
(pgcrypto/pgp_sym_encrypt). Apagar a chave do titular torna TODO o ciphertext
dele permanentemente indecifrável — inclusive cópias em backups/replicas que não
se pode alcançar fisicamente. NÃO toca audit.events (hash-chain imutável, já sem
plaintext) — invariante da Story 5.6.

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS lgpd")
    # Chave de cifra por titular (DEK aleatório). Apagá-la = crypto-shredding.
    op.execute(
        """
        CREATE TABLE lgpd.subject_key (
            subject_id text PRIMARY KEY,
            dek        bytea NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    # Cofre de PII recuperável, cifrada com a DEK do titular.
    op.execute(
        """
        CREATE TABLE lgpd.pii_vault (
            id         text PRIMARY KEY,
            subject_id text NOT NULL,
            field      text NOT NULL,
            ciphertext bytea NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_pii_vault_subject ON lgpd.pii_vault(subject_id)")
    op.execute("GRANT USAGE ON SCHEMA lgpd TO app_rw")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON lgpd.subject_key, lgpd.pii_vault TO app_rw"
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS lgpd CASCADE")
