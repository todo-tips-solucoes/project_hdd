/**
 * Story 2.5 — specs do gate Dev→Review (test suite verde + retry counter).
 *
 * AC1: bun test exit 1 → GateFailure('tests red') + audit GateFailed + diagnostic + counter=1.
 * AC2: 5 falhas → 5ª devolve RetryExhausted (attempts=5; FR-012, wiring S2).
 * AC3: lint exit 1 → 'lint red'; file em falta → 'files_created missing'.
 * AC4: tudo verde → ok + counter reset (re-falha volta a counter=1).
 * + SpawnError (binário ausente) propagado, NÃO conta como retry.
 *
 * Fake SpawnPort keyed por args (bun test vs bun run lint); DiagnosticWriter REAL
 * sobre mkdtemp (D-053); fake AuditPort; TestClockAdapter; fileExists probe fake.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { errAsync, ok, okAsync, type Result, ResultAsync } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import type { SpawnError, SpawnPort, SpawnResult } from "../../src/ports/spawn.port.ts";
import {
  createDevToReviewGate,
  type DevToReviewGateDeps,
} from "../../src/services/gates/dev-to-review.gate.ts";
import type {
  DiagnosticWriteError,
  DiagnosticWriter,
} from "../../src/services/gates/story-to-dev.gate.ts";

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

/** SpawnPort fake keyed por args: exit code por comando (test/lint), ou SpawnError. */
function spySpawn(opts: { test?: number; lint?: number; fail?: SpawnError }): SpawnPort {
  return {
    spawn(_cmd, args) {
      if (opts.fail !== undefined) return errAsync(opts.fail);
      const isLint = [...args].includes("lint");
      const exitCode = isLint ? (opts.lint ?? 0) : (opts.test ?? 0);
      const r: SpawnResult = { stdout: "", stderr: "", exitCode };
      return okAsync(r);
    },
  };
}

function createFsDiagnosticWriter(root: string): DiagnosticWriter {
  return {
    write(relPath, contents) {
      const path = join(root, relPath);
      return ResultAsync.fromPromise(
        writeFile(path, contents).then(() => ({ path })),
        (cause): DiagnosticWriteError => ({ kind: "WriteFailure", cause }),
      );
    },
  };
}

const clock = createTestClockAdapter(new Date("2026-05-30T13:00:00.000Z"));
const dirs: string[] = [];
function diagRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "hdd-dr-diag-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeGate(over: Partial<DevToReviewGateDeps> = {}): {
  gate: ReturnType<typeof createDevToReviewGate>;
  audit: AuditPort & { entries: AuditEntry[] };
  root: string;
} {
  const audit = createFakeAudit();
  const root = diagRoot();
  const deps: DevToReviewGateDeps = {
    spawn: spySpawn({}),
    audit,
    clock,
    diagnostics: createFsDiagnosticWriter(root),
    fileExists: () => true,
    ...over,
  };
  return { gate: createDevToReviewGate(deps), audit, root };
}

const INPUT = {
  storyId: "2-5-gate-dev-review",
  runId: "run-1",
  filesCreated: ["src/services/gates/dev-to-review.gate.ts"],
};

describe("AC1 — bun test red", () => {
  test("test exit 1 → GateFailure('tests red') + audit + diagnostic + counter=1", async () => {
    const { gate, audit, root } = makeGate({ spawn: spySpawn({ test: 1 }) });
    const r = await gate.check(INPUT);
    expect(r.isErr()).toBe(true);
    if (r.isErr() && r.error.kind === "GateFailure") {
      expect(r.error.gate).toBe("Dev→Review");
      expect(r.error.reason).toBe("tests red");
      expect(r.error.evidence).toBe(INPUT.storyId);
      expect(r.error.attempt).toBe(1);
    } else throw new Error("esperava GateFailure");
    const ev = audit.entries.find((e) => e.type === "GateFailed");
    expect(ev?.payload["gate"]).toBe("DevToReview");
    const diag = readFileSync(join(root, `${INPUT.storyId}-gate-fail.md`), "utf8");
    expect(diag).toContain("tests red");
  });
});

