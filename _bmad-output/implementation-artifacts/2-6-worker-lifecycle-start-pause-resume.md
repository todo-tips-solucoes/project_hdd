# Story 2.6: Worker lifecycle start/pause/resume

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want `hdd-worker start`, `pause`, `resume` que persiste state em db e sobrevive crash,
so that posso parar overnight e continuar de manhã sem perder progresso.

## Acceptance Criteria

1. **(binary — pause)** **Given** worker correndo (run `running`)
   **When** corro `hdd-worker pause`
   **Then** a FSM transita `running → paused_for_interrupt`, persiste em `runs.status`, emite audit event, e responde em ≤2s (operação síncrona bun:sqlite).

2. **(binary — resume)** **Given** worker pausado (`paused_for_interrupt`)
   **When** corro `hdd-worker resume`
   **Then** carrega o state do db + FSM transita `paused_for_interrupt → running` (evento `OperatorResponded`) + persiste + audit.

3. **(binary — recovery boot, partial)** **Given** worker correndo
   **When** simulo `kill -9` + restart manual (`recover()`)
   **Then** o boot recovery detecta a in-flight story (run `running` órfã) e deixa a FSM em **estado consistente** (conforme **Q-2.6-2**). **E5 entrega o recovery boot completo** (replay) — a 2.6 entrega a detecção + consistência.

