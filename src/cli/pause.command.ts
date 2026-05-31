/**
 * `pause.command.ts` — `hdd-worker pause` (Story 2.6; substitui o stub da 2.1).
 *
 * Transita o worker `running → paused_for_interrupt` (persiste em db + audit) via
 * `worker-lifecycle.service`. Operação síncrona (bun:sqlite) → responde ≤2s (AC1).
 *
 * `buildCliLifecycle()` (exportado, reusado por `resume.command`) faz
 * `bootstrap({cliMode})` (db + audit, 1.a.7) + clock + confirmation-gate (1.b.2) +
 * lifecycle. `lifecycle`/io injectáveis → testável sem db real.
 */

import type { Command } from "commander";
import { createSystemClockAdapter } from "../adapters/clock/system-clock.adapter.ts";
import { type BootError, bootstrap } from "../bootstrap.ts";
import { err, ok, type Result } from "../lib/result.ts";
import { createConfirmationGate } from "../services/confirmation-gate.service.ts";
import {
  createWorkerLifecycle,
  type LifecycleError,
  type WorkerLifecycle,
} from "../services/worker-lifecycle.service.ts";
import { formatBootError } from "./boot-error.format.ts";

export type LifecycleCmdDeps = {
  readonly lifecycle?: WorkerLifecycle;
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

/** Constrói o lifecycle de produção: bootstrap (db+audit) + clock + confirmation. */
export function buildCliLifecycle(): Result<WorkerLifecycle, BootError> {
  const boot = bootstrap({ cliMode: true });
  if (boot.isErr()) return err(boot.error);
  const { db, audit } = boot.value;
  const clock = createSystemClockAdapter();
  const confirmation = createConfirmationGate({ clock, audit });
  return ok(createWorkerLifecycle({ db, clock, audit, confirmation }));
}

export function formatLifecycleError(e: LifecycleError): string {
  switch (e.kind) {
    case "NoActiveRun":
      return "pause: não há run activo (worker idle?)";
    case "IllegalTransition":
      return `pause: transição ilegal (estado actual: ${e.from})`;
    case "QueryFailure":
      return `pause: falha de db (${String(e.cause)})`;
  }
}

export function registerPauseCommand(program: Command, deps: LifecycleCmdDeps = {}): void {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
  const exit = deps.exit ?? ((c) => process.exit(c));

  program
    .command("pause")
    .description("Pausa o worker (running → paused_for_interrupt)")
    .action(() => {
      let lifecycle = deps.lifecycle;
      if (lifecycle === undefined) {
        const built = buildCliLifecycle();
        if (built.isErr()) {
          stderr(`${formatBootError(built.error)}\n`);
          exit(1);
          return;
        }
        lifecycle = built.value;
      }
      const r = lifecycle.pause();
      if (r.isErr()) {
        stderr(`${formatLifecycleError(r.error)}\n`);
        exit(1);
        return;
      }
      stdout(`worker paused: ${r.value.from} → ${r.value.to} (run ${r.value.runId})\n`);
      exit(0);
    });
}
