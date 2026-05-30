/**
 * `status.command.ts` — `hdd-worker status` (Story 2.1, AC2; Q-2.1-2 = DB).
 *
 * Lê o estado persistido (última run + agregado de stories) via
 * `worker-status.service`. One-shot: boot cliMode → ler → `db.close()` → exit.
 * NÃO transita FSM nem escreve (isso é Story 2.6). Sem daemon/rede → ≤2s (NFR-O1).
 */

import type { Database } from "bun:sqlite";
import type { Command } from "commander";
import { type BootError, type BootResult, bootstrap } from "../bootstrap.ts";
import type { Result } from "../lib/result.ts";
import {
  readWorkerStatus,
  type StatusError,
  type WorkerStatusSnapshot,
} from "../services/worker-status.service.ts";
import { formatBootError } from "./boot-error.format.ts";

export type StatusDeps = {
  readonly bootstrap?: () => Result<BootResult, BootError>;
  readonly readStatus?: (db: Database) => Result<WorkerStatusSnapshot, StatusError>;
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

export function registerStatusCommand(program: Command, deps: StatusDeps = {}): void {
  program
    .command("status")
    .description("Mostra o estado do worker (última run + stories)")
    .action(() => {
      runStatus(deps);
    });
}

function runStatus(deps: StatusDeps): void {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
  const exit = deps.exit ?? ((c) => process.exit(c));

  const bootR = (deps.bootstrap ?? (() => bootstrap({ cliMode: true })))();
  if (bootR.isErr()) {
    stderr(`${formatBootError(bootR.error)}\n`);
    exit(1);
    return;
  }
  const { db } = bootR.value;
  const statusR = (deps.readStatus ?? readWorkerStatus)(db);
  db.close();
  if (statusR.isErr()) {
    stderr(`status query failed: ${JSON.stringify(statusR.error)}\n`);
    exit(1);
    return;
  }
  stdout(render(statusR.value));
  exit(0);
}

function render(snap: WorkerStatusSnapshot): string {
  if (snap.kind === "no-runs") {
    return "worker: idle (sem runs registadas)\n";
  }
  const { run, stories } = snap;
  const b = stories.byStatus;
  const trigger = run.pausedTrigger !== null ? ` paused_trigger=${run.pausedTrigger}` : "";
  return (
    `run ${run.runId} status=${run.status} iniciada=${run.startedAt} tokens=${run.llmTokensTotal}${trigger}\n` +
    `stories: total=${stories.total} PENDING=${b.PENDING} RUNNING=${b.RUNNING} ` +
    `PAUSED=${b.PAUSED} DONE=${b.DONE} ROLLED_BACK=${b.ROLLED_BACK}\n`
  );
}
