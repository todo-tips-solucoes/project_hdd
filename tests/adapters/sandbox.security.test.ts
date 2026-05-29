/**
 * `sandbox.security.test.ts` — docker sandbox hardening (Story 1.b.4).
 *
 * Mock-only (Q-B4-4): spawn spy captura os args; asserimos que o comando docker
 * é inescapável POR CONSTRUÇÃO. AC1 (--network=none), AC2 (boot fail-closed),
 * AC3 (escape table PT-1). Execução real de docker → Story 1.b.5/integração.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import {
  buildDockerArgs,
  createDockerSandboxAdapter,
  SANDBOX_IMAGE,
} from "../../src/adapters/sandbox/docker-spawn.adapter.ts";
import { bootstrap } from "../../src/bootstrap.ts";
import { err, ok, okAsync, type ResultAsync } from "../../src/lib/result.ts";
import type {
  SpawnError,
  SpawnOptions,
  SpawnPort,
  SpawnResult,
} from "../../src/ports/spawn.port.ts";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "..", "src", "db", "migrations");

/** Spawn spy: regista a última invocação e devolve um resultado configurável. */
function createSpawnSpy(result: SpawnResult = { stdout: "", stderr: "", exitCode: 0 }): {
  spawn: SpawnPort;
  calls: Array<{ cmd: string; args: ReadonlyArray<string>; opts: SpawnOptions }>;
} {
  const calls: Array<{ cmd: string; args: ReadonlyArray<string>; opts: SpawnOptions }> = [];
  const spawn: SpawnPort = {
    spawn(cmd, args, opts): ResultAsync<SpawnResult, SpawnError> {
      calls.push({ cmd, args, opts });
      return okAsync(result);
    },
  };
  return { spawn, calls };
}

describe("AC1 — --network=none enforced", () => {
  test("buildDockerArgs inclui sempre --network=none", () => {
    const args = buildDockerArgs({ script: "curl https://example.com" }, SANDBOX_IMAGE);
    expect(args).toContain("--network=none");
  });

  test("runInSandbox passa o comando docker ao spawn; script curl → exit ≠ 0 (simulado)", async () => {
    const spy = createSpawnSpy({ stdout: "", stderr: "could not resolve host", exitCode: 6 });
    const sandbox = createDockerSandboxAdapter({ spawn: spy.spawn, image: SANDBOX_IMAGE });
    const r = await sandbox.runInSandbox({ script: "curl https://example.com" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.exitCode).not.toBe(0);
    expect(spy.calls[0]?.cmd).toBe("docker");
    expect(spy.calls[0]?.args).toContain("--network=none");
  });
});

describe("AC3 — escape table PT-1 (0/N escapes)", () => {
  const args = buildDockerArgs({ script: "echo hi", mountDir: "/tmp/work" }, SANDBOX_IMAGE);
  const joined = args.join(" ");

  // Flags PERIGOSAS — nunca presentes.
  const FORBIDDEN = [
    "--privileged",
    "--cap-add",
    "--pid=host",
    "--pid",
    "--network=host",
    "seccomp=unconfined",
    "--ipc=host",
  ];
  for (const flag of FORBIDDEN) {
    test(`nunca inclui flag perigosa: ${flag}`, () => {
      expect(args.includes(flag)).toBe(false);
    });
  }
  test("nenhum mount rw para host root", () => {
    expect(joined).not.toContain("src=/,");
    expect(joined).not.toContain(",rw");
  });

  // Flags PROTECTORAS — sempre presentes.
  const REQUIRED = ["--network=none", "--cap-drop=ALL", "--read-only", "no-new-privileges", "--rm"];
  for (const flag of REQUIRED) {
    test(`sempre inclui flag protectora: ${flag}`, () => {
      expect(args).toContain(flag);
    });
  }
  test("corre como user não-privilegiado (65534)", () => {
    const i = args.indexOf("--user");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toBe("65534:65534");
  });
});

describe("AC3 — mount policy (Q-B4-3) + anti arg-injection (AO-174)", () => {
  test("mount read-only por defeito", () => {
    const args = buildDockerArgs({ script: "x", mountDir: "/data" }, SANDBOX_IMAGE);
    expect(args.join(" ")).toContain("type=bind,src=/data,dst=/work,ro");
  });
  test("mountWritable:true → rw (opt-in explícito)", () => {
    const args = buildDockerArgs(
      { script: "x", mountDir: "/data", mountWritable: true },
      SANDBOX_IMAGE,
    );
    expect(args.join(" ")).toContain(",rw");
  });
  test("mountDir com injection (`:` `,` espaço `..`) → UnsafeMount, sem spawn", async () => {
    const spy = createSpawnSpy();
    const sandbox = createDockerSandboxAdapter({ spawn: spy.spawn, image: SANDBOX_IMAGE });
    for (const bad of ["/tmp/a:rw", "/tmp/a,z", "/tmp/a b", "/tmp/../etc", "relative/dir"]) {
      const r = await sandbox.runInSandbox({ script: "x", mountDir: bad });
      expect(r.isErr()).toBe(true);
      if (r.isErr()) expect(r.error.kind).toBe("UnsafeMount");
    }
    expect(spy.calls).toHaveLength(0); // nunca chega ao spawn
  });
});

describe("AC2 — boot fail-closed se image ausente (<500ms)", () => {
  test("sandboxImageCheck a falhar → BootSandboxImageMissing, <500ms", () => {
    const start = performance.now();
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: "sk-test-123", CLIHELPER_TOKEN: "clh-test" },
      dbPath: ":memory:",
      sandboxImageCheck: () => err({ kind: "SandboxImageMissing", image: SANDBOX_IMAGE }),
    });
    const elapsed = performance.now() - start;
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("BootSandboxImageMissing");
      if (r.error.kind === "BootSandboxImageMissing") expect(r.error.image).toBe(SANDBOX_IMAGE);
    }
    expect(elapsed).toBeLessThan(500);
  });

  test("sandboxImageCheck ok → boot daemon prossegue", () => {
    const auditDir = mkdtempSync(join(tmpdir(), "hdd-sbx-boot-"));
    const r = bootstrap({
      env: { ANTHROPIC_API_KEY: "sk-test-123", CLIHELPER_TOKEN: "clh-test" },
      clock: createTestClockAdapter(new Date("2026-05-29T00:00:00Z")),
      dbPath: ":memory:",
      auditBaseDir: auditDir,
      project: "sbx",
      migrationsDir: MIGRATIONS_DIR,
      sandboxImageCheck: () => ok(true),
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      r.value.shutdown.arm()(); // arm + unarm para não deixar listeners
      r.value.db.close();
    }
    rmSync(auditDir, { recursive: true, force: true });
  });
});
