"""lease de quota com TTL/reaper (app.quota_lease) — robustez a crash (Story 5.2)

O counter inteiro app.quota_counter.in_use vazava um slot quando um worker
morria entre acquire() e release(). Substitui-se por leases com expires_at: o
teto é a contagem de leases ATIVOS; um worker morto deixa um lease que expira e
é recuperado pelo reaper (DELETE dos expirados) na próxima aquisição.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.quota_lease (
            id           text PRIMARY KEY,
            worker_id    text NOT NULL,
            acquired_at  timestamptz NOT NULL DEFAULT now(),
            heartbeat_at timestamptz NOT NULL DEFAULT now(),
            expires_at   timestamptz NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX ix_quota_lease_expires ON app.quota_lease(expires_at)")
    # in_use vira derivado (count de leases ativos): remove a coluna.
    op.execute("ALTER TABLE app.quota_counter DROP COLUMN in_use")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON app.quota_lease TO app_rw")


def downgrade() -> None:
    op.execute("ALTER TABLE app.quota_counter ADD COLUMN in_use int NOT NULL DEFAULT 0")
    op.execute("DROP TABLE IF EXISTS app.quota_lease")
