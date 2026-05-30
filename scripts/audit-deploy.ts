/**
 * `audit-deploy.ts` — regista `DeployCompleted` na audit hash-chain (Story 1.c.5, AC2).
 *
 * Invocado por `scripts/deploy.sh` no fim de um deploy SSH (Q-C5-1 = script
 * standalone, zero modificação de src). Monta o `createAuditAdapter` directamente
 * (sem `bootstrap()` completo — não precisa de env/sandbox) e appenda o evento na
 * MESMA chain do worker (mesma DB + baseDir; senão criaria uma chain paralela).
 *
 * runId = `deploy-<sha>` (Q-C5-4). `applyMigrations` é idempotente — funciona
 * quer a DB seja fresca (teste) quer já tenha o schema (produção).
 */

import { dirname, join } from "node:path";
import { createSystemClockAdapter } from "../src/adapters/clock/system-clock.adapter.ts";
import { createAuditAdapter } from "../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { applyMigrations, createDbConnection } from "../src/db/connection.ts";
import { err, type Result } from "../src/lib/result.ts";
import type { AuditAppendResult, AuditError } from "../src/ports/audit.port.ts";

const SHA_RE = /^[0-9a-f]{7,40}$/;

export type DeployError =
  | { readonly kind: "InvalidSha"; readonly sha: string }
  | { readonly kind: "MigrationFailed"; readonly cause: unknown }
  | AuditError;

export type RecordDeployDeps = {
  readonly commitSha: string;
  readonly dbPath: string;
  readonly auditBaseDir: string;
  readonly migrationsDir: string;
  readonly project: string;
};

export function recordDeploy(deps: RecordDeployDeps): Result<AuditAppendResult, DeployError> {
  // NFR-S6: a fronteira anti command-injection é a validação do sha.
  if (!SHA_RE.test(deps.commitSha)) {
    return err({ kind: "InvalidSha", sha: deps.commitSha });
  }

  const db = createDbConnection(deps.dbPath);
  try {
    const migR = applyMigrations(db, deps.migrationsDir);
    if (migR.isErr()) {
      return err({ kind: "MigrationFailed", cause: migR.error });
    }
    const audit = createAuditAdapter({
      db,
      baseDir: deps.auditBaseDir,
      project: deps.project,
      clock: createSystemClockAdapter(),
    });
    return audit.append({
      ts: new Date().toISOString(),
      runId: `deploy-${deps.commitSha}`,
      type: "DeployCompleted",
      payload: { commitSha: deps.commitSha },
    });
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  const sha = process.argv[2];
  if (sha === undefined) {
    process.stderr.write("uso: bun run scripts/audit-deploy.ts <commit-sha>\n");
    process.exit(2);
  }
  // Defaults alinhados com o worker (bootstrap.ts): cwd-relative (deploy.sh faz
  // `cd /opt/hdd`); migrations derivadas do repo (robusto ao cwd).
  const repo = dirname(import.meta.dir);
  const result = recordDeploy({
    commitSha: sha,
    dbPath: process.env["HDD_DB_PATH"] ?? "./.hdd-state.db",
    auditBaseDir: process.env["HDD_AUDIT_BASE_DIR"] ?? "_bmad-output/audit",
    migrationsDir: join(repo, "src", "db", "migrations"),
    project: process.env["HDD_PROJECT"] ?? "projeto_hdd",
  });
  if (result.isErr()) {
    process.stderr.write(`audit-deploy FAILED: ${JSON.stringify(result.error)}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `OK DeployCompleted seq=${result.value.seq} hash=${result.value.thisHash.slice(0, 12)}…\n`,
  );
}
