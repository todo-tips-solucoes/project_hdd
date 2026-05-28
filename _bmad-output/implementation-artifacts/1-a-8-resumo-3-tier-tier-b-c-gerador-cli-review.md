# Story 1.a.8: Resumo 3-tier Tier-B/C gerador + CLI review

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operador** (humano que aprova/rejeita workflows do HDD),
I want **um gerador automático de Resumos Tier-B (briefing ≤900 palavras) + Tier-C (full + git diff) committed em git ao concluir qualquer workflow + um CLI `hdd-worker review {approve|request-changes|reject}` para aprovação textual**,
so that **D-019 (revisão obrigatória) está enforced desde Day 1 — substitui a escrita MANUAL dos Tier-B summaries que tenho feito desde 1.a.5; antes do canal WhatsApp `hdd_summary_finalization` template estar aprovado**.

> **Big picture:** D-019 é uma das políticas centrais do HDD — operador humano APROVA cada finalização de workflow. Hoje (Sprint 0 Day 4), essa política está cumprida por mim a escrever `story-1aN-summary.md` à mão + a esperar `approve story-1aN` no chat. Esta story automatiza essa escrita e formaliza o canal de aprovação via CLI. **Não substitui o operador**; substitui o **acto manual do agent** — uma vez instalada, o worker chama `summaryGenerator.finalize(...)` e o ficheiro é gerado/committed automaticamente.
>
> **Onde se encaixa no canon F8 (FR-070..076):** o canon prevê 3-tier completo (Tier-A WhatsApp 200-palavras + Tier-B briefing + Tier-C full). Esta story implementa **Tier-B + Tier-C apenas** — Tier-A requer template Meta aprovado (`hdd_summary_finalization`) que está scope-out (chega Story 7.b.1 ou via E3 templates). Tier-A é renderizado aqui como **placeholder explícito** com mensagem "pending template aprovado".
>
> **Dependências de scope da Story:**
> - **FSM transition real** (`runs.status` → `paused_awaiting_review`) é **DEFERIDA** — Story 2.1+ wires o worker loop que consome o evento. Esta story emite o evento via audit JSONL apenas (best-effort marker; futuras stories consomem).
> - **Commander root CLI** (`src/cli/hdd-worker.ts`) é convencionalmente da Story 2.1 — mas esta story precisa do entry point para o subcommand `review` funcionar. Criamos versão **minimal** de `hdd-worker.ts` (apenas wiring Commander + register `review`); Story 2.1 expande com `start`, `stop`, etc.
> - **Auto-commit em git** do summary file: subprocess `Bun.spawn(["git", "add", path, "commit", "-m", msg])`. **NÃO commita código** — apenas o ficheiro de summary. Resto do trabalho continua sob controlo manual do operador.

## Acceptance Criteria

> ACs extracted verbatim de `_bmad-output/planning-artifacts/epics.md#Story-1.a.8`. 4 binary ACs explícitos + 1 condicional (Tier-C git diff).

**AC-1 (generator escreve + commita summary):**

**Given** workflow conclui (e.g. dev-story finaliza Tasks 1-N)
**When** worker chama `summaryGenerator.finalize(input)` com `workflowId, workflowName, phase, projectName, contexto, whatWasDone, decisions, tradeoffs, openItems, metrics, nextSteps`
**Then** ficheiro `_bmad-output/<phase>/<workflowId>-summary.md` é escrito com **3 sections renderizadas**:
- **Tier-A placeholder** explícito: "Tier-A: pending `hdd_summary_finalization` template aprovado (Story 7.b.1)"
- **Tier-B briefing** ≤900 palavras (target ≤715 para folga), seguindo o template `templates/summary-tier-b.md`
- **Tier-C full** com todas as sections + (opcional) git diff vs `diffAgainst` ref

**And** o ficheiro é committed via `git add <path> && git commit -m "summary(<workflowId>): <workflowName>"` (binary AC).

**AC-2 (review approve emite evento + audit):**

**Given** worker em estado virtual `paused_awaiting_review` (representado pela existência do summary file + ausência de decisão posterior no audit)
**When** corro `bun run src/cli/hdd-worker.ts review approve <workflowId>` (ou via binário compilado `hdd-worker review approve <workflowId>`)
**Then** uma entrada audit JSONL é appended com `{ type: "ReviewApproved", payload: { workflowId, decidedAt, reviewer } }` (binary AC)
**And** stdout escreve `"approved: <workflowId>"` + exit 0 (binary AC).

> **Nota de scope:** "FSM transita para próximo passo" e "state injecta approved=true" no spec original são **diferidos** — esta story emite só o evento via audit. Worker loop (Story 2.1+) consume o evento e faz transition real.

**AC-3 (request-changes regista nota):**

**Given** mesmo estado virtual
**When** corro `hdd-worker review request-changes <workflowId> --note "fix XYZ"`
**Then** audit JSONL recebe `{ type: "ReviewChangesRequested", payload: { workflowId, note: "fix XYZ", decidedAt, reviewer } }` (binary AC)
**And** stdout escreve `"changes-requested: <workflowId> — fix XYZ"` + exit 0.
**And** `--note` obrigatório (sem note → exit 1 com erro descritivo).

