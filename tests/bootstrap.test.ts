/**
 * Story 1.a.7 — specs para src/bootstrap.ts + src/lib/env.ts + src/lib/shutdown.ts.
 *
 * AC-1: fail-closed em env missing — exit 1 com "ANTHROPIC_API_KEY required"
 *       em <500ms + zero linhas audit (no partial init).
 * AC-2: SIGTERM graceful em <5s — flush audit + close db + exit 0.
 *
 * `process.exit` é mocked via spyOn → throw "exit-called:N" para testar sem
 * matar o test runner. `:memory:` SQLite + `mkdtempSync` para isolation.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestClockAdapter } from "../src/adapters/clock/test-clock.adapter.ts";
import { type BootResult, bootstrap } from "../src/bootstrap.ts";
import { parseEnv } from "../src/lib/env.ts";
import { ok } from "../src/lib/result.ts";
import { createShutdownHandler } from "../src/lib/shutdown.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "src", "db", "migrations");
const VALID_KEY = "sk-test-1234567890";

function tmpAuditDir(): string {
  return mkdtempSync(join(tmpdir(), "hdd-boot-audit-"));
}

// ────────────────────────────────────────────────────────────────────────────────
// parseEnv unit (AC-1 supporting)
// ────────────────────────────────────────────────────────────────────────────────

describe("parseEnv — AC-1 fail-closed substrings", () => {
  test("missing ANTHROPIC_API_KEY → err with substring", () => {
    const r = parseEnv({});
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("EnvValidationError");
      expect(r.error.formatted).toContain("ANTHROPIC_API_KEY required");
    }
  });

  test("empty string ANTHROPIC_API_KEY → err with substring", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: "" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.formatted).toContain("ANTHROPIC_API_KEY required");
  });

  test("whitespace-only ANTHROPIC_API_KEY → err with substring", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: "   \t  " });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.formatted).toContain("ANTHROPIC_API_KEY required");
  });

  test("valid ANTHROPIC_API_KEY → ok", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.ANTHROPIC_API_KEY).toBe(VALID_KEY);
  });

  test("ANTHROPIC_API_KEY com whitespace nas pontas é trimmed", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: "  sk-trimmed  ", CLIHELPER_TOKEN: "clh-test" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.ANTHROPIC_API_KEY).toBe("sk-trimmed");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: bootstrap fail-closed
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 bootstrap fail-closed em env missing", () => {
  test("env missing → err BootEnvInvalid + zero audit lines criadas", () => {
    const auditDir = tmpAuditDir();
    const r = bootstrap({
      env: {},
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
    });

    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("BootEnvInvalid");
      if (r.error.kind === "BootEnvInvalid") {
        expect(r.error.inner.formatted).toContain("ANTHROPIC_API_KEY required");
      }
    }

    // Zero audit linhas: o projectDir nem deve existir (createAuditAdapter
    // nunca foi invocado porque env validation falhou primeiro).
    const projectDir = join(auditDir, "test");
    expect(existsSync(projectDir)).toBe(false);

    rmSync(auditDir, { recursive: true, force: true });
  });

  test("bootstrap fail-closed completa em <500ms (AC-1 timing budget)", () => {
    const auditDir = tmpAuditDir();
    const startNs = Bun.nanoseconds();
    const r = bootstrap({
      env: {},
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
    });
    const elapsedMs = (Bun.nanoseconds() - startNs) / 1_000_000;

    expect(r.isErr()).toBe(true);
    expect(elapsedMs).toBeLessThan(500);
    rmSync(auditDir, { recursive: true, force: true });
  });

  test("env valid → ok BootResult com db, audit, shutdown, bootRunId", () => {
    const auditDir = tmpAuditDir();
    const clock = createTestClockAdapter(new Date("2026-05-28T10:00:00Z"));
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" },
      sandboxImageCheck: () => ok(true),
      clock,
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
      bootRunId: "test-boot-run-id",
    });

    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.bootRunId).toBe("test-boot-run-id");
      expect(r.value.shutdown.isShuttingDown()).toBe(false);
      // unarm para não poluir test runner com listeners residuais.
      const unarm = r.value.shutdown.arm();
      unarm();
      r.value.db.close();
    }

    rmSync(auditDir, { recursive: true, force: true });
  });

  test("env valid → ProcessStarted event escrito no audit log (Q-A7-3 Yes)", () => {
    const auditDir = tmpAuditDir();
    const clock = createTestClockAdapter(new Date("2026-05-28T10:00:00Z"));
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" },
      sandboxImageCheck: () => ok(true),
      clock,
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
    });

    expect(r.isOk()).toBe(true);
    const jsonlPath = join(auditDir, "test", "2026-05-28.jsonl");
    expect(existsSync(jsonlPath)).toBe(true);
    const lines = readFileSync(jsonlPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0] ?? "") as { type: string; payload: { pid: number } };
    expect(entry.type).toBe("ProcessStarted");
    expect(entry.payload.pid).toBe(process.pid);

    if (r.isOk()) r.value.db.close();
    rmSync(auditDir, { recursive: true, force: true });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: SIGTERM graceful shutdown
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 SIGTERM graceful shutdown", () => {
  // process.exit mock manual: throw "exit-called:N" para detectar invocação
  // sem terminar o test runner. Evita ReturnType<typeof spyOn> leak para `any`.
  // eslint-disable-next-line @typescript-eslint/unbound-method -- restored verbatim below
  const originalExit = process.exit;
  beforeEach(() => {
    process.exit = (code?: number) => {
      // allow-throw: AO-66 #6 (test code is excluded from throw whitelist).
      throw new Error(`exit-called:${code ?? 0}`);
    };
  });
  afterEach(() => {
    process.exit = originalExit;
  });

  function bootForShutdown(auditDir: string): BootResult {
    const clock = createTestClockAdapter(new Date("2026-05-28T10:00:00Z"));
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" },
      sandboxImageCheck: () => ok(true),
      clock,
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
      bootRunId: "boot-run-id-ac2",
    });
    if (r.isErr()) throw new Error(`boot failed: ${JSON.stringify(r.error)}`);
    return r.value;
  }

  test("trigger() → ProcessStopped escrito + db.close + exit(0) (AC-2)", () => {
    const auditDir = tmpAuditDir();
    const boot = bootForShutdown(auditDir);

    // Spy db.close para verificar invocação.
    const closeSpy = spyOn(boot.db, "close");

    try {
      boot.shutdown.trigger("test-sigterm");
      // Não devia chegar aqui — process.exit throws via mock.
      expect.unreachable("trigger should have called process.exit");
    } catch (e) {
      expect((e as Error).message).toBe("exit-called:0");
    }
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // Verifica que ProcessStopped foi appended.
    const jsonlPath = join(auditDir, "test", "2026-05-28.jsonl");
    const lines = readFileSync(jsonlPath, "utf8").trim().split("\n");
    expect(lines.length).toBe(2); // ProcessStarted + ProcessStopped
    const stopped = JSON.parse(lines[1] ?? "") as { type: string; payload: { reason: string } };
    expect(stopped.type).toBe("ProcessStopped");
    expect(stopped.payload.reason).toBe("test-sigterm");

    rmSync(auditDir, { recursive: true, force: true });
  });

  test("trigger() completa em <5s (AC-2 timing budget)", () => {
    const auditDir = tmpAuditDir();
    const boot = bootForShutdown(auditDir);

    const startNs = Bun.nanoseconds();
    try {
      boot.shutdown.trigger("timing-test");
    } catch {
      // exit-called esperado.
    }
    const elapsedMs = (Bun.nanoseconds() - startNs) / 1_000_000;
    expect(elapsedMs).toBeLessThan(5000);

    rmSync(auditDir, { recursive: true, force: true });
  });

  test("trigger() é re-entrant safe — duas chamadas executam cleanup só uma vez", () => {
    const auditDir = tmpAuditDir();
    const boot = bootForShutdown(auditDir);
    const closeSpy = spyOn(boot.db, "close");

    try {
      boot.shutdown.trigger("first");
    } catch {
      // 1º exit-called.
    }
    // Segunda chamada deve ser no-op (re-entrance flag).
    boot.shutdown.trigger("second");

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(boot.shutdown.isShuttingDown()).toBe(true);

    // Apenas 1 ProcessStopped escrito.
    const jsonlPath = join(auditDir, "test", "2026-05-28.jsonl");
    const lines = readFileSync(jsonlPath, "utf8").trim().split("\n");
    const stoppedLines = lines.filter((l) => l.includes('"ProcessStopped"'));
    expect(stoppedLines.length).toBe(1);

    rmSync(auditDir, { recursive: true, force: true });
  });

  test("emitStoppedEvent=false → shutdown skippa o ProcessStopped append", () => {
    const auditDir = tmpAuditDir();
    const clock = createTestClockAdapter(new Date("2026-05-28T10:00:00Z"));
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" },
      sandboxImageCheck: () => ok(true),
      clock,
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
      emitProcessStoppedEvent: false,
    });
    if (r.isErr()) throw new Error("boot failed");

    try {
      r.value.shutdown.trigger("silent");
    } catch {
      // exit-called.
    }
    const jsonlPath = join(auditDir, "test", "2026-05-28.jsonl");
    const lines = readFileSync(jsonlPath, "utf8").trim().split("\n");
    // Apenas ProcessStarted, sem ProcessStopped.
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('"ProcessStarted"');

    rmSync(auditDir, { recursive: true, force: true });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// createShutdownHandler unit (arm/unarm + listeners)
// ────────────────────────────────────────────────────────────────────────────────

describe("createShutdownHandler arm/unarm — listener hygiene", () => {
  test("arm() instala SIGTERM + SIGINT; unarm remove ambos", () => {
    const auditDir = tmpAuditDir();
    const clock = createTestClockAdapter();
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: VALID_KEY, CLIHELPER_TOKEN: "clh-test" },
      sandboxImageCheck: () => ok(true),
      clock,
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "test",
      migrationsDir: MIGRATIONS_DIR,
      emitProcessStartedEvent: false,
      emitProcessStoppedEvent: false,
    });
    if (r.isErr()) throw new Error("boot failed");

    // bootstrap.arm() já correu uma vez via bootstrap; armar mais um listener
    // para validar isolation com unarm. Pega contagem baseline.
    const baseSigterm = process.listenerCount("SIGTERM");
    const baseSigint = process.listenerCount("SIGINT");

    const handle = createShutdownHandler({
      db: r.value.db,
      audit: r.value.audit,
      clock,
      bootRunId: "second-handle",
    });
    const unarm = handle.arm();

    expect(process.listenerCount("SIGTERM")).toBe(baseSigterm + 1);
    expect(process.listenerCount("SIGINT")).toBe(baseSigint + 1);

    unarm();
    expect(process.listenerCount("SIGTERM")).toBe(baseSigterm);
    expect(process.listenerCount("SIGINT")).toBe(baseSigint);

    // Cleanup do listener instalado por bootstrap (o primeiro arm).
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    r.value.db.close();
    rmSync(auditDir, { recursive: true, force: true });
  });
});
