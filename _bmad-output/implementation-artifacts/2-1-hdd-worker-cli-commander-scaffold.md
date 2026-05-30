# Story 2.1: hdd-worker CLI Commander scaffold

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want o CLI `hdd-worker` (Commander) com subcomandos `start <project>`, `pause`, `resume`, `status`, `logs`, `review approve|request-changes|reject`,
so that opero o worker via terminal sem invocar TypeScript directamente (FR-031, NFR-U4, NFR-O1).

## Acceptance Criteria

1. **(binary — help completo)** **Given** o binário compilado
   **When** corro `hdd-worker --help`
   **Then** lista os 6 subcomandos (`start`, `pause`, `resume`, `status`, `logs`, `review`) com `--help` claro (NFR-U4).

2. **(binary — status ≤2s)** **Given** o worker corrido com `hdd-worker start projeto_hdd` (ou DB de estado existente)
   **When** corro `hdd-worker status` noutro terminal
   **Then** retorna o estado em ≤2s (NFR-O1) — estado FSM da última run + agregado de stories; DB fresca → "idle / sem runs".

## Tasks / Subtasks

- [x] **Task 1 — `src/cli/boot-error.format.ts` (NEW)** (AC: #2) — extrair `formatBootError(e: BootError): string` (switch exaustivo dos 5 kinds) para um módulo único; `hdd-worker.ts` e `main.ts` passam a importar (Q-2.1-3 consolidar). Gate.
- [x] **Task 2 — `src/cli/start.command.ts` (NEW)** (AC: #1) — extrair `registerStartCommand` (hoje inline em hdd-worker.ts) + `DEFAULT_PORT`; +argumento posicional opcional `[project]` (default `projeto_hdd`, forward-compatível — `bootstrap()` ainda usa projeto fixo); deps injectáveis `{bootstrap?, serve?, clock?, stdout?, stderr?, exit?, bootEpochMs?}` (`serve`=Bun.serve para testar sem socket). Preservar boot daemon + `/healthz`. Gate.
- [x] **Task 3 — `src/services/worker-status.service.ts` (NEW)** (AC: #2) — `readWorkerStatus(db): Result<WorkerStatusSnapshot, StatusError>` (Q-2.1-2 = DB). Lê última run (`runs` order by startedAt desc limit 1) + agrega `stories` por status. Snapshot discriminado `{kind:"no-runs"} | {kind:"run", run, stories:{total, byStatus}}`. `StatusError={kind:"QueryFailure",cause}`. Síncrono, neverthrow. **1ª leitura DB do projeto.** Gate (teste `:memory:`).
- [x] **Task 4 — `src/cli/status.command.ts` (NEW)** (AC: #2) — `registerStatusCommand(program, deps)`: `bootstrap({cliMode:true})` → `readWorkerStatus(db)` → `db.close()` → output legível → exit 0/1; `formatBootError` em erro de boot. Gate.
- [x] **Task 5 — `src/cli/logs.command.ts` (NEW)** (AC: #1) — `registerLogsCommand(program, deps)`: lê o JSONL directamente (AuditPort não tem leitura) com a convenção do adapter `join(baseDir, project, <date>.jsonl)` (defaults `HDD_AUDIT_DIR`/`HDD_PROJECT`); `--tail <n>` (default 20), `--date`; ENOENT → "sem eventos" + exit 0; resumo `<ts> <type> [<runId>]` com fallback à linha crua. NÃO abre DB. Gate.
- [x] **Task 6 — `src/cli/hdd-worker.ts` (MODIFY)** (AC: #1) — remover `start`/`formatBootError`/`DEFAULT_PORT` inline; importar e registar os 6 na ordem do help: `start, pause(stub), resume(stub), status, logs, review`. Helper local `registerStubCommand` (pause/resume → stderr "diferido p/ Story 2.6" + exit 1; o `--help` não invoca action → AC1 intacto). Gate.
- [x] **Task 7 — `src/main.ts` + `package.json` (MODIFY)** (AC: #1) — main.ts delega `void createCli().parseAsync(process.argv)` (Q-2.1-1 unificar, fecha O-C1-1); `package.json` `dev` → `bun --hot src/cli/hdd-worker.ts`, `module` → `src/cli/hdd-worker.ts`; `build`/`bin` inalterados. Gate.
- [x] **Task 8 — `tests/cli/commands.test.ts` (NEW)** (AC: #1, #2) — padrão `buildDeps()` + `parseAsync`: AC1 (`--help` lista os 6); status no-runs / run (`:memory:` + migrations reais + insert) / QueryFailure; logs (tail / date / ENOENT); start (serve mock capta porta 8080 + `--port`; `[project]` default/override); stubs (exit 1); guarda AC2 (`readWorkerStatus(memoryDb)` < 2000ms). `tests/cli/review.test.ts` intacto. Gate.
- [x] **Task 9 — gates finais + smoke**: type-check clean · lint exit 0 · `bun test` (sem regressão +novos) · `bun run test:integration` · `bun run build` → `dist/hdd-worker --help` lista 6 + `dist/hdd-worker status` corre read-only (AC2 smoke). Biome maxLines 200; JSDoc (âmbito 2.1 + fronteira 2.6).
- [x] **Task 10 (FINAL) — Tier-B summary via generator (14ª dogfood)**: `scripts/generate-21-summary.ts` → `finalize` auto-commit `summary(story-2.1): ...`. Sprint-status `2-1 → review`.

## Dev Notes

### Big picture

1ª story do M1 (Epic 2). Dá a **casca de operação** do worker: `hdd-worker <cmd>` com `--help` e `status` real. `start`+`review` já existem (Sprint 0); esta story acrescenta `status`+`logs`, extrai `start` para ficheiro próprio, unifica o entry-point, e cria **stubs** de `pause`/`resume` (lógica real = Story 2.6).

### Fronteira com a Story 2.6 (CRÍTICO — não ultrapassar)

- **2.1 (esta):** scaffold + `status` (LÊ a DB) + `logs` (tail audit). pause/resume = **stubs** no `--help`.
- **2.6:** cria `pause.command.ts`/`resume.command.ts` + `worker-lifecycle.service.ts` (transições FSM `running→paused_for_interrupt`, persistência, confirmation gate). **NÃO** implementar aqui; **NÃO** transitar FSM nem persistir estado nesta story.

### Estado actual (mapeado)

- `src/cli/hdd-worker.ts`: `createCli()` regista `review`+`start`; `start` é `[--port]` inline; `formatBootError` switch (5 kinds); `DEFAULT_PORT`; guard `import.meta.main`.
- `src/cli/review.command.ts`: **template** — `registerXCommand(program, deps={})`, deps `{bootstrap?, now?, stdout?, stderr?, exit?}`, `bootstrap({cliMode:true})`, usa `audit`/`db`, `db.close()`, exit.
- `src/db/schema.ts`: `runs` (run_id, status=6 estados FSM lowercase, startedAt, endedAt, pausedTrigger, llmTokensTotal) + `stories` (story_id, run_id, status UPPERCASE, currentPhase, retryCount; índice `idx_stories_run`). **Sem leitura DB ainda** — esta story é a 1ª.
- `src/cli/healthz.handler.ts`: `/healthz` só `{status,uptime}` (não FSM) → status NÃO usa /healthz (Q-2.1-2).
- audit JSONL: `_bmad-output/audit/<project>/<date>.jsonl`, 1 evento/linha; AuditPort só `append`/`verifyChain` (sem leitura) → `logs` lê o ficheiro directamente.
- `src/main.ts`: legacy (bootstrap + "started", sem /healthz/CLI). `build` JÁ compila `hdd-worker.ts` (correcto); `dev`/`module` é que apontam para main.ts (O-C1-1).

### Decisões (Open Questions resolvidas)

- **Q-2.1-1 [RESOLVED — unificar entry]:** main.ts delega para `createCli()`; dev/module → CLI. Fecha O-C1-1. `bun src/main.ts` sem args → `--help` (correcto para CLI).
- **Q-2.1-2 [RESOLVED — status lê DB]:** runs/stories via `worker-status.service.ts`; sem check /healthz. Funciona com worker parado; DB fresca → "idle / sem runs".
- **Q-2.1-3 [RESOLVED — consolidar formatBootError]:** módulo `src/cli/boot-error.format.ts` (ficheiro extra fora do files_created literal; remove duplicação hdd-worker+main+status).
- **Menores:** stubs pause/resume → stderr + exit 1; logs → resumo com fallback cru.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** criar pause/resume reais nem worker-lifecycle.service (Story 2.6).
- ❌ **NÃO** transitar FSM nem escrever na DB (esta story só lê).
- ❌ **NÃO** duplicar `formatBootError` (consolidar no módulo).
- ❌ **NÃO** quebrar `start` daemon + /healthz ao extrair para ficheiro.
- ❌ **NÃO** deixar `rows[0]`/`lines[i]` sem guard (`noUncheckedIndexedAccess`).
- ❌ **NÃO** floating promises (`void parseAsync`; actions async com await).

### Project Structure Notes

- NEW: `src/cli/boot-error.format.ts`, `src/cli/start.command.ts`, `src/cli/status.command.ts`, `src/cli/logs.command.ts`, `src/services/worker-status.service.ts`, `tests/cli/commands.test.ts`, `scripts/generate-21-summary.ts`.
- MODIFY: `src/cli/hdd-worker.ts`, `src/main.ts`, `package.json` (dev/module), `_bmad-output/implementation-artifacts/sprint-status.yaml`.
- **Divergência spec (AI-S0-4, registada):** StorySpec lista `hdd-worker.ts` em files_created → é **MODIFY**; `start.command.ts` é extração do inline. `boot-error.format.ts` é ficheiro extra (refactor Q-2.1-3).

### References

- [Source: epics.md#Story-2.1] (1250-1272) — StorySpec, ACs, blocked_by [1.a.7, 1.a.8, 1.c.7] (done).
- [Source: epics.md#Story-2.6] (1382-1413) — fronteira lifecycle.
- [Source: src/cli/review.command.ts] — template. [Source: src/db/schema.ts] — runs/stories. [Source: readiness-open-items.md] — O-C1-1 + divergências 2.x.

## Open Questions for Operator

- **Q-2.1-1 (main.ts / O-C1-1):** [RESOLVED — unificar entry (main.ts delega; dev/module → CLI)].
- **Q-2.1-2 (status data-source):** [RESOLVED — DB runs/stories via service; sem /healthz].
- **Q-2.1-3 (formatBootError):** [RESOLVED — consolidar em src/cli/boot-error.format.ts].
- **Q-2.1-4 (menores):** [RESOLVED — stubs exit 1; logs resumo+fallback].

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- type-check clean em todas as fases.
- lint: 2 ciclos de FIXABLE (organizeImports/formatter) → `lint:fix`; 4 erros eslint reais no teste (2 casts desnecessários `as Result<...>` + 2 floating promises `parseAsync`) → `void` + remoção de casts + remoção de imports órfãos (StatusError/WorkerStatusSnapshot). `useLiteralKeys` em logs.command (`process.env["X"]`) são info-only (bracket exigido por noPropertyAccessFromIndexSignature).
- `bun test`: 296 pass / 2 skip / 0 fail (era 285; +11 commands.test). Integration 16 pass / 2 skip.
- **Smoke do binário** (`bun run build`): `dist/hdd-worker --help` lista os 6 (AC1); `ANTHROPIC_API_KEY=… CLIHELPER_TOKEN=… dist/hdd-worker status` → "worker: idle (sem runs registadas)" rc=0 (AC2); `logs --date 2099-01-01` → "sem eventos" rc=0. `.hdd-state.db` de smoke limpo.
- AC2 ≤2s: guarda `readWorkerStatus(memoryDb)` com 50 stories < 2000ms (real).

### Completion Notes List

- **FR-031/NFR-U4/NFR-O1 materializados:** CLI com 6 subcomandos + `--help` claro + `status` que lê o estado real da DB em ≤2s.
- **Q-2.1-1 (unificar entry):** `main.ts` delega para `createCli()`; `dev`/`module` → `src/cli/hdd-worker.ts`. **Fecha O-C1-1.** `build`/`bin` já estavam certos (compilam hdd-worker.ts — confirmado).
- **Q-2.1-2 (status=DB):** novo `worker-status.service.ts` (1ª leitura DB do projeto) — última run + agregado de stories; DB fresca → "idle / sem runs". Sem /healthz.
- **Q-2.1-3 (formatBootError):** consolidado em `boot-error.format.ts`; hdd-worker.ts e main.ts importam (removida a tripla duplicação).
- **Fronteira 2.6 respeitada:** pause/resume são stubs (`--help` + stderr "diferido p/ Story 2.6" + exit 1); zero lógica FSM/persistência nesta story.
- **Achados de implementação:** seq não relevante aqui; o JSONL usa snake_case (`run_id`) — `logs` formata a partir disso. `start` extraído com `serve`/`clock` injectáveis (testável sem socket).
- Sem deps novas. Divergência spec (hdd-worker.ts MODIFY; start inline → ficheiro; boot-error.format.ts extra) registada em readiness-open-items.md (AI-S0-4).

### File List

- `src/cli/boot-error.format.ts` (NEW — formatBootError consolidado)
- `src/cli/start.command.ts` (NEW — extraído + [project] + deps injectáveis)
- `src/cli/status.command.ts` (NEW)
- `src/cli/logs.command.ts` (NEW)
- `src/services/worker-status.service.ts` (NEW — 1ª leitura DB)
- `src/cli/hdd-worker.ts` (MODIFY — regista os 6 + registerStubCommand; remove inline)
- `src/main.ts` (MODIFY — delega para createCli; fecha O-C1-1)
- `package.json` (MODIFY — dev/module → hdd-worker.ts)
- `tests/cli/commands.test.ts` (NEW — 11 specs)
- `scripts/generate-21-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/2-1-...md` (NEW — story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-30 | Story 2.1 criada (`ready-for-dev`) pós-plano aprovado; 4 Q's pré-resolvidas (unificar entry/O-C1-1, status=DB, consolidar formatBootError, menores). Fronteira 2.6 demarcada (pause/resume stubs). |
