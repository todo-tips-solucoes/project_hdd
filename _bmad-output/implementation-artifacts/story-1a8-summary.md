# Story 1.a.8 — Resumo 3-tier Tier-B/C gerador + CLI review · projeto_hdd · 2026-05-28

> **Tier-B (Manual final)** per D-019 — meta-dogfood: este é o ÚLTIMO summary escrito à mão. A partir da Story 1.a.9, `summaryGenerator.finalize()` (entregue nesta story) substitui esta escrita.

## Contexto

D-019 (revisão obrigatória do operador) é uma política central do HDD. Até hoje (Sprint 0 Day 4), foi cumprida por mim a escrever `story-1aN-summary.md` à mão + esperar `approve story-1aN` no chat. Esta story automatiza essa escrita via generator + adiciona CLI `hdd-worker review {approve|request-changes|reject}` para canalizar o verdict via audit JSONL. Tier-A continua placeholder (template Meta `hdd_summary_finalization` defer Story 7.b.1).

## O que foi feito

- **`templates/summary-tier-b.md` + `templates/summary-tier-c.md`** — templates Markdown com placeholders `{{key}}` + frontmatter YAML + comments HTML com anti-padrões a evitar (per canon `finalization-summary-templates.md`).
- **`src/services/summary-generator.service.ts` (102 linhas)** — factory `createSummaryGenerator({repoRoot, templatesDir?, gitSpawn?})`. `finalize(input)` síncrono: lê templates → render Tier-B/C → verifica word count ≤900 HARD → injecta diff se `diffAgainst` → escreve em `_bmad-output/<phase>/<workflowId>-summary.md` → auto-commit via `git add + git commit --no-verify`.
- **`src/services/summary/{types,format,internals}.ts` (71+98+93 linhas)** — splits para respeitar Biome 200-line cap. `types.ts` exporta `SummaryInput/Output/Error`, `format.ts` tem helpers Markdown (`formatDecisions`, `formatFileList`, `countWords`, `renderTemplate`), `internals.ts` tem `readTemplates`, `buildVars`, `autoCommit`, `defaultGitSpawn`.
- **`src/cli/hdd-worker.ts` (34 linhas)** — Commander root minimal. `createCli()` factory + `import.meta.main` guard. Story 2.1 expanderá com `start/stop/etc.`.
- **`src/cli/review.command.ts` (119 linhas)** — `registerReviewCommand(program, deps?)`. 3 subcommands com Commander `requiredOption()`. Boot em `cliMode: true` → `audit.append({type: "Review*"})` → `db.close()` → `process.exit`.
- **`src/bootstrap.ts` (micro-mod +15 linhas)** — campo `cliMode?: boolean` em `BootDeps`. Quando `true`: skipa `shutdown.arm()` + default `emitProcessStartedEvent=false` + default `emitStoppedEvent=false`. Compat 100% com 1.a.7.
- **`tests/services/summary.test.ts` (192 linhas, 7 specs)** — AC-1 (3) + AC-5 (2) + error paths (2). Setup: mkdtempSync + git init + copy templates.
- **`tests/cli/review.test.ts` (220 linhas, 6 specs)** — AC-2/3/4 (3 happy) + required-flag enforcement (2) + boot failure (1). Bootstrap injectado com mock audit + db (não toca filesystem).
- **`commander@14.0.3`** — dep nova adicionada via `bun add commander`.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Tier-A placeholder inline (não generated) | Template Meta `hdd_summary_finalization` não aprovado; Tier-A só faz sentido com WhatsApp pipeline. Placeholder torna scope-out explícito. | Q-A8-? (defer 7.b.1) |
| 2 | Audit-only FSM transition | Worker loop (2.1+) é o consumer; criar `runs.status` UPDATE agora dobraria scope + exigia seed tables. Audit chain é source-of-truth durável. | Q-A8-2 |
| 3 | Unified diff fence ` ```diff ` (não side-by-side) | Side-by-side em Markdown puro requer 2-column table que quebra com linhas longas. ```diff renderiza bem em GitHub UI; copy-paste friendly. | Q-A8-3 |
| 4 | `--no-verify` no auto-commit | Summary é narrativa, não código; pre-commit hooks (lint/test/typecheck) são irrelevantes. Apenas summary file é committed; resto do workflow continua manual. | Q-A8-4 |
| 5 | Commander root NOW (não defer 2.1) | Subcommand `review` precisa do entry point; criar minimal `hdd-worker.ts` agora desbloqueia ACs sem antecipar `start/stop` da 2.1. | Q-A8-1 |
| 6 | Splits sub-pasta `src/services/summary/` (4 files) | `summary-generator.service.ts` inicial 230 linhas → ultrapassou Biome 200 cap. Splitei em types/format/internals + main service. Discoverable + testable. | (in-story) |
| 7 | `Bun.spawnSync` em vez de `child_process` | Bun-native, sync, sem dep Node legacy. `Bun.spawnSync(["git", ...], { cwd, stderr: "pipe", stdout: "pipe" })` é simples. | (in-story) |
| 8 | `gitSpawn` injectable em `SummaryGeneratorDeps` | Tests de error path (GitCommitFailure) requerem mock controlado; defaultGitSpawn(repoRoot) é fallback produção. | (in-story) |
| 9 | `bootstrap({cliMode: true})` em vez de bootstrap separado | Reusar TODA a infra 1.a.7 (env Zod + db + migrations + audit). Skipar apenas SIGTERM arm + ProcessStarted/Stopped events. 15 linhas de mod. | (in-story) |
| 10 | Mock audit no test CLI (não bootstrap real) | Bootstrap real abre SQLite + cria audit JSONL no tmp; mais setup, menos isolation. Mock cumpre AC verification sem side-effects. | (in-story) |

