/**
 * Story 2.4 — specs do gate Story→Dev + story-spec-validator + FSM gate_blocked.
 *
 * AC1: acceptance_criteria:[] → GateFailure (reason 'no AC defined', evidence=storyId).
 * AC2: audit GateFailed emitido (GateName 'StoryToDev').
 * AC3: diagnostic escrito em <storyId>-gate-fail.md (DiagnosticWriter REAL → mkdtemp; D-053).
 * AC4: story bem-formed → ok, sem diagnostic; + files_created/ao_subset vazios + AC sem GWT.
 * + FSM: running→GateBlocked→gate_blocked→OperatorResponded→running (Q-2.4-1).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { transition } from "../../src/core/fsm.ts";
import { ok, type Result, ResultAsync } from "../../src/lib/result.ts";
import {
  hasGivenWhenThen,
  type StorySpec,
  validateStorySpec,
} from "../../src/lib/story-spec-validator.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import {
  createStoryToDevGate,
  type DiagnosticWriteError,
  type DiagnosticWriter,
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

/** DiagnosticWriter REAL: escreve sob `root` (mkdtemp). D-053 — fs real. */
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

const clock = createTestClockAdapter(new Date("2026-05-30T12:00:00.000Z"));

const GOOD_AC = "Given uma story válida When o gate corre Then retorna ok";
function goodSpec(overrides: Partial<StorySpec> = {}): StorySpec {
  return {
    storyId: "2-4-gate-story-dev-ac-validation",
    acceptanceCriteria: [GOOD_AC],
    filesCreated: ["src/services/gates/story-to-dev.gate.ts"],
    aoSubset: ["FR-050"],
    ...overrides,
  };
}

const dirs: string[] = [];
function diagRoot(): string {
  const d = mkdtempSync(join(tmpdir(), "hdd-diag-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("story-spec-validator (puro)", () => {
  test("AC vazio → no AC defined", () => {
    const r = validateStorySpec(goodSpec({ acceptanceCriteria: [] }));
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.reason).toBe("no AC defined");
  });
  test("AC sem Given/When/Then → no Given/When/Then", () => {
    const r = validateStorySpec(goodSpec({ acceptanceCriteria: ["só uma frase solta"] }));
    if (r.isErr()) expect(r.error.reason).toBe("no Given/When/Then");
    else throw new Error("esperava err");
  });
  test("files_created vazio → no files_created", () => {
    const r = validateStorySpec(goodSpec({ filesCreated: [] }));
    if (r.isErr()) expect(r.error.reason).toBe("no files_created");
    else throw new Error("esperava err");
  });
  test("ao_subset vazio → no ao_subset", () => {
    const r = validateStorySpec(goodSpec({ aoSubset: [] }));
    if (r.isErr()) expect(r.error.reason).toBe("no ao_subset");
    else throw new Error("esperava err");
  });
  test("spec bem-formed → ok", () => {
    expect(validateStorySpec(goodSpec()).isOk()).toBe(true);
  });
  test("property: AC com Given/When/Then em qualquer ordem de espaços passa o check BDD", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (a, b, c) => {
        expect(hasGivenWhenThen(`Given ${a} When ${b} Then ${c}`)).toBe(true);
      }),
      { numRuns: 25 },
    );
  });
});

describe("AC1/AC2/AC3 — gate falha em spec mal-formed", () => {
  test("AC vazio → GateFailure (reason, evidence) + audit GateFailed + diagnostic", async () => {
    const audit = createFakeAudit();
    const root = diagRoot();
    const gate = createStoryToDevGate({
      audit,
      clock,
      diagnostics: createFsDiagnosticWriter(root),
    });
    const spec = goodSpec({ acceptanceCriteria: [] });

    const r = await gate.check(spec, { runId: "run-1" });

    // AC1
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("GateFailure");
      expect(r.error.gate).toBe("Story→Dev");
      expect(r.error.reason).toBe("no AC defined");
      expect(r.error.evidence).toBe(spec.storyId);
    }
    // AC2
    const gateFailed = audit.entries.find((e) => e.type === "GateFailed");
    expect(gateFailed).toBeDefined();
    expect(gateFailed?.payload["gate"]).toBe("StoryToDev");
    expect(gateFailed?.runId).toBe("run-1");
    // AC3
    const diag = readFileSync(join(root, `${spec.storyId}-gate-fail.md`), "utf8");
    expect(diag).toContain("Gate Story→Dev — FAIL");
    expect(diag).toContain("no AC defined");
  });
});

describe("AC4 — happy path + falha do diagnostic não muda verdict", () => {
  test("spec bem-formed → ok, sem audit GateFailed, sem diagnostic", async () => {
    const audit = createFakeAudit();
    const root = diagRoot();
    const gate = createStoryToDevGate({
      audit,
      clock,
      diagnostics: createFsDiagnosticWriter(root),
    });

    const r = await gate.check(goodSpec(), { runId: "run-2" });
    expect(r.isOk()).toBe(true);
    expect(audit.entries.some((e) => e.type === "GateFailed")).toBe(false);
  });

  test("writer que falha → ainda devolve GateFailure (best-effort diagnostic)", async () => {
    const audit = createFakeAudit();
    const failingWriter: DiagnosticWriter = {
      write: () =>
        ResultAsync.fromPromise(
          Promise.reject(new Error("disk full")),
          (cause): DiagnosticWriteError => ({ kind: "WriteFailure", cause }),
        ),
    };
    const gate = createStoryToDevGate({ audit, clock, diagnostics: failingWriter });
    const r = await gate.check(goodSpec({ aoSubset: [] }), { runId: "run-3" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.reason).toBe("no ao_subset");
    // audit ainda registou apesar do diagnostic falhar
    expect(audit.entries.some((e) => e.type === "GateFailed")).toBe(true);
  });
});

describe("FSM — gate_blocked (Q-2.4-1)", () => {
  test("running → GateBlocked → gate_blocked", () => {
    const r = transition("running", { kind: "GateBlocked" });
    expect(r._unsafeUnwrap()).toEqual({ to: "gate_blocked" });
  });
  test("gate_blocked → OperatorResponded → running (re-dispatch)", () => {
    const r = transition("gate_blocked", { kind: "OperatorResponded" });
    expect(r._unsafeUnwrap()).toEqual({ to: "running" });
  });
  test("gate_blocked → StartRun → IllegalTransition", () => {
    const r = transition("gate_blocked", { kind: "StartRun" });
    expect(r.isErr()).toBe(true);
  });
});
