/**
 * Story 2.6 — specs do worker-lifecycle.service (pause/resume/recover/guard).
 *
 * AC1: run running → pause() → runs.status='paused_for_interrupt' + audit WorkerPaused.
 * AC2: run paused → resume() → running + audit WorkerResumed.
 * AC3: run running órfã → recover() → paused_for_interrupt (consistente) + audit.
 * AC4 (AI Safety): guardIrreversible('deploy') → err(ConfirmationRequired);
 *      com cliOverride → ok(bypassed); acção não-irreversível → ok(not-required).
 * + pause fora de running → IllegalTransition; sem run → NoActiveRun.
 *
 * `:memory:` + applyMigrations (DB real, D-053) + ConfirmationGate real + fake audit.
 */

import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { applyMigrations, createDbConnection, createDrizzle } from "../../src/db/connection.ts";
import { type NewRun, runs } from "../../src/db/schema.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import { createConfirmationGate } from "../../src/services/confirmation-gate.service.ts";
import {
  createWorkerLifecycle,
  type WorkerLifecycle,
} from "../../src/services/worker-lifecycle.service.ts";

const MIGRATIONS_DIR = "src/db/migrations";

function createFakeAudit(): AuditPort & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    append(event: AuditEntry): Result<AuditAppendResult, AuditError> {
      entries.push(event);
      return ok({ seq: entries.length, thisHash: "fake-hash" as never, path: "fake" });
    },
    verifyChain(): Result<{ verified: number }, AuditError> {
      return ok({ verified: entries.length });
    },
  };
}

const clock = createTestClockAdapter(new Date("2026-05-31T08:00:00.000Z"));

function seedRun(db: Database, status: NewRun["status"]): string {
  const runId = `run-${status}`;
  createDrizzle(db)
    .insert(runs)
    .values({
      runId,
      startedAt: "2026-05-31T07:00:00.000Z",
      status,
      contextBundleHash: "deadbeef",
    })
    .run();
  return runId;
}

function statusOf(db: Database, runId: string): string | undefined {
  return createDrizzle(db)
    .select()
    .from(runs)
    .all()
    .find((r) => r.runId === runId)?.status;
}

let db: Database;
let audit: AuditPort & { entries: AuditEntry[] };
let lifecycle: WorkerLifecycle;

beforeEach(() => {
  db = createDbConnection(":memory:");
  applyMigrations(db, MIGRATIONS_DIR);
  audit = createFakeAudit();
  const confirmation = createConfirmationGate({ clock, audit });
  lifecycle = createWorkerLifecycle({ db, clock, audit, confirmation });
});
afterEach(() => {
  db.close();
});

describe("AC1 — pause", () => {
  test("run running → pause() → paused_for_interrupt + audit WorkerPaused", () => {
    const runId = seedRun(db, "running");
    const r = lifecycle.pause();
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.from).toBe("running");
      expect(r.value.to).toBe("paused_for_interrupt");
    }
    expect(statusOf(db, runId)).toBe("paused_for_interrupt");
    expect(audit.entries.some((e) => e.type === "WorkerPaused")).toBe(true);
  });

  test("pause fora de running → IllegalTransition (persiste inalterado)", () => {
    const runId = seedRun(db, "idle");
    const r = lifecycle.pause();
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("IllegalTransition");
    expect(statusOf(db, runId)).toBe("idle");
  });

  test("sem run → NoActiveRun", () => {
    const r = lifecycle.pause();
    if (r.isErr()) expect(r.error.kind).toBe("NoActiveRun");
    else throw new Error("esperava NoActiveRun");
  });
});

describe("AC2 — resume", () => {
  test("run paused → resume() → running + audit WorkerResumed", () => {
    const runId = seedRun(db, "paused_for_interrupt");
    const r = lifecycle.resume();
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.to).toBe("running");
    expect(statusOf(db, runId)).toBe("running");
    expect(audit.entries.some((e) => e.type === "WorkerResumed")).toBe(true);
  });

  test("pause → resume round-trip volta a running", () => {
    const runId = seedRun(db, "running");
    expect(lifecycle.pause().isOk()).toBe(true);
    expect(lifecycle.resume().isOk()).toBe(true);
    expect(statusOf(db, runId)).toBe("running");
  });
});

describe("AC3 — recover (partial; E5 completa)", () => {
  test("run running órfã → recovered + paused_for_interrupt + audit RecoveryDetected", () => {
    const runId = seedRun(db, "running");
    const r = lifecycle.recover();
    expect(r.isOk()).toBe(true);
    if (r.isOk() && r.value.kind === "recovered") {
      expect(r.value.runId).toBe(runId);
      expect(r.value.to).toBe("paused_for_interrupt");
    } else throw new Error("esperava recovered");
    expect(statusOf(db, runId)).toBe("paused_for_interrupt");
    expect(audit.entries.some((e) => e.type === "RecoveryDetected")).toBe(true);
  });

  test("sem run / run não-running → clean (nada a recuperar)", () => {
    seedRun(db, "paused_for_interrupt");
    const r = lifecycle.recover();
    if (r.isOk()) expect(r.value.kind).toBe("clean");
    else throw new Error("esperava clean");
  });
});

describe("AC4 — guardIrreversible (AI Safety, Pre-Mortem #2)", () => {
  test("deploy SEM confirmação → err(ConfirmationRequired)", () => {
    const r = lifecycle.guardIrreversible("deploy");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("ConfirmationRequired");
  });

  test("deploy com cliOverride (--i-really-mean-it) → ok(bypassed)", () => {
    const r = lifecycle.guardIrreversible("force-push", { cliOverride: true });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.kind).toBe("bypassed");
  });

  test("acção não-irreversível → ok(not-required)", () => {
    const r = lifecycle.guardIrreversible("read-file");
    if (r.isOk()) expect(r.value.kind).toBe("not-required");
    else throw new Error("esperava not-required");
  });
});
