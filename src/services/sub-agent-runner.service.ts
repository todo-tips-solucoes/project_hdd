/**
 * `sub-agent-runner.service.ts` — orquestra sub-agentes Dev/Review/QA isolados.
 *
 * Story 2.3 (FR-004, AR-039, NFR-R3). Cada sub-agente corre dentro de
 * `withRunContext` (runId/storyId/traceId próprios — 1.a.9) + workdir efémero
 * próprio (`workdir-mount.ts`) passado como `opts.cwd` ao `BmadInvokerPort` (2.2).
 *
 * **AC1 (isolamento):** cada run emite audit `SubAgentStarted` com `runId`
 * explícito (distinto por sub-agente) + `subAgent` no payload (Q-2.3-1 [RESOLVED
 * — payload + runId distinto]; zero churn em `audit.port`/`run-context`).
 *
 * **AC3 (AI Safety, Pre-Mortem #2):** o Dev é OUTPUT-ONLY — `allowedTools` SEM
 * `Write`/`Edit` (Q-2.3-3 [RESOLVED]). O runner extrai o diff do `.result` e
 * aplica EXCLUSIVAMENTE via `apply-diff.service` (1.b.1) bound ao workdir do Dev,
 * que rejeita path traversal. Não há caminho de escrita que contorne a gate.
 */

import { z } from "zod";
import { errAsync, okAsync, type ResultAsync } from "../lib/result.ts";
import type { RunContext } from "../lib/run-context.ts";
import { withRunContext } from "../lib/run-context.ts";
import {
  createWorkdir,
  type HandoffError,
  handoffArtifact,
  type SubAgentRole,
} from "../lib/workdir-mount.ts";
import type { AuditPort } from "../ports/audit.port.ts";
import type { BmadError, BmadInvokerPort, BmadResult } from "../ports/bmad-invoker.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";
import {
  type ApplyDiffError,
  type ApplyDiffService,
  createApplyDiffService,
} from "./apply-diff.service.ts";

/** Dev é output-only: produz o diff, NUNCA escreve (Q-2.3-3). Sem Write/Edit. */
export const DEV_ALLOWED_TOOLS = ["Read", "Grep", "Glob"] as const;
/** Review/QA são read-only sobre os artefactos handed-off. */
export const READONLY_ALLOWED_TOOLS = ["Read", "Grep", "Glob"] as const;

/** Schema base do output do Dev (concretos DevOutput/… são da Story 2.7). */
export const devOutputSchema = z.object({
  files: z.array(z.object({ path: z.string(), contents: z.string() })),
});
export type DevOutput = z.infer<typeof devOutputSchema>;

export type SubAgentContext = {
  readonly runId: string;
  readonly role: SubAgentRole;
  readonly storyId?: string;
  readonly traceId?: string;
};

export type DevResult = { readonly applied: ReadonlyArray<string>; readonly workdir: string };

export type SubAgentError =
  | BmadError
  | ApplyDiffError
  | { readonly kind: "WorkdirSetupFailed"; readonly cause: unknown };

export type SubAgentRunnerDeps = {
  readonly invoker: BmadInvokerPort;
  readonly audit: AuditPort;
  readonly clock: ClockPort;
};

export interface SubAgentRunner {
  /** Dev output-only: invoca, valida o diff, aplica via apply-diff (AC1, AC3). */
  runDev(ctx: SubAgentContext, skill: string): ResultAsync<DevResult, SubAgentError>;
  /** Review/QA read-only sobre o workdir próprio (AC1). */
  runReadOnly(ctx: SubAgentContext, skill: string): ResultAsync<BmadResult, SubAgentError>;
  /** Troca explícita de artefactos entre workdirs (AC2). */
  handoff(
    from: string,
    to: string,
    paths: ReadonlyArray<string>,
  ): ReturnType<typeof handoffArtifact>;
}

function toRunContext(ctx: SubAgentContext): RunContext {
  return {
    runId: ctx.runId,
    ...(ctx.storyId !== undefined ? { storyId: ctx.storyId } : {}),
    ...(ctx.traceId !== undefined ? { traceId: ctx.traceId } : {}),
  };
}

export function createSubAgentRunner(deps: SubAgentRunnerDeps): SubAgentRunner {
  /** AC1: runId explícito (distinto) + subAgent no payload. Best-effort (observability). */
  function emitStarted(ctx: SubAgentContext): void {
    void deps.audit.append({
      ts: deps.clock.now().toISOString(),
      runId: ctx.runId,
      ...(ctx.storyId !== undefined ? { storyId: ctx.storyId } : {}),
      type: "SubAgentStarted",
      payload: { subAgent: ctx.role },
    });
  }

  /** Aplica cada ficheiro do diff via apply-diff; primeiro PathTraversal curto-circuita. */
  function applyAll(svc: ApplyDiffService, out: DevOutput): ResultAsync<string[], ApplyDiffError> {
    return out.files.reduce<ResultAsync<string[], ApplyDiffError>>(
      (acc, f) =>
        acc.andThen((paths) => svc.applyWrite(f.path, f.contents).map((r) => [...paths, r.path])),
      okAsync<string[], ApplyDiffError>([]),
    );
  }

  return {
    runDev(ctx, skill) {
      const wd = createWorkdir("dev");
      if (wd.isErr()) return errAsync(wd.error);
      const workdir = wd.value.path;
      return withRunContext(toRunContext(ctx), () => {
        emitStarted(ctx);
        // apply-diff bound ao workdir do Dev — TODA a escrita passa por aqui (AC3).
        const applyDiff = createApplyDiffService({
          workspaceRoot: workdir,
          audit: deps.audit,
          clock: deps.clock,
        });
        return deps.invoker
          .runParsed(skill, devOutputSchema, { allowedTools: [...DEV_ALLOWED_TOOLS], cwd: workdir })
          .andThen((out) => applyAll(applyDiff, out))
          .map((applied) => ({ applied, workdir }));
      });
    },

    runReadOnly(ctx, skill) {
      const wd = createWorkdir(ctx.role);
      if (wd.isErr()) return errAsync(wd.error);
      return withRunContext(toRunContext(ctx), () => {
        emitStarted(ctx);
        return deps.invoker.run(skill, {
          allowedTools: [...READONLY_ALLOWED_TOOLS],
          cwd: wd.value.path,
        });
      });
    },

    handoff(from, to, paths): ReturnType<typeof handoffArtifact> {
      return handoffArtifact(from, to, paths);
    },
  };
}

export type { HandoffError };