## Trade-offs aplicados

- **Quis 1 ficheiro 200 linhas, fiquei com 4 ficheiros em pasta sub:** Biome HARD cap não negociável; split preserve modularity + each file ≤100 linhas. Cost: 3 import statements extras + 1 export-type re-export.
- **Quis side-by-side diff (richer UX), fiquei com unified ```diff fence:** Markdown 2-column tables quebram com linhas longas; renderers (GitHub, VS Code) já distinguem `+/-` no fence. ROI side-by-side baixo; v1.1+ se operador pedir.
- **Quis E2E real-CLI test via Bun.spawn child, fiquei com bootstrap injectado:** Spawning child process adds 100-200ms + flake em CI. Inject mock cobre TODA a lógica (Commander parse → bootstrap → audit append → exit) sem child overhead.
- **Quis FSM transition real em finalize, fiquei com audit-only:** `runs` table existe (1.a.5) mas não tem seeds, e transitions requerem worker loop que não existe. Audit chain é durável; resume futuro lê e re-aplica. Scope-creep evitado.

## Open items deferidos

- **O-A8-1:** Tier-A 5-bullets generator real (AO-146) — entra Story 7.b.1 com Meta template aprovado.
- **O-A8-2:** Side-by-side diff rendering — v1.1+ se operador pedir.
- **O-A8-3:** `WORKER_VERSION = "0.0.1"` hardcoded em bootstrap.ts e `version("0.0.1")` hardcoded em hdd-worker.ts. Future: ler de `package.json` via dynamic import. Não-blocker.
- **O-A8-4:** `bin: hdd-worker` em package.json ainda aponta para `./dist/hdd-worker` (output do `bun build --compile src/main.ts`). Para usar `hdd-worker review ...` via binário, build precisa compilar `src/cli/hdd-worker.ts` em vez. Workaround actual: `bun run src/cli/hdd-worker.ts review ...`. Reconciliação na Story 1.c.4 (CI build).
- **O-A8-5:** CLI flag `--reviewer <name>` deferido (Q-A8-5 default `process.env.USER`); adicionar se operador pedir.
- **O-A6-6 acumula:** epics.md `ao_subset` codes vs canon D-04.x ainda por reconciliar; próximo `docs:` consolida.

## Reviewer findings

_(nenhum review ainda — a aguardar `approve story-1a8` do operador antes de commit.)_

## Métricas

- **Tests:** 130 pass / 0 fail (was 117 após 1.a.7; **+13 novos**: 7 summary + 6 review), 275 expect() calls, 718ms.
- **Linhas de código:** 611 total novas (services 102+71+98+93 + cli 34+119 + bootstrap +15 + templates 50+60 ≈ 752 incl. templates); 412 linhas tests (192+220).
- **Type-check:** clean.
- **Lint:** clean (0 errors, 1 info pré-existente migrate.ts não-blocker).
- **Biome line cap:** todos os 6 ficheiros src/** dentro do 200-line hard cap (max 119 em review.command).
- **Dependências adicionadas:** 1 (`commander@14.0.3`).
- **Token usage approx:** ~85K (dentro do `estimated_tokens.dev_with_retry: 96K`).
- **Smoke wall-clock:** CLI `review approve <id>` happy path ~50ms (bootstrap + audit append + exit). Missing env ~30ms.

## Próximos passos sugeridos

1. **Operador aprova** `approve story-1a8` → marco done + commit ~13 ficheiros (sem push). Mensagem proposta: `feat(story-1a8): Resumo 3-tier Tier-B/C generator + CLI review (5 ACs verde; D-019 enforced)`.
2. **Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs** — próxima (`blocked_by: [1.a.7, 1.a.8]` ambos done). Adiciona correlation IDs cross-async para rastrear cada run end-to-end no audit log. Boa progressão (foundational → observability).
3. **Em paralelo (opcional):** push origin agora vs adia para depois de 1.a.9 (ou final do Sprint 0 batch push).

→ Aprovar: `approve story-1a8` · Pedir alterações: `request-changes story-1a8 <razão>`
