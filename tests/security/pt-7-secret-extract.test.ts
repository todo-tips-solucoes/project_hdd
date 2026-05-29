/**
 * PT-7 — Secret extraction (Story 1.b.5). Compõe 1.b.3 + 1.a.6.
 *
 * Verifica que um secret colocado no payload de um audit event NÃO é
 * extraível do ficheiro JSONL no disco (redaction pre-write), e que a cadeia
 * permanece íntegra (hash sobre o payload redigido). Adapter REAL.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

function setup() {
  const baseDir = mkdtempSync(join(tmpdir(), "pt7-"));
  const db = createDbConnection(":memory:");
  applyMigrations(db, MIGRATIONS_DIR);
  const clock = createTestClockAdapter(new Date("2026-05-29T11:00:00.000Z"));
  const audit = createAuditAdapter({ db, baseDir, project: "pt7", clock });
  return { baseDir, db, audit };
}

describe("PT-7 secret extraction", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });
  afterEach(() => {
    ctx.db.close();
    rmSync(ctx.baseDir, { recursive: true, force: true });
  });

  test("secrets no payload não são extraíveis do JSONL; chain íntegra", () => {
    ctx.audit.append({
      ts: "2026-05-29T11:00:00.000Z",
      runId: "r1",
      type: "SecurityViolation",
      payload: {
        header: "Authorization: Bearer sk-ant-api03-PT7EXTRACT1234567890",
        wa_id: "5511912345678",
        env: "ANTHROPIC_API_KEY=sk-leak-pt7",
      },
    });

    const raw = readFileSync(join(ctx.baseDir, "pt7", "2026-05-29.jsonl"), "utf8");
    for (const secret of ["sk-ant-api03-PT7EXTRACT1234567890", "5511912345678", "sk-leak-pt7"]) {
      expect(raw.includes(secret)).toBe(false);
    }
    expect(raw).toContain("***REDACTED***");
    expect(ctx.audit.verifyChain("2026-05-29").isOk()).toBe(true);
  });
});
