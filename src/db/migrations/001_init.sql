-- Story 1.a.5 — migration 001_init.
-- Cria 4 tables iniciais (runs, stories, idempotency_keys, schema_migrations).
-- PRAGMAs WAL + busy_timeout + synchronous=NORMAL aplicados em connection.ts;
-- foreign_keys ON é runtime PRAGMA, repetido aqui por defesa.
--
-- BEGIN EXCLUSIVE garante atomicidade per AO-81. Idempotente via
-- `IF NOT EXISTS` + check de schema_migrations no runner (connection.ts).

PRAGMA foreign_keys = ON;

BEGIN EXCLUSIVE;

CREATE TABLE IF NOT EXISTS runs (
  run_id              TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL DEFAULT 'projeto_hdd',
  started_at          TEXT NOT NULL,
  ended_at            TEXT,
  status              TEXT NOT NULL CHECK(status IN
    ('idle','running','paused_for_interrupt','paused_awaiting_review','paused_window_exhausted','failed')),
  paused_trigger      TEXT CHECK(paused_trigger IN ('P1','S1','S2','S3')),
  paused_review_reason TEXT,
  context_bundle_hash TEXT NOT NULL,
  llm_tokens_total    INTEGER NOT NULL DEFAULT 0,
  schema_version      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stories (
  story_id        TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES runs(run_id),
  status          TEXT NOT NULL CHECK(status IN ('PENDING','RUNNING','PAUSED','DONE','ROLLED_BACK')),
  current_phase   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  artefact_hash   TEXT,
  branch_name     TEXT,
  rolled_back_at  TEXT,
  rollback_reason TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stories_run ON stories(run_id, status);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  story_id    TEXT NOT NULL REFERENCES stories(story_id),
  side_effect TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  result_ref  TEXT
);
CREATE INDEX IF NOT EXISTS idx_idem_story ON idempotency_keys(story_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL,
  description TEXT
);

INSERT INTO schema_migrations (version, applied_at, description)
VALUES (1, datetime('now'), '001_init: runs+stories+idempotency_keys+schema_migrations (6-state FSM canon Q-A4-1)');

COMMIT;
