/**
 * Story 2.1 — specs para o scaffold da CLI (status/logs/start/stubs).
 *
 * AC1: createCli() regista os 6 subcomandos (start/pause/resume/status/logs/review).
 * AC2: status lê o estado da DB e responde (≤2s; guarda de performance leve).
 * Padrão: deps injectáveis + capturas (sem bootstrap real, sem socket).
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import type { BootError, BootResult } from "../../src/bootstrap.ts";
import { createCli, registerStubCommand } from "../../src/cli/hdd-worker.ts";
import { type LogsDeps, registerLogsCommand } from "../../src/cli/logs.command.ts";
import { registerStartCommand, type StartDeps } from "../../src/cli/start.command.ts";
import { registerStatusCommand, type StatusDeps } from "../../src/cli/status.command.ts";
import { applyMigrations, createDbConnection, createDrizzle } from "../../src/db/connection.ts";
import { runs, stories } from "../../src/db/schema.ts";
import { err, ok, type Result } from "../../src/lib/result.ts";
import { readWorkerStatus } from "../../src/services/worker-status.service.ts";

const MIGRATIONS = "src/db/migrations";

function mockBoot(): { boot: () => Result<BootResult, BootError>; closes: () => number } {
  let closes = 0;
  const db = { close: () => (closes += 1) } as unknown as BootResult["db"];
  const bootResult = {
    env: { ANTHROPIC_API_KEY: "sk-test", CLIHELPER_TOKEN: "clh-test" },
    db,
    audit: {
      append: () => ok({ seq: 0, thisHash: "x", path: "/tmp/x" }),
      verifyChain: () => ok({ verified: 0 }),
    },
    shutdown: { arm: () => () => {}, trigger: () => {}, isShuttingDown: () => false },
    bootRunId: "test-boot",
  } as unknown as BootResult;
  return { boot: () => ok(bootResult), closes: () => closes };
}

function run(register: (p: Command, d: unknown) => void, deps: unknown, argv: string[]): void {
  const program = new Command();
  program.exitOverride();
  register(program, deps);
  void program.parseAsync(["node", "hdd-worker", ...argv]);
}

describe("AC1 — createCli regista os 6 subcomandos", () => {
  test("--help lista start/pause/resume/status/logs/review (na ordem)", () => {
    const names = createCli().commands.map((c) => c.name());
    expect(names).toEqual(["start", "pause", "resume", "status", "logs", "review"]);
  });
});

describe("status (AC2)", () => {
  test("no-runs → 'idle' + exit 0 + db.close()", () => {
    const { boot, closes } = mockBoot();
    const out: string[] = [];
    const exits: number[] = [];
    const deps: StatusDeps = {
      bootstrap: boot,
      readStatus: () => ok({ kind: "no-runs" }),
      stdout: (s) => out.push(s),
      stderr: () => {},
      exit: (c) => exits.push(c),
    };
    run(registerStatusCommand as never, deps, ["status"]);
    expect(out.join("")).toContain("idle");
    expect(exits).toEqual([0]);
    expect(closes()).toBe(1);
  });

  test("QueryFailure → stderr + exit 1", () => {
    const { boot } = mockBoot();
    const errs: string[] = [];
    const exits: number[] = [];
    const deps: StatusDeps = {
      bootstrap: boot,
      readStatus: () => err({ kind: "QueryFailure", cause: "boom" }),
      stdout: () => {},
      stderr: (s) => errs.push(s),
      exit: (c) => exits.push(c),
    };
    run(registerStatusCommand as never, deps, ["status"]);
    expect(errs.join("")).toContain("status query failed");
    expect(exits).toEqual([1]);
  });

  test("readWorkerStatus real (:memory:) agrega stories por status", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS);
    const orm = createDrizzle(db);
    orm
      .insert(runs)
      .values({
        runId: "r1",
        startedAt: "2026-05-30T10:00:00Z",
        status: "running",
        contextBundleHash: "h",
      })
      .run();
    const ts = "2026-05-30T10:01:00Z";
    orm
      .insert(stories)
      .values([
        { storyId: "s1", runId: "r1", status: "DONE", createdAt: ts, updatedAt: ts },
        { storyId: "s2", runId: "r1", status: "RUNNING", createdAt: ts, updatedAt: ts },
        { storyId: "s3", runId: "r1", status: "DONE", createdAt: ts, updatedAt: ts },
      ])
      .run();

    const r = readWorkerStatus(db);
    db.close();
    if (r.isErr()) throw new Error(JSON.stringify(r.error));
    expect(r.value.kind).toBe("run");
    if (r.value.kind !== "run") throw new Error("expected run");
    expect(r.value.run.runId).toBe("r1");
    expect(r.value.stories.total).toBe(3);
    expect(r.value.stories.byStatus.DONE).toBe(2);
    expect(r.value.stories.byStatus.RUNNING).toBe(1);
  });

  test("readWorkerStatus DB fresca → no-runs", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS);
    const r = readWorkerStatus(db);
    db.close();
    if (r.isErr()) throw new Error(JSON.stringify(r.error));
    expect(r.value.kind).toBe("no-runs");
  });

  test("AC2 guarda — readWorkerStatus < 2000ms", () => {
    const db = createDbConnection(":memory:");
    applyMigrations(db, MIGRATIONS);
    const orm = createDrizzle(db);
    orm
      .insert(runs)
      .values({
        runId: "r1",
        startedAt: "2026-05-30T10:00:00Z",
        status: "running",
        contextBundleHash: "h",
      })
      .run();
    const ts = "2026-05-30T10:01:00Z";
    for (let i = 0; i < 50; i += 1) {
      orm
        .insert(stories)
        .values({ storyId: `s${i}`, runId: "r1", status: "DONE", createdAt: ts, updatedAt: ts })
        .run();
    }
    const start = performance.now();
    const r = readWorkerStatus(db);
    const elapsed = performance.now() - start;
    db.close();
    expect(r.isOk()).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("logs", () => {
  test("--tail 2 → últimas 2 linhas formatadas", () => {
    const out: string[] = [];
    const lines = [
      '{"ts":"T1","type":"ProcessStarted","run_id":"r1"}',
      '{"ts":"T2","type":"ReviewApproved","run_id":"r1"}',
      '{"ts":"T3","type":"DeployCompleted","run_id":"r1"}',
    ].join("\n");
    const deps: LogsDeps = {
      readFile: () => lines,
      stdout: (s) => out.push(s),
      exit: () => {},
    };
    run(registerLogsCommand as never, deps, ["logs", "--tail", "2"]);
    const printed = out.join("");
    expect(printed).not.toContain("ProcessStarted");
    expect(printed).toContain("ReviewApproved");
    expect(printed).toContain("DeployCompleted");
  });

  test("ficheiro ausente → 'sem eventos' + exit 0", () => {
    const out: string[] = [];
    const exits: number[] = [];
    const deps: LogsDeps = {
      readFile: () => {
        throw new Error("ENOENT");
      },
      stdout: (s) => out.push(s),
      exit: (c) => exits.push(c),
    };
    run(registerLogsCommand as never, deps, ["logs", "--date", "2026-01-01"]);
    expect(out.join("")).toContain("sem eventos");
    expect(exits).toEqual([0]);
  });
});

describe("start", () => {
  test("serve recebe porta default 8080; mensagem inclui o projeto", () => {
    const { boot } = mockBoot();
    const out: string[] = [];
    let servedPort: number | undefined;
    const deps: StartDeps = {
      bootstrap: boot,
      serve: (o) => {
        servedPort = o.port;
        return {};
      },
      bootEpochMs: 0,
      stdout: (s) => out.push(s),
      stderr: () => {},
      exit: () => {},
    };
    run(registerStartCommand as never, deps, ["start"]);
    expect(servedPort).toBe(8080);
    expect(out.join("")).toContain("projeto_hdd");
  });

  test("--port override + [project] argumento", () => {
    const { boot } = mockBoot();
    const out: string[] = [];
    let servedPort: number | undefined;
    const deps: StartDeps = {
      bootstrap: boot,
      serve: (o) => {
        servedPort = o.port;
        return {};
      },
      bootEpochMs: 0,
      stdout: (s) => out.push(s),
      stderr: () => {},
      exit: () => {},
    };
    run(registerStartCommand as never, deps, ["start", "outro-proj", "--port", "9999"]);
    expect(servedPort).toBe(9999);
    expect(out.join("")).toContain("outro-proj");
  });
});

describe("stubs pause/resume", () => {
  test("stub → stderr hint + exit 1", () => {
    const errs: string[] = [];
    const exits: number[] = [];
    const program = new Command();
    program.exitOverride();
    registerStubCommand(
      program,
      { name: "pause", description: "d", hint: "diferido para a Story 2.6" },
      { stderr: (s) => errs.push(s), exit: (c) => exits.push(c) },
    );
    void program.parseAsync(["node", "hdd-worker", "pause"]);
    expect(errs.join("")).toContain("Story 2.6");
    expect(exits).toEqual([1]);
  });
});
