# Story 2.4: Gate Story→Dev — AC validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `Worker`,
I want um gate antes de dispatching `bmad-dev-story` que valida AC completos (≥1 Given/When/Then, `files_created` definido, `ao_subset` não vazio) na story spec,
so that o Dev não arranca em story mal-formed (FR-050 part 1).

## Acceptance Criteria

1. **(binary — gate falha em AC vazio)** **Given** uma story com `acceptance_criteria: []` (vazio)
   **When** o gate corre
   **Then** retorna `err({kind:'GateFailure', gate:'Story→Dev', reason:'no AC defined', evidence:<story_id>})`.

2. **(binary — audit FR-051)** **Given** a falha de gate da AC1
   **When** o gate processa a falha
   **Then** um audit event `GateFailed` é registado (domain event `events.ts` — `{kind:'GateFailed', runId, gate, reason, at}`; `GateName='StoryToDev'`).

3. **(binary — diagnostic FR-052)** **Given** a falha de gate
   **When** o gate processa a falha
   **Then** um diagnostic estruturado é escrito em `_bmad-output/diagnostics/<story_id>-gate-fail.md` (path conforme **Q-2.4-3**).

4. **(binary — happy path + validador completo)** **Given** uma story bem-formed (≥1 AC com Given/When/Then, `files_created` não vazio, `ao_subset` não vazio)
   **When** o gate corre
   **Then** retorna `ok` (gate passa) e nenhum diagnostic é escrito. O validador (`story-spec-validator.ts`) rejeita também: `files_created` vazio (`reason:'no files_created'`) e `ao_subset` vazio (`reason:'no ao_subset'`).

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/story-spec-validator.ts` (NEW)** (AC: #1, #4) — `StorySpec{storyId, acceptanceCriteria[], filesCreated[], aoSubset[]}` + `validateStorySpec`. Regras curto-circuito: AC vazio→'no AC defined'; sem `/Given…When…Then/i`→'no Given/When/Then'; `filesCreated` vazio→'no files_created'; `aoSubset` vazio→'no ao_subset'. `hasGivenWhenThen` exportado. Puro/síncrono, sem `throw`. 64 linhas.
- [x] **Task 2 — `src/services/gates/story-to-dev.gate.ts` (NEW)** (AC: #1-#4) — `createStoryToDevGate(deps)`; `check(spec, ctx): ResultAsync<StorySpec, GateFailure>`. Falha → `err({kind:'GateFailure', gate:'Story→Dev', reason, evidence: storyId})` + audit `GateFailed`(`gate:'StoryToDev'`) + diagnostic via `DiagnosticWriter` injectado (best-effort; falha do write não muda o verdict). Sucesso → `ok(spec)`. `DiagnosticWriter` port + `renderDiagnostic`. 110 linhas.
- [x] **Task 3 — `src/core/fsm.ts` (MODIFY — add gate state)** (AC: #1) — Q-2.4-1=(b): estado `gate_blocked` (não-terminal) + evento `GateBlocked`. `running→GateBlocked→gate_blocked`; `gate_blocked→OperatorResponded→running` (re-dispatch) / `Fail→failed`. `ALL_STATES`/`ALL_EVENT_KINDS`/`TRANSITION_TABLE` estendidos; transições existentes intactas (property totalidade 1.a.4 verde, 19 pass).
- [x] **Task 4 — `tests/gates/story-to-dev.test.ts` (NEW)** (AC: #1-#4) — fake `AuditPort` + `DiagnosticWriter` **REAL** (mkdtemp, D-053) + `TestClockAdapter`. AC1 `GateFailure`(reason+evidence); AC2 audit `GateFailed`(`StoryToDev`, runId); AC3 diagnostic escrito+conteúdo; AC4 happy path + 4 casos validador + writer-falha-não-muda-verdict; property `hasGivenWhenThen` (fast-check); 3 testes FSM `gate_blocked`. 12 specs.
- [x] **Task 5 — gates**: type-check clean · lint exit 0 · `bun test` 324 pass / 3 skip / 0 fail (+12) · integração 16 pass / 3 skip.
- [x] **Task 6 (FINAL) — Tier-B summary (17ª dogfood)**: `scripts/generate-24-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-2-4): …` (`7b7662a`, Tier-B **524 words** ≤715). `workflowId: "story-2-4"`. Sprint-status `2-4 → review`.

## Dev Notes

### Big picture

Primeiro dos dois gates do pipeline bimodal (2.4 = Story→Dev, 2.5 = Dev→Review). Impede que o `bmad-dev-story` arranque numa story mal-formed (FR-050 parte 1). O gate consome o validador puro (`story-spec-validator.ts`), emite audit `GateFailed` (FR-051) e materializa um diagnostic inspecionável (FR-052). É a primeira peça de **fail-fast** do worker autónomo.

### Reuso (NÃO reinventar)

- **`events.ts`** (1.a.4): JÁ tem o domain event `GateFailed = {kind, runId, gate: GateName, reason, at}` e `GateName = "StoryToDev" | "DevToReview" | "ReviewToQA"`. **Usar este** para o audit (não inventar). Ver Q-2.4-4 sobre o label `'Story→Dev'` do error vs `'StoryToDev'` do enum.
- **`fsm.ts`** (1.a.4): FSM pura `transition(from, event): Result<{to}, FsmError>`; `ALL_STATES`/`ALL_EVENT_KINDS`/`TRANSITION_TABLE`. Property test de totalidade em `tests/core/fsm.test.ts` — adicionar estado/evento estende a matriz sem quebrar (não mexer nas transições existentes).
- **`confirmation-gate.service.ts`** (1.b.2): **padrão de referência de gate** — factory `createXGate(deps)`, `emit(type, payload)` best-effort via `audit.append`, `Result` síncrono. A 2.4 segue o mesmo padrão (mas tem I/O de diagnostic — ver Q-2.4-3).
- **`AuditPort`** (1.a.6): `append({ts, runId?, storyId?, type, payload})`. **`ClockPort`** (`clock.now()`). **`branded.ts`**: `StoryId`/`RunId` + `mkStoryId`/`mkRunId`.
- Padrões: factory `createXService/Gate(deps)`; `lib` puro; injecção de deps + spies inline; `Result`/`ResultAsync` (neverthrow v8).

### Fronteiras (o que NÃO fazer aqui)

- **Story 2.5 (gate Dev→Review):** valida `bun test`/`bun run lint` verdes + retry counter + `RetryExhausted`. A 2.4 **não** corre testes nem conta retries — só valida a **spec** estática.
- **Story 2.6 (lifecycle FSM):** pause/resume/persistência/recovery. A 2.4 só **adiciona o estado/evento** de gate à tabela — não faz o wiring de transição runtime nem persistência.
- **Parser markdown→StorySpec:** a 2.4 valida um `StorySpec` já estruturado (shape injectável). O parser que lê o ficheiro de story é de outra story — aqui o `StorySpec` é input.
- A 2.4 **não** dispara o `bmad-dev-story` — só decide se ele *pode* arrancar (gate verdict).

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-30)

- **Q-2.4-1 [RESOLVED — (b) estado `gate_blocked` não-terminal]:** adicionar estado `gate_blocked` + evento `GateBlocked` (running→gate_blocked; `OperatorResponded`→gate_blocked→running para re-dispatch após correct-course). Honra "add gate state"; alinha human-in-loop. Não mexer nas transições existentes; estender `ALL_STATES`/`ALL_EVENT_KINDS`/`TRANSITION_TABLE`.
- **Q-2.4-2 [RESOLVED — (a) strings + regex Given/When/Then]:** `StorySpec` mínimo `{storyId, acceptanceCriteria: string[], filesCreated: string[], aoSubset: string[]}`; validador exige `acceptanceCriteria` não vazio **e** ≥1 entry que case `/Given … When … Then/is`. Pragmático, desacoplado, testável; o parser markdown→StorySpec é de outra story (input estruturado aqui).
- **Q-2.4-3 [RESOLVED — (a) injectar `DiagnosticWriter`]:** port/função `write(relPath, contents): ResultAsync<…>` injectada; gate é `ResultAsync`; root `_bmad-output/diagnostics/` configurável. Alinha hexagonal/ports-adapters, testável (fake writer), seguro (sem path hardcoded), autonomia (destino redirecionável).
- **Q-2.4-4 [RESOLVED — (a) error `'Story→Dev'` + audit enum `'StoryToDev'`]:** o error `GateFailure` usa o label legível `'Story→Dev'` (= AC literal); o audit `GateFailed` usa o enum `GateName='StoryToDev'` de `events.ts`. Honra a AC e reutiliza o enum tipado.

### Project Structure Notes

- `files_created`: `src/services/gates/story-to-dev.gate.ts`, `src/lib/story-spec-validator.ts`, `tests/gates/story-to-dev.test.ts` (alinhado epics.md:1345). Cria-se `src/services/gates/` e `tests/gates/` (novos dirs) + `_bmad-output/diagnostics/` (output).
- `files_modified`: `src/core/fsm.ts` (add gate state — Q-2.4-1).
- Biome `maxLines:200` HARD em `src/**` → validador e gate em ficheiros separados.
- `ao_subset`: FR-050, FR-051, FR-052, AR-054.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] (linhas 1336-1357 — StorySpec + ACs)
- [Source: src/core/events.ts] (1.a.4 — GateFailed domain event + GateName enum)
- [Source: src/core/fsm.ts] (1.a.4 — transition + tabela; property totalidade)
- [Source: src/services/confirmation-gate.service.ts] (1.b.2 — padrão de gate: factory + emit audit + Result)
- [Source: src/ports/audit.port.ts] (1.a.6 — AuditEntry) · [Source: src/ports/clock.port.ts] (ClockPort)
- [Source: src/lib/branded.ts] (StoryId/RunId + mkStoryId)
- [Source: tests/core/fsm.test.ts] (invariantes a preservar ao add state)
- Story anterior: `_bmad-output/implementation-artifacts/2-3-...md` (padrão factory + fake audit + mkdtemp)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean.
- `bun run lint` → exit 0 (`organizeImports` auto-fixed; `payload["gate"]` bracket por `noPropertyAccessFromIndexSignature` — info-only).
- `bun test` → 324 pass / 3 skip / 0 fail (era 312; +12). FSM 19 pass (property totalidade estendeu-se ao novo estado sem regressão).
- `bun run test:integration` → 16 pass / 3 skip.

### Completion Notes List

- **AC1:** spec mal-formed → `err({kind:'GateFailure', gate:'Story→Dev', reason, evidence: storyId})`. O validador puro decide o `reason` (4 razões); o gate mapeia-o ao erro com o label legível.
- **AC2 (FR-051):** audit `GateFailed` com `payload.gate='StoryToDev'` (enum `GateName` de `events.ts`) + `runId`/`storyId`. Best-effort (`void append`).
- **AC3 (FR-052):** diagnostic `<storyId>-gate-fail.md` via `DiagnosticWriter` injectado (Q-2.4-3=(a)); testado com writer REAL sobre mkdtemp (D-053). É best-effort — `writer` que falha (`disk full`) **não** muda o verdict (`GateFailure` na mesma).
- **AC4:** spec bem-formed → `ok(spec)`, sem audit/diagnostic. Validador rejeita também `files_created`/`ao_subset` vazios e AC sem Given/When/Then.
- **Q-2.4-1=(b):** FSM ganhou `gate_blocked` (não-terminal) + `GateBlocked`; permite re-dispatch após correct-course (`OperatorResponded→running`). Sem mexer transições existentes.
- **Q-2.4-4=(a):** error `'Story→Dev'` (AC literal) + audit enum `'StoryToDev'` (reuso tipado). Sem divergência.
- **Fronteiras:** sem correr testes/retry (2.5), sem wiring lifecycle/persistência (2.6), sem parser markdown→StorySpec. Sem deps novas.

### File List

- `src/lib/story-spec-validator.ts` (NEW)
- `src/services/gates/story-to-dev.gate.ts` (NEW)
- `src/core/fsm.ts` (MODIFY — add `gate_blocked` state + `GateBlocked` event)
- `tests/gates/story-to-dev.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/2-4-gate-story-dev-ac-validation.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 2-4)
- `scripts/generate-24-summary.ts` (NEW — Task 6, dogfood)
