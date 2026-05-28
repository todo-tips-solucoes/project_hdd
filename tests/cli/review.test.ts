/**
 * Story 1.a.8 — specs para src/cli/review.command.ts.
 *
 * AC-2: review approve <id> → audit ReviewApproved + stdout "approved: <id>".
 * AC-3: review request-changes <id> --note → ReviewChangesRequested + payload.note.
 * AC-4: review reject <id> --reason → ReviewRejected + payload.reason.
 * Required flags enforcement: --note / --reason missing → exit 1 via Commander.
 *
 * Setup: bootstrap injectado retorna mock audit/db; capturamos stdout/stderr
 * + exit via deps. NÃO arrancamos bootstrap real para evitar criar SQLite +
 * audit JSONL no filesystem.
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import type { BootError, BootResult } from "../../src/bootstrap.ts";
import { type ReviewDeps, registerReviewCommand } from "../../src/cli/review.command.ts";
import type { Sha256Hash } from "../../src/lib/branded.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type { AuditEntry } from "../../src/ports/audit.port.ts";

type AppendCall = { ts: string; runId: string; type: string; payload: Record<string, unknown> };

function buildDeps(): {
  deps: Required<Omit<ReviewDeps, "bootstrap">> & {
    bootstrap: () => Result<BootResult, BootError>;
  };
  calls: {
    stdout: string[];
    stderr: string[];
    exits: number[];
    appends: AppendCall[];
    closes: number;
  };
} {
  const calls = {
    stdout: [] as string[],
    stderr: [] as string[],
    exits: [] as number[],
    appends: [] as AppendCall[],
    closes: 0,
  };
  const mockAudit = {
    append(event: AuditEntry) {
      calls.appends.push({
        ts: event.ts,
        runId: event.runId,
        type: event.type,
        payload: { ...event.payload },
      });
      return ok({ seq: 0, thisHash: "deadbeef" as Sha256Hash, path: "/tmp/fake.jsonl" });
    },
    verifyChain() {
      return ok({ verified: 0 });
    },
  };
  const mockDb = {
    close() {
      calls.closes += 1;
    },
  } as unknown as BootResult["db"];

  const bootResult: BootResult = {
    env: { ANTHROPIC_API_KEY: "sk-test" },
    db: mockDb,
    audit: mockAudit,
    shutdown: {
      arm: () => () => {},
      trigger: () => {},
      isShuttingDown: () => false,
    },
    bootRunId: "test-boot",
  };

  const deps = {
    bootstrap: () => ok(bootResult) as Result<BootResult, BootError>,
    reviewer: "test-reviewer",
    now: () => "2026-05-28T22:00:00.000Z",
    stdout: (s: string) => calls.stdout.push(s),
    stderr: (s: string) => calls.stderr.push(s),
    exit: (c: number) => calls.exits.push(c),
  };

  return { deps, calls };
}

function newProgram(deps: ReviewDeps): Command {
  const program = new Command();
  program.exitOverride(); // throw em vez de exit em parse error
  registerReviewCommand(program, deps);
  return program;
}

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: approve
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 review approve", () => {
  test("emit ReviewApproved + stdout + exit(0)", async () => {
    const { deps, calls } = buildDeps();
    const program = newProgram(deps);

    await program.parseAsync(["node", "hdd-worker", "review", "approve", "story-test"]);

    expect(calls.appends.length).toBe(1);
    expect(calls.appends[0]?.type).toBe("ReviewApproved");
    expect(calls.appends[0]?.payload["workflowId"]).toBe("story-test");
    expect(calls.appends[0]?.payload["reviewer"]).toBe("test-reviewer");
    expect(calls.stdout.join("")).toContain("approved: story-test");
    expect(calls.exits).toEqual([0]);
    expect(calls.closes).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3: request-changes
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-3 review request-changes", () => {
  test("emit ReviewChangesRequested com note", async () => {
    const { deps, calls } = buildDeps();
    const program = newProgram(deps);

    await program.parseAsync([
      "node",
      "hdd-worker",
      "review",
      "request-changes",
      "story-test",
      "--note",
      "fix XYZ",
    ]);

    expect(calls.appends[0]?.type).toBe("ReviewChangesRequested");
    expect(calls.appends[0]?.payload["note"]).toBe("fix XYZ");
    expect(calls.stdout.join("")).toContain("changes-requested: story-test — fix XYZ");
    expect(calls.exits).toEqual([0]);
  });

  test("--note missing → Commander exit error", async () => {
    const { deps } = buildDeps();
    const program = newProgram(deps);

    let caught: unknown = null;
    try {
      await program.parseAsync(["node", "hdd-worker", "review", "request-changes", "story-test"]);
    } catch (e) {
      caught = e;
    }
    // Commander throws CommanderError quando exitOverride() activo e flag falta.
    expect(caught).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-4: reject
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-4 review reject", () => {
  test("emit ReviewRejected com reason", async () => {
    const { deps, calls } = buildDeps();
    const program = newProgram(deps);

    await program.parseAsync([
      "node",
      "hdd-worker",
      "review",
      "reject",
      "story-test",
      "--reason",
      "scope creep",
    ]);

    expect(calls.appends[0]?.type).toBe("ReviewRejected");
    expect(calls.appends[0]?.payload["reason"]).toBe("scope creep");
    expect(calls.stdout.join("")).toContain("rejected: story-test — scope creep");
    expect(calls.exits).toEqual([0]);
  });

  test("--reason missing → Commander exit error", async () => {
    const { deps } = buildDeps();
    const program = newProgram(deps);

    let caught: unknown = null;
    try {
      await program.parseAsync(["node", "hdd-worker", "review", "reject", "story-test"]);
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Boot failure path
// ────────────────────────────────────────────────────────────────────────────────

describe("Boot failure", () => {
  test("bootstrap err → stderr + exit(1)", async () => {
    const { deps: baseDeps, calls } = buildDeps();
    const deps: ReviewDeps = {
      ...baseDeps,
      bootstrap: () =>
        ({
          isOk: () => false,
          isErr: () => true,
          error: {
            kind: "BootEnvInvalid",
            inner: { kind: "EnvValidationError", issues: [], formatted: "missing" },
          },
        }) as unknown as Result<BootResult, BootError>,
    };
    const program = newProgram(deps);

    await program.parseAsync(["node", "hdd-worker", "review", "approve", "story-test"]);

    expect(calls.appends.length).toBe(0);
    expect(calls.stderr.join("")).toContain("BootEnvInvalid");
    expect(calls.exits).toEqual([1]);
  });
});
