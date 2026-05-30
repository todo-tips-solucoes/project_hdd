/**
 * Story 2.3 — specs do `sub-agent-runner.service` + `workdir-mount`.
 *
 * AC1 (property, fast-check): dois sub-agentes concorrentes → audit lines com
 * `runId` E `subAgent` distintos, sem colisão.
 * AC2 (binary): `handoffArtifact` copia paths válidos entre workdirs reais;
 * `../`/absoluto → PathTraversal; Review sem handoff não vê ficheiros de A.
 * AC3 (binary, AI Safety): fake invoker devolve diff com `../etc/passwd` →
 * runner encaminha por apply-diff REAL → PathTraversal + audit SecurityViolation;
 * Dev corre output-only (allowedTools sem Write/Edit). `claude -p` real NÃO no
 * unit (fake do BmadInvoker — D-053).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { errAsync, ok, okAsync, type Result } from "../../src/lib/result.ts";
import { handoffArtifact } from "../../src/lib/workdir-mount.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import type {
  BmadError,
  BmadInvokeOptions,
  BmadInvokerPort,
  BmadResult,
} from "../../src/ports/bmad-invoker.port.ts";
import {
  createSubAgentRunner,
  type DevOutput,
  type SubAgentContext,
} from "../../src/services/sub-agent-runner.service.ts";

/** Fake AuditPort em-memória — grava entries verbatim (sem chain nem context). */
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

type InvokeCall = { skill: string; opts?: BmadInvokeOptions };

/** Fake BmadInvokerPort — `runParsed` devolve `devOutput`; regista opts (allowedTools). */
function createFakeInvoker(devOutput: DevOutput | { fail: BmadError }): {
  invoker: BmadInvokerPort;
  calls: InvokeCall[];
} {
  const calls: InvokeCall[] = [];
  const invoker: BmadInvokerPort = {
    run(skill, opts) {
      calls.push({ skill, ...(opts !== undefined ? { opts } : {}) });
      const r: BmadResult = { stdout: "", stderr: "", exitCode: 0, result: "ok" };
      return okAsync(r);
    },
    runParsed<T>(skill: string, _schema: unknown, opts?: BmadInvokeOptions) {
      calls.push({ skill, ...(opts !== undefined ? { opts } : {}) });
      if ("fail" in devOutput) return errAsync(devOutput.fail);
      return okAsync(devOutput as unknown as T);
    },
  };
  return { invoker, calls };
}

const clock = createTestClockAdapter(new Date("2026-05-30T00:00:00.000Z"));

describe("AC1 — isolamento de contexto (property, fast-check)", () => {
  test("dois sub-agentes concorrentes → (runId, subAgent) distintos por linha", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (runIdA, runIdB) => {
        fc.pre(runIdA !== runIdB);
        const audit = createFakeAudit();
        const { invoker } = createFakeInvoker({ files: [] }); // Dev sem writes
        const runner = createSubAgentRunner({ invoker, audit, clock });

        const devCtx: SubAgentContext = { runId: runIdA, role: "dev" };
        const reviewCtx: SubAgentContext = { runId: runIdB, role: "review" };

        await Promise.all([
          runner.runDev(devCtx, "bmad-dev-story"),
          runner.runReadOnly(reviewCtx, "bmad-code-review"),
        ]);

        const started = audit.entries.filter((e) => e.type === "SubAgentStarted");
        expect(started.length).toBe(2);
        const dev = started.find((e) => e.payload["subAgent"] === "dev");
        const review = started.find((e) => e.payload["subAgent"] === "review");
        expect(dev?.runId).toBe(runIdA);
        expect(review?.runId).toBe(runIdB);
        // runId E subAgent ambos distintos — sem colisão.
        expect(dev?.runId).not.toBe(review?.runId);
        expect(dev?.payload["subAgent"]).not.toBe(review?.payload["subAgent"]);
      }),
      { numRuns: 25 },
    );
  });
});

describe("AC2 — handoff explícito entre workdirs", () => {
  const dirs: string[] = [];
  function ws(): string {
    const d = mkdtempSync(join(tmpdir(), "hdd-handoff-"));
    dirs.push(d);
    return d;
  }
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  test("copia paths válidos de A para B; Review só vê via handoff", () => {
    const from = ws();
    const to = ws();
    writeFileSync(join(from, "artifact.txt"), "diff-output");

    // Antes do handoff, B não tem o ficheiro (sem fs access directo a A).
    expect(existsSync(join(to, "artifact.txt"))).toBe(false);

    const r = handoffArtifact(from, to, ["artifact.txt"]);
    expect(r.isOk()).toBe(true);
    expect(existsSync(join(to, "artifact.txt"))).toBe(true);
    expect(readFileSync(join(to, "artifact.txt"), "utf8")).toBe("diff-output");
  });

  test("path com ../ → PathTraversal (rejeitado antes de I/O)", () => {
    const from = ws();
    const to = ws();
    const r = handoffArtifact(from, to, ["../etc/passwd"]);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
  });

  test("path absoluto → PathTraversal", () => {
    const from = ws();
    const to = ws();
    const r = handoffArtifact(from, to, ["/etc/passwd"]);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
  });
});

describe("AC3 — AI Safety: Dev output-only + write via apply-diff (Pre-Mortem #2)", () => {
  test("diff com ../etc/passwd → PathTraversal + audit SecurityViolation", async () => {
    const audit = createFakeAudit();
    const malicious: DevOutput = { files: [{ path: "../etc/passwd", contents: "PWNED" }] };
    const { invoker } = createFakeInvoker(malicious);
    const runner = createSubAgentRunner({ invoker, audit, clock });

    const r = await runner.runDev({ runId: "run-dev-1", role: "dev" }, "bmad-dev-story");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
    expect(audit.entries.some((e) => e.type === "SecurityViolation")).toBe(true);
  });

  test("diff com path absoluto → PathTraversal", async () => {
    const audit = createFakeAudit();
    const { invoker } = createFakeInvoker({ files: [{ path: "/etc/cron.d/x", contents: "x" }] });
    const runner = createSubAgentRunner({ invoker, audit, clock });
    const r = await runner.runDev({ runId: "run-dev-2", role: "dev" }, "bmad-dev-story");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PathTraversal");
  });

  test("Dev corre output-only: allowedTools SEM Write/Edit", async () => {
    const audit = createFakeAudit();
    const { invoker, calls } = createFakeInvoker({ files: [] });
    const runner = createSubAgentRunner({ invoker, audit, clock });
    await runner.runDev({ runId: "run-dev-3", role: "dev" }, "bmad-dev-story");

    const call = calls[0];
    if (call === undefined) throw new Error("invoker não invocado");
    const tools = call.opts?.allowedTools ?? [];
    expect(tools).not.toContain("Write");
    expect(tools).not.toContain("Edit");
    expect(tools).toContain("Read");
    // cwd é o workdir isolado do Dev (não o repo root).
    expect(call.opts?.cwd).toBeDefined();
  });

  test("diff válido (path relativo) → escrito dentro do workdir", async () => {
    const audit = createFakeAudit();
    const { invoker } = createFakeInvoker({
      files: [{ path: "src/out.ts", contents: "export {};" }],
    });
    const runner = createSubAgentRunner({ invoker, audit, clock });
    const r = await runner.runDev({ runId: "run-dev-4", role: "dev" }, "bmad-dev-story");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.applied.length).toBe(1);
      expect(existsSync(join(r.value.workdir, "src/out.ts"))).toBe(true);
      rmSync(r.value.workdir, { recursive: true, force: true });
    }
  });
});