**AC-4 (reject regista razão):**

**Given** mesmo estado virtual
**When** corro `hdd-worker review reject <workflowId> --reason "scope creep"`
**Then** audit JSONL recebe `{ type: "ReviewRejected", payload: { workflowId, reason: "scope creep", decidedAt, reviewer } }` (binary AC)
**And** stdout escreve `"rejected: <workflowId> — scope creep"` + exit 0.
**And** `--reason` obrigatório.

**AC-5 (Tier-C git diff side-by-side se workflow anterior existe — condicional):**

**Given** `diffAgainst` é um git ref válido (e.g. `HEAD~1`, `955bdbf`) passado no input
**When** `summaryGenerator.finalize(input)` corre
**Then** Tier-C inclui section `## Diff vs <ref>` com output de `git diff <ref> -- <relevant-paths>` dentro de code fence ```diff (binary AC)

> **Side-by-side scope-out:** "side-by-side" na spec original implica renderização 2-column. Em Markdown puro isso é hard. Esta story renderiza diff **unified** dentro de ```diff fence (sufficient para code review). Se operador prefere side-by-side, fica como Open Item para v1.1+.

## Tasks / Subtasks

> 8 tasks. Estimated tokens: 64K core / 96K with retry (per epics StorySpec). Instrumentação `bun run lint && bun run type-check && bun test tests/services/summary.test.ts` entre tasks.

- [x] **Task 1 — Add `commander` dependency** (foundational; AC-2..4)
  - [x] 1.1 `bun add commander` (latest stable); regista versão exacta no Dev Agent Record. Stack v2 canon (memory `project-hdd-stack-v2-bun`) já lista Commander.
  - [x] 1.2 Confirma `bun.lock` text format mantido.
  - [x] 1.3 `bun run type-check` passa sem erros.

- [x] **Task 2 — Criar templates Markdown** (AC-1)
  - [x] 2.1 `templates/summary-tier-b.md` — template seguindo a estrutura canon `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md#Tier-B` com placeholders `{{contexto}}`, `{{whatWasDone}}`, `{{decisions}}`, `{{tradeoffs}}`, `{{openItems}}`, `{{reviewerFindings}}`, `{{metrics}}`, `{{nextSteps}}`.
  - [x] 2.2 `templates/summary-tier-c.md` — superset do Tier-B + placeholders adicionais `{{fullFileList}}`, `{{gitDiff}}`, `{{taskBreakdown}}`.
  - [x] 2.3 Frontmatter YAML obrigatório (per convenção "Convenções comuns aos 3 tiers"): `workflowId`, `workflowName`, `date`, `tier` (b ou c).
  - [x] 2.4 Tier-A placeholder inline em ambos os templates: `> **Tier-A:** pending hdd_summary_finalization Meta template (Story 7.b.1).`
  - [x] 2.5 Anti-padrões a evitar: documentar em comentário HTML no topo dos templates ("não usar 'foi feito muito trabalho'; usar artefactos como prova").

