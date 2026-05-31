/**
 * `resume.command.ts` — `hdd-worker resume` (Story 2.6; substitui o stub da 2.1).
 *
 * Carrega o state do db + transita `paused_for_interrupt → running` (evento
 * `OperatorResponded`) via `worker-lifecycle.service` (AC2). Reusa
 * `buildCliLifecycle`/`LifecycleCmdDeps` de `pause.command`. `lifecycle`/io
 * injectáveis → testável sem db real.
 */

import type { Command } from "commander";
import { formatBootError } from "./boot-error.format.ts";
import { buildCliLifecycle, type LifecycleCmdDeps } from "./pause.command.ts";

function formatResumeError(e: {
  kind: "NoActiveRun" | "IllegalTransition" | "QueryFailure";
  from?: string;
  cause?: unknown;
}): string {
  switch (e.kind) {
    case "NoActiveRun":
      return "resume: não há run para retomar";
    case "IllegalTransition":
      return `resume: worker não está pausado (estado actual: ${e.from})`;
    case "QueryFailure":
      return `resume: falha de db (${String(e.cause)})`;
  }
}

export function registerResumeCommand(program: Command, deps: LifecycleCmdDeps = {}): void {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
  const exit = deps.exit ?? ((c) => process.exit(c));

  program
    .command("resume")
    .description("Retoma o worker (paused_for_interrupt → running)")
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
      const r = lifecycle.resume();
      if (r.isErr()) {
        stderr(`${formatResumeError(r.error)}\n`);
        exit(1);
        return;
      }
      stdout(`worker resumed: ${r.value.from} → ${r.value.to} (run ${r.value.runId})\n`);
      exit(0);
    });
}
