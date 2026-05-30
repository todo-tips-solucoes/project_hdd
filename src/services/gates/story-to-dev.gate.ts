/**
 * `story-to-dev.gate.ts` — gate de validação antes de `bmad-dev-story`.
 *
 * Story 2.4 (FR-050, FR-051, FR-052, AR-054). Impede que o Dev arranque numa
 * story mal-formed: corre `validateStorySpec` (1.b / `story-spec-validator.ts`);
 * em falha (a) devolve `err({kind:'GateFailure', gate:'Story→Dev', reason,
 * evidence: storyId})` (AC1; label legível — Q-2.4-4); (b) emite audit
 * `GateFailed` com o enum `GateName='StoryToDev'` (FR-051; AC2); (c) escreve um
 * diagnostic `<storyId>-gate-fail.md` via `DiagnosticWriter` injectado (FR-052;
 * AC3 — Q-2.4-3). O verdict é a `GateFailure`; o write do diagnostic é
 * best-effort (a sua falha não muda o verdict). Em sucesso → `ok(spec)` (AC4).
 */

import type { GateName } from "../../core/events.ts";
import { err, ResultAsync } from "../../lib/result.ts";
import {
  type StorySpec,
  type StorySpecInvalidReason,
  validateStorySpec,
} from "../../lib/story-spec-validator.ts";
import type { AuditPort } from "../../ports/audit.port.ts";
import type { ClockPort } from "../../ports/clock.port.ts";

/** Label legível do gate (= literal da AC1). O enum `GateName` é para o audit. */
const GATE_LABEL = "Story→Dev" as const;
const GATE_NAME: GateName = "StoryToDev";

export type GateFailure = {
  readonly kind: "GateFailure";
  readonly gate: typeof GATE_LABEL;
  readonly reason: StorySpecInvalidReason;
  /** `storyId` da spec rejeitada. */
  readonly evidence: string;
};

export type DiagnosticWriteError = { readonly kind: "WriteFailure"; readonly cause: unknown };

/** Escritor de diagnostics (port injectável — Q-2.4-3). Real → fs; fake → tests. */
export interface DiagnosticWriter {
  write(relPath: string, contents: string): ResultAsync<{ path: string }, DiagnosticWriteError>;
}

export type StoryToDevGateDeps = {
  readonly audit: AuditPort;
  readonly clock: ClockPort;
  readonly diagnostics: DiagnosticWriter;
};

export interface StoryToDevGate {
  /** Verdict do gate. `ctx.runId` correlaciona o audit `GateFailed`. */
  check(spec: StorySpec, ctx: { runId: string }): ResultAsync<StorySpec, GateFailure>;
}

function renderDiagnostic(spec: StorySpec, reason: StorySpecInvalidReason, ts: string): string {
  return [
    `# Gate Story→Dev — FAIL: ${spec.storyId}`,
    "",
    `- **Quando:** ${ts}`,
    `- **Gate:** ${GATE_LABEL}`,
    `- **Razão:** ${reason}`,
    "",
    "## Spec recebida",
    "",
    `- acceptance_criteria: ${spec.acceptanceCriteria.length} entradas`,
    `- files_created: ${spec.filesCreated.length} entradas`,
    `- ao_subset: ${spec.aoSubset.length} entradas`,
    "",
    "## Como corrigir",
    "",
    "Reabrir a story (correct-course) e satisfazer ≥1 AC com Given/When/Then,",
    "`files_created` definido e `ao_subset` não vazio antes de re-dispatch.",
    "",
  ].join("\n");
}

export function createStoryToDevGate(deps: StoryToDevGateDeps): StoryToDevGate {
  function check(spec: StorySpec, ctx: { runId: string }): ResultAsync<StorySpec, GateFailure> {
    const v = validateStorySpec(spec);
    if (v.isOk()) return ResultAsync.fromSafePromise(Promise.resolve(spec)); // AC4: gate passa

    const reason = v.error.reason;
    const failure: GateFailure = {
      kind: "GateFailure",
      gate: GATE_LABEL,
      reason,
      evidence: spec.storyId,
    };
    const now = deps.clock.now().toISOString();

    // (b) audit GateFailed (FR-051) — best-effort no hot-path.
    void deps.audit.append({
      ts: now,
      runId: ctx.runId,
      storyId: spec.storyId,
      type: "GateFailed",
      payload: { gate: GATE_NAME, reason },
    });

    // (c) diagnostic (FR-052) — best-effort: o verdict é `failure` em qualquer caso.
    const md = renderDiagnostic(spec, reason, now);
    const settled = deps.diagnostics.write(`${spec.storyId}-gate-fail.md`, md).match(
      () => err<StorySpec, GateFailure>(failure),
      () => err<StorySpec, GateFailure>(failure),
    );
    return new ResultAsync(settled);
  }

  return { check };
}
