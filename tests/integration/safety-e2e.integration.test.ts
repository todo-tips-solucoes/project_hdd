/**
 * Safety E2E — INTEGRAÇÃO REAL (fs + SQLite + audit JSONL de verdade).
 * Retro Epic 1.b: path (1.b.1) + redaction (1.b.3) + audit (1.a.6/1.b.3)
 * compostos num fluxo real, sem mocks de I/O.
 *
 * Determinístico (não precisa de docker) → corre sempre. Prova que:
 *   - apply-diff escreve um ficheiro REAL no workspace e bloqueia symlink REAL;
 *   - o audit adapter REAL escreve JSONL no disco com secrets redigidos e a
 *     hash-chain verifica.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createSystemClockAdapter } from "../../src/adapters/clock/system-clock.adapter.ts";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";
import { withRunContext } from "../../src/lib/run-context.ts";
import { createApplyDiffService } from "../../src/services/apply-diff.service.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

describe("safety E2E — fs/audit reais", () => {
  let ws: string;
  let auditDir: string;
  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), "e2e-ws-"));
    auditDir = mkdtempSync(join(tmpdir(), "e2e-audit-"));
  });
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
    rmSync(auditDir, { recursive: true, force: true });
  });

  function realStack() {
    const clock = createSystemClockAdapter();
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS_DIR);
    const audit = createAuditAdapter({ db, baseDir: auditDir, project: "e2e", clock });
    const applyDiff = createApplyDiffService({ workspaceRoot: ws, audit, clock });
    return { db, audit, applyDiff };
  }

  test("apply-diff escreve ficheiro REAL dentro do workspace", async () => {
    const { db, applyDiff } = realStack();
    const r = await applyDiff.applyWrite("src/generated.ts", "export const x = 42;\n");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(existsSync(r.value.path)).toBe(true);
      expect(readFileSync(r.value.path, "utf8")).toBe("export const x = 42;\n");
    }
    db.close();
  });

  test("apply-diff bloqueia symlink REAL que escapa o workspace", async () => {
    const { db, applyDiff } = realStack();
    symlinkSync("/etc", join(ws, "escape")); // symlink real para fora
    const r = await applyDiff.applyWrite("escape/pwned", "x");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
    expect(existsSync("/etc/pwned")).toBe(false); // nada escrito fora
    db.close();
  });

  test("audit REAL: secret no payload → JSONL no disco redigido + chain verifica", () => {
    const { db, audit } = realStack();
    withRunContext({ runId: "e2e-run" }, () => {
      const r = audit.append({
        ts: new Date().toISOString(),
        type: "SecurityViolation",
        payload: { header: "Authorization: Bearer sk-ant-api03-E2EREALsecret123456" },
      });
      expect(r.isOk()).toBe(true);
    });
    const date = new Date().toISOString().slice(0, 10);
    const raw = readFileSync(join(auditDir, "e2e", `${date}.jsonl`), "utf8");
    expect(raw.includes("sk-ant-api03-E2EREALsecret123456")).toBe(false);
    expect(raw).toContain("***REDACTED***");
    expect(audit.verifyChain(date).isOk()).toBe(true);
    db.close();
  });
});
