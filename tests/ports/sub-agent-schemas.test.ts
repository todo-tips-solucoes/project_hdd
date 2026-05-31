/**
 * Story 2.7 — specs dos schemas concretos DevOutput/ReviewOutput/QAOutput.
 *
 * AC1: DevOutput + campo extra → parseSubAgentOutput → SchemaDrift{field}.
 * AC2: ReviewOutput verdict:'unsure' → reject (fora do enum formal AO-106).
 * AC3: JSON válido p/ cada schema → ok<T>; QAOutput válido; tipo errado → SchemaInvalid.
 * + adapter wrappers (runDevOutput) usam os schemas (via fake spawn).
 */

import { describe, expect, test } from "bun:test";
import { createCliWrapperAdapter } from "../../src/adapters/bmad/cli-wrapper.adapter.ts";
import { okAsync } from "../../src/lib/result.ts";
import type { SpawnPort, SpawnResult } from "../../src/ports/spawn.port.ts";
import {
  type DevOutput,
  devOutputSchema,
  parseSubAgentOutput,
  type QAOutput,
  qaOutputSchema,
  type ReviewOutput,
  reviewOutputSchema,
} from "../../src/ports/sub-agent-outputs.port.ts";

const validDev: DevOutput = {
  storyId: "2-7-schemas",
  filesCreated: [
    {
      path: "src/ports/sub-agent-outputs.port.ts",
      lineCount: 122,
      appliedAOs: ["AO-120"],
      skippedAOs: [],
    },
  ],
  filesModified: ["src/adapters/bmad/cli-wrapper.adapter.ts"],
  idempotencyKeysRegistered: [],
  brandedTypesUsed: ["StoryId"],
  retryOwnership: "adapter",
  testCoverage: { lines: 100, branches: 90 },
  untestedBranches: [],
  testFilePaths: ["tests/ports/sub-agent-schemas.test.ts"],
  dbIsolationPattern: "per-file",
  openQuestions: [],
  missingAOs: [],
};

const validReview: ReviewOutput = {
  storyId: "2-7-schemas",
  reviewedAt: "2026-05-31T10:00:00.000Z",
  verdict: "APPROVED",
  issues: [],
  gapDetected: false,
  coveragePassed: true,
  selfReview: true,
  missingAOs: [],
};

const validQa: QAOutput = {
  coveragePassed: true,
  coverageActual: { lines: 100, branches: 90, functions: 100 },
  branchesUncovered: [],
  flakyTestsDetected: [],
  chaosTestPassed: true,
  chaosRecoveryTimeMs: 1200,
  chaosAuditIntegrityOk: true,
  e2eTestsPassed: true,
  e2eFailures: [],
  newPropertiesGenerated: 2,
  mutationSpotcheckPassed: true,
  blockers: [],
};

describe("AC1 — SchemaDrift (campo extra, strict)", () => {
  test("DevOutput + campo extra → SchemaDrift{field}", () => {
    const drifted = { ...validDev, unexpectedField: "boom" };
    const r = parseSubAgentOutput(devOutputSchema, drifted);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("SchemaDrift");
      if (r.error.kind === "SchemaDrift") expect(r.error.field).toBe("unexpectedField");
    }
  });

  test("campo extra aninhado em filesCreated → SchemaDrift", () => {
    const drifted = {
      ...validDev,
      filesCreated: [{ ...validDev.filesCreated[0], rogue: 1 }],
    };
    const r = parseSubAgentOutput(devOutputSchema, drifted);
    if (r.isErr()) expect(r.error.kind).toBe("SchemaDrift");
    else throw new Error("esperava SchemaDrift");
  });
});

describe("AC2 — verdict fora do enum formal (AO-106)", () => {
  test("verdict:'unsure' → reject", () => {
    const bad = { ...validReview, verdict: "unsure" };
    const r = parseSubAgentOutput(reviewOutputSchema, bad);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("SchemaInvalid");
  });

  test("verdict:'pass' (esboço epics) também rejeitado — segue arquitectura", () => {
    const bad = { ...validReview, verdict: "pass" };
    expect(parseSubAgentOutput(reviewOutputSchema, bad).isErr()).toBe(true);
  });

  test("os 4 verdicts formais são aceites", () => {
    for (const verdict of [
      "APPROVED",
      "APPROVED_WITH_WARNINGS",
      "REJECTED",
      "BLOCKED_P1",
    ] as const) {
      expect(parseSubAgentOutput(reviewOutputSchema, { ...validReview, verdict }).isOk()).toBe(
        true,
      );
    }
  });
});

describe("AC3 — happy path + tipos errados", () => {
  test("DevOutput/ReviewOutput/QAOutput válidos → ok<T>", () => {
    expect(parseSubAgentOutput(devOutputSchema, validDev).isOk()).toBe(true);
    expect(parseSubAgentOutput(reviewOutputSchema, validReview).isOk()).toBe(true);
    expect(parseSubAgentOutput(qaOutputSchema, validQa).isOk()).toBe(true);
  });

  test("tipo errado (lineCount string) → SchemaInvalid (não SchemaDrift)", () => {
    const bad = { ...validDev, filesCreated: [{ ...validDev.filesCreated[0], lineCount: "x" }] };
    const r = parseSubAgentOutput(devOutputSchema, bad);
    if (r.isErr()) expect(r.error.kind).toBe("SchemaInvalid");
    else throw new Error("esperava SchemaInvalid");
  });

  test("retryOwnership só aceita adapter|VIOLATION", () => {
    expect(
      parseSubAgentOutput(devOutputSchema, { ...validDev, retryOwnership: "core" }).isErr(),
    ).toBe(true);
  });
});

describe("AC4 — adapter usa os schemas (wrappers tipados)", () => {
  function fakeSpawn(result: string): SpawnPort {
    return {
      spawn() {
        const stdout = `${JSON.stringify({ type: "result", subtype: "success", is_error: false, result })}`;
        const r: SpawnResult = { stdout, stderr: "", exitCode: 0 };
        return okAsync(r);
      },
    };
  }

  test("runDevOutput valida com devOutputSchema (JSON válido → ok)", async () => {
    const invoker = createCliWrapperAdapter({ spawn: fakeSpawn(JSON.stringify(validDev)) });
    const r = await invoker.runDevOutput("bmad-dev-story");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.storyId).toBe("2-7-schemas");
  });

  test("runReviewOutput rejeita verdict inválido (BmadOutputMalformed)", async () => {
    const invoker = createCliWrapperAdapter({
      spawn: fakeSpawn(JSON.stringify({ ...validReview, verdict: "unsure" })),
    });
    const r = await invoker.runReviewOutput("bmad-code-review");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("BmadOutputMalformed");
  });
});
