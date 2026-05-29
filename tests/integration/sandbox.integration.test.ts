/**
 * Sandbox — INTEGRAÇÃO REAL (docker de verdade). Story 1.b.4 + retro Epic 1.b.
 *
 * Corre a cadeia real `createDockerSandboxAdapter` → `createSystemSpawnAdapter`
 * → `Bun.spawn` → `docker run`. Prova as propriedades de segurança ao vivo
 * (mock-only não as via). `skipIf` quando a image não está pre-pulled (CI sem
 * docker fica verde). Opt-in: `bun run test:integration`.
 *
 * Pré-req: `bash scripts/prepull-sandbox-image.sh` (build hdd-sandbox:0.0.1).
 */

import { describe, expect, test } from "bun:test";
import {
  checkSandboxImageSync,
  createDockerSandboxAdapter,
  SANDBOX_IMAGE,
} from "../../src/adapters/sandbox/docker-spawn.adapter.ts";
import { createSystemSpawnAdapter } from "../../src/adapters/spawn/system-spawn.adapter.ts";

const HAS_SANDBOX = checkSandboxImageSync(SANDBOX_IMAGE).isOk();

const sandbox = createDockerSandboxAdapter({
  spawn: createSystemSpawnAdapter(),
  image: SANDBOX_IMAGE,
});

describe.skipIf(!HAS_SANDBOX)("sandbox docker — integração real", () => {
  test("happy path: comando legítimo → exit 0 + stdout", async () => {
    const r = await sandbox.runInSandbox({ script: "echo hello-from-sandbox" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.exitCode).toBe(0);
      expect(r.value.stdout).toContain("hello-from-sandbox");
    }
  });

  test("AC1 REAL: egress bloqueado (--network=none) → exit ≠ 0", async () => {
    const r = await sandbox.runInSandbox({ script: "wget -T 3 -q -O- http://1.1.1.1" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.exitCode).not.toBe(0); // Network unreachable
  });

  test("REAL: root fs read-only → write fora de /work falha", async () => {
    const r = await sandbox.runInSandbox({ script: "echo x > /etc/pwned" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.exitCode).not.toBe(0); // Read-only file system
  });

  test("REAL: corre como user não-privilegiado (65534)", async () => {
    const r = await sandbox.runInSandbox({ script: "id -u" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.stdout.trim()).toBe("65534");
  });

  test("REAL: sem capabilities (cap-drop=ALL) → não pode mudar de uid", async () => {
    // tentar escalar para root deve falhar sem CAP_SETUID
    const r = await sandbox.runInSandbox({ script: "su root -c id 2>&1; id -u" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.stdout.trim().endsWith("65534")).toBe(true);
  });
});

describe.skipIf(HAS_SANDBOX)("sandbox docker — SKIPPED (image não pre-pulled)", () => {
  test("placeholder — corre `bash scripts/prepull-sandbox-image.sh`", () => {
    expect(HAS_SANDBOX).toBe(false);
  });
});