4. **(binary — AI Safety, Pre-Mortem #2)** **Given** o worker dispara uma acção catalogada como `irreversibleActions` (deploy, branch-delete, force-push, schema-drop, audit-purge)
   **When** o lifecycle service intercepta a chamada (`guardIrreversible`)
   **Then** **antes** de executar consulta `confirmation-gate` (Story 1.b.2) e bloqueia até confirmação OU CLI flag `--i-really-mean-it` (→ `cliOverride`).
   **And** test: `deploy` via lifecycle **sem** confirmação devolve `err({kind:'ConfirmationRequired'})`.

## Tasks / Subtasks

- [x] **Task 1 — `src/services/worker-lifecycle.service.ts` (NEW)** (AC: #1-#4) — `createWorkerLifecycle(deps)`; `pause()`/`resume()`/`recover()`/`guardIrreversible()`. Lê latest run (padrão `worker-status.service`), `transition()` puro valida, persiste `runs.status` via drizzle (Q-2.6-4), audit. Síncrono. 134 linhas.
- [x] **Task 2 — FSM event do pause (AC: #1)** — Q-2.6-1=(a): evento `OperatorPaused` (`running→paused_for_interrupt`) em `fsm.ts`; não adiciona estado (enum DB intacto). `resume`=`OperatorResponded`. `recover` persiste `running→paused_for_interrupt` directo (audit `RecoveryDetected`). **Divergência `files_modified`: +`src/core/fsm.ts`** (AI-S0-4).
- [x] **Task 3 — `src/cli/pause.command.ts` + `src/cli/resume.command.ts` (NEW)** (AC: #1, #2) — `registerPauseCommand`/`registerResumeCommand`; `buildCliLifecycle()` (exportado de pause, reusado por resume) = `bootstrap({cliMode})` + clock + confirmation-gate + lifecycle. io + `lifecycle` injectáveis. `formatLifecycleError`/`formatResumeError`.
- [x] **Task 4 — `src/cli/hdd-worker.ts` (MODIFY)** (AC: #1, #2) — stubs `pause`/`resume` substituídos por `registerPauseCommand`/`registerResumeCommand`. Ordem `--help` mantida; `registerStubCommand` continua exportado (testes + futuro).
- [x] **Task 5 — `tests/services/lifecycle.test.ts` (NEW)** (AC: #1-#4) — `:memory:` + `applyMigrations` (DB real, D-053) + `ConfirmationGate` real + fake audit + `TestClockAdapter`. AC1 pause+audit+IllegalTransition+NoActiveRun; AC2 resume+round-trip; AC3 recover(recovered/clean)+audit; AC4 guardIrreversible(ConfirmationRequired/bypassed/not-required). 10 specs.
- [x] **Task 6 — gates**: type-check clean · lint exit 0 · `bun test` 341 pass / 3 skip / 0 fail (+10) · integração 16 pass / 3 skip.
- [x] **Task 7 (FINAL) — Tier-B summary (19ª dogfood)**: `scripts/generate-26-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-2-6): …` (`fada157`, Tier-B **557 words** ≤715). `workflowId: "story-2-6"`. Sprint-status `2-6 → review`.

## Dev Notes

### Big picture

A maior story do Epic 2 e a que **liga tudo**: dá state real ao worker. `pause`/`resume` transitam a FSM (1.a.4) e persistem em SQLite (`runs` table, 1.a.5); `recover()` torna o arranque crash-safe (parcial — E5 completa). A AC4 é o **wiring de segurança** (Pre-Mortem #2): toda acção irreversível passa pelo `confirmation-gate` (1.b.2) antes de executar. É aqui que o `gate_blocked` (2.4) e o `RetryExhausted` (2.5) passam a ter state persistido a montante.

### Reuso (NÃO reinventar)

- **`runs` table** (`src/db/schema.ts`, 1.a.5): single-row per run; `status` = os 6 estados FSM lowercase (idle/running/paused_*/failed). `pausedTrigger`/`pausedReviewReason` carregam metadata do PAUSED. **`gate_blocked` (2.4) NÃO está no enum do DB** — irrelevante para a 2.6 (só toca running↔paused_for_interrupt, ambos no enum).
- **`worker-status.service.ts`** (2.1): `readWorkerStatus(db)` — padrão de leitura do latest run via `createDrizzle(db)` + `desc(runs.startedAt)`. A 2.6 segue o mesmo para **ler**, e **escreve** `runs.status` (primeira escrita de lifecycle).
- **`connection.ts`** (1.a.5): `createDbConnection(":memory:")`, `createDrizzle(db)`, `applyMigrations(db, dir)`. Tests usam `:memory:` + migrations.
- **`fsm.ts`** (1.a.4): `transition(from, event): Result<{to}, FsmError>` puro. `paused_for_interrupt → OperatorResponded → running` (resume). Pause → ver Q-2.6-1.
- **`confirmation-gate.service.ts`** (1.b.2): `requireConfirmation(action, {waId, cliOverride}): Result<RequireOutcome, ConfirmationError>`. `cliOverride:true` → `bypassed`; acção irreversível sem override → `err({kind:'ConfirmationRequired'})`. **É o que a AC4 invoca** (o `requireTwoStep` do epics = este método). `isIrreversibleAction` (catálogo 1.b.2).
- **`start.command.ts`** (2.1): padrão de command (deps injectáveis, `import.meta.main` guard). **`AuditPort`**/**`ClockPort`**; `Result` (neverthrow). Factory `createXService(deps)`.

### Fronteiras (o que NÃO fazer aqui)

- **Epic 5 (recovery boot completo):** replay de in-flight story, reconstrução de contexto. A 2.6 entrega **detecção + estado consistente** (AC3 é explicitamente partial — "E5 entrega recovery boot completo").
- **Epic 3 (WhatsApp Quick Reply):** o `IrrevConfirmYes` via WhatsApp two-step. Na 2.6 (CLI), o caminho humano é a flag `--i-really-mean-it` (→ `cliOverride`); o código 6-char/Quick Reply é Epic 3 (Q-2.6-3).
- **Epic 4 (triggers/interrupts reais):** a 2.6 **não** processa triggers P1/S1/S2/S3 nem a queue de interrupts — só o pause/resume operador-iniciado.
- A 2.6 **não** modifica a FSM além do evento de pause (Q-2.6-1); **não** corre stories nem dispara BMAD.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-2.6-1 [RESOLVED — (a) novo evento `OperatorPaused`]:** adicionar `OperatorPaused` a `fsm.ts` (`running→paused_for_interrupt`). Semântica honesta; `pausedTrigger` fica null; **não** adiciona estado (enum DB intacto). Divergência `files_modified` (+`src/core/fsm.ts`) registada em AI-S0-4. `resume` usa `OperatorResponded`.
- **Q-2.6-2 [RESOLVED — (a) detectar running órfã → paused]:** `recover()` detecta run `running` órfã (crash) → transita para `paused_for_interrupt` + audit `RecoveryDetected`. Estado consistente e seguro (operador faz `resume` explícito; sem auto-resume pós-crash). E5 adiciona o replay completo.
- **Q-2.6-3 [RESOLVED — (a) waId sentinela + flag]:** `guardIrreversible` usa `waId="cli-operator"` + `--i-really-mean-it` → `cliOverride:true`. Sem flag → `err(ConfirmationRequired)`. O Quick Reply WhatsApp two-step é Epic 3.
- **Q-2.6-4 [RESOLVED — (a) drizzle directo no service]:** o lifecycle escreve `runs.status` via drizzle (Database injectado; consistente com `worker-status.service`; bun:sqlite sync). Sem ficheiro novo (honra `files_created`). Extração para `RunStateRepository` = open item futuro (O-2.6-1).

### Project Structure Notes

- `files_created`: `src/services/worker-lifecycle.service.ts`, `src/cli/pause.command.ts`, `src/cli/resume.command.ts`, `tests/services/lifecycle.test.ts`.
- `files_modified`: `src/cli/hdd-worker.ts` (declarado) + **`src/core/fsm.ts`** se Q-2.6-1=(a) (divergência a registar — AI-S0-4).
- Biome `maxLines:200` HARD em `src/**` → service + 2 commands em ficheiros separados. `ao_subset`: FR-031, FR-032 partial, FR-040, NFR-R3.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.6] (linhas 1382-1413 — StorySpec + ACs)
- [Source: src/db/schema.ts] (1.a.5 — runs table, status enum) · [Source: src/db/connection.ts] (createDbConnection/applyMigrations/createDrizzle)
- [Source: src/services/worker-status.service.ts] (2.1 — padrão de leitura do latest run)
- [Source: src/core/fsm.ts] (1.a.4 — transition; OperatorResponded p/ resume)
- [Source: src/services/confirmation-gate.service.ts] (1.b.2 — requireConfirmation/cliOverride) · [Source: src/lib/irreversible-action-catalog.ts]
- [Source: src/cli/hdd-worker.ts] (stubs pause/resume a substituir) · [Source: src/cli/start.command.ts] (padrão de command)
- [Source: tests/services/idempotency.test.ts] (`:memory:` + applyMigrations) · [Source: tests/services/confirmation-gate.test.ts] (waId/cliOverride)
- Story anterior: `_bmad-output/implementation-artifacts/2-5-...md` · Memória `[[feedback-hdd-mandatory-review]]`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0.
- `bun test` → 341 pass / 3 skip / 0 fail (era 331; +10). FSM property totalidade estende-se ao novo evento `OperatorPaused` sem regressão. `commands.test.ts` (nomes/ordem do `--help` + helper `registerStubCommand`) intacto.
- `bun run test:integration` → 16 pass / 3 skip.

### Completion Notes List

- **AC1 (pause):** `running → paused_for_interrupt` via evento `OperatorPaused`; persiste `runs.status` + audit `WorkerPaused`. Síncrono (bun:sqlite) → ≤2s trivialmente. Pause fora de `running` → `IllegalTransition` (persiste inalterado); sem run → `NoActiveRun`.
- **AC2 (resume):** `paused_for_interrupt → running` (`OperatorResponded`) + audit `WorkerResumed`. Round-trip pause→resume testado.
- **AC3 (recovery, partial):** run `running` órfã (crash) → `paused_for_interrupt` + audit `RecoveryDetected` (estado consistente e seguro — sem auto-resume). Run não-`running` → `clean`. E5 adiciona o replay completo.
- **AC4 (AI Safety, Pre-Mortem #2):** `guardIrreversible('deploy')` → `err(ConfirmationRequired)`; `cliOverride:true` (`--i-really-mean-it`) → `ok(bypassed)`; acção não-catalogada → `ok(not-required)`. Delega no `confirmation-gate` (1.b.2) com `waId="cli-operator"`.
- **Q-2.6-1=(a):** evento `OperatorPaused` adicionado a `fsm.ts` → **divergência `files_modified`** (+`src/core/fsm.ts`); registar em `readiness-open-items.md`/AI-S0-4.
- **Fronteiras:** recovery é partial (E5), Quick Reply WhatsApp é Epic 3, triggers reais Epic 4. O `--i-really-mean-it` ainda não está ligado a um comando CLI irreversível (não existe nenhum na 2.6) — `guardIrreversible` é o chokepoint para dispatch futuro. Sem deps novas.
- **O-2.6-1:** extrair `RunStateRepository` port quando um 2º writer de `runs` aparecer.

### File List

- `src/services/worker-lifecycle.service.ts` (NEW)
- `src/cli/pause.command.ts` (NEW)
- `src/cli/resume.command.ts` (NEW)
- `tests/services/lifecycle.test.ts` (NEW)
- `src/core/fsm.ts` (MODIFY — +evento `OperatorPaused`; divergência files_modified vs StorySpec)
- `src/cli/hdd-worker.ts` (MODIFY — stubs → comandos reais)
- `_bmad-output/implementation-artifacts/2-6-worker-lifecycle-start-pause-resume.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 2-6)
- `scripts/generate-26-summary.ts` (NEW — Task 7, dogfood)
