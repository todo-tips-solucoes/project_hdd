# Story 2.5: Gate Dev→Review — test suite verde

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `Worker`,
I want um gate após `bmad-dev-story` que valida (a) `bun test` exit 0 (b) `bun run lint` exit 0 (c) `files_created` correspondem ao declarado,
so that Review não recebe diff broken nem code com lint errors (FR-050 part 2).

## Acceptance Criteria

1. **(binary — tests red)** **Given** o Dev completou a story
   **When** o gate corre `bun test` que falha (exit ≠ 0)
   **Then** retorna `err({kind:'GateFailure', gate:'Dev→Review', reason:'tests red'})` **+** audit `GateFailed` (FR-051) **+** diagnostic (FR-052) **+** retry counter incrementado.

2. **(binary — RetryExhausted, wiring S2)** **Given** o retry counter atinge 5 (FR-012 — vai trigger S2 em E4)
   **When** o gate falha a 5ª vez
   **Then** retorna `err({kind:'RetryExhausted'})` para o upstream FSM (em vez de `GateFailure` nessa ronda).

3. **(binary — lint red + files_created)** **Given** o Dev completou a story com `bun test` verde
   **When** o gate corre `bun run lint` que falha **ou** um ficheiro de `files_created` declarado não existe
   **Then** retorna `err({kind:'GateFailure', gate:'Dev→Review', reason:'lint red'|'files_created missing'})` + audit + diagnostic + counter incrementado.

4. **(binary — happy path)** **Given** `bun test` exit 0 **e** `bun run lint` exit 0 **e** todos os `files_created` existem
   **When** o gate corre
   **Then** retorna `ok` (gate passa) **e** o retry counter da story é reset (zerado). Nenhum diagnostic é escrito.

## Tasks / Subtasks

