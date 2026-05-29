/**
 * `env-secrets.test.ts` — Story 1.c.2: CLIHELPER_TOKEN required no Zod +
 * checkSecretsFilePerms (perm 0600 gate). fs reais (mkdtempSync+chmodSync, D-053).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSecretsFilePerms, parseEnv } from "../../src/lib/env.ts";

describe("parseEnv — CLIHELPER_TOKEN required (Q-C2-1)", () => {
  test("ambos presentes → ok + typed", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: "sk-ant-x", CLIHELPER_TOKEN: "clh-y" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.ANTHROPIC_API_KEY).toBe("sk-ant-x");
      expect(r.value.CLIHELPER_TOKEN).toBe("clh-y");
    }
  });

  test("CLIHELPER_TOKEN ausente → err 'CLIHELPER_TOKEN required'", () => {
    const r = parseEnv({ ANTHROPIC_API_KEY: "sk-ant-x" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.formatted).toContain("CLIHELPER_TOKEN required");
  });

  test("ANTHROPIC_API_KEY ausente → err", () => {
    const r = parseEnv({ CLIHELPER_TOKEN: "clh-y" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.formatted).toContain("ANTHROPIC_API_KEY required");
  });
});

describe("checkSecretsFilePerms (fs reais)", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "secrets-"));
    file = join(dir, "secrets.env");
    writeFileSync(file, "ANTHROPIC_API_KEY=x\n");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("0600 → ok", () => {
    chmodSync(file, 0o600);
    expect(checkSecretsFilePerms(file).isOk()).toBe(true);
  });

  test("0400 (read-only) → ok (Q-C2-4 permite)", () => {
    chmodSync(file, 0o400);
    expect(checkSecretsFilePerms(file).isOk()).toBe(true);
  });

  test("0644 (group/world readable) → SecretsFileInsecure", () => {
    chmodSync(file, 0o644);
    const r = checkSecretsFilePerms(file);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("SecretsFileInsecure");
      if (r.error.kind === "SecretsFileInsecure") expect(r.error.mode).toBe("0644");
    }
  });

  test("0640 (group readable) → SecretsFileInsecure", () => {
    chmodSync(file, 0o640);
    expect(checkSecretsFilePerms(file).isErr()).toBe(true);
  });

  test("ficheiro ausente → SecretsFileMissing", () => {
    const r = checkSecretsFilePerms(join(dir, "nope.env"));
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("SecretsFileMissing");
  });

  test("statFn injectável (sem fs)", () => {
    const r = checkSecretsFilePerms("/fake", () => ({ mode: 0o100600 }));
    expect(r.isOk()).toBe(true);
  });
});
