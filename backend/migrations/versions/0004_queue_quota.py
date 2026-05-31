"""tabelas app.work_queue (fila SKIP LOCKED) e app.quota_counter (lease global)

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.work_queue (
            id         text PRIMARY KEY,
            payload    text NOT NULL,
            status     text NOT NULL DEFAULT 'pending',
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_work_queue_status ON app.work_queue(status)")
    # Contador de concorrência global de claude -p (lease enforçado, não só config).
    op.execute(
        """
        CREATE TABLE app.quota_counter (
            id             int PRIMARY KEY DEFAULT 1,
            in_use         int NOT NULL DEFAULT 0,
            max_concurrent int NOT NULL DEFAULT 2,
            CONSTRAINT quota_counter_singleton CHECK (id = 1)
        )
        """
    )
    op.execute("INSERT INTO app.quota_counter (id, in_use, max_concurrent) VALUES (1, 0, 2)")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON app.work_queue, app.quota_counter TO app_rw"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.quota_counter")
    op.execute("DROP TABLE IF EXISTS app.work_queue")
