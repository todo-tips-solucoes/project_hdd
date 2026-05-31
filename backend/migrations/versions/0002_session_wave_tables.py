"""tabelas app.sessions e app.waves (FSM de sessão/onda)

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.sessions (
            id         text PRIMARY KEY,
            state      text NOT NULL,
            task       text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE app.waves (
            id            text PRIMARY KEY,
            session_id    text NOT NULL REFERENCES app.sessions(id),
            state         text NOT NULL,
            n_corrections int  NOT NULL DEFAULT 0,
            created_at    timestamptz NOT NULL DEFAULT now(),
            updated_at    timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_waves_session_id ON app.waves(session_id)")
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON app.sessions, app.waves TO app_rw"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.waves")
    op.execute("DROP TABLE IF EXISTS app.sessions")
