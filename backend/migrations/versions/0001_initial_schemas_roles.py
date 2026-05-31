"""schemas base (app, langgraph) + role app_rw (least-privilege)

Revision ID: 0001
Revises:
Create Date: 2026-05-31

Cria apenas os schemas necessários ao Epic 1/2 (sessões/ondas/checkpoint).
Os schemas `audit` e `memory` são criados sob demanda (Epic 3), conforme o
princípio "tabelas/entidades só quando a história precisa".
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS app")
    op.execute("CREATE SCHEMA IF NOT EXISTS langgraph")
    # Role de aplicação (NOLOGIN — herdada pelo usuário de runtime). Least-privilege.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
                CREATE ROLE app_rw NOLOGIN;
            END IF;
        END
        $$;
        """
    )
    op.execute("GRANT USAGE ON SCHEMA app TO app_rw")
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA app "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw"
    )


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS langgraph CASCADE")
    op.execute("DROP SCHEMA IF EXISTS app CASCADE")
    op.execute("DROP ROLE IF EXISTS app_rw")
