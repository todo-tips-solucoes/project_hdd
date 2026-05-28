/**
 * `verify-audit-chain.ts` — CLI standalone para `bun run audit:verify <date>`.
 *
 * Story 1.a.6 (AO-54). Lê JSONL diário, recomputa chain integrity, exit 0/1.
 */

import { createSystemClockAdapter } from "../src/adapters/clock/system-clock.adapter.ts";
import { createAuditAdapter } from "../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createDbConnection } from "../src/db/connection.ts";

const dateArg = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const baseDir = process.env["HDD_AUDIT_DIR"] ?? "_bmad-output/audit";
const project = process.env["HDD_PROJECT"] ?? "projeto_hdd";
const dbPath = process.env["HDD_DB_PATH"] ?? "./.hdd-state.db";

const db = createDbConnection(dbPath);
const audit = createAuditAdapter({
  db,
  baseDir,
  project,
  clock: createSystemClockAdapter(),
});

const result = audit.verifyChain(dateArg);
db.close();

if (result.isErr()) {
  const e = result._unsafeUnwrapErr();
  console.error(`[audit:verify] FAILED date=${dateArg} kind=${e.kind}`, e);
  process.exit(1);
}

const { verified } = result._unsafeUnwrap();
console.log(`[audit:verify] OK date=${dateArg} verified=${verified} lines`);
