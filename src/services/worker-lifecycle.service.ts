/**
 * `worker-lifecycle.service.ts` — start/pause/resume + recovery + guard irreversível.
 *
 * Story 2.6 (FR-031, FR-032 partial, FR-040, NFR-R3). Dá state real ao worker:
 *   - `pause()`  → FSM `running → paused_for_interrupt` (evento `OperatorPaused`,
 *                  2.6/Q-2.6-1) + persiste `runs.status` + audit (AC1).
 *   - `resume()` → FSM `paused_for_interrupt → running` (`OperatorResponded`) (AC2).
 *   - `recover()`→ run `running` órfã (crash) → `paused_for_interrupt` + audit
 *                  `RecoveryDetected` (AC3 partial; E5 completa o replay).
 *   - `guardIrreversible()` → consulta `confirmation-gate` (1.b.2) ANTES de uma
 *                  acção irreversível; sem confirmação → `err(ConfirmationRequired)`
 *                  (AC4 — wiring AI Safety, Pre-Mortem #2).
 *
 * Persistência via drizzle directo (Q-2.6-4), consistente com `worker-status.service`.
 * Síncrono (bun:sqlite sync) → `Result`. NÃO corre stories nem processa triggers.
 */

import type { Database } from "bun:sqlite";
import { desc, eq } from "drizzle-orm";
import { type FsmEvent, type FsmState, transition } from "../core/fsm.ts";
import { createDrizzle } from "../db/connection.ts";
import { type Run, runs } from "../db/schema.ts";
import { err, ok, type Result } from "../lib/result.ts";
import type { AuditPort } from "../ports/audit.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";
import type {
  ConfirmationError,
  ConfirmationGate,
  RequireOutcome,
} from "./confirmation-gate.service.ts";

/** waId sentinela do operador em contexto CLI (Q-2.6-3; Quick Reply WhatsApp = Epic 3). */
const CLI_OPERATOR_WAID = "cli-operator";

/** Estados persistíveis em `runs.status` (6; `gate_blocked` não está no enum DB). */
type DbRunStatus = Run["status"];

export type LifecycleError =
  | { readonly kind: "NoActiveRun" }
  | { readonly kind: "IllegalTransition"; readonly from: FsmState; readonly event: string }
  | { readonly kind: "QueryFailure"; readonly cause: unknown };

export type LifecycleTransition = {
  readonly runId: string;
  readonly from: FsmState;
  readonly to: DbRunStatus;
};

export type RecoveryReport =
  | { readonly kind: "clean" }
  | { readonly kind: "recovered"; readonly runId: string; readonly to: DbRunStatus };

export type WorkerLifecycleDeps = {
  readonly db: Database;
  readonly clock: ClockPort;
  readonly audit: AuditPort;
  readonly confirmation: ConfirmationGate;
};

export interface WorkerLifecycle {
  pause(): Result<LifecycleTransition, LifecycleError>;
  resume(): Result<LifecycleTransition, LifecycleError>;
  recover(): Result<RecoveryReport, LifecycleError>;
  guardIrreversible(
    action: string,
    opts?: { readonly cliOverride?: boolean },
  ): Result<RequireOutcome, ConfirmationError>;
}

export function createWorkerLifecycle(deps: WorkerLifecycleDeps): WorkerLifecycle {
  const orm = createDrizzle(deps.db);

  function latestRun(): Run | undefined {
    return orm.select().from(runs).orderBy(desc(runs.startedAt)).limit(1).all()[0];
  }

  function persist(runId: string, to: DbRunStatus, type: string, from: FsmState): void {
    orm.update(runs).set({ status: to }).where(eq(runs.runId, runId)).run();
    void deps.audit.append({
      ts: deps.clock.now().toISOString(),
      runId,
      type,
      payload: { from, to },
    });
  }

  /** Aplica `event` ao latest run; persiste `expectedTo` se a transição for legal. */
  function applyEvent(
    event: FsmEvent,
    expectedTo: DbRunStatus,
    auditType: string,
  ): Result<LifecycleTransition, LifecycleError> {
    try {
      const run = latestRun();
      if (run === undefined) return err({ kind: "NoActiveRun" });
      const from = run.status;
      const t = transition(from, event);
      if (t.isErr()) return err({ kind: "IllegalTransition", from, event: event.kind });
      persist(run.runId, expectedTo, auditType, from);
      return ok({ runId: run.runId, from, to: expectedTo });
    } catch (cause) {
      return err({ kind: "QueryFailure", cause });
    }
  }

  return {
    pause() {
      return applyEvent({ kind: "OperatorPaused" }, "paused_for_interrupt", "WorkerPaused");
    },

    resume() {
      return applyEvent({ kind: "OperatorResponded" }, "running", "WorkerResumed");
    },

    recover() {
      try {
        const run = latestRun();
        if (run === undefined || run.status !== "running") return ok({ kind: "clean" });
        // Run `running` órfã = crash (shutdown limpo teria pausado/terminado).
        persist(run.runId, "paused_for_interrupt", "RecoveryDetected", "running");
        return ok({ kind: "recovered", runId: run.runId, to: "paused_for_interrupt" });
      } catch (cause) {
        return err({ kind: "QueryFailure", cause });
      }
    },

    guardIrreversible(action, opts) {
      return deps.confirmation.requireConfirmation(action, {
        waId: CLI_OPERATOR_WAID,
        ...(opts?.cliOverride === true ? { cliOverride: true } : {}),
      });
    },
  };
}
