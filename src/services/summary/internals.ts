/**
 * `internals.ts` — helpers privados do summary generator.
 *
 * Story 1.a.8. Isolados de `summary-generator.service.ts` para respeitar Biome
 * 200-line cap.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { err, ok, type Result } from "../../lib/result.ts";
import {
  formatDecisions,
  formatFileList,
  formatMetrics,
  formatNextSteps,
  formatOpenItems,
  formatReviewerFindings,
  formatTradeoffs,
} from "./format.ts";
import type { GitSpawn, SummaryError, SummaryInput } from "./types.ts";

export function readTemplates(
  dir: string,
): Result<{ tierBTpl: string; tierCTpl: string }, SummaryError> {
  try {
    const tierBTpl = readFileSync(join(dir, "summary-tier-b.md"), "utf8");
    const tierCTpl = readFileSync(join(dir, "summary-tier-c.md"), "utf8");
    return ok({ tierBTpl, tierCTpl });
  } catch (cause) {
    return err({ kind: "TemplateNotFound", path: dir, cause });
  }
}

export function buildVars(input: SummaryInput, gitSpawn: GitSpawn): Record<string, string> {
  return {
    workflowId: input.workflowId,
    workflowName: input.workflowName,
    date: input.date,
    projectName: input.projectName,
    phase: input.phase,
    contexto: input.contexto,
    whatWasDone: formatFileList(input.whatWasDone),
    fullFileList: formatFileList(input.whatWasDone),
    decisions: formatDecisions(input.decisions),
    tradeoffs: formatTradeoffs(input.tradeoffs),
    openItems: formatOpenItems(input.openItems),
    reviewerFindings: formatReviewerFindings(input.reviewerFindings),
    metrics: formatMetrics(input.metrics),
    nextSteps: formatNextSteps(input.nextSteps),
    diffAgainst: input.diffAgainst ?? "—",
    gitDiff: computeDiffSection(input, gitSpawn),
  };
}

function computeDiffSection(input: SummaryInput, gitSpawn: GitSpawn): string {
  if (input.diffAgainst === undefined) return "_(no diff requested)_";
  const args = ["diff", input.diffAgainst, "--", ...(input.diffPaths ?? [])];
  const r = gitSpawn(args);
  if (r.exitCode !== 0) return `_(diff failed: ${r.stderr.trim()})_`;
  return `\`\`\`diff\n${r.stdout}\n\`\`\``;
}

export function autoCommit(
  gitSpawn: GitSpawn,
  outPath: string,
  input: SummaryInput,
): Result<string | undefined, SummaryError> {
  const addR = gitSpawn(["add", outPath]);
  if (addR.exitCode !== 0) {
    return err({ kind: "GitCommitFailure", stderr: addR.stderr, exitCode: addR.exitCode });
  }
  const msg = `summary(${input.workflowId}): ${input.workflowName}`;
  // --no-verify justified: summary is narrative-only, not code; pre-commit
  // hooks (lint/test/typecheck) are irrelevant. Only the summary file is
  // staged + committed; rest of the workflow stays under operator control.
  const commitR = gitSpawn(["commit", "-m", msg, "--no-verify"]);
  if (commitR.exitCode !== 0) {
    return err({ kind: "GitCommitFailure", stderr: commitR.stderr, exitCode: commitR.exitCode });
  }
  const shaR = gitSpawn(["rev-parse", "HEAD"]);
  return ok(shaR.exitCode === 0 ? shaR.stdout.trim() : undefined);
}

export function defaultGitSpawn(cwd: string): GitSpawn {
  return (args) => {
    const p = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
    return {
      exitCode: p.exitCode,
      stdout: p.stdout.toString(),
      stderr: p.stderr.toString(),
    };
  };
}
