> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

---

<!--
  Tier-B template — briefing 600-900 palavras, target ≤715 para folga.

  Story 1.a.8 (F8 FR-070..076, D-019, AO-146 defer p/ Tier-A).
  Renderizado por `summaryGenerator.finalize()` em src/services/summary-generator.service.ts.

  Anti-padrões a EVITAR (per finalization-summary-templates canon):
    × "Foi feito muito trabalho" — usar ARTEFACTOS como prova
    × Listas FR sem dizer o que ficou diferente — mostrar CONSEQUÊNCIA, não actividade
    × "Várias decisões foram tomadas" — enumerá-las (tabela)
    × Tier-B sem Trade-offs — sinal de processo low-judgment
    × "Tudo correu bem" — preferir verdict formal (ready-to-merge etc.)

  Mantém: artefactos como prova, decisões enumeradas, trade-offs narrativos,
  open items distintos das próximas etapas.
-->
---
workflowId: story-2-6
workflowName: Story 2.6 — Worker lifecycle start/pause/resume
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.6 — Worker lifecycle start/pause/resume · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

A maior story do Epic 2 e a que liga tudo: dá state real ao worker. pause/resume transitam a FSM (1.a.4) e persistem em SQLite (runs table, 1.a.5); recover() torna o arranque crash-safe (parcial — E5 completa). A AC4 é o wiring de segurança (Pre-Mortem #2): toda acção irreversível passa pelo confirmation-gate (1.b.2) antes de executar. É aqui que o gate_blocked (2.4) e o RetryExhausted (2.5) ganham state persistido a montante.

## O que foi feito

- **src/services/worker-lifecycle.service.ts** — NEW: createWorkerLifecycle; pause/resume/recover/guardIrreversible; lê latest run, transition() puro valida, persiste runs.status via drizzle, audit. 134 linhas.
- **src/cli/pause.command.ts + resume.command.ts** — NEW: comandos reais (substituem stubs); buildCliLifecycle (bootstrap cliMode + clock + confirmation-gate + lifecycle), io injectável.
- **src/core/fsm.ts** — MODIFY: +evento OperatorPaused (running→paused_for_interrupt); sem novo estado (enum DB intacto). Divergência files_modified registada (AI-S0-4).
- **src/cli/hdd-worker.ts + tests/services/lifecycle.test.ts** — MODIFY hdd-worker (stubs→reais); NEW test 10 specs com :memory:+migrations (DB real, D-053) + ConfirmationGate real.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Evento OperatorPaused na FSM para o pause. | Semântica honesta (running→paused_for_interrupt); pausedTrigger null; sem novo estado. Modifica fsm.ts (divergência files_modified aceite). | Q-2.6-1 |
| 2 | recover() transita running órfã → paused_for_interrupt. | Estado consistente e seguro: operador faz resume explícito, sem auto-resume pós-crash. E5 completa o replay. | Q-2.6-2 |
| 3 | Confirmação CLI: waId sentinela 'cli-operator' + --i-really-mean-it→cliOverride. | Quick Reply WhatsApp two-step é Epic 3; em CLI a flag é o human-in-loop. Reusa confirmation-gate. | Q-2.6-3 |
| 4 | Lifecycle escreve runs.status via drizzle directo (db injectado). | Consistente com worker-status.service read; bun:sqlite sync; sem ficheiro novo (honra files_created). | Q-2.6-4 |

## Trade-offs aplicados

- AC4 (núcleo AI Safety) é wiring enforcement: guardIrreversible é o chokepoint — toda acção catalogada (deploy/branch-delete/force-push/schema-drop/audit-purge) passa pelo confirmation-gate antes de executar. Sem confirmação nem flag → ConfirmationRequired.
- recover() é deliberadamente PARTIAL (detect+consistência); o replay de in-flight story é E5. A 2.6 garante que nunca há auto-resume silencioso após crash (segurança > conveniência).

## Open items deferidos

- **O-2.6-1:** Extrair RunStateRepository port quando um 2º writer de runs aparecer (hoje lifecycle escreve, worker-status lê — drizzle directo em ambos).
- **files_modified:** Divergência aceite: 2.6 modifica src/core/fsm.ts além de hdd-worker.ts (registado em readiness-open-items.md / AI-S0-4).
- **fronteiras:** E5 (recovery boot completo/replay), Epic 3 (Quick Reply WhatsApp), Epic 4 (triggers P1/S1/S2/S3 reais); --i-really-mean-it ainda sem comando CLI irreversível ligado.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 341 pass / 3 skip / 0 fail (era 331; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-2.6` → marco done + commit `feat(story-2.6): worker lifecycle start/pause/resume`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 6/7. Próxima e ÚLTIMA do épico: Story 2.7 (DevOutput/ReviewOutput/QAOutput schemas Zod concretos — fecha o Epic 2).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-6` · Pedir alterações: `hdd-worker review request-changes story-2-6 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-6 --reason "<razão>"`


---

<!--
  Tier-C template — full briefing, sem limite estricto de palavras.

  Story 1.a.8 (F8 FR-070..076, D-019). Superset do Tier-B + diff opcional.

  Renderizado por `summaryGenerator.finalize()`. Tier-C inclui git diff
  unified dentro de fence ```diff (Q-A8-3 Recommended); side-by-side fica
  para v1.1+. Quando `diffAgainst` é undefined, a section "Diff" exibe
  "(no diff requested)" como placeholder.
-->
---
workflowId: story-2-6
workflowName: Story 2.6 — Worker lifecycle start/pause/resume
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.6 — Worker lifecycle start/pause/resume

### Contexto detalhado

A maior story do Epic 2 e a que liga tudo: dá state real ao worker. pause/resume transitam a FSM (1.a.4) e persistem em SQLite (runs table, 1.a.5); recover() torna o arranque crash-safe (parcial — E5 completa). A AC4 é o wiring de segurança (Pre-Mortem #2): toda acção irreversível passa pelo confirmation-gate (1.b.2) antes de executar. É aqui que o gate_blocked (2.4) e o RetryExhausted (2.5) ganham state persistido a montante.

### O que foi feito (verbose)

- **src/services/worker-lifecycle.service.ts** — NEW: createWorkerLifecycle; pause/resume/recover/guardIrreversible; lê latest run, transition() puro valida, persiste runs.status via drizzle, audit. 134 linhas.
- **src/cli/pause.command.ts + resume.command.ts** — NEW: comandos reais (substituem stubs); buildCliLifecycle (bootstrap cliMode + clock + confirmation-gate + lifecycle), io injectável.
- **src/core/fsm.ts** — MODIFY: +evento OperatorPaused (running→paused_for_interrupt); sem novo estado (enum DB intacto). Divergência files_modified registada (AI-S0-4).
- **src/cli/hdd-worker.ts + tests/services/lifecycle.test.ts** — MODIFY hdd-worker (stubs→reais); NEW test 10 specs com :memory:+migrations (DB real, D-053) + ConfirmationGate real.

### Full file list

- **src/services/worker-lifecycle.service.ts** — NEW: createWorkerLifecycle; pause/resume/recover/guardIrreversible; lê latest run, transition() puro valida, persiste runs.status via drizzle, audit. 134 linhas.
- **src/cli/pause.command.ts + resume.command.ts** — NEW: comandos reais (substituem stubs); buildCliLifecycle (bootstrap cliMode + clock + confirmation-gate + lifecycle), io injectável.
- **src/core/fsm.ts** — MODIFY: +evento OperatorPaused (running→paused_for_interrupt); sem novo estado (enum DB intacto). Divergência files_modified registada (AI-S0-4).
- **src/cli/hdd-worker.ts + tests/services/lifecycle.test.ts** — MODIFY hdd-worker (stubs→reais); NEW test 10 specs com :memory:+migrations (DB real, D-053) + ConfirmationGate real.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Evento OperatorPaused na FSM para o pause. | Semântica honesta (running→paused_for_interrupt); pausedTrigger null; sem novo estado. Modifica fsm.ts (divergência files_modified aceite). | Q-2.6-1 |
| 2 | recover() transita running órfã → paused_for_interrupt. | Estado consistente e seguro: operador faz resume explícito, sem auto-resume pós-crash. E5 completa o replay. | Q-2.6-2 |
| 3 | Confirmação CLI: waId sentinela 'cli-operator' + --i-really-mean-it→cliOverride. | Quick Reply WhatsApp two-step é Epic 3; em CLI a flag é o human-in-loop. Reusa confirmation-gate. | Q-2.6-3 |
| 4 | Lifecycle escreve runs.status via drizzle directo (db injectado). | Consistente com worker-status.service read; bun:sqlite sync; sem ficheiro novo (honra files_created). | Q-2.6-4 |

### Trade-offs aplicados (narrativa)

- AC4 (núcleo AI Safety) é wiring enforcement: guardIrreversible é o chokepoint — toda acção catalogada (deploy/branch-delete/force-push/schema-drop/audit-purge) passa pelo confirmation-gate antes de executar. Sem confirmação nem flag → ConfirmationRequired.
- recover() é deliberadamente PARTIAL (detect+consistência); o replay de in-flight story é E5. A 2.6 garante que nunca há auto-resume silencioso após crash (segurança > conveniência).

### Open items deferidos (com onde serão resolvidos)

- **O-2.6-1:** Extrair RunStateRepository port quando um 2º writer de runs aparecer (hoje lifecycle escreve, worker-status lê — drizzle directo em ambos).
- **files_modified:** Divergência aceite: 2.6 modifica src/core/fsm.ts além de hdd-worker.ts (registado em readiness-open-items.md / AI-S0-4).
- **fronteiras:** E5 (recovery boot completo/replay), Epic 3 (Quick Reply WhatsApp), Epic 4 (triggers P1/S1/S2/S3 reais); --i-really-mean-it ainda sem comando CLI irreversível ligado.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 341 pass / 3 skip / 0 fail (era 331; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-2.6` → marco done + commit `feat(story-2.6): worker lifecycle start/pause/resume`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 6/7. Próxima e ÚLTIMA do épico: Story 2.7 (DevOutput/ReviewOutput/QAOutput schemas Zod concretos — fecha o Epic 2).

### Diff vs `HEAD`

```diff
diff --git a/src/core/fsm.ts b/src/core/fsm.ts
index b21ae81..5c69326 100644
--- a/src/core/fsm.ts
+++ b/src/core/fsm.ts
@@ -9,6 +9,9 @@
  * **7 estados (Q-A4-1 resolved 2026-05-28 → lowercase epics.md AC; `gate_blocked`
  * adicionado na Story 2.4 — Q-2.4-1, gate Story→Dev não-terminal):**
  *
+ * Eventos extra (não na tabela abaixo): `GateBlocked` (running→gate_blocked,
+ * 2.4) e `OperatorPaused` (running→paused_for_interrupt, pause operador — 2.6).
+ *
  * | from \\ event              | StartRun | InterruptP1/S1/S2/S3 | OperatorResponded | OperatorPausedReview | OperatorApproved | OperatorRejected | WindowExhausted | Fail   |
  * |----------------------------|----------|----------------------|-------------------|----------------------|------------------|------------------|-----------------|--------|
  * | idle                       | running  | —                    | —                 | —                    | —                | —                | —               | —      |
@@ -47,6 +50,7 @@ export type FsmEvent =
   | { readonly kind: "InterruptS2" }
   | { readonly kind: "InterruptS3" }
   | { readonly kind: "OperatorResponded" }
+  | { readonly kind: "OperatorPaused" }
   | { readonly kind: "OperatorPausedReview" }
   | { readonly kind: "OperatorApproved" }
   | { readonly kind: "OperatorRejected" }
@@ -63,6 +67,7 @@ export const ALL_EVENT_KINDS: ReadonlyArray<FsmEventKind> = [
   "InterruptS2",
   "InterruptS3",
   "OperatorResponded",
+  "OperatorPaused",
   "OperatorPausedReview",
   "OperatorApproved",
   "OperatorRejected",
@@ -88,6 +93,7 @@ export const TRANSITION_TABLE: Readonly<Record<FsmState, Partial<Record<FsmEvent
       InterruptS1: "paused_for_interrupt",
       InterruptS2: "paused_for_interrupt",
       InterruptS3: "paused_for_interrupt",
+      OperatorPaused: "paused_for_interrupt",
       OperatorPausedReview: "paused_awaiting_review",
       WindowExhausted: "paused_window_exhausted",
       GateBlocked: "gate_blocked",

```

---

→ Aprovar: `hdd-worker review approve story-2-6` · Pedir alterações: `hdd-worker review request-changes story-2-6 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-6 --reason "<razão>"`

