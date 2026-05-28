/**
 * Story 1.a.8 — specs para src/services/summary-generator.service.ts.
 *
 * AC-1: finalize escreve summary file (3 sections) + auto-commit via git.
 * AC-5: Tier-C inclui ```diff fence quando diffAgainst definido.
 * Error paths: TemplateNotFound, TierBOverflow, GitCommitFailure.
 *
 * Setup: cada test mkdtempSync + git init + copy templates. gitSpawn pode
 * ser injectado para mockar git em testes de error paths.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSummaryGenerator,
  type GitSpawn,
  type SummaryInput,
} from "../../src/services/summary-generator.service.ts";

const TEMPLATES_SRC = join(import.meta.dir, "..", "..", "templates");

function setupRepo(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), "hdd-summary-"));
  // Copy templates into tmp repo.
  const tplDir = join(repoRoot, "templates");
  mkdirSync(tplDir);
  writeFileSync(
    join(tplDir, "summary-tier-b.md"),
    readFileSync(join(TEMPLATES_SRC, "summary-tier-b.md"), "utf8"),
  );
  writeFileSync(
    join(tplDir, "summary-tier-c.md"),
    readFileSync(join(TEMPLATES_SRC, "summary-tier-c.md"), "utf8"),
  );
  // Init git + initial commit so HEAD exists.
  runGit(repoRoot, ["init", "-q"]);
  runGit(repoRoot, ["config", "user.email", "test@hdd.local"]);
  runGit(repoRoot, ["config", "user.name", "HDD Test"]);
  writeFileSync(join(repoRoot, "README.md"), "# tmp\n");
  runGit(repoRoot, ["add", "README.md"]);
  runGit(repoRoot, ["commit", "-q", "-m", "initial", "--no-verify"]);
  return repoRoot;
}

function runGit(cwd: string, args: ReadonlyArray<string>): { exitCode: number; stdout: string } {
  const p = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
  return { exitCode: p.exitCode, stdout: p.stdout.toString() };
}

function buildMinimalInput(): SummaryInput {
  return {
    workflowId: "story-test",
    workflowName: "Story Test — bootstrap",
    phase: "implementation-artifacts",
    projectName: "projeto_hdd",
    date: "2026-05-28",
    contexto: "Contexto de teste curto.",
    whatWasDone: [{ artifact: "src/foo.ts", path: "src/foo.ts", description: "novo helper" }],
    decisions: [{ n: 1, decision: "X", reason: "Y", id: "D-1" }],
    tradeoffs: ["A vs B → A escolhido"],
    openItems: [{ id: "O-1", description: "pergunta aberta" }],
    metrics: [{ key: "Tests", value: "10" }],
    nextSteps: [{ n: 1, description: "próximo workflow" }],
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: finalize escreve 3 sections + auto-commit
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 summaryGenerator.finalize escreve summary + commit", () => {
  test("ficheiro escrito em _bmad-output/<phase>/<workflowId>-summary.md", () => {
    const repoRoot = setupRepo();
    const gen = createSummaryGenerator({ repoRoot });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(existsSync(r.value.summaryPath)).toBe(true);
      const content = readFileSync(r.value.summaryPath, "utf8");
      expect(content).toContain("Tier-A:");
      expect(content).toContain("pending");
      expect(content).toContain("# Story Test — bootstrap"); // Tier-B header
      expect(content).toContain("## Tier-C — Full"); // Tier-C header
    }

    rmSync(repoRoot, { recursive: true, force: true });
  });

  test("Tier-B word count ≤900 + retornado em SummaryOutput", () => {
    const repoRoot = setupRepo();
    const gen = createSummaryGenerator({ repoRoot });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.tierBWordCount).toBeLessThanOrEqual(900);
      expect(r.value.tierBWordCount).toBeGreaterThan(0);
    }
    rmSync(repoRoot, { recursive: true, force: true });
  });

  test("auto-commit cria commit com mensagem summary(<workflowId>)", () => {
    const repoRoot = setupRepo();
    const gen = createSummaryGenerator({ repoRoot });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isOk()).toBe(true);
    const log = runGit(repoRoot, ["log", "--oneline", "-1"]).stdout;
    expect(log).toContain("summary(story-test): Story Test — bootstrap");

    if (r.isOk()) expect(r.value.gitCommit).toBeDefined();
    rmSync(repoRoot, { recursive: true, force: true });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-5: Tier-C inclui ```diff quando diffAgainst definido
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-5 Tier-C git diff fence", () => {
  test("diffAgainst definido → Tier-C contém ```diff fence", () => {
    const repoRoot = setupRepo();
    // Cria 2º commit para HEAD~1 existir
    writeFileSync(join(repoRoot, "extra.txt"), "novo conteudo\n");
    runGit(repoRoot, ["add", "extra.txt"]);
    runGit(repoRoot, ["commit", "-q", "-m", "second", "--no-verify"]);

    const gen = createSummaryGenerator({ repoRoot });
    const input: SummaryInput = { ...buildMinimalInput(), diffAgainst: "HEAD~1" };
    const r = gen.finalize(input);

    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      const content = readFileSync(r.value.summaryPath, "utf8");
      expect(content).toContain("```diff");
      expect(content).toContain("extra.txt");
    }
    rmSync(repoRoot, { recursive: true, force: true });
  });

  test("diffAgainst undefined → placeholder '_(no diff requested)_'", () => {
    const repoRoot = setupRepo();
    const gen = createSummaryGenerator({ repoRoot });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      const content = readFileSync(r.value.summaryPath, "utf8");
      expect(content).toContain("_(no diff requested)_");
    }
    rmSync(repoRoot, { recursive: true, force: true });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Error paths
// ────────────────────────────────────────────────────────────────────────────────

describe("Error paths", () => {
  test("TemplateNotFound quando templatesDir vazio", () => {
    const repoRoot = setupRepo();
    const emptyTpl = mkdtempSync(join(tmpdir(), "hdd-empty-tpl-"));
    const gen = createSummaryGenerator({ repoRoot, templatesDir: emptyTpl });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("TemplateNotFound");

    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(emptyTpl, { recursive: true, force: true });
  });

  test("GitCommitFailure quando gitSpawn injectado falha no add", () => {
    const repoRoot = setupRepo();
    const failingGit: GitSpawn = (args) => {
      if (args[0] === "add") return { exitCode: 1, stdout: "", stderr: "add failed" };
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const gen = createSummaryGenerator({ repoRoot, gitSpawn: failingGit });
    const r = gen.finalize(buildMinimalInput());

    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("GitCommitFailure");
      if (r.error.kind === "GitCommitFailure") expect(r.error.stderr).toBe("add failed");
    }

    rmSync(repoRoot, { recursive: true, force: true });
  });
});
