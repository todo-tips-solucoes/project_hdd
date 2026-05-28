/**
 * Story 1.a.5 — specs para src/services/idempotency.service.ts.
 *
 * AC-3 property: generate é determinístico + format Sha256Hash válido.
 * AC-4: commitBeforeSideEffect implementa commit-state-before-side-effect.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import * as fc from "fast-check";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";
import { mkSha256Hash } from "../../src/lib/branded.ts";
import { createIdempotencyService } from "../../src/services/idempotency.service.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

function seedRunAndStory(db: ReturnType<typeof createDbConnection>): void {
  db.query(
    "INSERT INTO runs (run_id, started_at, status, context_bundle_hash) VALUES ('r1', datetime('now'), 'running', 'h')",
  ).run();
  db.query(
    "INSERT INTO stories (story_id, run_id, status, created_at, updated_at) VALUES ('s1', 'r1', 'RUNNING', datetime('now'), datetime('now'))",
  ).run();
}

// ────────────────────────────────────────────────────────────────────────────────
// AC-3 generate determinístico
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-3 generate determinístico", () => {
  const db = createDbConnection(":memory:");
  const svc = createIdempotencyService({ db });

  test("mesmos params → mesma key (5 invocações consecutivas)", () => {
    const params = { runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 };
    const keys = Array.from({ length: 5 }, () => svc.generate(params));
    expect(new Set(keys).size).toBe(1);
  });

  test("output é SHA-256 hex 64 chars lowercase (Sha256Hash brand válido)", () => {
    const out = svc.generate({ runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 });
    expect(out).toMatch(/^[0-9a-f]{64}$/);
    const branded = mkSha256Hash(out);
    expect(branded.isOk()).toBe(true);
  });

  test("changing runId muda key", () => {
    const base = { runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 };
    expect(svc.generate(base)).not.toBe(svc.generate({ ...base, runId: "r2" }));
  });

  test("changing storyId muda key", () => {
    const base = { runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 };
    expect(svc.generate(base)).not.toBe(svc.generate({ ...base, storyId: "s2" }));
  });

  test("changing operation muda key", () => {
    const base = { runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 };
    expect(svc.generate(base)).not.toBe(svc.generate({ ...base, operation: "recv" }));
  });

  test("changing seqLocal muda key", () => {
    const base = { runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 };
    expect(svc.generate(base)).not.toBe(svc.generate({ ...base, seqLocal: 2 }));
  });

  test("property: generate(p) === generate(p) para arbitraries", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.string({ minLength: 1, maxLength: 60 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        (runId, storyId, operation, seqLocal) => {
          const a = svc.generate({ runId, storyId, operation, seqLocal });
          const b = svc.generate({ runId, storyId, operation, seqLocal });
          return a === b && /^[0-9a-f]{64}$/.test(a);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-4 commitBeforeSideEffect
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-4 commitBeforeSideEffect", () => {
  test("primeira call insere key, retorna alreadyCommitted=false", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    seedRunAndStory(db);
    const svc = createIdempotencyService({ db });

    const key = svc.generate({ runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 });
    const r = svc.commitBeforeSideEffect({
      key,
      storyId: "s1",
      sideEffect: "whatsapp_send",
    });

    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ alreadyCommitted: false, resultRef: null });

    const row = db
      .query<{ side_effect: string }, [string]>(
        "SELECT side_effect FROM idempotency_keys WHERE key = ?",
      )
      .get(key);
    expect(row?.side_effect).toBe("whatsapp_send");
    db.close();
  });

  test("segunda call com mesma key retorna alreadyCommitted=true + resultRef original (crash drill in-process)", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    seedRunAndStory(db);
    const svc = createIdempotencyService({ db });

    const key = svc.generate({ runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 });

    const first = svc.commitBeforeSideEffect({
      key,
      storyId: "s1",
      sideEffect: "whatsapp_send",
      resultRef: "msg-id-abc",
    });
    expect(first._unsafeUnwrap()).toEqual({ alreadyCommitted: false, resultRef: "msg-id-abc" });

    // Simula crash entre commit e side-effect — caller faz retry com mesma key
    const second = svc.commitBeforeSideEffect({
      key,
      storyId: "s1",
      sideEffect: "whatsapp_send",
      resultRef: "msg-id-abc",
    });
    expect(second._unsafeUnwrap()).toEqual({ alreadyCommitted: true, resultRef: "msg-id-abc" });

    // Apenas 1 row persistida (não duplicou)
    const n = db
      .query<{ n: number }, [string]>("SELECT COUNT(*) as n FROM idempotency_keys WHERE key = ?")
      .get(key);
    expect(n?.n).toBe(1);
    db.close();
  });

  test("commit com FK violation (story_id ausente) retorna err DbWriteFailure", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    // NÃO seed — story_id="s1" não existe
    const svc = createIdempotencyService({ db });

    const key = svc.generate({ runId: "r1", storyId: "s1", operation: "send", seqLocal: 1 });
    const r = svc.commitBeforeSideEffect({
      key,
      storyId: "s1",
      sideEffect: "send",
    });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().kind).toBe("DbWriteFailure");
    db.close();
  });
});