- [x] **Task 3 — `src/services/summary-generator.service.ts`** (AC-1 + AC-5)
  - [x] 3.1 Definir tipos:
    ```ts
    export type SummaryInput = {
      readonly workflowId: string;          // "story-1a8"
      readonly workflowName: string;        // "Story 1.a.8 — ..."
      readonly phase: string;               // "implementation-artifacts"
      readonly projectName: string;         // "projeto_hdd"
      readonly date: string;                // ISO 8601
      readonly contexto: string;
      readonly whatWasDone: ReadonlyArray<{ readonly artifact: string; readonly path?: string; readonly description: string }>;
      readonly decisions: ReadonlyArray<{ readonly n: number; readonly decision: string; readonly reason: string; readonly id?: string }>;
      readonly tradeoffs: ReadonlyArray<string>;
      readonly openItems: ReadonlyArray<{ readonly id: string; readonly description: string }>;
      readonly reviewerFindings?: { readonly verdict: string; readonly resolved: ReadonlyArray<string>; readonly deferred: ReadonlyArray<string> };
      readonly metrics: ReadonlyArray<{ readonly key: string; readonly value: string }>;
      readonly nextSteps: ReadonlyArray<{ readonly n: number; readonly description: string }>;
      readonly diffAgainst?: string;        // git ref (opcional)
      readonly diffPaths?: ReadonlyArray<string>;
    };

    export type SummaryOutput = {
      readonly summaryPath: string;         // _bmad-output/<phase>/<workflowId>-summary.md
      readonly gitCommit?: string;          // commit SHA after auto-commit
      readonly tierBWordCount: number;      // para AC-1 ≤715 target
    };

    export type SummaryError =
      | { readonly kind: "TemplateNotFound"; readonly path: string }
      | { readonly kind: "WriteFailure"; readonly cause: unknown }
      | { readonly kind: "GitCommitFailure"; readonly stderr: string; readonly code: number }
      | { readonly kind: "TierBOverflow"; readonly wordCount: number };
    ```
  - [x] 3.2 Factory function `createSummaryGenerator(deps: { repoRoot: string; templatesDir?: string; gitSpawn?: (args: string[]) => { exitCode: number; stdout: string; stderr: string } }): { finalize: (input: SummaryInput) => Result<SummaryOutput, SummaryError> }`. `gitSpawn` injectable para tests.
  - [x] 3.3 `finalize()`:
    1. Lê templates (`templates/summary-tier-b.md` + `templates/summary-tier-c.md`).
    2. Renderiza Tier-B + Tier-C com substituição `{{key}}` → valor (helper `renderTemplate`).
    3. Tier-A é placeholder inline (string fixa).
    4. Concatena: Tier-A placeholder + `\n\n---\n\n` + Tier-B + `\n\n---\n\n` + Tier-C.
    5. Verifica Tier-B word count ≤900 (HARD); soft warn se >715 (não falha).
    6. Se `diffAgainst` definido, corre `git diff <ref> -- <paths>` e injecta em Tier-C `{{gitDiff}}`.
    7. Escreve para `<repoRoot>/_bmad-output/<phase>/<workflowId>-summary.md`.
    8. `git add <path> && git commit -m "summary(<workflowId>): <workflowName>" --no-verify` (skip hooks intencional para auto-commit; explain em comment).
    9. Retorna `ok({ summaryPath, gitCommit, tierBWordCount })`.
  - [x] 3.4 **Helpers**:
    - `renderTemplate(template: string, vars: Record<string, string>): string` — `template.replaceAll("{{" + key + "}}", value)` (não regex, evita escape).
    - `formatTable(rows, columns)` — render table markdown para `decisions`.
    - `formatList(items)` — render bullet list.
    - `countWords(text: string): number` — split por whitespace + filter empty.
  - [x] 3.5 **`--no-verify` justification** (AO-66 nota): auto-commit do summary file precisa skipar pre-commit hooks (lint/test/typecheck) porque o summary é narrativa pura, não código. Explain em comment + audit log.
  - [x] 3.6 Linha cap Biome 200: se exceder, factor helpers para `src/services/summary/helpers.ts`.

- [x] **Task 4 — `src/cli/hdd-worker.ts`** (root Commander entry; foundational AC-2..4)
  - [x] 4.1 Minimal Commander root:
    ```ts
    import { Command } from "commander";
    import { registerReviewCommand } from "./review.command.ts";

    const program = new Command();
    program
      .name("hdd-worker")
      .description("HDD worker CLI (HORSE DRIVEN DEVELOPMENT)")
      .version("0.0.1");

    registerReviewCommand(program);

    if (import.meta.main) {
      program.parse(process.argv);
    }
    ```
  - [x] 4.2 **NÃO** wire-up daemon `start`/`stop` ainda — fica para Story 2.1. Comentar em comment header.
  - [x] 4.3 `import.meta.main` guard para tests poderem importar sem invocar parse.

- [x] **Task 5 — `src/cli/review.command.ts`** (AC-2 + AC-3 + AC-4)
  - [x] 5.1 `registerReviewCommand(program: Command, deps?: ReviewDeps): void` factory pattern (deps injectable para tests):
    ```ts
    export type ReviewDeps = {
      readonly audit?: AuditPort;
      readonly clock?: ClockPort;
      readonly reviewer?: string;       // default: process.env.USER ?? "operador"
      readonly bootstrap?: () => Result<BootResult, BootError>; // default real bootstrap
    };
    ```
  - [x] 5.2 3 subcommands com Commander:
    - `review approve <workflowId>` → audit append `ReviewApproved`.
    - `review request-changes <workflowId>` com `--note <string>` (required) → audit `ReviewChangesRequested`.
    - `review reject <workflowId>` com `--reason <string>` (required) → audit `ReviewRejected`.
  - [x] 5.3 Cada subcommand:
    1. Inicia bootstrap (`deps.bootstrap?.() ?? bootstrap()`).
    2. Se err, escreve `formatBootError` em stderr + exit 1.
    3. Compõe payload com `workflowId, decidedAt: clock.now().toISOString(), reviewer`.
    4. `audit.append({ ts, runId: workflowId, type, payload })`.
    5. Se err, escreve mensagem em stderr + exit 1.
    6. Stdout: `"<verdict>: <workflowId>[ — <note/reason>]"`; exit 0.
    7. **Nota:** após o subcommand completar, **fechar db** + **não** armar shutdown handler — o CLI é one-shot, não daemon. Bootstrap precisa de modo "cli mode" que skipa o `shutdown.arm()`.
  - [x] 5.4 **CLI mode no bootstrap**: adicionar `BootDeps.cliMode?: boolean` em `src/bootstrap.ts` que skipa `shutdown.arm()` + `emitProcessStartedEvent`. Mantém compat: default `false` (modo daemon como agora). Esta é uma **micro-modificação** de bootstrap.ts (sem quebrar 1.a.7 specs).
  - [x] 5.5 Erros: `--note`/`--reason` em falta → Commander já valida `requiredOption()`; CLI exit 1 nativo.

