"""schema memory — pgvector para memória semântica (RF-05)

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBED_DIM = 64


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE SCHEMA IF NOT EXISTS memory")
    op.execute(
        f"""
        CREATE TABLE memory.items (
            id         text PRIMARY KEY,
            content    text NOT NULL,
            embedding  vector({EMBED_DIM}) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'memory_rw') THEN
                CREATE ROLE memory_rw NOLOGIN;
            END IF;
        END
        $$;
        """
    )
    op.execute("GRANT USAGE ON SCHEMA memory TO memory_rw")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON memory.items TO memory_rw")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS memory.items")
    op.execute("DROP SCHEMA IF EXISTS memory CASCADE")
