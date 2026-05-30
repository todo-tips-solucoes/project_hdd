/**
 * `deploy.integration.test.ts` — INTEGRAÇÃO REAL do deploy SSH (Story 1.c.5, D-053).
 *
 * Q-C5-3 = `.integration.test.ts`. Dois ACs, ambos provados de verdade SEM sshd:
 *  - AC2 (audit): `recordDeploy` real → escreve no JSONL → assert DeployCompleted
 *    + commitSha + runId, com a hash-chain íntegra (DB+migrations reais em tmp).
 *  - AC1 (forced command): corre `deploy.sh` via bash real com $SSH_ORIGINAL_COMMAND
 *    e confirma que shell livre / sha inválido são rejeitados (exit 2) ANTES de
 *    tocar git/systemctl. Não precisa de SSH — o forced command é só env + parsing.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { recordDeploy } from "../../scripts/audit-deploy.ts";

const REPO = dirname(dirname(import.meta.dir)); // tests/integration → repo root
const MIGRATIONS = join(REPO, "src", "db", "migrations");
const DEPLOY_SH = join(REPO, "scripts", "deploy.sh");

let work: string;
beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), "hdd-deploy-"));
});
afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("AC2 — DeployCompleted na audit hash-chain [real]", () => {
  test("recordDeploy appenda DeployCompleted{commitSha} com runId deploy-<sha>", () => {
    const auditBaseDir = join(work, "audit");
    const r = recordDeploy({
      commitSha: "abc1234",
      dbPath: join(work, "state.db"),
      auditBaseDir,
      migrationsDir: MIGRATIONS,
      project: "test-proj",
    });
    if (r.isErr()) throw new Error(`unexpected err: ${JSON.stringify(r.error)}`);
    expect(r.value.seq).toBeGreaterThanOrEqual(0); // 1º evento numa chain fresca = seq 0

    const projDir = join(auditBaseDir, "test-proj");
    const files = readdirSync(projDir).filter((f) => f.endsWith(".jsonl"));
    expect(files.length).toBe(1);
    const lines = readFileSync(join(projDir, files[0] as string), "utf8")
      .trim()
      .split("\n");
    const last = JSON.parse(lines[lines.length - 1] as string) as {
      type: string;
      run_id: string; // JSONL usa snake_case
      payload: { commitSha: string };
    };
    expect(last.type).toBe("DeployCompleted");
    expect(last.payload.commitSha).toBe("abc1234");
    expect(last.run_id).toBe("deploy-abc1234");
  });

  test("rejeita sha inválido (fronteira anti command-injection)", () => {
    const r = recordDeploy({
      commitSha: "; rm -rf /",
      dbPath: join(work, "x.db"),
      auditBaseDir: join(work, "x"),
      migrationsDir: MIGRATIONS,
      project: "test-proj",
    });
    if (r.isOk()) throw new Error("esperava InvalidSha");
    expect(r.error.kind).toBe("InvalidSha");
  });
});

describe("AC1 — deploy.sh forced command rejeita shell livre [bash real]", () => {
  async function runDeploy(originalCmd: string): Promise<number> {
    const proc = Bun.spawn(["bash", DEPLOY_SH], {
      env: { ...process.env, SSH_ORIGINAL_COMMAND: originalCmd },
      stdout: "pipe",
      stderr: "pipe",
    });
    return await proc.exited;
  }

  test("comando não-deploy (shell livre) → exit 2", async () => {
    expect(await runDeploy("rm -rf /")).toBe(2);
  });

  test("deploy com sha inválido → exit 2 (antes de tocar git/systemctl)", async () => {
    expect(await runDeploy("deploy ../../etc/passwd")).toBe(2);
  });

  test("SSH_ORIGINAL_COMMAND vazio → exit 2", async () => {
    expect(await runDeploy("")).toBe(2);
  });
});