- [x] **Task 1 — `src/services/gates/dev-to-review.gate.ts` (NEW)** (AC: #1-#4) — `createDevToReviewGate(deps)`; `check(input): ResultAsync<{storyId}, GateFailure | RetryExhausted | SpawnError>`. Corre `bun test`+`bun run lint` via `SpawnPort` (exit≠0=falha) + `files_created` via probe injectado. Short-circuit test→lint→files (Q-2.5-3). Falha: counter++, audit `GateFailed`, diagnostic (`DiagnosticWriter` importado da 2.4); 5ª→`RetryExhausted`. Sucesso: reset+`ok`. 173 linhas.
- [x] **Task 2 — retry counter (AC: #1, #2)** — `Map<storyId, count>` in-process por instância (Q-2.5-1); incrementa em cada falha; `attempt >= maxRetries (default 5, FR-012)` → `RetryExhausted{evidence, attempts, lastReason}` + audit `type:"RetryExhausted"`; sucesso `retries.delete(storyId)`. `maxRetries` injectável.
- [x] **Task 3 — `tests/gates/dev-to-review.test.ts` (NEW)** (AC: #1-#4) — fake `SpawnPort` keyed por args + fake `AuditPort` + `DiagnosticWriter` **REAL** (mkdtemp, D-053) + `TestClockAdapter` + `fileExists` probe. AC1 `tests red`+audit+diagnostic+counter=1; AC2 5 falhas→`RetryExhausted`(attempts=5); AC3 `lint red`/`files_created missing`; AC4 verde→`ok`+reset (re-falha attempt=1); SpawnError propagado sem incrementar. 7 specs.
- [x] **Task 4 — gates**: type-check clean · lint exit 0 · `bun test` 331 pass / 3 skip / 0 fail (+7) · integração 16 pass / 3 skip.
- [x] **Task 5 (FINAL) — Tier-B summary (18ª dogfood)**: `scripts/generate-25-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-2-5): …` (`68d5678`, Tier-B **503 words** ≤715). `workflowId: "story-2-5"`. Sprint-status `2-5 → review`.

## Dev Notes

### Big picture

Segundo gate do pipeline bimodal (2.4 = Story→Dev, **2.5 = Dev→Review**). Garante que o Review só recebe diff que **compila/passa/lint-clean** e cujos `files_created` declarados existem de facto (FR-050 parte 2). Introduz o **retry counter** (FR-012) que, ao atingir 5, devolve `RetryExhausted` — o wiring para o trigger S2 (Epic 4) e a recovery (Epic 5). Reusa o padrão de gate da 2.4 (audit `GateFailed` + diagnostic) e o `SpawnPort` da 1.a.3.

### Reuso (NÃO reinventar)

- **`SpawnPort`** (`src/ports/spawn.port.ts`, 1.a.3): `spawn(cmd, args, opts): ResultAsync<SpawnResult, SpawnError>`. **Contrato:** exit ≠ 0 ainda é `ok({stdout, stderr, exitCode})` — o caller decide se é erro semântico. `fake-spawn.adapter.ts` (testes) / `system-spawn.adapter.ts` (real). Nos testes desta story, fake inline keyed por args (test vs lint) — ver `spySpawn` em `tests/adapters/bmad-invoker.test.ts`.
- **`story-to-dev.gate.ts`** (2.4): **padrão de gate** + a interface `DiagnosticWriter` (importável — Q-2.5-4). `GateFailure`/`renderDiagnostic`/audit best-effort.
- **`events.ts`** (1.a.4): `GateName` inclui `"DevToReview"` — usar no audit `GateFailed`.
- **`confirmation-gate.service.ts`** (1.b.2): precedente de **estado in-process por instância** (Maps) — o retry counter segue o mesmo.
- **`AuditPort`**/**`ClockPort`**; `Result`/`ResultAsync` (neverthrow v8). Padrão factory `createXGate(deps)`.

### Fronteiras (o que NÃO fazer aqui)

- **Story 2.4 (gate Story→Dev):** valida a **spec**. A 2.5 valida o **output do Dev** (test/lint/files). NÃO modificar `story-to-dev.gate.ts` (`files_modified: —`) — só importar a interface `DiagnosticWriter`.
- **Story 2.6 (lifecycle FSM):** o wiring `RetryExhausted → FSM/persistência` e a recovery. A 2.5 só **devolve** `RetryExhausted` ao upstream — não transita FSM nem persiste o counter (in-process por agora).
- **Epic 4 (trigger S2):** o que acontece *após* `RetryExhausted` (escalar ao operador via S2). A 2.5 só entrega o sinal.
- A 2.5 **não** corre o Review nem dispara `bmad-code-review` — só decide se o diff *pode* seguir.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-30)

- **Q-2.5-1 [RESOLVED — (a) Map in-process por instância]:** retry counter `Map<storyId, count>` dentro do gate, reset em sucesso. Precedente confirmation-gate (1.b.2); persistência DB = Epic 4.x. `maxRetries` injectável (default 5, FR-012).
- **Q-2.5-2 [RESOLVED — (a) probe `fileExists`]:** injectar `fileExists(path): boolean` (fake nos testes, fs real em produção). Testável, sem acoplar o gate ao `node:fs`.
- **Q-2.5-3 [RESOLVED — (a) short-circuit na 1ª falha]:** ordem test → lint → files; pára na primeira falha, uma razão de cada vez. Rápido, alinha "corrige uma coisa por retry".
- **Q-2.5-4 [RESOLVED — (a) importar a interface da 2.4]:** importar `DiagnosticWriter` de `story-to-dev.gate.ts` (só import; zero churn; honra `files_modified: —`). Extração para um port partilhado fica como open item futuro (O-2.5-1).

### Project Structure Notes

- `files_created`: `src/services/gates/dev-to-review.gate.ts`, `tests/gates/dev-to-review.test.ts` (alinhado epics.md:1367). `files_modified: —`.
- `RetryExhausted` e `GateFailure` desta story são tipos próprios (gate `'Dev→Review'`, razões próprias) — distintos dos da 2.4; um refactor futuro pode unificar num `GateFailure<Gate, Reason>` genérico.
- Biome `maxLines:200` HARD em `src/**`. `ao_subset`: FR-050, FR-051, FR-052.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.5] (linhas 1358-1380 — StorySpec + ACs)
- [Source: src/ports/spawn.port.ts] (1.a.3 — SpawnPort; exit≠0 = ok) · [Source: src/adapters/spawn/fake-spawn.adapter.ts]
- [Source: src/services/gates/story-to-dev.gate.ts] (2.4 — padrão de gate + DiagnosticWriter + renderDiagnostic)
- [Source: src/core/events.ts] (1.a.4 — GateName 'DevToReview')
- [Source: src/services/confirmation-gate.service.ts] (1.b.2 — estado in-process por instância)
- Story anterior: `_bmad-output/implementation-artifacts/2-4-...md` (gate + fake audit + writer real mkdtemp)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0.
- `bun test` → 331 pass / 3 skip / 0 fail (era 324; +7).
- `bun run test:integration` → 16 pass / 3 skip.

### Completion Notes List

- **AC1:** `bun test` exit ≠ 0 → `GateFailure(gate:'Dev→Review', reason:'tests red', evidence, attempt)` + audit `GateFailed`(`gate:'DevToReview'`) + diagnostic + counter=1.
- **AC2 (FR-012, wiring S2):** counter in-process por storyId; à 5ª falha devolve `RetryExhausted{attempts:5, lastReason}` em vez de `GateFailure`; audit `type:"RetryExhausted"`.
- **AC3:** short-circuit test→lint→files; lint exit ≠ 0 → `lint red`; `files_created` em falta (probe) → `files_created missing`.
- **AC4:** tudo verde → `ok` + `retries.delete(storyId)` (reset). Teste prova que após reset uma nova falha volta a `attempt=1` (não 2).
- **SpawnError:** binário ausente (`Permanent`) é propagado e **não** conta como retry (infra ≠ falha do Dev).
- **Q-2.5-4=(a):** `DiagnosticWriter` importado de `story-to-dev.gate.ts` — zero churn, `files_modified: —` honrado.
- **Fronteiras:** sem wiring FSM/persistência do counter (2.6), sem o que acontece após `RetryExhausted` (S2/Epic 4), sem correr o Review. Sem deps novas.

### File List

- `src/services/gates/dev-to-review.gate.ts` (NEW)
- `tests/gates/dev-to-review.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/2-5-gate-dev-review-test-suite-verde.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 2-5)
- `scripts/generate-25-summary.ts` (NEW — Task 5, dogfood)
