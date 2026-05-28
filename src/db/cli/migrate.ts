/**
 * `cli/migrate.ts` — `bun run db:migrate` entry point.
 *
 * Story 1.a.5 (Q-A5-4: CLI standalone; bootstrap 1.a.7 também invocará
 * `applyMigrations` programaticamente).
 */

import { join } from "node:path";
import { applyMigrations, createDbConnection } from "../connection.ts";

const dbPath = process.env["HDD_DB_PATH"] ?? "./.hdd-state.db";
const migrationsDir = join(import.meta.dir, "..", "migrations");

const db = createDbConnection(dbPath);
const result = applyMigrations(db, migrationsDir);
db.close();

if (result.isErr()) {
  const e = result._unsafeUnwrapErr();
  console.error(`[db:migrate] FAILED kind=${e.kind}`, e);
  process.exit(1);
}

const { appliedCount } = result._unsafeUnwrap();
console.log(`[db:migrate] OK dbPath=${dbPath} applied=${appliedCount}`);
