/**
 * `worker-status.service.ts` — leitura do estado do worker (Story 2.1, AC2, Q-2.1-2).
 *
 * PRIMEIRA leitura DB do projeto (até aqui só INSERT/UPDATE em boot/audit). Lê a
 * última run (estado FSM) + agrega as suas stories por status. Puro/síncrono
 * (bun:sqlite é sync), neverthrow. NÃO transita FSM nem escreve (isso é Story 2.6).
 *
 * Volume baixo (single-row run + poucas stories) → agregação em memória.
 */

import type { Database } from "bun:sqlite";
import { desc, eq } from "drizzle-orm";
import { createDrizzle } from "../db/connection.ts";
import { type Run, runs, stories } from "../db/schema.ts";
import { err, ok, type Result } from "../lib/result.ts";

export type StoryStatus = "PENDING" | "RUNNING" | "PAUSED" | "DONE" | "ROLLED_BACK";

export type WorkerStatusSnapshot =
  | { readonly kind: "no-runs" }
  | {
      readonly kind: "run";
      readonly run: Run;
      readonly stories: {
        readonly total: number;
        readonly byStatus: Record<StoryStatus, number>;
      };
    };

export type StatusError = { readonly kind: "QueryFailure"; readonly cause: unknown };

export function readWorkerStatus(db: Database): Result<WorkerStatusSnapshot, StatusError> {
  try {
    const orm = createDrizzle(db);
    const latest = orm.select().from(runs).orderBy(desc(runs.startedAt)).limit(1).all();
    const run = latest[0];
    if (run === undefined) return ok({ kind: "no-runs" });

    const rows = orm.select().from(stories).where(eq(stories.runId, run.runId)).all();
    const byStatus: Record<StoryStatus, number> = {
      PENDING: 0,
      RUNNING: 0,
      PAUSED: 0,
      DONE: 0,
      ROLLED_BACK: 0,
    };
    for (const s of rows) byStatus[s.status] += 1;

    return ok({ kind: "run", run, stories: { total: rows.length, byStatus } });
  } catch (cause) {
    return err({ kind: "QueryFailure", cause });
  }
}
