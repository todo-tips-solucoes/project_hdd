/**
 * PT-6 — Audit tamper (Story 1.b.5). Compõe a defesa de 1.a.6.
 *
 * Verifica que `verifyChain` detecta adulteração: alterar 1 byte de uma linha
 * JSONL quebra o hash-chain (ChainBreak na linha alterada). Usa o adapter REAL
 * (fake em-memória não serve — precisa do hash-chain + ficheiro).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

function setup() {
  const baseDir = mkdtempSync(join(tmpdir(), "pt6-"));
  const db = createDbConnection(":memory:");
  applyMigrations(db, MIGRATIONS_DIR);
  const clock = createTestClockAdapter(new Date("2026-05-29T10:00:00.000Z"));
  const audit = createAuditAdapter({ db, baseDir, project: "pt6", clock });
  return { baseDir, db, audit };
}

describe("PT-6 audit tamper", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });
  afterEach(() => {
    ctx.db.close();
    rmSync(ctx.baseDir, { recursive: true, force: true });
  });

  test("cadeia íntegra → verifyChain ok", () => {
    for (let i = 0; i < 5; i++) {
      ctx.audit.append({
        ts: `2026-05-29T10:00:0${i}.000Z`,
        runId: "r1",
        type: "E",
        payload: { i },
      });
    }
    expect(ctx.audit.verifyChain("2026-05-29").isOk()).toBe(true);
  });

  test("1 byte alterado numa linha → ChainBreak detectado", () => {
    for (let i = 0; i < 5; i++) {
      ctx.audit.append({
        ts: `2026-05-29T10:00:0${i}.000Z`,
        runId: "r1",
        type: "E",
        payload: { i },
      });
    }
    const path = join(ctx.baseDir, "pt6", "2026-05-29.jsonl");
    const lines = readFileSync(path, "utf8").split("\n");
    lines[2] = (lines[2] ?? "").replace('"i":2', '"i":222');
    writeFileSync(path, lines.join("\n"));

    const r = ctx.audit.verifyChain("2026-05-29");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("ChainBreak");
  });
});
