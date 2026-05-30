És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Continuação directa. Último commit `f80896d` (feat story-2.2). `main` em sync com origin.

## Estado actual (verificável)

- **Sprint 0:** FECHADO 22/22 (Epic 1.a 10/10 · 1.b 5/5 · 1.c 7/7) + retrospetiva done.
- **M1 / Epic 2 (Worker Autónomo & Pipeline Bimodal):** in-progress, **2/7**.
  - 2.1 (hdd-worker CLI scaffold: start/pause·resume-stub/status/logs/review) ✅
  - 2.2 (BMAD invoker port + cli-wrapper `claude -p`, D-052) ✅
  - **2.3 é a próxima em `backlog`** · faltam 2.4/2.5/2.6/2.7.
- **Tests:** 304 pass / 3 skip / 0 fail (`bun test`); `bun run test:integration` = 16 pass / 3 skip
  (skips: docker sandbox + litestream + **bmad-invoker live** gated por `HDD_BMAD_LIVE`).
  type-check clean; `bun run lint` exit 0 (~25 infos `useLiteralKeys`, info-only).
- **CI** (`.github/workflows/ci.yml`): build-and-test (lint/type-check/test/**test:security**/
  **build:compile**/verify-redaction/**runbook-completeness**) + secret-scan + security-suite +
  integration. Verde, `<60s` real (job mais lento ~27s). **`gh run watch` pós-push é hábito** (apanha
  o que a suite local não vê — `[[project-hdd-bun-spawn-ci-gotcha]]`).

## A tua tarefa

Executar **Story 2.3 — Sub-agent context isolation per workflow** pelo método BMAD
canónico (NÃO dev manual). Cada sub-agente (Dev / Review / QA) corre em contexto
isolado: `RunContext` próprio (runId/storyId/traceId) + workdir limitado + audit
dedicado. **ACs de segurança fortes (Pre-Mortem Party Mode #2 AI Safety):** todo
write do Dev passa por `apply-diff.service` (1.b.1) que rejeita path traversal; o
Dev **nunca** escreve directamente no filesystem.

## Workflow obrigatório (idêntico às 16 stories anteriores)

1. **`bmad-create-story`** arg "Story 2.3". Python 3.8 → fallback manual (sem
   overrides team/user; sem `project-context.md`). Escrever story file em
   `_bmad-output/implementation-artifacts/2-3-sub-agent-context-isolation-per-workflow.md`
   com ACs/Tasks/Dev Notes/Open Questions. sprint-status `2-3 → ready-for-dev`.
2. Sumarizar ACs + 3-4 Open Questions via `AskUserQuestion`. O operador costuma
   delegar ("o que recomendas?") MAS já escolheu não-Recommended antes (Q-C2-1) —
   **apresenta sempre as alternativas honestamente.**
3. Marcar Q-2.3-* `[RESOLVED — <choice>]`.
4. **`bmad-dev-story`** + Q's. sprint-status `2-3 → in-progress`; gates
   (`bun run type-check && bun run lint && bun test`) entre tasks.
5. **TASK FINAL — Tier-B summary via generator (16º dogfood):**
   `scripts/generate-23-summary.ts` (pattern de `generate-22-summary.ts`) →
   `gen.finalize(input)` (auto-commit `summary(story-2-3): ...`). Trim Tier-B
   agressivo (últimos: 518-558 words; cap O-A9-5 ≤715). `workflowId: "story-2-3"`.
6. Pedir `approve story-2.3`. Após approve: `2-3 → done`; `git add` específicos
   (deixar `.claude/settings.local.json` FORA); `git commit feat(story-2.3): ...`
   + footer Co-Authored-By (HEREDOC); pedir confirmação p/ `git push origin main`
   (2 commits: summary + feat). **Não toca workflows** → push normal. Após push:
   `gh run watch <id> --exit-status` p/ confirmar CI verde.

## StorySpec canónico (epics.md ~linha 1307 — lê primeiro)

```
### Story 2.3: Sub-agent context isolation per workflow
- blocked_by: [1.a.9, 2.2]                              (done)
- files_created: src/services/sub-agent-runner.service.ts, src/lib/workdir-mount.ts,
  tests/services/sub-agent-runner.test.ts
- files_modified: —
- ao_subset: [FR-004, AR-039, NFR-R3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

ACs:
- AC1 (property): Dev em contexto A, Review em contexto B; ambos audit append no
  mesmo tick → linhas JSONL com `runId` E `subAgent` DISTINTOS.
- AC2 (binary): Dev escreve em workdir A; Review tenta ler workdir A → SÓ via API
  explícita `handoffArtifact(from, to, paths)` (não direct fs access).
- AC3 (binary, AI Safety): Dev retorna diff com `../etc/passwd` ou path absoluto
  fora do workdir → `apply-diff.service` (1.b.1) rejeita com `err({kind:'PathTraversal'})`;
  Dev **nunca** escreve directamente no fs (todo write passa por apply-diff).
```

## Onde ler (NESTA ordem; NÃO releias PRD/epics/arch inteiros)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-3` deve estar
   `backlog`; `epic-2: in-progress`.
2. `_bmad-output/planning-artifacts/epics.md` linhas 1307-1335 (StorySpec 2.3) +
   1382-1413 (Story 2.6 lifecycle — fronteira: a 2.6 faz FSM/pause/resume).
3. **`src/ports/bmad-invoker.port.ts` + `src/adapters/bmad/cli-wrapper.adapter.ts`**
   (2.2 — o sub-agent-runner USA isto): `run(skill, opts)`/`runParsed<T>(skill, schema, opts)`;
   `opts.allowedTools`/`cwd`/`terminal`; `BmadLifecycleHooks` (`onArtifact`/`onComplete`).
4. **`src/lib/run-context.ts`** (1.a.9): `RunContext = {runId, storyId?, traceId?}`;
   `withRunContext(ctx, fn)`, `getRunContext()`, `requireRunContext()`. **NÃO tem
   campo `subAgent`** — ver Q-2.3-1.
5. **`src/services/apply-diff.service.ts`** (1.b.1): `createApplyDiffService(deps)`;
   `sanitizeRelPath`; `err({kind:'PathTraversal', attempted, reason})`. É o que a AC3
   invoca. Lê na íntegra — o Dev sub-agent tem de passar TODOS os writes por aqui.
6. **`src/ports/audit.port.ts`**: `AuditEntry = {ts, runId?, storyId?, type, payload}`.
   **NÃO tem campo `subAgent`** (AC1 quer subAgent distinto) — ver Q-2.3-1.
7. Memórias: `[[project-hdd-d052-claude-headless-invoker]]` (claude -p),
   `[[project-hdd-composition-risks]]` (failure modes de composição — relevante p/ AI Safety ACs),
   `[[project-hdd-d053-integration-testing]]` (real onde possível).

## ⚠️ Decisões de arquitectura a clarificar (Open Questions prováveis)

- **Q-2.3-1 — `subAgent` no audit (AC1):** `AuditEntry`/`RunContext` NÃO têm campo
  `subAgent`. Mas `files_modified: —`. Opções:
  (a) **`subAgent` no payload** de cada evento + `runId` distinto por sub-agente
      (zero churn em audit.port/run-context; AC1 pede "runId E subAgent distintos");
  (b) **adicionar `subAgent` a RunContext + AuditEntry** (toca audit.port.ts +
      run-context.ts → contraria files_modified, mas mais limpo/tipado);
  (c) **runId encoded** (`<run>:dev`/`<run>:review`) — subAgent derivado do runId.
  Pensa: (a) honra files_modified e é mínimo; (b) é mais correcto mas alarga o
  AuditEntry (e os switches?). **Apresenta as alternativas.**
- **Q-2.3-2 — isolamento do workdir (`workdir-mount.ts`):** cada sub-agente tem um
  workdir próprio (`mkdtempSync`?) passado como `cwd` ao `claude -p` (via BmadInvoker
  `opts.cwd`). `handoffArtifact(from, to, paths)` copia ficheiros explicitamente entre
  workdirs (AC2: Review NÃO lê workdir A directo). Decidir: workdir temp efémero por
  sub-agente vs sob `_bmad-output/workdirs/<runId>/<subAgent>`; e o que `handoffArtifact`
  valida (paths relativos, sem traversal — reutiliza `sanitizeRelPath`?).
- **Q-2.3-3 — "Dev nunca escreve directo" (AC3, AI Safety):** como garantir que o
  `claude -p` do Dev não escreve no fs? Opções:
  (a) **allowedTools do Dev SEM Write/Edit** → o Dev só produz o diff no `.result`
      (output-only); o sub-agent-runner aplica via `apply-diff.service` (que valida
      traversal). Least-privilege puro.
  (b) Dev corre em sandbox fs read-only + diff no output. (mais infra)
  Recomendação a pensar: (a) — alinha com o `allowedTools` restrito da 2.2 (Q-2.2-1)
  e força todo write pelo apply-diff. **Apresenta.**
- **Q-2.3-4 — formato do teste:** `tests/services/sub-agent-runner.test.ts` (unit).
  AC1 (property) → fast-check? (dois sub-agentes, audit append concorrente, asserir
  runId/subAgent distintos). AC2/AC3 → fake BmadInvoker (devolve diff com
  `../etc/passwd`) + apply-diff real (rejeita) + fake audit. `claude -p` real NÃO no
  unit (usa fake do invoker). Confirmar property-based (fast-check já é dep) p/ AC1.

## Convenções emergidas (CRÍTICO — não estão nos docs canónicos)

### Stack / config
- **Runtime:** Bun 1.3.14, TS strict + noUncheckedIndexedAccess +
  exactOptionalPropertyTypes + noUnusedLocals/Parameters + noPropertyAccessFromIndexSignature.
- **`process.env`:** bracket `process.env["X"]` ou destructuring.
- **Biome** maxLines:200 HARD em `src/**` (tests/** override) → **um ficheiro por
  unidade**; `useLiteralKeys` info-only (não bloqueia); `noUnusedVariables`/Locals SÃO erro.
- **Lint flow:** `bun run lint:fix` resolve FIXABLE (format/organizeImports). Erros
  eslint reais à mão: **`no-floating-promises`** (`void parseAsync`/await),
  **`no-unsafe-assignment`** (`JSON.parse(x) as T` — cast obrigatório), **`no-unnecessary-type-assertion`**
  (remove `as Result<...>` quando o tipo já é inferido). Imports órfãos pós-edição → remover.
- **Deps:** drizzle-orm, neverthrow v8, fast-check, zod, commander, @anthropic-ai/sdk,
  hono. Sem deps novas esperadas na 2.3.

### Padrões de código
- **`Result<T,E>` síncrono** (`src/lib/result.ts`); `ResultAsync` p/ async; `.andThen`
  com callback que devolve `Result` sync funciona (ver cli-wrapper.adapter). `err`/`ok`/
  `errAsync`/`okAsync`.
- **Ports** `src/ports/*.port.ts`; **adapters** factory `createXAdapter(deps)` em
  `src/adapters/<name>/`; **services** factory `createXService(deps)` em `src/services/`;
  **core** puro (`src/core/`). **SpawnPort** real `system-spawn.adapter.ts` + `fake-spawn.adapter.ts`.
- **Injecção de deps p/ testes:** o padrão é factory com deps `{port?, stdout?, exit?, ...}`
  + spies inline nos testes (ver `tests/cli/commands.test.ts`, `tests/adapters/bmad-invoker.test.ts`).
- **`withRunContext`** isola runId/storyId/traceId via AsyncLocalStorage — base para
  o isolamento de sub-agente desta story.

### Testes / D-053
- **Mock/fake por defeito** em `bun test`; **integração real** em
  `tests/integration/*.integration.test.ts` com `describe.skipIf(!hasX)`. `claude -p`
  real é **opt-in** (`HDD_BMAD_LIVE=1`) — NÃO no unit (usa fake do BmadInvoker).
- **fast-check** disponível p/ property tests (AC1 é "property AC").
- `:memory:` SQLite + `applyMigrations(db, "src/db/migrations")` nos testes de DB;
  `mkdtempSync` p/ workdirs/fs reais.

### Gotchas de tooling (memórias)
- **`[[project-hdd-bun-spawn-ci-gotcha]]`:** scripts Bun que fazem spawn de "bun" ou
  usam paths hardcoded partem no runner GH Actions → `process.execPath` +
  `dirname(import.meta.dir)`. **`gh run watch <id> --exit-status` pós-push** apanha o
  que a suite local não vê.
- **`[[project-hdd-git-workflow-scope]]`:** push de `.github/workflows/*` exige scope
  `workflow` (já refrescado; persiste). **2.3 NÃO toca workflows** → push normal.
- **`[[feedback-write-tool-control-chars]]`:** não escrever bytes de control no Write.
- **Hook context-mode bloqueia curl/wget/fetch inline no Bash** — usa testes (Bun.serve/
  fetch) ou logs, não curl. (claude NÃO é bloqueado.)

### D-019 (2 commits por story)
1. `summary(story-X): ...` — auto-commit pelo `gen.finalize()` via
   `scripts/generate-XYZ-summary.ts` ANTES do approve. **15 dogfoods feitos**
   (1a9,1a10,1b1-5,1c1-6,2.1,2.2); 2.3 = 16º. `SummaryInput` em
   `src/services/summary/types.ts`. O generator faz `git add <summaryPath>` específico.
2. `feat(story-X): ...` — operator approval; `git add` ESPECÍFICOS (não `-A`).
   Deixar `.claude/settings.local.json` FORA.

## Princípios não-negociáveis
- **Single-story-at-a-time** (não adiantar 2.4+). Respeitar fronteiras: **2.6** faz FSM
  pause/resume + state-transition (o `onComplete` da 2.2 liga aí; aqui só isola contexto);
  **2.7** faz os schemas concretos DevOutput/ReviewOutput/QAOutput (a 2.3 usa o
  `runParsed` genérico com schema injectável/base).
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`).
- **NÃO inventes versões/paths/comandos** — descobre via execução real / leitura.
- **Confirma com operador antes de:** (a) Q-2.3-* (apresenta alternativas, ele pode
  escolher não-Recommended); (b) push (commit OK após approve; push exige confirm).
- **Revisão humana obrigatória** (`[[feedback-hdd-mandatory-review]]`) — nunca auto-aprovar.
- **D-053:** real onde possível (apply-diff real no teste; fs real com mkdtemp), fake o
  resto (BmadInvoker fake — não invocar claude -p no unit).
- **AI Safety (Pre-Mortem #2):** a AC3 é WIRING ENFORCEMENT — o Dev sub-agent **nunca**
  escreve directo; todo write passa por `apply-diff.service`. É o ponto mais crítico da story.

## Outputs esperados
1. Story file `2-3-...md` (committable).
2. `src/services/sub-agent-runner.service.ts` (NEW — orquestra sub-agentes Dev/Review/QA
   com RunContext + workdir + BmadInvoker; wiring apply-diff).
3. `src/lib/workdir-mount.ts` (NEW — isolamento de workdir + `handoffArtifact`).
4. `tests/services/sub-agent-runner.test.ts` (NEW — AC1 property, AC2/AC3 fake invoker
   + apply-diff real).
5. (provável, fora de files_created — confirmar como na 1.c.4/2.1) eventual ajuste ao
   payload de audit p/ `subAgent` (Q-2.3-1=a → sem tocar tipos).
6. `scripts/generate-23-summary.ts` + `story-2-3-summary.md` (auto-commit).
7. sprint-status `2-3 → done`; commit `feat` + push; CI verde verificado.

## Open Items abertos do projecto (contexto, não-bloqueantes)
- **readiness-open-items.md** (registo único c/ TTL — AI-S0-3): O-B5-3 (schema clihelper
  webhook-mock), O-C2-1 (wire CLIHELPER_TOKEN, Epic 3), O-C4-2/3 (license-checker no
  release.yml; Renovate App), O-C5-1/2 (sshd real; polkit), O-C6-1 ([quando implementado]
  WhatsApp/clihelper), **O-2.2-1** (integração claude -p live só com HDD_BMAD_LIVE;
  considerar job CI live), **O-2.2-2** (allowedTools por skill — afinar na 2.3: Dev precisa
  output-only sem Write; review só Read). **Divergências spec-vs-realidade Epic 2** também aí.
- **AI-S0-4** (reconciliar epics.md): a 2.3 — verificar `files_created` vs realidade no
  create-story (padrão: hdd-worker.ts era MODIFY na 2.1; confirmar caso a caso).

## Plano de comunicação
- Antes de `bmad-create-story`: confirma estado (último commit `f80896d`, branch sync,
  Sprint 0 fechado, Epic 2 2/7, 2-3 backlog) em 2-3 linhas.
- Após o story file: ACs + Open Questions via `AskUserQuestion`.
- Após dev-story: Resumo inline + summary auto-commit + pedido `approve story-2.3`.
- Após approve: confirmar antes de commit; confirmar antes de push; verificar CI.

Começa.
