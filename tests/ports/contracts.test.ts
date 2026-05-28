/**
 * Story 1.a.3 — contract tests para os 3 ports temporais.
 *
 * AC-1 binary: Dep Graph Rigour — `src/core/**` nunca importa `src/adapters/**`.
 * AC-2 property: TestClock determinístico (advance, sem setTimeout real).
 * AC-3 binary: SpawnPort timeout → err({ kind: "Transient", cause: { kind: "Timeout" } }).
 *
 * Test files isentos da throw whitelist (AO-104).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createSystemClockAdapter } from "../../src/adapters/clock/system-clock.adapter.ts";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { createFakeSpawnAdapter } from "../../src/adapters/spawn/fake-spawn.adapter.ts";

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: Dep Graph Rigour — core não importa adapters
// ────────────────────────────────────────────────────────────────────────────────

function walkTs(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s: ReturnType<typeof statSync>;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walkTs(p));
    } else if (s.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
      out.push(p);
    }
  }
  return out;
}

describe("AC-1 Dep Graph Rigour", () => {
  test("nenhum ficheiro em src/core/** importa src/adapters/**", () => {
    const coreFiles = walkTs("src/core").filter((f) => !f.endsWith(".gitkeep"));
    const violations: Array<{ file: string; line: number; importPath: string }> = [];
    const importRe = /^\s*import\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/;

    for (const file of coreFiles) {
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const m = importRe.exec(line);
        if (m && m[1] !== undefined && /adapters/.test(m[1])) {
          violations.push({ file, line: idx + 1, importPath: m[1] });
        }
      });
    }

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.file}:${v.line} → ${v.importPath}`).join("\n");
      throw new Error(`Dep Graph Rigour violation:\n${msg}`);
    }
    // Por agora src/core/ está vazio (só .gitkeep); o teste valida em stories futuras.
    expect(violations.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: TestClock determinístico
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 TestClock determinístico", () => {
  test("setTimeout dispara após advance(ms) exacto, sem espera real", () => {
    const startWallClock = Date.now();
    const clock = createTestClockAdapter(new Date(0));
    let called = false;
    clock.setTimeout(() => {
      called = true;
    }, 60_000);

    expect(called).toBe(false);
    clock.advance(59_999);
    expect(called).toBe(false);
    clock.advance(1);
    expect(called).toBe(true);

    const elapsedWallClock = Date.now() - startWallClock;
    // 60_000ms simulados em <50ms wall-clock real
    expect(elapsedWallClock).toBeLessThan(50);
  });

  test("setInterval re-dispara em ciclos de advance", () => {
    const clock = createTestClockAdapter();
    let count = 0;
    clock.setInterval(() => {
      count++;
    }, 1000);

    clock.advance(2500);
    expect(count).toBe(2); // disparou em 1000, 2000; 2500 ainda não atinge 3000

    clock.advance(500);
    expect(count).toBe(3); // total 3000 atinge 3º disparo
  });

  test("advance(0) é no-op", () => {
    const clock = createTestClockAdapter();
    let called = false;
    clock.setTimeout(() => {
      called = true;
    }, 1);

    clock.advance(0);
    expect(called).toBe(false);
  });

  test("cancel function impede disparo", () => {
    const clock = createTestClockAdapter();
    let called = false;
    const cancel = clock.setTimeout(() => {
      called = true;
    }, 100);

    cancel();
    clock.advance(200);
    expect(called).toBe(false);
  });

  test("setTimeout nested durante advance é respeitado na mesma chamada", () => {
    const clock = createTestClockAdapter();
    let outerCalled = false;
    let innerCalled = false;

    clock.setTimeout(() => {
      outerCalled = true;
      clock.setTimeout(() => {
        innerCalled = true;
      }, 100);
    }, 100);

    clock.advance(250); // 100ms para outer + 100ms para inner = 200ms, sobra 50ms
    expect(outerCalled).toBe(true);
    expect(innerCalled).toBe(true);
  });

  test("now() avança com advance", () => {
    const clock = createTestClockAdapter(new Date(0));
    expect(clock.now().getTime()).toBe(0);
    clock.advance(5000);
    expect(clock.now().getTime()).toBe(5000);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// SystemClock smoke (1 spec, real-time)
// ────────────────────────────────────────────────────────────────────────────────

describe("SystemClock smoke", () => {
  test("now() retorna Date com getTime() actual razoável", () => {
    const clock = createSystemClockAdapter();
    const t = clock.now().getTime();
    // Entre 2025-01-01 e 2050-01-01 (janela larga; sanity check apenas)
    expect(t).toBeGreaterThan(1735689600000);
    expect(t).toBeLessThan(2524608000000);
  });

  test("setTimeout dispara em tempo razoável (real)", async () => {
    const clock = createSystemClockAdapter();
    let called = false;
    clock.setTimeout(() => {
      called = true;
    }, 10);
    await new Promise<void>((r) => setTimeout(r, 30));
    expect(called).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3: SpawnPort timeout via FakeSpawn
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-3 SpawnPort timeout", () => {
  test("FakeSpawn com behavior=timeout retorna err Transient cause Timeout", async () => {
    const spawn = createFakeSpawnAdapter({ defaultBehavior: "timeout" });
    const r = await spawn.spawn("any-cmd", [], { timeoutMs: 100 });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({
      kind: "Transient",
      cause: { kind: "Timeout" },
    });
  });

  test("FakeSpawn com behavior=success retorna ok com stdout/exit", async () => {
    const spawn = createFakeSpawnAdapter({
      defaultBehavior: "success",
      stdout: "hello",
      exitCode: 0,
    });
    const r = await spawn.spawn("echo", ["hello"], {});
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ stdout: "hello", stderr: "", exitCode: 0 });
  });

  test("FakeSpawn com behavior=binary-not-found retorna err Permanent", async () => {
    const spawn = createFakeSpawnAdapter({ defaultBehavior: "binary-not-found" });
    const r = await spawn.spawn("missing-binary", [], {});
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({
      kind: "Permanent",
      cause: { kind: "BinaryNotFound", bin: "missing-binary" },
    });
  });

  test("FakeSpawn com behavior=non-zero-exit retorna err Permanent", async () => {
    const spawn = createFakeSpawnAdapter({
      defaultBehavior: "non-zero-exit",
      exitCode: 42,
      stderr: "fail",
    });
    const r = await spawn.spawn("any", [], {});
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({
      kind: "Permanent",
      cause: { kind: "NonZeroExit", exitCode: 42, stderr: "fail" },
    });
  });
});
