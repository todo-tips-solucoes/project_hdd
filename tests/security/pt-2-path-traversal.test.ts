/**
 * PT-2 — Path traversal (Story 1.b.5). Compõe a defesa de 1.b.1.
 *
 * Verifica que `sanitizeRelPath` rejeita os 5 tipos de payload e que
 * `apply-diff.service` emite audit `SecurityViolation` + nunca escreve fora do
 * workspace. Fake AuditPort em-memória + tmpdir isolado.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { sanitizeRelPath } from "../../src/lib/path-sanitize.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import { createApplyDiffService } from "../../src/services/apply-diff.service.ts";

function fakeAudit(): AuditPort & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    append(e: AuditEntry): Result<AuditAppendResult, AuditError> {
      entries.push(e);
      return ok({ seq: entries.length, thisHash: "h" as never, path: "p" });
    },
    verifyChain(): Result<{ verified: number }, AuditError> {
      return ok({ verified: entries.length });
    },
  };
}

describe("PT-2 path traversal", () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), "pt2-"));
  });
  afterEach(() => {
    rmSync(ws, { recursive: true, force: true });
  });

  test("payloads relative/absolute/encoded rejeitados (lexical)", () => {
    for (const p of ["../escape", "../../etc/passwd", "/etc/passwd", "%2e%2e%2fx", "..%2fx"]) {
      expect(sanitizeRelPath(ws, p).isErr()).toBe(true);
    }
    expect(sanitizeRelPath(ws, "src/ok.ts").isOk()).toBe(true);
  });

  test("apply-diff: payload traversal → SecurityViolation, sem write fora", async () => {
    const audit = fakeAudit();
    const svc = createApplyDiffService({
      workspaceRoot: ws,
      audit,
      clock: createTestClockAdapter(new Date("2026-05-29T00:00:00Z")),
    });
    const r = await svc.applyWrite("../../etc/pwned", "x");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
    expect(audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
  });
});
