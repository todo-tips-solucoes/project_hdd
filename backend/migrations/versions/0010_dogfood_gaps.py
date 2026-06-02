"""tabela app.dogfood_gaps (loop gaps→backlog do dogfood) + seed pré-identificado

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-02
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app.dogfood_gaps (
            id         text PRIMARY KEY,
            wave_id    text,
            stage      text NOT NULL,
            reason     text NOT NULL,
            context    jsonb NOT NULL DEFAULT '{}'::jsonb,
            status     text NOT NULL DEFAULT 'open',
            created_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_dogfood_gaps_status ON app.dogfood_gaps(status)")
    op.execute("CREATE INDEX ix_dogfood_gaps_wave_id ON app.dogfood_gaps(wave_id)")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON app.dogfood_gaps TO app_rw")

    # Seed dos gaps pré-identificados na análise adversarial de 2026-06-02
    # (Stories 7.1/planejamento). IDs fixos → idempotente entre réplicas/redeploys.
    op.execute(
        """
        INSERT INTO app.dogfood_gaps (id, wave_id, stage, reason, context, status) VALUES
        ('seed-7.2-quota-pause', NULL, 'preexisting',
         'Pausa-e-retoma de quota não existe: QuotaExhausted falha a onda; '
         'retry.decide não está wirado; PAUSED_QUOTA é estado morto. Bloqueia '
         'medir tempo em PAUSED_QUOTA (Story 7.1).',
         '{"origin": "analise-2026-06-02", "candidate_meta_wave": true, '
         '"refs": ["adapters/llm/subscription.py", "application/retry.py", '
         '"domain/session.py"]}'::jsonb,
         'open'),
        ('seed-7.2-quota-exhausted-flag', NULL, 'preexisting',
         'Bug: LlmResult.quota_exhausted é sempre False (campo nunca atualizado; '
         'a detecção real vive na exceção QuotaExhausted).',
         '{"origin": "analise-2026-06-02", "candidate_meta_wave": true, '
         '"refs": ["adapters/llm/subscription.py", "contracts/dtos.py"]}'::jsonb,
         'open'),
        ('seed-7.2-quota-detection-fragile', NULL, 'preexisting',
         'Detecção de quota frágil: pattern-match de 5 strings em stderr do '
         'claude -p; quebra se a Anthropic mudar a mensagem.',
         '{"origin": "analise-2026-06-02", "candidate_meta_wave": true, '
         '"refs": ["adapters/llm/subscription.py"]}'::jsonb,
         'open')
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app.dogfood_gaps")