describe("AC2 — RetryExhausted à 5ª falha (FR-012, wiring S2)", () => {
  test("5 falhas consecutivas → 5ª devolve RetryExhausted(attempts=5)", async () => {
    const { gate } = makeGate({ spawn: spySpawn({ test: 1 }) });
    for (let i = 1; i <= 4; i++) {
      const r = await gate.check(INPUT);
      if (r.isErr() && r.error.kind === "GateFailure") expect(r.error.attempt).toBe(i);
      else throw new Error(`ronda ${i} devia ser GateFailure`);
    }
    const fifth = await gate.check(INPUT);
    expect(fifth.isErr()).toBe(true);
    if (fifth.isErr() && fifth.error.kind === "RetryExhausted") {
      expect(fifth.error.attempts).toBe(5);
      expect(fifth.error.lastReason).toBe("tests red");
      expect(fifth.error.evidence).toBe(INPUT.storyId);
    } else throw new Error("esperava RetryExhausted");
  });
});

describe("AC3 — lint red + files_created missing", () => {
  test("test verde + lint exit 1 → GateFailure('lint red')", async () => {
    const { gate } = makeGate({ spawn: spySpawn({ test: 0, lint: 1 }) });
    const r = await gate.check(INPUT);
    if (r.isErr() && r.error.kind === "GateFailure") expect(r.error.reason).toBe("lint red");
    else throw new Error("esperava GateFailure lint red");
  });

  test("test+lint verdes + ficheiro declarado em falta → 'files_created missing'", async () => {
    const { gate } = makeGate({ spawn: spySpawn({}), fileExists: () => false });
    const r = await gate.check(INPUT);
    if (r.isErr() && r.error.kind === "GateFailure") {
      expect(r.error.reason).toBe("files_created missing");
    } else throw new Error("esperava GateFailure files missing");
  });
});

describe("AC4 — happy path + reset do counter", () => {
  test("tudo verde → ok, sem audit GateFailed, sem diagnostic", async () => {
    const { gate, audit } = makeGate({ spawn: spySpawn({}) });
    const r = await gate.check(INPUT);
    expect(r.isOk()).toBe(true);
    expect(audit.entries.some((e) => e.type === "GateFailed")).toBe(false);
  });

  test("falha → sucesso reseta counter (próxima falha volta a attempt=1)", async () => {
    // spawn dinâmico: 1ª chamada test red, depois verde; controla via closure.
    let testExit = 1;
    const spawn: SpawnPort = {
      spawn(_cmd, args) {
        const isLint = [...args].includes("lint");
        const r: SpawnResult = { stdout: "", stderr: "", exitCode: isLint ? 0 : testExit };
        return okAsync(r);
      },
    };
    const { gate } = makeGate({ spawn });

    const f1 = await gate.check(INPUT);
    if (f1.isErr() && f1.error.kind === "GateFailure") expect(f1.error.attempt).toBe(1);
    else throw new Error("1ª devia falhar attempt=1");

    testExit = 0; // agora passa → reset
    expect((await gate.check(INPUT)).isOk()).toBe(true);

    testExit = 1; // volta a falhar → counter recomeça em 1 (não 2)
    const f2 = await gate.check(INPUT);
    if (f2.isErr() && f2.error.kind === "GateFailure") expect(f2.error.attempt).toBe(1);
    else throw new Error("após reset devia ser attempt=1");
  });
});

describe("SpawnError — infra failure propagado (não conta como retry)", () => {
  test("binário ausente → Permanent propagado", async () => {
    const fail: SpawnError = { kind: "Permanent", cause: { kind: "BinaryNotFound", bin: "bun" } };
    const { gate, audit } = makeGate({ spawn: spySpawn({ fail }) });
    const r = await gate.check(INPUT);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("Permanent");
    // não emitiu GateFailed nem incrementou retry
    expect(audit.entries.some((e) => e.type === "GateFailed")).toBe(false);
  });
});
