/**
 * `connection.ts` — bun:sqlite connection factory + migration runner.
 *
 * Story 1.a.5 (AR-013, AO-48, AO-49, AO-81). PRAGMAs WAL + foreign_keys +
 * busy_timeout + synchronous=NORMAL aplicados em todas as conexões. Migrations
 * em `src/db/migrations/*.sql` aplicadas via `BEGIN EXCLUSIVE` (no SQL) +
 * idempotente via check em `schema_migrations`.
 *
 * Caller (Story 1.a.7 bootstrap) chama `applyMigrations()` no startup;
 * CLI standalone `src/db/cli/migrate.ts` (Q-A5-4) também invoca.
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { err, ok, type Result } from "../lib/result.ts";
import * as schema from "./schema.ts";

export type MigrationError =
  | { readonly kind: "ReadFailure"; readonly path: string; readonly cause: unknown }
  | { readonly kind: "ApplyFailure"; readonly version: number; readonly cause: unknown }
  | { readonly kind: "InvalidFilename"; readonly filename: string };

export function createDbConnection(path: string): Database {
  const db = new Database(path);
  // AR-013: WAL + foreign_keys + busy_timeout + synchronous NORMAL.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}

export function createDrizzle(db: Database): BunSQLiteDatabase<typeof schema> {
  return drizzle(db, { schema });
}

const MIGRATION_FILENAME_RE = /^(\d+)_.+\.sql$/;

export function applyMigrations(
  db: Database,
  dir: string,
): Result<{ appliedCount: number }, MigrationError> {
  // Bootstrap: garante que schema_migrations existe antes de qualquer check.
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, description TEXT)",
  );

  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch (cause) {
    return err({ kind: "ReadFailure", path: dir, cause });
  }

  let applied = 0;
  for (const filename of files) {
    const match = MIGRATION_FILENAME_RE.exec(filename);
    if (!match || match[1] === undefined) {
      return err({ kind: "InvalidFilename", filename });
    }
    const version = Number.parseInt(match[1], 10);

    const existing = db.query("SELECT 1 FROM schema_migrations WHERE version = ?").get(version);
    if (existing !== null) continue;

    let sql: string;
    try {
      sql = readFileSync(join(dir, filename), "utf8");
    } catch (cause) {
      return err({ kind: "ReadFailure", path: join(dir, filename), cause });
    }

    try {
      // BEGIN EXCLUSIVE embedded no próprio SQL (AO-81). db.exec executa
      // múltiplas statements separadas por `;`.
      db.exec(sql);
    } catch (cause) {
      return err({ kind: "ApplyFailure", version, cause });
    }
    applied += 1;
  }

  return ok({ appliedCount: applied });
}
