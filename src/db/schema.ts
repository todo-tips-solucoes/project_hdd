/**
 * `schema.ts` — Drizzle schema canónica do state store HDD.
 *
 * Story 1.a.5 (AR-013, AO-40 partial, AO-41, AO-48, AO-49, AO-81). 4 tables
 * iniciais (Q-A5-3 scope: só spec). Outras tables (`fsm_state`,
 * `interrupts_pending`, `consumption_*`, `templates_meta`) entram em
 * migrations 002+ nas stories que as consomem (AO-41 append-only).
 *
 * **runs.status:** 6 estados lowercase per Story 1.a.4 Q-A4-1 canon
 * (commit ac4c7ec). `paused_trigger` / `paused_review_reason` carregam
 * metadata do PAUSED consolidation.
 *
 * **stories.status:** UPPERCASE (PENDING/RUNNING/PAUSED/DONE/ROLLED_BACK)
 * per Q-A5-5 — DB enum convention para entity lifecycle; distinta da
 * worker FSM.
 */

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── runs (worker FSM single-row per run) ──────────────────────────────────────

export const runs = sqliteTable("runs", {
  runId: text("run_id").primaryKey(),
  projectId: text("project_id").notNull().default("projeto_hdd"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  status: text("status", {
    enum: [
      "idle",
      "running",
      "paused_for_interrupt",
      "paused_awaiting_review",
      "paused_window_exhausted",
      "failed",
    ],
  }).notNull(),
  pausedTrigger: text("paused_trigger", { enum: ["P1", "S1", "S2", "S3"] }),
  pausedReviewReason: text("paused_review_reason"),
  contextBundleHash: text("context_bundle_hash").notNull(),
  llmTokensTotal: integer("llm_tokens_total").notNull().default(0),
  schemaVersion: integer("schema_version").notNull().default(1),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

// ── stories (per-story lifecycle, FK to runs) ─────────────────────────────────

export const stories = sqliteTable(
  "stories",
  {
    storyId: text("story_id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.runId),
    status: text("status", {
      enum: ["PENDING", "RUNNING", "PAUSED", "DONE", "ROLLED_BACK"],
    }).notNull(),
    currentPhase: text("current_phase"),
    retryCount: integer("retry_count").notNull().default(0),
    artefactHash: text("artefact_hash"),
    branchName: text("branch_name"),
    rolledBackAt: text("rolled_back_at"),
    rollbackReason: text("rollback_reason"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_stories_run").on(table.runId, table.status)],
);

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

// ── idempotency_keys (commit-state-before-side-effect; AO-3, AO-39, AO-89) ────

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    storyId: text("story_id")
      .notNull()
      .references(() => stories.storyId),
    sideEffect: text("side_effect").notNull(),
    executedAt: text("executed_at").notNull(),
    resultRef: text("result_ref"),
  },
  (table) => [index("idx_idem_story").on(table.storyId)],
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;

// ── schema_migrations (AO-41 — versionadas append-only) ───────────────────────

export const schemaMigrations = sqliteTable("schema_migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
  description: text("description"),
});

export type SchemaMigration = typeof schemaMigrations.$inferSelect;
export type NewSchemaMigration = typeof schemaMigrations.$inferInsert;
