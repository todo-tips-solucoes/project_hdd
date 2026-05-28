-- Story 1.a.6 — migration 002_audit_chain_state.
-- Per-project last hash tracking + current date. Lido/escrito em cada
-- audit.append() para preservar chain integrity através de restarts.

PRAGMA foreign_keys = ON;

BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS audit_chain_state (
  project_id    TEXT PRIMARY KEY,
  current_date  TEXT NOT NULL,                       -- 'YYYY-MM-DD'
  last_seq      INTEGER NOT NULL DEFAULT 0,
  last_hash     TEXT NOT NULL DEFAULT 'genesis',
  updated_at    TEXT NOT NULL
);

INSERT INTO schema_migrations (version, applied_at, description)
VALUES (2, datetime('now'), '002_audit_chain_state: per-project last hash tracking');

COMMIT;
