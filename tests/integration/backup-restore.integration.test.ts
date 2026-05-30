/**
 * `backup-restore.integration.test.ts` — INTEGRAÇÃO REAL do backup (Story 1.c.3, D-053).
 *
 * Q-C3-4 = `.integration.test.ts` (corre em `bun run test:integration`, ao
 * contrário de um `.test.sh` órfão — precedente 1.c.7).
 *
 * Dois níveis (D-053: real onde possível):
 *  - AC2 (snapshot consistente): provado SEMPRE com `bun:sqlite` — `VACUUM INTO`
 *    (transacção atómica, o que o rclone-daily-backup.sh faz) + gzip round-trip.
 *    Não depende de binários externos.
 *  - AC1 (litestream replicate→restore): `skipIf(!hasLitestream)` — sem o binário
 *    (Q-C3-2) o bloco é SKIPPED (CI verde); com ele, prova o round-trip real via
 *    réplica local `file://` (mecanismo idêntico ao R2, sem creds).
 */

import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const hasLitestream = Bun.which("litestream") !== null;

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "hdd-backup-"));
});
afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function seedDb(path: string, rows: number): void {
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL"); // Litestream exige WAL (src/db/connection.ts:28)
  db.exec("CREATE TABLE kv (k INTEGER PRIMARY KEY, v TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO kv (k, v) VALUES (?, ?)");
  for (let i = 0; i < rows; i += 1) insert.run(i, `value-${i}`);
  db.close();
}

function countRows(path: string): number {
  const db = new Database(path, { readonly: true });
  const row = db.query("SELECT COUNT(*) AS n FROM kv").get() as { n: number };
  db.close();
  return row.n;
}

function integrityOk(path: string): boolean {
  const db = new Database(path, { readonly: true });
  const row = db.query("PRAGMA integrity_check").get() as { integrity_check: string };
  db.close();
  return row.integrity_check === "ok";
}

describe("AC2 — snapshot consistente (VACUUM INTO + gzip) [D-053: prova local]", () => {
  test("VACUUM INTO produz snapshot íntegro; gzip round-trips bit-a-bit", () => {
    const dbPath = join(workDir, "src.db");
    seedDb(dbPath, 100);

    // Snapshot atómico — o que rclone-daily-backup.sh faz (NUNCA cp de WAL vivo).
    const snapPath = join(workDir, "snap.db");
    const src = new Database(dbPath);
    src.exec(`VACUUM INTO '${snapPath}'`);
    src.close();

    expect(existsSync(snapPath)).toBe(true);
    expect(integrityOk(snapPath)).toBe(true);
    expect(countRows(snapPath)).toBe(100);

    // gzip round-trip (passo de compressão antes do upload rclone).
    const raw = readFileSync(snapPath);
    const gz = Bun.gzipSync(raw);
    expect(gz.byteLength).toBeGreaterThan(0);
    const restored = Buffer.from(Bun.gunzipSync(gz));
    expect(restored.equals(raw)).toBe(true);
  });
});

describe.skipIf(!hasLitestream)("AC1 — litestream replicate→restore round-trip (file://)", () => {
  test("restore reconstrói o db com integridade e contagem após replicação", async () => {
    const dbPath = join(workDir, "ls-src.db");
    seedDb(dbPath, 50);
    const replicaDir = join(workDir, "replica");

    // Daemon de replicação ad-hoc para réplica local (snapshot inicial imediato).
    const proc = Bun.spawn(["litestream", "replicate", dbPath, `file://${replicaDir}`], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !existsSync(join(replicaDir, "generations"))) {
      await Bun.sleep(250);
    }
    await Bun.sleep(1000); // margem para o snapshot inicial completar
    proc.kill();
    await proc.exited;

    const restored = join(workDir, "ls-restored.db");
    const restoreProc = Bun.spawn(
      ["litestream", "restore", "-o", restored, `file://${replicaDir}`],
      { stdout: "pipe", stderr: "pipe" },
    );
    const code = await restoreProc.exited;

    expect(code).toBe(0);
    expect(integrityOk(restored)).toBe(true);
    expect(countRows(restored)).toBe(50);
  });
});
