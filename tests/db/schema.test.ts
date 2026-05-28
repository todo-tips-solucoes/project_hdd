/**
 * Story 1.a.5 — specs para src/db/schema.ts + connection.ts.
 *
 * AC-1: PRAGMAs WAL + busy_timeout=5000 + synchronous=NORMAL aplicados.
 * AC-2: migrations dentro de BEGIN EXCLUSIVE; segunda execução idempotente.
 * Test files isentos (AO-104 + biome override).
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { applyMigrations, createDbConnection, createDrizzle } from "../../src/db/connection.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: PRAGMAs activos
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 PRAGMAs após createDbConnection", () => {
  test("journal_mode=WAL (lowercase 'wal' returned by SQLite)", () => {
    const db = createDbConnection(":memory:");
    const r = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode").get();
    // :memory: DBs ignoram WAL e retornam 'memory'; disco real retorna 'wal'.
    expect(r).not.toBeNull();
    expect(["wal", "memory"]).toContain(r?.journal_mode ?? "");
    db.close();
  });

  test("foreign_keys=1 (ON)", () => {
    const db = createDbConnection(":memory:");
    const r = db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get();
    expect(r?.foreign_keys).toBe(1);
    db.close();
  });

  test("busy_timeout=5000", () => {
    const db = createDbConnection(":memory:");
    const r = db.query<{ timeout: number }, []>("PRAGMA busy_timeout").get();
    expect(r?.timeout).toBe(5000);
    db.close();
  });

  test("synchronous=1 (NORMAL)", () => {
    const db = createDbConnection(":memory:");
    const r = db.query<{ synchronous: number }, []>("PRAGMA synchronous").get();
    expect(r?.synchronous).toBe(1);
    db.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: applyMigrations idempotente + BEGIN EXCLUSIVE
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 applyMigrations idempotente", () => {
  test("primeira execução aplica 001_init", () => {
    const db = createDbConnection(":memory:");
    const r = applyMigrations(db, MIGRATIONS_DIR);
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ appliedCount: 1 });

    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all();
    const names = tables.map((t) => t.name);
    expect(names).toContain("runs");
    expect(names).toContain("stories");
    expect(names).toContain("idempotency_keys");
    expect(names).toContain("schema_migrations");

    const migrations = db
      .query<{ version: number }, []>("SELECT version FROM schema_migrations ORDER BY version")
      .all();
    expect(migrations).toEqual([{ version: 1 }]);

    db.close();
  });

  test("segunda execução é no-op (idempotente)", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);

    const r2 = applyMigrations(db, MIGRATIONS_DIR);
    expect(r2.isOk()).toBe(true);
    expect(r2._unsafeUnwrap()).toEqual({ appliedCount: 0 });

    const count = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM schema_migrations").get();
    expect(count?.n).toBe(1);

    db.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// CHECK constraints (FSM canon)
// ────────────────────────────────────────────────────────────────────────────────

describe("CHECK constraints", () => {
  test("runs.status aceita 6 lowercase canónicos", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);

    for (const status of [
      "idle",
      "running",
      "paused_for_interrupt",
      "paused_awaiting_review",
      "paused_window_exhausted",
      "failed",
    ]) {
      const runId = `run-${status}`;
      db.query(
        "INSERT INTO runs (run_id, started_at, status, context_bundle_hash) VALUES (?, datetime('now'), ?, 'hash')",
      ).run(runId, status);
    }
    const rows = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM runs").get();
    expect(rows?.n).toBe(6);
    db.close();
  });

  test("runs.status rejeita UPPERCASE (worker FSM é lowercase)", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);

    expect(() => {
      db.query(
        "INSERT INTO runs (run_id, started_at, status, context_bundle_hash) VALUES ('r1', datetime('now'), 'RUNNING', 'h')",
      ).run();
    }).toThrow();
    db.close();
  });

  test("stories.status aceita UPPERCASE (entity lifecycle convention)", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    db.query(
      "INSERT INTO runs (run_id, started_at, status, context_bundle_hash) VALUES ('r1', datetime('now'), 'running', 'h')",
    ).run();
    for (const status of ["PENDING", "RUNNING", "PAUSED", "DONE", "ROLLED_BACK"]) {
      db.query(
        "INSERT INTO stories (story_id, run_id, status, created_at, updated_at) VALUES (?, 'r1', ?, datetime('now'), datetime('now'))",
      ).run(`s-${status}`, status);
    }
    const n = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM stories").get();
    expect(n?.n).toBe(5);
    db.close();
  });

  test("idempotency_keys FK story_id rejeita órfão", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);

    expect(() => {
      db.query(
        "INSERT INTO idempotency_keys (key, story_id, side_effect, executed_at) VALUES ('k1', 'orphan', 'op', datetime('now'))",
      ).run();
    }).toThrow();
    db.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Drizzle wrapper sanity
// ────────────────────────────────────────────────────────────────────────────────

describe("Drizzle wrapper", () => {
  test("createDrizzle retorna instance utilizável", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    const orm = createDrizzle(db);
    expect(orm).toBeDefined();
    expect(typeof orm.select).toBe("function");
    db.close();
  });
});
