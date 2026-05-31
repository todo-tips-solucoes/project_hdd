"""schema audit — events append-only + hash-chain + role + trigger anti-mutação

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-31
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS audit")
    op.execute(
        """
        CREATE TABLE audit.events (
            seq           bigserial PRIMARY KEY,
            event_id      text NOT NULL,
            type          text NOT NULL,
            schema_version int NOT NULL,
            occurred_at   timestamptz NOT NULL,
            correlation_id text NOT NULL,
            actor         text NOT NULL,
            payload       jsonb NOT NULL,
            prev_hash     text NOT NULL,
            hash          text NOT NULL,
            inserted_at   timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_audit_events_correlation ON audit.events(correlation_id)")

    # Role append-only: SELECT + INSERT, jamais UPDATE/DELETE (least-privilege).
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_append') THEN
                CREATE ROLE audit_append NOLOGIN;
            END IF;
        END
        $$;
        """
    )
    op.execute("GRANT USAGE ON SCHEMA audit TO audit_append")
    op.execute("GRANT SELECT, INSERT ON audit.events TO audit_append")
    op.execute("GRANT USAGE ON SEQUENCE audit.events_seq_seq TO audit_append")

    # Trigger: defesa em profundidade — rejeita UPDATE/DELETE mesmo de superusuário app.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION audit.no_mutation() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit.events é append-only (mutação proibida)';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_immutable
        BEFORE UPDATE OR DELETE ON audit.events
        FOR EACH ROW EXECUTE FUNCTION audit.no_mutation();
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS audit.events CASCADE")
    op.execute("DROP FUNCTION IF EXISTS audit.no_mutation()")
    op.execute("DROP SCHEMA IF EXISTS audit CASCADE")
