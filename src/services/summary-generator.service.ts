/**
 * `summary-generator.service.ts` — gerador 3-tier (Tier-A placeholder + Tier-B briefing + Tier-C full).
 *
 * Story 1.a.8 (F8 FR-070..076, D-019, Q-A8-1..4 [RESOLVED — Recommended]).
 *
 * **Big picture:** D-019 mandata revisão obrigatória do operador em cada
 * finalização. Esta service substitui a escrita MANUAL dos `story-1aN-summary.md`
 * por um generator estructurado que:
 *   1. lê templates `templates/summary-tier-{b,c}.md`,
 *   2. renderiza Tier-B + Tier-C com substituição `{{key}}` → value,
 *   3. valida Tier-B word count (≤900 HARD, warn >715),
 *   4. opcionalmente injecta `git diff <ref>` em fence ```diff (Tier-C),
 *   5. escreve para `_bmad-output/<phase>/<workflowId>-summary.md`,
 *   6. auto-committa via `git add + commit --no-verify` (apenas o summary).
 *
 * **--no-verify justification (AO-66 nota):** o summary é NARRATIVA, não código.
 * Pre-commit hooks (lint/test/typecheck) são irrelevantes para Markdown puro.
 * `--no-verify` aplica APENAS ao auto-commit do summary file; o resto do
 * workflow continua sob controlo manual do operador.
 *
 * **Síncrono throughout:** fs sync + Bun.spawnSync sync. Sem ResultAsync.
 *
 * **Layout interno (Biome 200-line cap):**
 *   - types em `./summary/types.ts`
 *   - format helpers em `./summary/format.ts`
 *   - internals (readTemplates, buildVars, autoCommit, defaultGitSpawn) em `./summary/internals.ts`
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "../lib/result.ts";
import { countWords, renderTemplate } from "./summary/format.ts";
import { autoCommit, buildVars, defaultGitSpawn, readTemplates } from "./summary/internals.ts";
import type { GitSpawn, SummaryError, SummaryInput, SummaryOutput } from "./summary/types.ts";

export type {
  GitSpawn,
  GitSpawnResult,
  SummaryDecision,
  SummaryError,
  SummaryFile,
  SummaryFinding,
  SummaryInput,
  SummaryMetric,
  SummaryNextStep,
  SummaryOpenItem,
  SummaryOutput,
} from "./summary/types.ts";

const TIER_B_HARD_CAP_WORDS = 900;
const TIER_A_PLACEHOLDER =
  "> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).\n";

export type SummaryGeneratorDeps = {
  readonly repoRoot: string;
  readonly templatesDir?: string;
  readonly gitSpawn?: GitSpawn;
};

export type SummaryGenerator = {
  readonly finalize: (input: SummaryInput) => Result<SummaryOutput, SummaryError>;
};

export function createSummaryGenerator(deps: SummaryGeneratorDeps): SummaryGenerator {
  const templatesDir = deps.templatesDir ?? join(deps.repoRoot, "templates");
  const gitSpawn = deps.gitSpawn ?? defaultGitSpawn(deps.repoRoot);

  const finalize = (input: SummaryInput): Result<SummaryOutput, SummaryError> => {
    const tplR = readTemplates(templatesDir);
    if (tplR.isErr()) return err(tplR.error);
    const { tierBTpl, tierCTpl } = tplR.value;

    const vars = buildVars(input, gitSpawn);
    const tierB = renderTemplate(tierBTpl, vars);
    const tierC = renderTemplate(tierCTpl, vars);

    const wc = countWords(tierB);
    if (wc > TIER_B_HARD_CAP_WORDS) return err({ kind: "TierBOverflow", wordCount: wc });

    const body = `${TIER_A_PLACEHOLDER}\n---\n\n${tierB}\n\n---\n\n${tierC}\n`;
    const outPath = join(
      deps.repoRoot,
      "_bmad-output",
      input.phase,
      `${input.workflowId}-summary.md`,
    );

    try {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, body, "utf8");
    } catch (cause) {
      return err({ kind: "WriteFailure", path: outPath, cause });
    }

    const commitR = autoCommit(gitSpawn, outPath, input);
    if (commitR.isErr()) return err(commitR.error);

    return ok({ summaryPath: outPath, gitCommit: commitR.value, tierBWordCount: wc });
  };

  return { finalize };
}