- [x] **Task 6 — Specs `tests/services/summary.test.ts`** (AC-1 + AC-5)
  - [x] 6.1 Setup: `mkdtempSync` para repo tmpdir; `Bun.spawn(["git", "init"])` + 1 commit dummy para HEAD existir; copy templates do projeto para tmpdir.
  - [x] 6.2 **AC-1**: criar SummaryInput mínimo + chamar `finalize` → verifica:
    - Ficheiro existe em `<tmpdir>/_bmad-output/<phase>/<workflowId>-summary.md`.
    - Conteúdo contém substring "Tier-A: pending" + "Tier-B" header + "Tier-C" header.
    - Tier-B word count ≤900.
    - `git log --oneline -1` retorna commit message com `summary(<workflowId>)`.
  - [x] 6.3 **AC-5**: setup repo com 2 commits; passar `diffAgainst: "HEAD~1"` + `diffPaths: ["src/"]` → verifica Tier-C contém ```diff fence + diff text.
  - [x] 6.4 **Error paths**: template missing → `TemplateNotFound`; git commit fail (corromper repo) → `GitCommitFailure`.
  - [x] 6.5 Helper `buildMinimalInput()` para reduzir verbosity em todos os tests.

- [x] **Task 7 — Specs `tests/cli/review.test.ts`** (AC-2 + AC-3 + AC-4)
  - [x] 7.1 Setup: `mkdtempSync` + bootstrap em CLI mode + audit baseDir tmp.
  - [x] 7.2 **AC-2**: invocar `registerReviewCommand(program, deps)` + `program.parseAsync(["node", "hdd-worker", "review", "approve", "story-test"])` → verifica audit JSONL contém `ReviewApproved`.
  - [x] 7.3 **AC-3**: parseAsync com `["review", "request-changes", "story-test", "--note", "fix"]` → audit `ReviewChangesRequested` + payload.note correcto.
  - [x] 7.4 **AC-4**: parseAsync com `["review", "reject", "story-test", "--reason", "creep"]` → audit `ReviewRejected`.
  - [x] 7.5 **Required flag enforcement**: `request-changes` sem `--note` deve exit 1; Commander gera o erro automaticamente.
  - [x] 7.6 Mock `process.exit` igual ao pattern Story 1.a.7 (manual `process.exit = ...` + restore).

- [x] **Task 8 — Resumo Tier-B (manual ainda) + sprint-status review**
  - [x] 8.1 Escrever `_bmad-output/implementation-artifacts/story-1a8-summary.md` manualmente seguindo template `summary-tier-b.md` recém-criado (meta-dogfood: a Story 1.a.8 produz o seu próprio summary à mão, mas a partir da Story 1.a.9 será o generator que substitui).
  - [x] 8.2 Sprint-status: `1-a-8: in-progress → review`. Após `approve`: `review → done`.

## Dev Notes

### AO matrix (compliance map)

| AO / Decisão | Story relevance | Onde aplicado |
|---|---|---|
| **D-019** Revisão obrigatória pelo operador | Canon directo (motivação primária) | `summaryGenerator.finalize` produz artefacto + CLI `review` regista verdict |
| **FR-070..076 (F8 Resumo 3-tier)** | Direct | Tier-B/C esta story; Tier-A defer (Story 7.b.1) |
| **AO-146** Tier-A 5 bullets fixos | Defer (Tier-A é placeholder aqui) | Placeholder explícito; AO-146 enforce em 7.b.1 |
| **AO-148** Auto-archive 30d | Future | Não esta story; menção em Tier-C metadata para tracking |
| **Pre-Mortem PM-4** | Direct | "Operador esquece-se de revisar" — CLI `review` é o mitigation enforced |
| **AO-21** Drift detector Tier-A↔Tier-B | Defer (Tier-A não existe ainda) | Adicionar quando Tier-A entrar |
| **D-04.19** Domain events tagged union | Touched (audit event type novo) | Eventos `ReviewApproved/ChangesRequested/Rejected` adicionados como `type` strings no audit; não tagged union completa em `src/core/events.ts` ainda (defer 1.a.9 + AsyncLocalStorage) |
| **AO-66** Throw whitelist | Canon | Generator + CLI usam Result; throws apenas via Commander internals |
| **AO-122** 200-line cap | Hard | `summary-generator.service.ts` provável dividir em helpers se ultrapassar |
| **D-019** vs auto-commit hooks skip | Trade-off | `--no-verify` justificado: summary é narrativa, não código; skipar pre-commit lint/test é seguro |

### Esboços canónicos

**`templates/summary-tier-b.md` (estrutura):**

```markdown
<!--
  Tier-B template — 600-900 palavras, target ≤715 para folga.
  Anti-padrões a EVITAR: "foi feito muito trabalho", listas FR sem consequência,
  "várias decisões foram tomadas" sem enumerar, "tudo correu bem".
  Manter: artefactos como prova, decisões enumeradas, trade-offs narrativos.
-->
---
workflowId: {{workflowId}}
workflowName: {{workflowName}}
date: {{date}}
tier: b
---

