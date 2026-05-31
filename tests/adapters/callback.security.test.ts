/**
 * Story 3.4 — AC4 (AI Safety, Pre-Mortem #2): redaction PRE-WRITE end-to-end.
 *
 * Audit adapter REAL (`jsonl-hash-chain`, `:memory:` + temp dir, D-053). Um
 * `POST /callback` com 3 secrets injectados (Bearer token, wa_id 55…, sk-ant-…)
 * → ler o JSONL → **0 occurrences raw** dos 3 (3/3). Prova que a redaction da
 * Story 1.b.3 acontece no audit adapter (nunca pós-write); o listener passa raw.
 */

import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { createCallbackApp } from "../../src/adapters/whatsapp/callback-listener.adapter.ts";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";

const PROJECT = "projeto_hdd";
const DATE = "2026-05-31";
const clock = createTestClockAdapter(new Date(`${DATE}T10:00:00.000Z`));

// 3 secrets reais que os patterns de redaction (1.b.3) devem apanhar.
const BEARER = "Bearer sk-supersecret-n8n-token-abc123";
const WA_RAW = "5511988887777"; // pattern wa-id 55\d{10,11}
const ANTHROPIC = "sk-ant-api03-DEADBEEFcafef00dDEADBEEFcafef00d";

let db: Database;
let baseDir: string;

beforeEach(() => {
  db = createDbConnection(":memory:");
  applyMigrations(db, "src/db/migrations");
  baseDir = mkdtempSync(join(tmpdir(), "hdd-cb-sec-"));
});
afterEach(() => {
  db.close();
  rmSync(baseDir, { recursive: true, force: true });
});

describe("AC4 — redaction pre-write (3 secrets → 0 raw)", () => {
  test("POST /callback com secrets → JSONL 0 occurrences raw (3/3)", async () => {
    const audit = createAuditAdapter({ db, baseDir, project: PROJECT, clock });
    const app = createCallbackApp({ audit, clock, allowedWaIds: [WA_RAW], webhookMock: true });

    const body = {
      wa_id: WA_RAW,
      payload: "p1_continuar_assim",
      runId: "run-sec",
      authHeader: BEARER,
      apiKey: ANTHROPIC,
    };
    const res = await app.request("/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);

    const jsonl = readFileSync(join(baseDir, PROJECT, `${DATE}.jsonl`), "utf8");
    expect(jsonl).toContain("InboundCallback"); // a linha foi escrita

    // 3/3 — nenhum dos secrets raw sobrevive no JSONL.
    expect(jsonl).not.toContain("sk-supersecret-n8n-token-abc123");
    expect(jsonl).not.toContain(WA_RAW);
    expect(jsonl).not.toContain("sk-ant-api03-DEADBEEFcafef00dDEADBEEFcafef00d");
    expect(jsonl).toContain("***REDACTED***"); // a redaction marcou
  });
});
