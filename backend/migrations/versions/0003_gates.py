"""tabela app.gates (gate manager — PIN single-use, timeout)

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.gates (
            id           text PRIMARY KEY,
            wave_id      text NOT NULL,
            gate_type    text NOT NULL,
            reason       text NOT NULL,
            status       text NOT NULL,
            pin_hash     text NOT NULL,
            attempts     int  NOT NULL DEFAULT 0,
            max_attempts int  NOT NULL DEFAULT 3,
            created_at   timestamptz NOT NULL DEFAULT now(),
            expires_at   timestamptz NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX ix_gates_wave_id ON app.gates(wave_id)")
    op.execute("CREATE INDEX ix_gates_status ON app.gates(status)")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON app.gates TO app_rw")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.gates")
