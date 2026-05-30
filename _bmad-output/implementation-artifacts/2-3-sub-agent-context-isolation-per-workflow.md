# Story 2.3: Sub-agent context isolation per workflow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `worker core`,
I want que cada sub-agente (Dev / Review / QA) corra em contexto isolado com o seu próprio `RunContext` (runId, storyId, traceId) + workdir limitado + audit dedicado, e que **todo** write do Dev passe por `apply-diff.service` (1.b.1),
so that artefactos cruzados entre sub-agentes não contaminam state e o Dev nunca escreve directamente no filesystem (FR-004, AR-039, NFR-R3 + AI Safety Pre-Mortem #2).

## Acceptance Criteria

1. **(property — isolamento de contexto)** **Given** sub-agent Dev corre em contexto A; sub-agent Review corre em contexto B
   **When** ambos fazem audit `append` no mesmo tick
   **Then** as linhas JSONL têm `runId` **e** `subAgent` distintos. (Property AC — verificada com `fast-check`: para quaisquer dois sub-agentes concorrentes, os pares `(runId, subAgent)` nunca colidem.)

2. **(binary — handoff explícito)** **Given** sub-agent Dev escreve em `workdir A`
   **When** sub-agent Review precisa de ler ficheiros de `workdir A`
   **Then** o acesso só acontece via API explícita `handoffArtifact(from, to, paths)` (copia os `paths` validados de A para B) — Review **não** lê `workdir A` por fs access directo. Paths fora do boundary (`../`, absolutos) → `err({kind:'PathTraversal'})`.

3. **(binary, AI Safety — wiring enforcement)** **Given** o Dev sub-agent devolve um diff com path `../etc/passwd` ou path absoluto fora do workdir
   **When** o sub-agent-runner aplica o diff
   **Then** o write é encaminhado por `apply-diff.service` (1.b.1), que rejeita com `err({kind:'PathTraversal'})`.
   **And** o Dev sub-agent **nunca** escreve directamente no filesystem — corre output-only (`allowedTools` sem `Write`/`Edit`) e **todo** write passa por `apply-diff.service`. (Binary AC — **Pre-Mortem Party Mode #2 AI Safety**, `[[project-hdd-composition-risks]]`.)

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/workdir-mount.ts` (NEW)** (AC: #2) — isolamento de workdir por sub-agente + `handoffArtifact`. `createWorkdir(role)` cria `mkdtempSync` sob `os.tmpdir()`; devolve `WorkdirHandle{role, path}` (path usado como `opts.cwd` do BmadInvoker). `handoffArtifact(from, to, paths)` valida cada path com `sanitizeRelPath` (reuso de 1.b.1) contra AMBOS os boundaries (origem + destino), copia para `to`, e rejeita traversal/absoluto com `err({kind:'PathTraversal'})`. `cleanupWorkdir` para higiene. 84 linhas (≤200 Biome HARD).
- [x] **Task 2 — `src/services/sub-agent-runner.service.ts` (NEW)** (AC: #1, #3) — `createSubAgentRunner(deps)` factory. `runDev`/`runReadOnly` correm dentro de `withRunContext(ctx, …)` com `runId`/`storyId`/`traceId` próprios + workdir próprio (Task 1) passado como `opts.cwd`. **AC3 (crítico):** Dev output-only (`DEV_ALLOWED_TOOLS = [Read, Grep, Glob]` — SEM `Write`/`Edit`, Q-2.3-3); o runner parseia o diff via `runParsed`(devOutputSchema base) e aplica **exclusivamente** via `apply-diff.service` bound ao workdir do Dev — nunca escreve no fs directamente. `subAgent` propagado ao audit (Q-2.3-1). 148 linhas.
- [x] **Task 3 — propagação de `subAgent` ao audit (AC: #1)** — Q-2.3-1=(a): `emitStarted` emite `type:"SubAgentStarted"` com `runId` explícito (distinto por sub-agente) + `payload:{subAgent}`. **Zero alteração** a `audit.port.ts`/`run-context.ts` → honra `files_modified: —`.
- [x] **Task 4 — `tests/services/sub-agent-runner.test.ts` (NEW)** (AC: #1, #2, #3) — **AC1 (property, `fast-check`):** dois sub-agentes concorrentes (`Promise.all`, `fc.uuid` runIds, 25 runs) → `runId` E `subAgent` distintos por linha, sem colisão. **AC2:** `handoffArtifact` copia paths válidos entre workdirs reais (`mkdtempSync`); `../`/absoluto → `PathTraversal`; Review sem handoff não vê ficheiros de A. **AC3:** fake `BmadInvokerPort` devolve diff com `../etc/passwd` → runner encaminha por `apply-diff.service` **real** → `PathTraversal` + audit `SecurityViolation`; asserir Dev `allowedTools` sem `Write`/`Edit` + diff válido escrito dentro do workdir. `claude -p` real **NÃO** no unit (fake do invoker — D-053). 8 specs.
- [x] **Task 5 — gates**: `bun run type-check` (clean) · `bun run lint` (exit 0) · `bun test` (312 pass / 3 skip / 0 fail; +8) · `bun run test:integration` (16 pass / 3 skip).
- [x] **Task 6 (FINAL) — Tier-B summary (16ª dogfood)**: `scripts/generate-23-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-2-3): …` (`b58197d`, Tier-B **504 words** ≤715). `workflowId: "story-2-3"`. Sprint-status `2-3 → review`.

## Dev Notes

### Big picture

A 2.2 entregou a **ponte** worker→BMAD (`BmadInvokerPort` via `claude -p`). A 2.3 dá-lhe **isolamento**: cada sub-agente (Dev / Review / QA) corre numa "célula" própria — `RunContext` (correlation IDs), workdir limitado, audit discriminado por `subAgent` — para que o output de um não contamine o state de outro. O ponto mais crítico **não** é o isolamento em si, é o **wiring de segurança da AC3**: o Dev é output-only e todo write passa por `apply-diff.service`, que já rejeita path traversal (1.b.1). É enforcement de composição (Pre-Mortem #2 AI Safety).

### Reuso (NÃO reinventar)

- **`BmadInvokerPort`** (`src/ports/bmad-invoker.port.ts`, 2.2): `run(skill, opts)` / `runParsed<T>(skill, schema, opts)`. `opts.allowedTools` (least-privilege), `opts.cwd` (← workdir isolado), `opts.terminal`. Fake nos testes (ver `tests/adapters/bmad-invoker.test.ts`, `spySpawn`).
- **`run-context.ts`** (1.a.9): `withRunContext(ctx, fn)`, `getRunContext()`, `requireRunContext()` via AsyncLocalStorage. `storage.run` cria frame isolado → 2 sub-agentes concorrentes (`Promise.all`) preservam contexto independente (provado na 1.a.9 AC-2). **`RunContext` NÃO tem campo `subAgent`** — ver Q-2.3-1.
- **`apply-diff.service.ts`** (1.b.1): `createApplyDiffService({workspaceRoot, audit, clock})` → `applyWrite(relPath, contents): ResultAsync<{path}, ApplyDiffError>`. Pipeline: `sanitizeRelPath` (lexical) → realpath anti-symlink → write atómico serializado. Rejeição → `err({kind:'PathTraversal', attempted, reason})` + audit `SecurityViolation`. **É o que a AC3 invoca — o Dev sub-agent passa TODOS os writes por aqui.**
- **`path-sanitize.ts`** (1.b.1): `sanitizeRelPath(root, candidate): Result<string, PathTraversalError>` — puro/síncrono, sem I/O. **`handoffArtifact` reutiliza isto** para validar paths antes de copiar.
- **`audit.port.ts`** (1.a.6): `AuditEntry = {ts, runId?, storyId?, type, payload}`. `runId`/`storyId` opcionais lidos de `getRunContext()` quando ausentes. **NÃO tem campo `subAgent`** — ver Q-2.3-1.
- Padrões: factory `createXService(deps)` em `src/services/`; `lib` puro em `src/lib/`; injecção de deps + spies inline nos testes; `Result` sync / `ResultAsync` async (neverthrow v8).

### ⚠️ AC3 é o núcleo (AI Safety — Pre-Mortem #2)

O Dev sub-agent é **output-only**: `allowedTools` SEM `Write`/`Edit` (alinha com o least-privilege da 2.2, Q-2.2-1 / O-2.2-2). O `claude -p` do Dev produz o diff no `.result`; o sub-agent-runner extrai e aplica **exclusivamente** via `apply-diff.service`. Assim, um diff malicioso (`../etc/passwd`, absoluto, symlink) é rejeitado pela gate de 1.b.1 — não há caminho de escrita que contorne a gate. `[[project-hdd-composition-risks]]`: o failure mode perigoso é a composição (Dev podia escrever directo se tivesse `Write`) → o enforcement é negar a tool **e** centralizar o write.

### Fronteiras (o que NÃO fazer aqui)

- **Story 2.6 (lifecycle FSM):** pause/resume, persistência de state, recovery boot. A 2.3 **só isola contexto** — não transita FSM nem persiste lifecycle. O `onComplete` da 2.2 liga à FSM **na 2.6**, não aqui.
- **Story 2.7 (schemas concretos):** `DevOutput`/`ReviewOutput`/`QAOutput` Zod. A 2.3 usa o `runParsed` genérico com schema injectável/base — **não** define os schemas concretos.
- **Story 2.4/2.5 (gates Story→Dev / Dev→Review):** validação de AC / test-suite verde. Fora de escopo.
- A 2.3 **não** orquestra o pipeline bimodal completo nem a FSM — entrega a primitiva de isolamento que essas stories consomem.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-30)

- **Q-2.3-1 [RESOLVED — (a) subAgent no payload + runId distinto]:** o discriminador `subAgent` (`'dev'|'review'|'qa'`) entra no **payload** de cada audit event + `runId` distinto por sub-agente. Zero churn em `audit.port.ts`/`run-context.ts` → honra `files_modified: —`; AC1 satisfeito.
- **Q-2.3-2 [RESOLVED — (a) temp efémero `mkdtempSync`]:** cada sub-agente recebe um workdir temporário auto-limpo (`mkdtempSync` sob `os.tmpdir()`). Mais higiénico/seguro; nada persiste entre runs (evita soft convention rot).
- **Q-2.3-3 [RESOLVED — (a) allowedTools sem Write/Edit, output-only]:** o Dev corre output-only (`allowedTools` SEM `Write`/`Edit`); produz só o diff no `.result`; o runner aplica **exclusivamente** via `apply-diff.service` (valida traversal). Least-privilege puro, alinha com 2.2 (Q-2.2-1 / O-2.2-2).
- **Q-2.3-4 [RESOLVED — (a) property-based `fast-check`]:** AC1 testada com `fast-check` (já é dep) — dois sub-agentes concorrentes, audit append em `Promise.all`, asserir que os pares `(runId, subAgent)` nunca colidem. AC2/AC3 com fake invoker + apply-diff real.

### Project Structure Notes

- `files_created`: `src/services/sub-agent-runner.service.ts`, `src/lib/workdir-mount.ts`, `tests/services/sub-agent-runner.test.ts` (alinhado com epics.md:1316).
- `files_modified: —` — desde que Q-2.3-1=(a). Se (b), tocaria `audit.port.ts`+`run-context.ts` (divergência a registar em `readiness-open-items.md` / `AI-S0-4`).
- Biome `maxLines:200` HARD em `src/**` → um ficheiro por unidade (Task 1 e Task 2 separados). `tests/**` tem override (sem cap).
- `ao_subset`: FR-004, AR-039, NFR-R3.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3] (linhas 1307-1334 — StorySpec + ACs)
- [Source: src/ports/bmad-invoker.port.ts] (2.2 — run/runParsed, allowedTools/cwd/terminal, hooks)
- [Source: src/adapters/bmad/cli-wrapper.adapter.ts] (2.2 — spawn claude -p; buildArgs com allowedTools)
- [Source: src/lib/run-context.ts] (1.a.9 — withRunContext/getRunContext; sem subAgent)
- [Source: src/services/apply-diff.service.ts] (1.b.1 — applyWrite; PathTraversal; audit SecurityViolation)
- [Source: src/lib/path-sanitize.ts] (1.b.1 — sanitizeRelPath, reuso em handoffArtifact)
- [Source: src/ports/audit.port.ts] (1.a.6 — AuditEntry; sem subAgent)
- [Source: tests/services/apply-diff.security.test.ts] (fake AuditPort em-memória; mkdtempSync)
- [Source: tests/adapters/bmad-invoker.test.ts] (fake SpawnPort / invoker; streamJson)
- Memórias: `[[project-hdd-d052-claude-headless-invoker]]`, `[[project-hdd-composition-risks]]`, `[[project-hdd-d053-integration-testing]]`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean.
- `bun run lint` → exit 0 (`organizeImports` auto-fixed; `useLiteralKeys` em `payload["subAgent"]` mantido em bracket por `noPropertyAccessFromIndexSignature` — info-only, não bloqueia).
- `bun test` → 312 pass / 3 skip / 0 fail (era 304; +8 specs da 2.3).
- `bun run test:integration` → 16 pass / 3 skip (sem novos; `claude -p` real fica gated por `HDD_BMAD_LIVE`).

### Completion Notes List

- **AC1 (property):** `emitStarted` emite `SubAgentStarted` com `runId` explícito (distinto) + `payload.subAgent`. Property test (`fast-check`, 25 runs, `fc.uuid`) confirma que dois sub-agentes concorrentes nunca colidem em `(runId, subAgent)`. `withRunContext` isola o frame de cada um (AsyncLocalStorage, 1.a.9); apply-diff aninhado herda o `runId` do contexto.
- **AC2 (handoff):** `handoffArtifact` é o único canal entre workdirs — valida cada path com `sanitizeRelPath` contra origem **e** destino antes de qualquer I/O; `../`/absoluto → `PathTraversal`. Teste confirma que B não vê o ficheiro de A sem handoff explícito.
- **AC3 (AI Safety, Pre-Mortem #2):** Dev corre output-only (`allowedTools` sem `Write`/`Edit`); o diff do `.result` é aplicado **exclusivamente** via `apply-diff.service` bound ao workdir do Dev. Diff malicioso (`../etc/passwd`, absoluto) → `PathTraversal` + audit `SecurityViolation`. Não há caminho de escrita que contorne a gate de 1.b.1.
- **Q-2.3-1=(a):** `subAgent` no payload + `runId` distinto → **zero churn** em `audit.port.ts`/`run-context.ts`; honra `files_modified: —` do StorySpec. Sem divergência a registar em AI-S0-4.
- **Fronteiras respeitadas:** sem FSM/pause-resume (2.6), sem schemas concretos DevOutput/ReviewOutput/QAOutput (2.7 — usa-se `devOutputSchema` base injectável). Sem deps novas.

### File List

- `src/lib/workdir-mount.ts` (NEW)
- `src/services/sub-agent-runner.service.ts` (NEW)
- `tests/services/sub-agent-runner.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/2-3-sub-agent-context-isolation-per-workflow.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 2-3)
- `scripts/generate-23-summary.ts` (NEW — Task 6, dogfood)
