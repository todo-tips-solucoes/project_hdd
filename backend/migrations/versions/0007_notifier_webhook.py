"""notifier leaky-bucket + webhook inbox (Stories 4.4 e 4.5)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-31

- app.notifier_bucket: estado persistente do leaky-bucket do Notifier. Uma única
  linha (id=1) guarda `available_at` — o instante mais cedo em que o próximo
  envio é permitido. Sobrevive a restart (NFR-ESC), garantindo o teto de 1 req/s
  do clihelper mesmo entre processos/workers.
- app.webhook_inbox: deduplicação idempotente do webhook inbound do n8n. A
  idempotency key é PK; um INSERT que conflita = mensagem já processada (drop).
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.notifier_bucket (
            id           smallint PRIMARY KEY DEFAULT 1,
            available_at timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT notifier_bucket_singleton CHECK (id = 1)
        )
        """
    )
    op.execute("INSERT INTO app.notifier_bucket (id) VALUES (1) ON CONFLICT DO NOTHING")
    op.execute(
        """
        CREATE TABLE app.webhook_inbox (
            idempotency_key text PRIMARY KEY,
            source          text NOT NULL,
            received_at     timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE ON app.notifier_bucket TO app_rw")
    op.execute("GRANT SELECT, INSERT ON app.webhook_inbox TO app_rw")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.webhook_inbox")
    op.execute("DROP TABLE IF EXISTS app.notifier_bucket")
