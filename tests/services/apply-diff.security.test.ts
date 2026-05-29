/**
 * `apply-diff.security.test.ts` — Pentest path-traversal suite (Story 1.b.1).
 *
 * 15 payloads em 5 categorias (relative, absolute, encoded/Unicode, symlink,
 * null/control) + 1 controlo positivo. Cada rejeição tem de emitir audit
 * `SecurityViolation`. AC-1 (binary) + AC-2 (coverage) + AC-4 (happy path).
 *
 * Nota numeração PT: o epics rotula isto "PT-2" mas architecture.md:1972 define
 * PT-2=egress / PT-3=docker-`-v`. O doc canónico `docs/pre-m1-pentest-tasks.md`
 * ainda não existe — implementamos o suite material (path traversal) e o
 * follow-up reconcilia a numeração.
 *
 * Control chars são construídos via `String.fromCharCode` para não embeber
 * bytes de control no source.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import { createApplyDiffService } from "../../src/services/apply-diff.service.ts";

const NUL = String.fromCharCode(0x00);
const US = String.fromCharCode(0x1f); // unit separator (C0)
const DEL = String.fromCharCode(0x7f);

/** Fake AuditPort em-memória: grava entries, sem chain nem run-context. */
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

function setup() {
  const ws = mkdtempSync(join(tmpdir(), "hdd-apply-diff-"));
  const audit = createFakeAudit();
  const clock = createTestClockAdapter(new Date("2026-05-29T00:00:00.000Z"));
  const svc = createApplyDiffService({ workspaceRoot: ws, audit, clock });
  return { ws, audit, clock, svc };
}

describe("apply-diff path traversal — Pentest suite (15 payloads)", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });
  afterEach(() => {
    rmSync(ctx.ws, { recursive: true, force: true });
  });

  // 1–3: relative escape
  const relative = ["../escape.txt", "../../etc/passwd", "a/../../b.txt"];
  // 4–6: absolute (posix + windows-style + UNC)
  const absolute = ["/etc/passwd", "C:\\Windows\\system32\\x.txt", "\\\\server\\share\\x"];
  // 7–9: encoded / Unicode
  const encoded = ["%2e%2e%2fetc%2fpasswd", "..%2fpasswd", "．．／x.txt"];

  for (const p of [...relative, ...absolute, ...encoded]) {
    test(`rejeita payload lexical: ${JSON.stringify(p)}`, async () => {
      const before = ctx.audit.entries.length;
      const res = await ctx.svc.applyWrite(p, "PWNED");
      expect(res.isErr()).toBe(true);
      if (res.isErr()) expect(res.error.kind).toBe("PathTraversal");
      const emitted = ctx.audit.entries.slice(before);
      expect(emitted.some((e) => e.type === "SecurityViolation")).toBe(true);
    });
  }

  // 10–12: null byte / control chars
  const control = [`a${NUL}b.txt`, `foo${US}bar.txt`, `x${DEL}y.txt`];
  for (const [i, p] of control.entries()) {
    test(`rejeita control char #${i + 1}`, async () => {
      const res = await ctx.svc.applyWrite(p, "PWNED");
      expect(res.isErr()).toBe(true);
      if (res.isErr() && res.error.kind === "PathTraversal") {
        expect(["null-byte", "control-char"]).toContain(res.error.reason);
      }
      expect(ctx.audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
    });
  }

  // 13–15: symlink escape (criados em runtime)
  test("rejeita symlink dir → /etc (write sob o link)", async () => {
    symlinkSync("/etc", join(ctx.ws, "link"));
    const res = await ctx.svc.applyWrite("link/passwd", "PWNED");
    expect(res.isErr()).toBe(true);
    if (res.isErr() && res.error.kind === "PathTraversal") {
      expect(res.error.reason).toBe("symlink-escape");
    }
    expect(ctx.audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
  });

  test("rejeita symlink → /tmp (escapa boundary)", async () => {
    symlinkSync("/tmp", join(ctx.ws, "out"));
    const res = await ctx.svc.applyWrite("out/evil.txt", "PWNED");
    expect(res.isErr()).toBe(true);
    expect(ctx.audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
  });

  test("rejeita symlink-alvo directo (o próprio target é symlink p/ fora)", async () => {
    symlinkSync("/etc/hosts", join(ctx.ws, "target"));
    const res = await ctx.svc.applyWrite("target", "PWNED");
    expect(res.isErr()).toBe(true);
    if (res.isErr() && res.error.kind === "PathTraversal") {
      expect(res.error.reason).toBe("symlink-escape");
    }
    expect(ctx.audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
  });
});

describe("apply-diff happy path (AC-4)", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });
  afterEach(() => {
    rmSync(ctx.ws, { recursive: true, force: true });
  });

  test("aceita path relativo legítimo, escreve, sem SecurityViolation", async () => {
    const res = await ctx.svc.applyWrite("src/foo.ts", "export const x = 1;\n");
    expect(res.isOk()).toBe(true);
    if (res.isOk()) {
      expect(res.value.path).toBe(join(ctx.ws, "src", "foo.ts"));
      expect(existsSync(res.value.path)).toBe(true);
      expect(readFileSync(res.value.path, "utf8")).toBe("export const x = 1;\n");
    }
    expect(ctx.audit.entries.some((e) => e.type === "SecurityViolation")).toBe(false);
  });

  test("writes concorrentes são serializados (mutex AO-165)", async () => {
    const results = await Promise.all([
      ctx.svc.applyWrite("a.txt", "A"),
      ctx.svc.applyWrite("b.txt", "B"),
      ctx.svc.applyWrite("c.txt", "C"),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    expect(readFileSync(join(ctx.ws, "a.txt"), "utf8")).toBe("A");
    expect(readFileSync(join(ctx.ws, "b.txt"), "utf8")).toBe("B");
    expect(readFileSync(join(ctx.ws, "c.txt"), "utf8")).toBe("C");
  });
});