# {{workflowName}} · {{projectName}} · {{date}}

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

{{contexto}}

## O que foi feito

{{whatWasDone}}

## Decisões críticas

{{decisions}}

## Trade-offs aplicados

{{tradeoffs}}

## Open items deferidos

{{openItems}}

## Reviewer findings

{{reviewerFindings}}

## Métricas

{{metrics}}

## Próximos passos sugeridos

{{nextSteps}}

→ Tier-C: ver `_bmad-output/{{phase}}/{{workflowId}}-summary.md#tier-c` · Aprovar: `hdd-worker review approve {{workflowId}}`
```

**`templates/summary-tier-c.md` (estrutura):** superset com `## Diff vs {{diffAgainst}}` + `## Full file list`.

**`src/services/summary-generator.service.ts` (esboço, target ~150-200 linhas):**

```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "../lib/result.ts";

export function createSummaryGenerator(deps: {
  repoRoot: string;
  templatesDir?: string;
  gitSpawn?: (args: string[]) => { exitCode: number; stdout: string; stderr: string };
}): { finalize: (input: SummaryInput) => Result<SummaryOutput, SummaryError> } {
  const templatesDir = deps.templatesDir ?? join(deps.repoRoot, "templates");
  const gitSpawn = deps.gitSpawn ?? defaultGitSpawn(deps.repoRoot);

  const finalize = (input: SummaryInput): Result<SummaryOutput, SummaryError> => {
    // 1. read templates
    let tierBTpl: string; let tierCTpl: string;
    try {
      tierBTpl = readFileSync(join(templatesDir, "summary-tier-b.md"), "utf8");
      tierCTpl = readFileSync(join(templatesDir, "summary-tier-c.md"), "utf8");
    } catch (cause) {
      return err({ kind: "TemplateNotFound", path: templatesDir });
    }

    // 2. compute vars
    const vars = buildVars(input);

    // 3. compute gitDiff if diffAgainst
    if (input.diffAgainst) {
      const diffR = gitSpawn(["diff", input.diffAgainst, "--", ...(input.diffPaths ?? [])]);
      vars.gitDiff = diffR.exitCode === 0 ? `\`\`\`diff\n${diffR.stdout}\n\`\`\`` : "_(diff failed)_";
    }

    // 4. render
    const tierB = renderTemplate(tierBTpl, vars);
    const tierC = renderTemplate(tierCTpl, vars);

    // 5. tier-B word count check
    const wc = countWords(tierB);
    if (wc > 900) return err({ kind: "TierBOverflow", wordCount: wc });

    // 6. compose
    const tierAPlaceholder = `> **Tier-A:** pending hdd_summary_finalization Meta template (Story 7.b.1).\n`;
    const body = `${tierAPlaceholder}\n---\n\n${tierB}\n\n---\n\n${tierC}\n`;

    // 7. write
    const outPath = join(deps.repoRoot, "_bmad-output", input.phase, `${input.workflowId}-summary.md`);
    try {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, body, "utf8");
    } catch (cause) {
      return err({ kind: "WriteFailure", cause });
    }

    // 8. git add + commit
    const addR = gitSpawn(["add", outPath]);
    if (addR.exitCode !== 0) return err({ kind: "GitCommitFailure", stderr: addR.stderr, code: addR.exitCode });
    const msg = `summary(${input.workflowId}): ${input.workflowName}`;
    const commitR = gitSpawn(["commit", "-m", msg, "--no-verify"]);
    if (commitR.exitCode !== 0) return err({ kind: "GitCommitFailure", stderr: commitR.stderr, code: commitR.exitCode });

    // 9. get commit sha
    const shaR = gitSpawn(["rev-parse", "HEAD"]);
    const gitCommit = shaR.exitCode === 0 ? shaR.stdout.trim() : undefined;

    return ok({ summaryPath: outPath, gitCommit, tierBWordCount: wc });
  };

  return { finalize };
}
```

**`src/cli/hdd-worker.ts` (minimal Commander root, ~25 linhas):**

```ts
import { Command } from "commander";
import { registerReviewCommand } from "./review.command.ts";

const program = new Command();
program.name("hdd-worker").description("HDD CLI").version("0.0.1");
registerReviewCommand(program);

if (import.meta.main) {
  program.parseAsync(process.argv);
}

export { program };
```

**`src/cli/review.command.ts` (~100 linhas):**

```ts
import type { Command } from "commander";
import { bootstrap, type BootError, type BootResult } from "../bootstrap.ts";
import { type Result } from "../lib/result.ts";

export type ReviewDeps = {
  readonly bootstrap?: () => Result<BootResult, BootError>;
  readonly reviewer?: string;
};

