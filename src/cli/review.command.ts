/**
 * `review.command.ts` — Commander subcommand `hdd-worker review {approve|request-changes|reject}`.
 *
 * Story 1.a.8 (D-019 enforcement, Q-A8-1/2/5 [RESOLVED]).
 *
 * **Scope minimal (Q-A8-2 audit-only):** cada subcommand emite um evento no
 * audit JSONL via bootstrap em cliMode. NÃO actualiza `runs.status` nem tabela
 * `review_decisions` — esse wiring vem com worker loop (Story 2.1+). Consumer
 * lê audit chain em resume.
 *
 * **CLI lifecycle:** boot em cliMode → audit.append → db.close → process.exit.
 * Sem SIGTERM arm; one-shot.
 *
 * **Reviewer source (Q-A8-5):** `process.env.USER ?? "operador"`. Override
 * via `--reviewer <name>` adiável.
 */

import type { Command } from "commander";
import { type BootError, type BootResult, bootstrap } from "../bootstrap.ts";
import type { Result } from "../lib/result.ts";

type ReviewEventType = "ReviewApproved" | "ReviewChangesRequested" | "ReviewRejected";

type ReviewExtra = {
  readonly note?: string;
  readonly reason?: string;
};

export type ReviewDeps = {
  readonly bootstrap?: () => Result<BootResult, BootError>;
  readonly reviewer?: string;
  readonly now?: () => string;
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

export function registerReviewCommand(program: Command, deps: ReviewDeps = {}): void {
  const { USER } = process.env;
  const reviewer = deps.reviewer ?? USER ?? "operador";
  const review = program.command("review").description("Operator review verdicts (D-019)");

  review
    .command("approve <workflowId>")
    .description("Approve a workflow")
    .action((workflowId: string) => {
      runReview(deps, "ReviewApproved", workflowId, {}, reviewer);
    });

  review
    .command("request-changes <workflowId>")
    .requiredOption("--note <text>", "Change request note")
    .description("Request changes on a workflow")
    .action((workflowId: string, opts: { note: string }) => {
      runReview(deps, "ReviewChangesRequested", workflowId, { note: opts.note }, reviewer);
    });

  review
    .command("reject <workflowId>")
    .requiredOption("--reason <text>", "Reject reason")
    .description("Reject a workflow")
    .action((workflowId: string, opts: { reason: string }) => {
      runReview(deps, "ReviewRejected", workflowId, { reason: opts.reason }, reviewer);
    });
}

function runReview(
  deps: ReviewDeps,
  type: ReviewEventType,
  workflowId: string,
  extra: ReviewExtra,
  reviewer: string,
): void {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
  const exit = deps.exit ?? ((c) => process.exit(c));
  const now = deps.now ?? (() => new Date().toISOString());

  const bootR = (deps.bootstrap ?? (() => bootstrap({ cliMode: true })))();
  if (bootR.isErr()) {
    stderr(`boot failed: ${bootR.error.kind}\n`);
    exit(1);
    return;
  }
  const { audit, db } = bootR.value;
  const decidedAt = now();
  const payload: Record<string, string> = {
    workflowId,
    reviewer,
    ...(extra.note !== undefined ? { note: extra.note } : {}),
    ...(extra.reason !== undefined ? { reason: extra.reason } : {}),
  };
  const appR = audit.append({ ts: decidedAt, runId: workflowId, type, payload });
  db.close();
  if (appR.isErr()) {
    stderr(`audit append failed: ${JSON.stringify(appR.error)}\n`);
    exit(1);
    return;
  }
  stdout(`${labelFor(type)}: ${workflowId}${formatSuffix(extra)}\n`);
  exit(0);
}

function labelFor(type: ReviewEventType): string {
  switch (type) {
    case "ReviewApproved":
      return "approved";
    case "ReviewChangesRequested":
      return "changes-requested";
    case "ReviewRejected":
      return "rejected";
  }
}

function formatSuffix(extra: ReviewExtra): string {
  const note = extra.note ?? extra.reason;
  return note !== undefined ? ` — ${note}` : "";
}
