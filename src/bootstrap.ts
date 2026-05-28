/**
 * `bootstrap.ts` — boot orchestration explícita (D-04.16, Story 1.a.7).
 *
 * **Big picture:** 1ª story end-to-end real do HDD. Liga `Result/branded` (1.a.2)
 * + ports temporais (1.a.3) + db schema/migrations (1.a.5) + audit JSONL hash
 * chain (1.a.6) + env Zod (1.a.7 nova) + shutdown handler (1.a.7 nova) num
 * sequence funcional.
 *
 * **Scope delimit:** o canon D-04.16 tem 7 passos boot; 3 deles (Litestream
 * watch, Hono /healthz, worker loop) **estão fora desta story** — nenhum
 * dos respectivos ficheiros existe ainda na sprint. Esta story implementa os
 * 4 passos com dependências prontas:
 *   1. parse env via Zod (`parseEnv`) — fail-fast em <500ms (AC-1).
 *   2. `createDbConnection` + `applyMigrations` (re-uso 1.a.5).
 *   3. `createAuditAdapter` + emit "ProcessStarted" (Q-A7-3 Yes).
 *   4. arm SIGTERM handler (`createShutdownHandler`, Q-A7-4 Yes para Stopped).
 *
 * **Síncrono:** todas as dependências internas são sync (parseEnv,
 * createDbConnection, applyMigrations, createAuditAdapter.append). `bootstrap()`
 * é sync e retorna `Result<BootResult, BootError>`.
 *
 * **bootRunId:** UUID único por arranque, partilhado entre ProcessStarted e
 * ProcessStopped events. Permite correlacionar lifecycle no postmortem.
 */

import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

import { createAuditAdapter } from "./adapters/audit/jsonl-hash-chain.adapter.ts";
import { createSystemClockAdapter } from "./adapters/clock/system-clock.adapter.ts";
import { applyMigrations, createDbConnection, type MigrationError } from "./db/connection.ts";
import { type Env, type EnvValidationError, parseEnv } from "./lib/env.ts";
import { err, ok, type Result } from "./lib/result.ts";
import { createShutdownHandler, type ShutdownHandle } from "./lib/shutdown.ts";
import type { AuditError, AuditPort } from "./ports/audit.port.ts";
import type { ClockPort } from "./ports/clock.port.ts";

const DEFAULT_DB_PATH = "./.hdd-state.db";
const DEFAULT_AUDIT_BASE_DIR = "_bmad-output/audit";
const DEFAULT_PROJECT = "projeto_hdd";
const DEFAULT_MIGRATIONS_DIR = "src/db/migrations";
const WORKER_VERSION = "0.0.1"; // sync com package.json#version

export type BootDeps = {
  readonly env?: NodeJS.ProcessEnv;
  readonly clock?: ClockPort;
  readonly dbPath?: string;
  readonly auditBaseDir?: string;
  readonly project?: string;
  readonly migrationsDir?: string;
  readonly bootRunId?: string;
  readonly emitProcessStartedEvent?: boolean;
  readonly emitProcessStoppedEvent?: boolean;
};

export type BootResult = {
  readonly env: Env;
  readonly db: Database;
  readonly audit: AuditPort;
  readonly shutdown: ShutdownHandle;
  readonly bootRunId: string;
};

export type BootError =
  | { readonly kind: "BootEnvInvalid"; readonly inner: EnvValidationError }
  | { readonly kind: "BootDbFailure"; readonly cause: unknown }
  | { readonly kind: "BootMigrationFailure"; readonly inner: MigrationError }
  | { readonly kind: "BootAuditFailure"; readonly inner: AuditError };

export function bootstrap(deps: BootDeps = {}): Result<BootResult, BootError> {
  // 1. env Zod fail-fast.
  const envR = parseEnv(deps.env ?? process.env);
  if (envR.isErr()) return err({ kind: "BootEnvInvalid", inner: envR.error });
  const env = envR.value;

  const clock = deps.clock ?? createSystemClockAdapter();
  const bootRunId = deps.bootRunId ?? randomUUID();

  // 2. db + migrations.
  let db: Database;
  try {
    db = createDbConnection(deps.dbPath ?? DEFAULT_DB_PATH);
  } catch (cause) {
    return err({ kind: "BootDbFailure", cause });
  }
  const migR = applyMigrations(db, deps.migrationsDir ?? DEFAULT_MIGRATIONS_DIR);
  if (migR.isErr()) {
    db.close();
    return err({ kind: "BootMigrationFailure", inner: migR.error });
  }

  // 3. audit adapter + opcional "ProcessStarted" event (Q-A7-3 Yes default).
  const audit = createAuditAdapter({
    clock,
    db,
    baseDir: deps.auditBaseDir ?? DEFAULT_AUDIT_BASE_DIR,
    project: deps.project ?? DEFAULT_PROJECT,
  });
  if (deps.emitProcessStartedEvent !== false) {
    const appR = audit.append({
      ts: clock.now().toISOString(),
      runId: bootRunId,
      type: "ProcessStarted",
      payload: { pid: process.pid, version: WORKER_VERSION },
    });
    if (appR.isErr()) {
      db.close();
      return err({ kind: "BootAuditFailure", inner: appR.error });
    }
  }

  // 4. shutdown handler armed.
  const shutdown = createShutdownHandler({
    db,
    audit,
    clock,
    bootRunId,
    emitStoppedEvent: deps.emitProcessStoppedEvent !== false,
  });
  shutdown.arm();

  return ok({ env, db, audit, shutdown, bootRunId });
}
