/**
 * Story 1.a.9 — specs para src/lib/run-context.ts + integração com audit adapter.
 *
 * AC-1: withRunContext propaga runId/storyId automaticamente para audit.append
 *       sem ter de passar como argumento.
 * AC-2: 2 contextos concorrentes em Promise.all preservam isolation.
 * Plus: explicit overrides context; RunIdMissing fora de qualquer contexto;
 *       nested context (inner overrides outer); helper APIs (get/require).
 *
 * Setup: cada test usa mkdtempSync + :memory: SQLite + audit adapter real;
 * lemos JSONL final para validar run_id/story_id corretos.
 */

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { applyMigrations } from "../../src/db/connection.ts";
import { getRunContext, requireRunContext, withRunContext } from "../../src/lib/run-context.ts";
import type { AuditPort } from "../../src/ports/audit.port.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");
const TEST_DATE = "2026-05-28";
const TEST_TS = `${TEST_DATE}T10:00:00.000Z`;

type Setup = { audit: AuditPort; auditDir: string; date: string };

function setupAudit(): Setup {
  const db = new Database(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  const migR = applyMigrations(db, MIGRATIONS_DIR);
  if (migR.isErr()) throw new Error(`migrations failed: ${JSON.stringify(migR.error)}`);

  const auditDir = mkdtempSync(join(tmpdir(), "hdd-runctx-"));
  const clock = createTestClockAdapter(new Date(TEST_TS));
  const audit = createAuditAdapter({ clock, db, baseDir: auditDir, project: "test" });
  return { audit, auditDir, date: TEST_DATE };
}

function readJsonlLines(auditDir: string, date: string): Array<Record<string, unknown>> {
  const path = join(auditDir, "test", `${date}.jsonl`);
  const content = readFileSync(path, "utf8").trim();
  return content.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper APIs — getRunContext / requireRunContext
// ────────────────────────────────────────────────────────────────────────────────

describe("getRunContext / requireRunContext", () => {
  test("getRunContext fora de qualquer wrap → undefined", () => {
    expect(getRunContext()).toBeUndefined();
  });

  test("getRunContext dentro de withRunContext → retorna o contexto", () => {
    const ctx = withRunContext({ runId: "r1", storyId: "s1" }, () => getRunContext());
    expect(ctx).toEqual({ runId: "r1", storyId: "s1" });
  });

  test("getRunContext após withRunContext → volta a undefined", () => {
    withRunContext({ runId: "r1" }, () => getRunContext());
    expect(getRunContext()).toBeUndefined();
  });

  test("requireRunContext fora de wrap → throws", () => {
    expect(() => requireRunContext()).toThrow("requireRunContext called outside withRunContext");
  });

  test("requireRunContext dentro de wrap → retorna o contexto", () => {
    const ctx = withRunContext({ runId: "r1" }, () => requireRunContext());
    expect(ctx.runId).toBe("r1");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: context propagation → audit
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 withRunContext → audit.append propaga runId/storyId", () => {
  test("runId + storyId vindos do contexto (sem passar explicit)", () => {
    const { audit, auditDir, date } = setupAudit();
    const r = withRunContext({ runId: "r1", storyId: "s1" }, () =>
      audit.append({ ts: TEST_TS, type: "TestEvent", payload: { n: 1 } }),
    );
    expect(r.isOk()).toBe(true);

    const lines = readJsonlLines(auditDir, date);
    expect(lines.length).toBe(1);
    expect(lines[0]?.["run_id"]).toBe("r1");
    expect(lines[0]?.["story_id"]).toBe("s1");
  });

  test("audit.append fora de qualquer contexto + sem explicit → err RunIdMissing", () => {
    const { audit } = setupAudit();
    const r = audit.append({ ts: TEST_TS, type: "TestEvent", payload: {} });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("RunIdMissing");
  });

  test("explicit AuditEntry.runId overrides context (precedência explicit > ctx)", () => {
    const { audit, auditDir, date } = setupAudit();
    const r = withRunContext({ runId: "r-ctx", storyId: "s-ctx" }, () =>
      audit.append({
        ts: TEST_TS,
        runId: "r-explicit",
        storyId: "s-explicit",
        type: "TestEvent",
        payload: {},
      }),
    );
    expect(r.isOk()).toBe(true);

    const lines = readJsonlLines(auditDir, date);
    expect(lines[0]?.["run_id"]).toBe("r-explicit");
    expect(lines[0]?.["story_id"]).toBe("s-explicit");
  });

  test("storyId opcional — context só com runId → story_id é null no JSONL", () => {
    const { audit, auditDir, date } = setupAudit();
    const r = withRunContext({ runId: "r-only" }, () =>
      audit.append({ ts: TEST_TS, type: "TestEvent", payload: {} }),
    );
    expect(r.isOk()).toBe(true);

    const lines = readJsonlLines(auditDir, date);
    expect(lines[0]?.["run_id"]).toBe("r-only");
    expect(lines[0]?.["story_id"]).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: concurrent isolation
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 isolation entre contextos concorrentes", () => {
  test("Promise.all com 2 contextos diferentes → cada linha mantém o seu runId", async () => {
    const { audit, auditDir, date } = setupAudit();

    await Promise.all([
      withRunContext({ runId: "r1" }, async () => {
        await Promise.resolve(); // forçar async stack split
        return audit.append({ ts: TEST_TS, type: "TestEvent", payload: { which: "first" } });
      }),
      withRunContext({ runId: "r2" }, async () => {
        await Promise.resolve();
        return audit.append({ ts: TEST_TS, type: "TestEvent", payload: { which: "second" } });
      }),
    ]);

    const lines = readJsonlLines(auditDir, date);
    expect(lines.length).toBe(2);

    // O JSONL é append-only; a ordem não é determinística entre Promise.all
    // racers, mas cada linha deve ter o run_id correto para o seu payload.
    for (const line of lines) {
      const payload = line["payload"] as { which: string };
      if (payload.which === "first") expect(line["run_id"]).toBe("r1");
      if (payload.which === "second") expect(line["run_id"]).toBe("r2");
    }
  });

  test("nested withRunContext: inner override outer", () => {
    const { audit, auditDir, date } = setupAudit();
    const r = withRunContext({ runId: "outer" }, () =>
      withRunContext({ runId: "inner" }, () =>
        audit.append({ ts: TEST_TS, type: "TestEvent", payload: {} }),
      ),
    );
    expect(r.isOk()).toBe(true);
    const lines = readJsonlLines(auditDir, date);
    expect(lines[0]?.["run_id"]).toBe("inner");
  });

  test("após inner termina, outer retoma para chamadas subsequentes", () => {
    const { audit, auditDir, date } = setupAudit();
    withRunContext({ runId: "outer" }, () => {
      withRunContext({ runId: "inner" }, () =>
        audit.append({ ts: TEST_TS, type: "Inner", payload: {} }),
      );
      audit.append({ ts: TEST_TS, type: "OuterAfter", payload: {} });
    });
    const lines = readJsonlLines(auditDir, date);
    expect(lines.length).toBe(2);
    expect(lines[0]?.["type"]).toBe("Inner");
    expect(lines[0]?.["run_id"]).toBe("inner");
    expect(lines[1]?.["type"]).toBe("OuterAfter");
    expect(lines[1]?.["run_id"]).toBe("outer");
  });
});
