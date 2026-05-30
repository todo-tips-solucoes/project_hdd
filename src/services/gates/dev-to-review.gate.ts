/**
 * `dev-to-review.gate.ts` — gate após `bmad-dev-story` (test suite verde).
 *
 * Story 2.5 (FR-050 pt2, FR-051, FR-052, FR-012). Garante que o Review só recebe
 * diff que passa: corre (a) `bun test` (b) `bun run lint` via `SpawnPort` e (c)
 * verifica que os `files_created` declarados existem (probe injectado — Q-2.5-2).
 * Short-circuit na 1ª falha (Q-2.5-3) → `err({kind:'GateFailure', gate:'Dev→Review',
 * reason})` + audit `GateFailed` (FR-051) + diagnostic (FR-052) + retry counter++
 * (Map in-process por storyId — Q-2.5-1). À 5ª falha (FR-012) devolve
 * `RetryExhausted` em vez de `GateFailure` (wiring S2/Epic 4). Sucesso → reset + ok.
 *
 * Nota SpawnPort: exit ≠ 0 ainda é `ok({exitCode})` — o gate decide o significado.
 */

import { err, ok, type Result, ResultAsync } from "../../lib/result.ts";
import type { AuditPort } from "../../ports/audit.port.ts";
import type { ClockPort } from "../../ports/clock.port.ts";
import type { SpawnError, SpawnOptions, SpawnPort } from "../../ports/spawn.port.ts";
import type { DiagnosticWriter } from "./story-to-dev.gate.ts";

const GATE_LABEL = "Dev→Review" as const;
const GATE_NAME = "DevToReview" as const;
const DEFAULT_MAX_RETRIES = 5; // FR-012
const DEFAULT_TIMEOUT_MS = 120_000;

export type DevReviewFailReason = "tests red" | "lint red" | "files_created missing";

export type GateFailure = {
  readonly kind: "GateFailure";
  readonly gate: typeof GATE_LABEL;
  readonly reason: DevReviewFailReason;
  readonly evidence: string; // storyId
  readonly attempt: number;
};

export type RetryExhausted = {
  readonly kind: "RetryExhausted";
  readonly gate: typeof GATE_LABEL;
  readonly evidence: string;
  readonly attempts: number;
  readonly lastReason: DevReviewFailReason;
};

export type DevToReviewGateError = GateFailure | RetryExhausted | SpawnError;

export type DevReviewCheckInput = {
  readonly storyId: string;
  readonly runId: string;
  readonly filesCreated: ReadonlyArray<string>;
  /** Workdir onde correr os comandos + resolver `files_created`. */
  readonly cwd?: string;
};

export type DevToReviewGateDeps = {
  readonly spawn: SpawnPort;
  readonly audit: AuditPort;
  readonly clock: ClockPort;
  readonly diagnostics: DiagnosticWriter;
  /** Probe de existência (Q-2.5-2). Recebe o path tal como declarado em files_created. */
  readonly fileExists: (path: string) => boolean;
  readonly maxRetries?: number;
  readonly testCmd?: readonly [string, ...string[]];
  readonly lintCmd?: readonly [string, ...string[]];
  readonly timeoutMs?: number;
};

export interface DevToReviewGate {
  check(input: DevReviewCheckInput): ResultAsync<{ storyId: string }, DevToReviewGateError>;
}

function renderDiagnostic(
  storyId: string,
  reason: DevReviewFailReason,
  attempt: number,
  exhausted: boolean,
  ts: string,
): string {
  return [
    `# Gate Dev→Review — FAIL: ${storyId}`,
    "",
    `- **Quando:** ${ts}`,
    `- **Gate:** ${GATE_LABEL}`,
    `- **Razão:** ${reason}`,
    `- **Tentativa:** ${attempt}${exhausted ? " (RetryExhausted — FR-012)" : ""}`,
    "",
    "## Como corrigir",
    "",
    "Repor `bun test` e `bun run lint` a verde e garantir que os ficheiros",
    "declarados em `files_created` foram realmente criados; depois re-dispatch.",
    "",
  ].join("\n");
}

export function createDevToReviewGate(deps: DevToReviewGateDeps): DevToReviewGate {
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES;
  const testCmd = deps.testCmd ?? (["bun", "test"] as const);
  const lintCmd = deps.lintCmd ?? (["bun", "run", "lint"] as const);
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = new Map<string, number>();

  /** Corre `cmd`; `ok(true)` se exit 0, `ok(false)` se exit ≠ 0; `err` em SpawnError. */
  function runCmd(
    cmd: readonly [string, ...string[]],
    cwd: string | undefined,
  ): ResultAsync<boolean, SpawnError> {
    const [bin, ...args] = cmd;
    const opts: SpawnOptions = { timeoutMs, ...(cwd !== undefined ? { cwd } : {}) };
    return deps.spawn.spawn(bin, args, opts).map((r) => r.exitCode === 0);
  }

  async function fail(
    input: DevReviewCheckInput,
    reason: DevReviewFailReason,
  ): Promise<Result<{ storyId: string }, DevToReviewGateError>> {
    const attempt = (retries.get(input.storyId) ?? 0) + 1;
    retries.set(input.storyId, attempt);
    const exhausted = attempt >= maxRetries;
    const ts = deps.clock.now().toISOString();

    void deps.audit.append({
      ts,
      runId: input.runId,
      storyId: input.storyId,
      type: exhausted ? "RetryExhausted" : "GateFailed",
      payload: { gate: GATE_NAME, reason, attempt },
    });
    await deps.diagnostics
      .write(
        `${input.storyId}-gate-fail.md`,
        renderDiagnostic(input.storyId, reason, attempt, exhausted, ts),
      )
      .match(
        () => undefined,
        () => undefined,
      );

    if (exhausted) {
      return err({
        kind: "RetryExhausted",
        gate: GATE_LABEL,
        evidence: input.storyId,
        attempts: attempt,
        lastReason: reason,
      });
    }
    return err({ kind: "GateFailure", gate: GATE_LABEL, reason, evidence: input.storyId, attempt });
  }

  async function evaluate(
    input: DevReviewCheckInput,
  ): Promise<Result<{ storyId: string }, DevToReviewGateError>> {
    const testOk = await runCmd(testCmd, input.cwd);
    if (testOk.isErr()) return err(testOk.error);
    if (!testOk.value) return fail(input, "tests red");

    const lintOk = await runCmd(lintCmd, input.cwd);
    if (lintOk.isErr()) return err(lintOk.error);
    if (!lintOk.value) return fail(input, "lint red");

    if (!input.filesCreated.every((f) => deps.fileExists(f))) {
      return fail(input, "files_created missing");
    }

    retries.delete(input.storyId); // sucesso → reset do counter
    return ok({ storyId: input.storyId });
  }

  return {
    check(input) {
      return new ResultAsync(evaluate(input));
    },
  };
}
