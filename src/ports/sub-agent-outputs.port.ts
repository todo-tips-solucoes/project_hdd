/**
 * `sub-agent-outputs.port.ts` — schemas Zod concretos dos outputs dos sub-agents.
 *
 * Story 2.7 (AR-050/051/052). Materializa os contratos formais do Architecture
 * Step 06 (DevOutput extended, ReviewOutput, QAOutput) como schemas `.strict()` —
 * qualquer campo extra (drift do BMAD CLI) é rejeitado. Consome o `runParsed` da
 * 2.2 (schema injectável); os tipos inferidos dão type-safety ao pipeline.
 *
 * Q-2.7-1 [RESOLVED — arquitectura]: `verdict` segue o enum formal (AO-106), NÃO
 * o esboço `pass|fail-gap|fail-bug` do epics-AC (divergência em AI-S0-4).
 * Q-2.7-2 [RESOLVED]: `parseSubAgentOutput` mapeia `unrecognized_keys` →
 * `SchemaDrift{field}`; o resto → `SchemaInvalid`. Sem `throw` (AO-66).
 */

import { type ZodType, z } from "zod";
import { err, ok, type Result } from "../lib/result.ts";

// ── DevOutput (Architecture Step 06 extended, AO-120) ─────────────────────────

export const devOutputSchema = z
  .object({
    storyId: z.string(),
    filesCreated: z.array(
      z
        .object({
          path: z.string(),
          lineCount: z.number(),
          appliedAOs: z.array(z.string()),
          skippedAOs: z.array(z.string()),
        })
        .strict(),
    ),
    filesModified: z.array(z.string()),
    idempotencyKeysRegistered: z.array(z.string()),
    brandedTypesUsed: z.array(z.string()),
    retryOwnership: z.enum(["adapter", "VIOLATION"]),
    testCoverage: z.object({ lines: z.number(), branches: z.number() }).strict(),
    untestedBranches: z.array(z.string()),
    testFilePaths: z.array(z.string()),
    dbIsolationPattern: z.enum(["per-file", "per-test", "shared"]),
    propertyTestSeeds: z.array(z.number()).optional(),
    openQuestions: z.array(z.string()),
    missingAOs: z.array(z.string()),
  })
  .strict();

// ── ReviewOutput (Architecture 1036, AO-106; verdict formal — Q-2.7-1) ────────

export const reviewIssueSchema = z
  .object({
    severity: z.enum(["P1", "P2", "P3"]),
    category: z.string(),
    description: z.string(),
    file: z.string().optional(),
    aoRef: z.string().optional(),
  })
  .strict();

export const reviewOutputSchema = z
  .object({
    storyId: z.string(),
    reviewedAt: z.string(),
    verdict: z.enum(["APPROVED", "APPROVED_WITH_WARNINGS", "REJECTED", "BLOCKED_P1"]),
    issues: z.array(reviewIssueSchema),
    gapDetected: z.boolean(),
    gapDescription: z.string().optional(),
    coveragePassed: z.boolean(),
    selfReview: z.boolean(),
    missingAOs: z.array(z.string()),
  })
  .strict();

// ── QAOutput (Architecture 1719, novo formal Round 2) ─────────────────────────

export const qaOutputSchema = z
  .object({
    coveragePassed: z.boolean(),
    coverageActual: z
      .object({ lines: z.number(), branches: z.number(), functions: z.number() })
      .strict(),
    branchesUncovered: z.array(z.string()),
    flakyTestsDetected: z.array(z.string()),
    chaosTestPassed: z.boolean(),
    chaosRecoveryTimeMs: z.number(),
    chaosAuditIntegrityOk: z.boolean(),
    e2eTestsPassed: z.boolean(),
    e2eFailures: z.array(z.string()),
    newPropertiesGenerated: z.number(),
    mutationSpotcheckPassed: z.boolean(),
    blockers: z.array(z.string()),
  })
  .strict();

export type DevOutput = z.infer<typeof devOutputSchema>;
export type ReviewIssue = z.infer<typeof reviewIssueSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type QAOutput = z.infer<typeof qaOutputSchema>;

// ── parse helper com mapeamento de SchemaDrift (AC1) ──────────────────────────

export type SubAgentOutputError =
  | { readonly kind: "SchemaDrift"; readonly field: string }
  | { readonly kind: "SchemaInvalid"; readonly detail: string };

/**
 * Valida `raw` com `schema` (strict). Campo extra (`unrecognized_keys`) →
 * `SchemaDrift{field}` (1º campo não reconhecido); qualquer outro defeito →
 * `SchemaInvalid{detail}`.
 */
export function parseSubAgentOutput<T>(
  schema: ZodType<T>,
  raw: unknown,
): Result<T, SubAgentOutputError> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const drift = parsed.error.issues.find((i) => i.code === "unrecognized_keys");
  if (drift?.code === "unrecognized_keys") {
    const field = drift.keys[0];
    if (field !== undefined) return err({ kind: "SchemaDrift", field });
  }
  return err({ kind: "SchemaInvalid", detail: parsed.error.message });
}