export function registerReviewCommand(program: Command, deps: ReviewDeps = {}): void {
  const review = program.command("review").description("Operator review verdicts");
  const reviewer = deps.reviewer ?? process.env.USER ?? "operador";

  review
    .command("approve <workflowId>")
    .description("Approve a workflow")
    .action((workflowId: string) => {
      runReview(deps, "ReviewApproved", workflowId, {}, reviewer);
    });

  review
    .command("request-changes <workflowId>")
    .requiredOption("--note <text>", "Change request note")
    .description("Request changes on a workflow")
    .action((workflowId: string, opts: { note: string }) => {
      runReview(deps, "ReviewChangesRequested", workflowId, { note: opts.note }, reviewer);
    });

  review
    .command("reject <workflowId>")
    .requiredOption("--reason <text>", "Reject reason")
    .description("Reject a workflow")
    .action((workflowId: string, opts: { reason: string }) => {
      runReview(deps, "ReviewRejected", workflowId, { reason: opts.reason }, reviewer);
    });
}

function runReview(
  deps: ReviewDeps,
  type: "ReviewApproved" | "ReviewChangesRequested" | "ReviewRejected",
  workflowId: string,
  extra: Record<string, string>,
  reviewer: string,
): void {
  const bootR = (deps.bootstrap ?? (() => bootstrap({ cliMode: true })))();
  if (bootR.isErr()) {
    process.stderr.write(`boot failed: ${bootR.error.kind}\n`);
    process.exit(1);
  }
  const { audit, db, env: _env } = bootR.value;
  const decidedAt = new Date().toISOString();
  const appR = audit.append({ ts: decidedAt, runId: workflowId, type, payload: { workflowId, reviewer, ...extra } });
  db.close();
  if (appR.isErr()) {
    process.stderr.write(`audit append failed: ${JSON.stringify(appR.error)}\n`);
    process.exit(1);
  }
  const label = type === "ReviewApproved" ? "approved" : type === "ReviewChangesRequested" ? "changes-requested" : "rejected";
  const suffix = extra.note ?? extra.reason;
  process.stdout.write(`${label}: ${workflowId}${suffix ? ` — ${suffix}` : ""}\n`);
  process.exit(0);
}
```

**`src/bootstrap.ts` micro-modificação (add cliMode):**

```ts
// novo field em BootDeps:
readonly cliMode?: boolean;

// dentro do bootstrap, antes do arm():
const shutdown = createShutdownHandler({ ... });
if (deps.cliMode !== true) {
  shutdown.arm();
}
// emit ProcessStarted condicional ao cliMode também:
if (deps.emitProcessStartedEvent !== false && deps.cliMode !== true) { ... }
```

### Previous story intelligence (1.a.5 + 1.a.6 + 1.a.7 — directly leveraged)

**Da 1.a.7 (bootstrap.ts):**
- `bootstrap(deps?)` retorna `Result<BootResult, BootError>` sync. CLI consume.
- Adicionar `cliMode: boolean` é micro-feature; **mantém compat** (default `false` = behavior 1.a.7).
- `BootResult` expõe `db` + `audit` que a CLI precisa.

**Da 1.a.6 (audit JSONL):**
- `audit.append({ ts, runId, type, payload })` é sync `Result<AuditAppendResult, AuditError>`.
- `runId` campo é generic string — usar `workflowId` aqui (e.g. "story-1a8").
- Audit chain integrity automática; CLI não precisa preocupar-se com hashing.

**Da 1.a.5 (db schema + commit-before-side-effect):**
- bun:sqlite síncrono; `db.close()` no fim do CLI antes de exit.
- Não há nova migration nesta story; review verdicts vivem no audit log.

**Convenções emergidas (tácitas das 7 stories prévias):**
- Result sync; ResultAsync só quando async genuíno (não é o caso aqui — fs + spawn são sync via `Bun.spawnSync`).
- Factory functions, não classes.
- `process.exit` mock pattern em tests: manual `process.exit = ...` + `originalExit` restore + AO-66 #6 (test code) para throws.
- Biome organize-imports + 200-line cap; comentários inline `// allow-throw: AO-66 #N` quando necessário.
- @types/bun ✓; bun.lock text ✓.

### Anti-pattern guardrails (NÃO fazer)

1. **NÃO usar `child_process` Node legado** — usar `Bun.spawnSync` (síncrono, native).
2. **NÃO commit code automaticamente** — apenas o summary file. Auto-commit aplica-se SÓ ao `_bmad-output/<phase>/<workflowId>-summary.md`. Resto do trabalho continua sob controlo manual operador.
3. **NÃO escrever no audit log se bootstrap falhou.** Mesma regra AC-1 da Story 1.a.7 — fail-closed em env missing significa ZERO audit lines.
4. **NÃO usar template engine externa (Handlebars, EJS, etc.)** — `string.replaceAll("{{key}}", value)` chega; menos uma dep, menos uma superfície de attack.
5. **NÃO assumir git config** — testes correm em CI sem `user.email`/`user.name`. Para auto-commit em tests, set `git config user.email "test@hdd.local"` + `user.name "Test"` no setup; em produção operador já tem.
6. **NÃO emitir DomainEvent tipado (`src/core/events.ts`)** — esta story só usa audit log strings. Story 1.a.9 (AsyncLocalStorage) ou 2.x integra tagged union completa.
7. **NÃO duplicar bootstrap state em `cliMode`** — o cli mode SKIPA `shutdown.arm()` e `ProcessStarted` event; tudo o resto (env Zod + db + audit) corre igual. Compat 100% com 1.a.7.
8. **NÃO assumir `_bmad-output/<phase>/` existe** — `mkdirSync(..., { recursive: true })` cria; idempotente.
9. **NÃO compitar palavras com tags HTML em conta** — `countWords` strip-tags antes (ou ignorar; comentários `<!-- ... -->` no template inicial são minimais).
10. **NÃO esquecer `--no-verify` justification em comment** — pre-commit hooks (lint, type-check) NÃO devem correr no auto-commit do summary porque o summary não é código. Documentar.

