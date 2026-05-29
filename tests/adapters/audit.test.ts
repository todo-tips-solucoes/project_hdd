/**
 * Story 1.a.6 — specs para src/adapters/audit/jsonl-hash-chain.adapter.ts.
 *
 * AC-1: O_APPEND atomic 1 line per event.
 * AC-2: prev_hash chain SHA-256 (genesis + canonical(payload) formula).
 * AC-3: verifyChain detecta integrity (ok) e ChainBreak (err).
 * AC-4: rotation date-based emite .tsr stub.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAuditAdapter } from "../../src/adapters/audit/jsonl-hash-chain.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { applyMigrations, createDbConnection } from "../../src/db/connection.ts";
import type { AuditPort } from "../../src/ports/audit.port.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

type AuditLine = {
  ts: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  prev_hash: string;
  this_hash: string;
};

type TsrStub = {
  stub_version: number;
  covered_file: string;
  covered_sha256: string;
  tsa_real: boolean;
};

function parseLine(s: string): AuditLine {
  return JSON.parse(s) as AuditLine;
}

function parseTsr(s: string): TsrStub {
  return JSON.parse(s) as TsrStub;
}

function setup(initialDate: Date = new Date("2026-05-28T10:00:00.000Z")): {
  audit: AuditPort;
  baseDir: string;
  project: string;
  cleanup: () => void;
  clock: ReturnType<typeof createTestClockAdapter>;
  db: ReturnType<typeof createDbConnection>;
} {
  const baseDir = mkdtempSync(join(tmpdir(), "hdd-audit-"));
  const project = "test-project";
  const db = createDbConnection(":memory:");
  applyMigrations(db, MIGRATIONS_DIR);
  const clock = createTestClockAdapter(initialDate);
  const audit = createAuditAdapter({ db, baseDir, project, clock });
  return {
    audit,
    baseDir,
    project,
    clock,
    db,
    cleanup() {
      db.close();
      rmSync(baseDir, { recursive: true, force: true });
    },
  };
}

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});
afterEach(() => {
  ctx.cleanup();
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: append atomic + ficheiro JSONL produzido
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 append cria JSONL com 1 linha por evento", () => {
  test("3 appends → 3 linhas JSON parseáveis com seq 0,1,2", () => {
    for (let i = 0; i < 3; i++) {
      const r = ctx.audit.append({
        ts: "2026-05-28T10:00:00.000Z",
        runId: "run-1",
        type: "STORY_STARTED",
        payload: { idx: i },
      });
      expect(r.isOk()).toBe(true);
    }

    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBe(3);

    lines.forEach((line, i) => {
      const parsed = parseLine(line);
      expect(parsed.seq).toBe(i);
      expect(parsed.type).toBe("STORY_STARTED");
      expect(parsed.payload).toEqual({ idx: i });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: prev_hash chain integrity
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 prev_hash chain SHA-256", () => {
  test("primeira linha tem prev_hash = 'genesis'", () => {
    ctx.audit.append({
      ts: "2026-05-28T10:00:00.000Z",
      runId: "run-1",
      type: "FOO",
      payload: { x: 1 },
    });
    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const line = readFileSync(path, "utf8").split("\n")[0] ?? "";
    const parsed = parseLine(line);
    expect(parsed.prev_hash).toBe("genesis");
  });

  test("linha 2 tem prev_hash === linha1.this_hash", () => {
    ctx.audit.append({
      ts: "2026-05-28T10:00:00.000Z",
      runId: "r1",
      type: "A",
      payload: { v: 1 },
    });
    ctx.audit.append({
      ts: "2026-05-28T10:00:01.000Z",
      runId: "r1",
      type: "B",
      payload: { v: 2 },
    });
    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const lines = readFileSync(path, "utf8")
      .split("\n")
      .filter((l) => l.length > 0);
    const l1 = parseLine(lines[0] ?? "");
    const l2 = parseLine(lines[1] ?? "");
    expect(l2.prev_hash).toBe(l1.this_hash);
  });

  test("formula recomputa manualmente", () => {
    ctx.audit.append({
      ts: "2026-05-28T10:00:00.000Z",
      runId: "r1",
      type: "FOO",
      payload: { b: 2, a: 1 }, // unsorted input
    });
    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const line = readFileSync(path, "utf8").split("\n")[0] ?? "";
    const parsed = parseLine(line);

    // Recompute: canonical(payload) sorts keys: {"a":1,"b":2}
    const canonical = JSON.stringify({ a: 1, b: 2 });
    const input = `genesis|${parsed.ts}|${parsed.seq}|${parsed.type}|${canonical}`;
    const expected = new Bun.CryptoHasher("sha256").update(input).digest("hex");
    expect(parsed.this_hash).toBe(expected);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3: verifyChain
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-3 verifyChain", () => {
  test("10 eventos íntegros → ok({verified: 10})", () => {
    for (let i = 0; i < 10; i++) {
      ctx.audit.append({
        ts: `2026-05-28T10:00:${String(i).padStart(2, "0")}.000Z`,
        runId: "r1",
        type: "E",
        payload: { i },
      });
    }
    const r = ctx.audit.verifyChain("2026-05-28");
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ verified: 10 });
  });

  test("linha 5 corrompida (1 char alterado) → err ChainBreak atLine: 5", () => {
    for (let i = 0; i < 10; i++) {
      ctx.audit.append({
        ts: `2026-05-28T10:00:${String(i).padStart(2, "0")}.000Z`,
        runId: "r1",
        type: "E",
        payload: { i },
      });
    }
    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const lines = readFileSync(path, "utf8").split("\n");
    const corrupted = (lines[5] ?? "").replace('"i":5', '"i":999');
    lines[5] = corrupted;
    writeFileSync(path, lines.join("\n"));

    const r = ctx.audit.verifyChain("2026-05-28");
    expect(r.isErr()).toBe(true);
    const e = r._unsafeUnwrapErr();
    expect(e.kind).toBe("ChainBreak");
    if (e.kind === "ChainBreak") {
      expect(e.atLine).toBe(5);
    }
  });

  test("ficheiro inexistente → err FileNotFound", () => {
    const r = ctx.audit.verifyChain("1999-01-01");
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().kind).toBe("FileNotFound");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-4: rotation date-based + .tsr stub
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-4 rotation date-based + .tsr stub", () => {
  test("date muda → novo ficheiro JSONL + .tsr do anterior", () => {
    ctx.audit.append({
      ts: "2026-05-28T23:59:50.000Z",
      runId: "r1",
      type: "A",
      payload: {},
    });

    // Avança clock 1 dia
    ctx.clock.advance(24 * 60 * 60 * 1000);

    ctx.audit.append({
      ts: "2026-05-29T10:00:00.000Z",
      runId: "r1",
      type: "B",
      payload: {},
    });

    const path1 = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const path2 = join(ctx.baseDir, ctx.project, "2026-05-29.jsonl");
    const tsr1 = join(ctx.baseDir, ctx.project, "2026-05-28.tsr");

    expect(existsSync(path1)).toBe(true);
    expect(existsSync(path2)).toBe(true);
    expect(existsSync(tsr1)).toBe(true);

    // novo ficheiro: prev_hash = 'genesis'
    const newLine = readFileSync(path2, "utf8").split("\n")[0] ?? "";
    const parsed = parseLine(newLine);
    expect(parsed.prev_hash).toBe("genesis");
    expect(parsed.seq).toBe(0);

    // .tsr stub format
    const tsrContent = parseTsr(readFileSync(tsr1, "utf8"));
    expect(tsrContent.stub_version).toBe(1);
    expect(tsrContent.tsa_real).toBe(false);
    expect(tsrContent.covered_file).toBe(path1);
    expect(tsrContent.covered_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Story 1.b.3: redaction pre-write (AO-160/166) — secret nunca toca o disco
// ────────────────────────────────────────────────────────────────────────────────

describe("redaction pre-write (Story 1.b.3)", () => {
  test("payload com Bearer sk-ant → linha JSONL redigida; verifyChain verde", () => {
    const r = ctx.audit.append({
      ts: "2026-05-28T10:00:00.000Z",
      runId: "run-1",
      type: "SecurityViolation",
      payload: {
        header: "Authorization: Bearer sk-ant-api03-LEAKEDsecret123456",
        wa_id: "5511987654321",
      },
    });
    expect(r.isOk()).toBe(true);

    const path = join(ctx.baseDir, ctx.project, "2026-05-28.jsonl");
    const raw = readFileSync(path, "utf8");
    // o segredo cru NUNCA aparece no ficheiro
    expect(raw.includes("sk-ant-api03-LEAKEDsecret123456")).toBe(false);
    expect(raw.includes("5511987654321")).toBe(false);

    const parsed = parseLine(raw.split("\n")[0] ?? "");
    expect(parsed.payload["header"] as string).toBe("Authorization: Bearer ***REDACTED***");

    // AC3: hash sobre redigido → chain íntegra
    expect(ctx.audit.verifyChain("2026-05-28").isOk()).toBe(true);
  });
});