### Testing strategy

- Co-located tests em `tests/services/summary.test.ts` (generator) + `tests/cli/review.test.ts` (CLI).
- `mkdtempSync` + `Bun.spawnSync(["git", "init"])` + 1 dummy commit no setup para criar repo válido tmp.
- Set `git config user.email "test@hdd.local"` + `user.name "HDD Test"` no tmpdir (não polui global config).
- Tier-C diff test: criar 2 commits no tmpdir + diffAgainst HEAD~1 → verificar fence.
- Word count test: gerar Tier-B mock + assert `≤ 900` + warn se >715 (log warn em test, não fail).
- CLI test: `program.parseAsync(["node", "hdd-worker", "review", ...])` (note: argv[0]+[1] são dummies para Commander parsing).
- `process.exit` mock pattern 1.a.7 reusado.
- Coverage target: ≥85% line nos 3 ficheiros novos.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.a.8] — StorySpec + ACs canónicos.
- [Source: _bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md] — Templates Tier-A/B/C canon (Princípios + Anti-padrões).
- [Source: _bmad-output/planning-artifacts/architecture.md#F8-Resumo-3-tier] — FR-070..076 + AO-146 + AO-148.
- [Source: _bmad-output/implementation-artifacts/story-1a7-summary.md] — bootstrap.ts BootDeps shape + BootResult.
- [Source: _bmad-output/implementation-artifacts/story-1a6-summary.md] — audit.append signature.
- [Source: src/bootstrap.ts] — local que recebe `cliMode` micro-add.
- [Source: src/lib/result.ts] — Result re-export.
- [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts] — audit append target.
- [Memory: project-hdd-stack-v2-bun] — Stack v2 Bun-first (Commander já listed).

### Project Structure Notes

**Created (8):**
- `templates/summary-tier-b.md` (NEW)
- `templates/summary-tier-c.md` (NEW)
- `src/services/summary-generator.service.ts` (NEW)
- `src/cli/hdd-worker.ts` (NEW — minimal Commander root)
- `src/cli/review.command.ts` (NEW)
- `tests/services/summary.test.ts` (NEW)
- `tests/cli/review.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/story-1a8-summary.md` (NEW — meta-dogfood, ainda manual mas última vez)

**Modified (3):**
- `src/bootstrap.ts` (+~5 linhas: `cliMode?: boolean` em BootDeps; condicionais)
- `package.json` + `bun.lock` (commander dep)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-a-8 lifecycle)

**Sem deviations vs architecture** — Story 2.1 vai expandir `src/cli/hdd-worker.ts` com `start/stop/etc.`; esta story cria minimal root.

## Open Questions for Operator

> **Resolução em 2026-05-28** — todas em default Recommended via `AskUserQuestion` (4 questions; Q-A8-5 sem perguntar — assumido Recommended).

- **Q-A8-1 [RESOLVED — Commander root minimal NOW]** — criar `src/cli/hdd-worker.ts` Commander root NOW + register `review` subcommand. Story 2.1 vai expandir com `start/stop/etc.`. Adiciona dep `commander`.

- **Q-A8-2 [RESOLVED — Audit-only Minimal]** — audit log apenas. `summaryGenerator.finalize` NÃO escreve em `runs.status`; CLI `review` NÃO toca em `runs` table. Worker loop (Story 2.1+) será o consumer do audit log e fará a FSM transition real. Nenhuma migration nesta story.

- **Q-A8-3 [RESOLVED — Unified diff em ```diff fence]** — `git diff <ref> -- <paths>` output dentro de markdown code fence ```diff. Side-by-side fica para v1.1+ se operador precisar.

- **Q-A8-4 [RESOLVED — Auto-commit com --no-verify]** — `Bun.spawnSync(["git", "add", path, "commit", "-m", ..., "--no-verify"])` no fim de `finalize()`. `--no-verify` justified em comment (summary é narrativa, não código — pre-commit hooks de lint/test/typecheck são irrelevantes para o summary). Apenas o summary file é committed; resto continua manual operador.

- **Q-A8-5 [RESOLVED — `process.env.USER ?? "operador"`]** — `reviewer` field default. CLI flag `--reviewer <name>` opcional não implementado nesta story (defer se necessário).

**Implicações para tasks (delta):**
- Task 1 → `bun add commander` confirmado (Q-A8-1 Recommended).
- Task 3.3 step 6 → diff render usa ```diff fence (Q-A8-3).
- Task 3.3 step 8 → `git commit --no-verify` confirmado (Q-A8-4).
- Task 5 → CLI escreve apenas audit; sem UPDATE em `runs` (Q-A8-2).
- Task 5.2 → reviewer = `process.env.USER ?? "operador"` (Q-A8-5).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context).

### Debug Log References

- `bun add commander` → `commander@14.0.3`. Bun.lock text format mantido.
- **Refactor mid-implementation**: `summary-generator.service.ts` inicial 230 linhas → ultrapassou Biome 200-line cap. Splitei em 4 ficheiros: `summary-generator.service.ts` (102), `summary/types.ts` (71), `summary/format.ts` (98), `summary/internals.ts` (93). Mantém-se factory + finalize no top-level; helpers + types isolados.
- **TS issue `exactOptionalPropertyTypes` (sticky):** `SummaryOutput.gitCommit?: string` rejeita `string | undefined`; mudei para `gitCommit: string | undefined` explícito.
- **TS issue `noPropertyAccessFromIndexSignature`** apareceu 3x em `review.command.ts` (process.env.USER + Record access). Resolvi com destructuring (`const { USER } = process.env`) + tipo `ReviewExtra` específico em vez de `Record<string,string>` + spread literais.
- **Smoke CLI:** `bun run src/cli/hdd-worker.ts review approve story-test` → `approved: story-test` + audit JSONL escrito com `ReviewApproved`. Missing env → `boot failed: BootEnvInvalid` + exit 1.
- **Lint cycle**: 5 round-trips com `lint:fix` (organize imports + format + unused imports). 1 info `useLiteralKeys` em `migrate.ts:11` permanece pré-existente (1.a.5).

### Completion Notes List

- **Scope honrado**: Tier-B + Tier-C generator; Tier-A é placeholder explícito (template Meta defer 7.b.1). 4-de-5 ACs implementados + 5º condicional (Tier-C git diff fence) implementado.
- **AC-1 verde**: 3 specs (file escrito; word count ≤900; auto-commit). git auto-commit usa `--no-verify` justified (summary é narrativa não código).
- **AC-2/3/4 verde**: 6 specs CLI (3 happy paths + 2 required-flag enforcement + 1 boot failure).
- **AC-5 verde**: 2 specs (diff fence quando `diffAgainst` set; placeholder quando undefined).
- **FSM transition é audit-only** (Q-A8-2 Minimal): `summaryGenerator.finalize` apenas escreve summary + auto-commit; CLI `review` apenas emit audit JSONL. NÃO actualiza `runs.status` nem cria `review_decisions` table. Worker loop (Story 2.1+) será o consumer.
- **`cliMode` micro-mod em bootstrap.ts**: campo `cliMode?: boolean` em BootDeps. Quando true: skipa `shutdown.arm()`, default `emitProcessStartedEvent=false`, default `emitStoppedEvent=false`. Compat 100% com 1.a.7 (default `false`). 1.a.7 specs (14 specs bootstrap) continuam verdes.
- **130 tests pass** (was 117; +13 novos). 0 regressões. Type-check + lint exit 0.
- **Linha counts:** services/{generator 102, types 71, format 98, internals 93} + cli/{hdd-worker 34, review.command 119}. Todos ≤200 (Biome cap).
- **Dependency inversion documentada**: `src/cli/hdd-worker.ts` ought to be Story 2.1; criamos minimal aqui para AC-2..4. Story 2.1 expanderá com `start/stop/etc.` sem quebrar.

### File List

**Created (9):**
- `templates/summary-tier-b.md`
- `templates/summary-tier-c.md`
- `src/services/summary-generator.service.ts` (102 linhas)
- `src/services/summary/types.ts` (71 linhas)
- `src/services/summary/format.ts` (98 linhas)
- `src/services/summary/internals.ts` (93 linhas)
- `src/cli/hdd-worker.ts` (34 linhas)
- `src/cli/review.command.ts` (119 linhas)
- `tests/services/summary.test.ts` (192 linhas, 7 specs)
- `tests/cli/review.test.ts` (220 linhas, 6 specs)
- `_bmad-output/implementation-artifacts/story-1a8-summary.md` (Task 8 — meta-dogfood manual)

**Modified (3):**
- `src/bootstrap.ts` (+15 linhas: `cliMode?: boolean` em BootDeps; condicional em ProcessStarted + shutdown.arm)
- `package.json` + `bun.lock` (commander@14.0.3)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-a-8 lifecycle backlog→ready-for-dev→in-progress→review)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-05-28 | 0.1 | Story file criado por `bmad-create-story` (Sprint 0 Day 4 continuação 1.a.7) | Amelia (Dev Agent) |
| 2026-05-28 | 0.2 | Q-A8-1..5 resolvidas em default Recommended | Amelia (Dev Agent) |
| 2026-05-28 | 0.3 | Implementação Tasks 1-8 + 130 tests pass + Status → review | Amelia (Dev Agent) |
| 2026-05-28 | 1.0 | Approve operador → Status done; commit pendente | Amelia (Dev Agent) |
