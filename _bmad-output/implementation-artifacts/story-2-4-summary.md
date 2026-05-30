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
workflowId: story-2-4
workflowName: Story 2.4 — Gate Story→Dev (AC validation)
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.4 — Gate Story→Dev (AC validation) · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Primeiro dos dois gates do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Fail-fast: impede que o bmad-dev-story arranque numa story mal-formed (FR-050 pt1). Valida a spec estática (≥1 Given/When/Then, files_created, ao_subset), emite audit GateFailed (FR-051) e materializa um diagnostic inspecionável (FR-052). Não corre testes nem conta retries (2.5), não faz wiring lifecycle (2.6).

## O que foi feito

- **src/lib/story-spec-validator.ts** — NEW: StorySpec + validateStorySpec puro; 4 razões curto-circuito (no AC defined / no Given-When-Then / no files_created / no ao_subset); hasGivenWhenThen. 64 linhas.
- **src/services/gates/story-to-dev.gate.ts** — NEW: createStoryToDevGate; check→ResultAsync. Falha→GateFailure(gate 'Story→Dev', evidence storyId) + audit GateFailed('StoryToDev') + diagnostic via DiagnosticWriter injectado (best-effort). 110 linhas.
- **src/core/fsm.ts** — MODIFY: +estado gate_blocked (não-terminal) +evento GateBlocked; running→gate_blocked→running (re-dispatch). Transições existentes intactas.
- **tests/gates/story-to-dev.test.ts** — NEW: 12 specs — AC1-4 + writer REAL (mkdtemp, D-053) + property hasGivenWhenThen + 3 FSM gate_blocked.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Estado gate_blocked não-terminal + evento GateBlocked. | Honra 'add gate state'; permite re-dispatch após correct-course (human-in-loop). Não muda idle→running. | Q-2.4-1 |
| 2 | StorySpec mínimo (strings) + regex Given/When/Then. | Parser markdown→StorySpec é de outra story; input estruturado aqui. Pragmático, desacoplado, testável. | Q-2.4-2 |
| 3 | DiagnosticWriter injectado (port); gate ResultAsync. | Hexagonal/ports-adapters; testável (writer real no teste), seguro (root configurável), autonomia (destino redirecionável). | Q-2.4-3 |
| 4 | Error label 'Story→Dev' + audit enum 'StoryToDev'. | Honra AC literal E reutiliza GateName tipado de events.ts. Sem divergência. | Q-2.4-4 |

## Trade-offs aplicados

- Diagnostic é best-effort: um writer que falha (disk full) NÃO muda o verdict (GateFailure na mesma) — o gate nunca esconde a falha de spec por causa de I/O. Testado explicitamente.
- events.ts já tinha GateFailed+GateName (stub 1.a.4) → reuso em vez de inventar; a 2.4 deu-lhe o primeiro caller real.

## Open items deferidos

- **O-2.4-1:** Adapter fs real do DiagnosticWriter ainda não existe em src/ (no teste usa-se um real sobre mkdtemp); materializa-se quando o worker fizer o wiring end-to-end do pipeline.
- **fronteiras:** 2.5 (gate Dev→Review: bun test/lint verdes + retry counter + RetryExhausted), 2.6 (lifecycle FSM: wiring gate_blocked↔persistência/pause-resume).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 324 pass / 3 skip / 0 fail (era 312; +12 unit)
- **Integração:** 16 pass / 3 skip
- **FSM:** 7 estados (era 6; +gate_blocked); property totalidade 19 pass
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-2.4` → marco done + commit `feat(story-2.4): gate Story→Dev (AC validation)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 4/7. Próxima: Story 2.5 (gate Dev→Review — test suite verde + retry counter).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-4` · Pedir alterações: `hdd-worker review request-changes story-2-4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-4 --reason "<razão>"`


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
workflowId: story-2-4
workflowName: Story 2.4 — Gate Story→Dev (AC validation)
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.4 — Gate Story→Dev (AC validation)

### Contexto detalhado

Primeiro dos dois gates do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Fail-fast: impede que o bmad-dev-story arranque numa story mal-formed (FR-050 pt1). Valida a spec estática (≥1 Given/When/Then, files_created, ao_subset), emite audit GateFailed (FR-051) e materializa um diagnostic inspecionável (FR-052). Não corre testes nem conta retries (2.5), não faz wiring lifecycle (2.6).

### O que foi feito (verbose)

- **src/lib/story-spec-validator.ts** — NEW: StorySpec + validateStorySpec puro; 4 razões curto-circuito (no AC defined / no Given-When-Then / no files_created / no ao_subset); hasGivenWhenThen. 64 linhas.
- **src/services/gates/story-to-dev.gate.ts** — NEW: createStoryToDevGate; check→ResultAsync. Falha→GateFailure(gate 'Story→Dev', evidence storyId) + audit GateFailed('StoryToDev') + diagnostic via DiagnosticWriter injectado (best-effort). 110 linhas.
- **src/core/fsm.ts** — MODIFY: +estado gate_blocked (não-terminal) +evento GateBlocked; running→gate_blocked→running (re-dispatch). Transições existentes intactas.
- **tests/gates/story-to-dev.test.ts** — NEW: 12 specs — AC1-4 + writer REAL (mkdtemp, D-053) + property hasGivenWhenThen + 3 FSM gate_blocked.

### Full file list

- **src/lib/story-spec-validator.ts** — NEW: StorySpec + validateStorySpec puro; 4 razões curto-circuito (no AC defined / no Given-When-Then / no files_created / no ao_subset); hasGivenWhenThen. 64 linhas.
- **src/services/gates/story-to-dev.gate.ts** — NEW: createStoryToDevGate; check→ResultAsync. Falha→GateFailure(gate 'Story→Dev', evidence storyId) + audit GateFailed('StoryToDev') + diagnostic via DiagnosticWriter injectado (best-effort). 110 linhas.
- **src/core/fsm.ts** — MODIFY: +estado gate_blocked (não-terminal) +evento GateBlocked; running→gate_blocked→running (re-dispatch). Transições existentes intactas.
- **tests/gates/story-to-dev.test.ts** — NEW: 12 specs — AC1-4 + writer REAL (mkdtemp, D-053) + property hasGivenWhenThen + 3 FSM gate_blocked.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Estado gate_blocked não-terminal + evento GateBlocked. | Honra 'add gate state'; permite re-dispatch após correct-course (human-in-loop). Não muda idle→running. | Q-2.4-1 |
| 2 | StorySpec mínimo (strings) + regex Given/When/Then. | Parser markdown→StorySpec é de outra story; input estruturado aqui. Pragmático, desacoplado, testável. | Q-2.4-2 |
| 3 | DiagnosticWriter injectado (port); gate ResultAsync. | Hexagonal/ports-adapters; testável (writer real no teste), seguro (root configurável), autonomia (destino redirecionável). | Q-2.4-3 |
| 4 | Error label 'Story→Dev' + audit enum 'StoryToDev'. | Honra AC literal E reutiliza GateName tipado de events.ts. Sem divergência. | Q-2.4-4 |

### Trade-offs aplicados (narrativa)

- Diagnostic é best-effort: um writer que falha (disk full) NÃO muda o verdict (GateFailure na mesma) — o gate nunca esconde a falha de spec por causa de I/O. Testado explicitamente.
- events.ts já tinha GateFailed+GateName (stub 1.a.4) → reuso em vez de inventar; a 2.4 deu-lhe o primeiro caller real.

### Open items deferidos (com onde serão resolvidos)

- **O-2.4-1:** Adapter fs real do DiagnosticWriter ainda não existe em src/ (no teste usa-se um real sobre mkdtemp); materializa-se quando o worker fizer o wiring end-to-end do pipeline.
- **fronteiras:** 2.5 (gate Dev→Review: bun test/lint verdes + retry counter + RetryExhausted), 2.6 (lifecycle FSM: wiring gate_blocked↔persistência/pause-resume).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 324 pass / 3 skip / 0 fail (era 312; +12 unit)
- **Integração:** 16 pass / 3 skip
- **FSM:** 7 estados (era 6; +gate_blocked); property totalidade 19 pass
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-2.4` → marco done + commit `feat(story-2.4): gate Story→Dev (AC validation)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 4/7. Próxima: Story 2.5 (gate Dev→Review — test suite verde + retry counter).

### Diff vs `HEAD`

```diff
diff --git a/src/core/fsm.ts b/src/core/fsm.ts
index e0c31d3..b21ae81 100644
--- a/src/core/fsm.ts
+++ b/src/core/fsm.ts
@@ -6,7 +6,8 @@
  * Persistência em SQLite (AO-40) é Story 1.a.5; queue de triggers durante
  * PAUSED (AO-2) é Story 4.x.
  *
- * **6 estados (Q-A4-1 resolved 2026-05-28 → lowercase epics.md AC):**
+ * **7 estados (Q-A4-1 resolved 2026-05-28 → lowercase epics.md AC; `gate_blocked`
+ * adicionado na Story 2.4 — Q-2.4-1, gate Story→Dev não-terminal):**
  *
  * | from \\ event              | StartRun | InterruptP1/S1/S2/S3 | OperatorResponded | OperatorPausedReview | OperatorApproved | OperatorRejected | WindowExhausted | Fail   |
  * |----------------------------|----------|----------------------|-------------------|----------------------|------------------|------------------|-----------------|--------|
@@ -26,6 +27,7 @@ export type FsmState =
   | "paused_for_interrupt"
   | "paused_awaiting_review"
   | "paused_window_exhausted"
+  | "gate_blocked"
   | "failed";
 
 export const ALL_STATES: ReadonlyArray<FsmState> = [
@@ -34,6 +36,7 @@ export const ALL_STATES: ReadonlyArray<FsmState> = [
   "paused_for_interrupt",
   "paused_awaiting_review",
   "paused_window_exhausted",
+  "gate_blocked",
   "failed",
 ];
 
@@ -48,6 +51,7 @@ export type FsmEvent =
   | { readonly kind: "OperatorApproved" }
   | { readonly kind: "OperatorRejected" }
   | { readonly kind: "WindowExhausted" }
+  | { readonly kind: "GateBlocked" }
   | { readonly kind: "Fail" };
 
 export type FsmEventKind = FsmEvent["kind"];
@@ -63,6 +67,7 @@ export const ALL_EVENT_KINDS: ReadonlyArray<FsmEventKind> = [
   "OperatorApproved",
   "OperatorRejected",
   "WindowExhausted",
+  "GateBlocked",
   "Fail",
 ];
 
@@ -85,6 +90,7 @@ export const TRANSITION_TABLE: Readonly<Record<FsmState, Partial<Record<FsmEvent
       InterruptS3: "paused_for_interrupt",
       OperatorPausedReview: "paused_awaiting_review",
       WindowExhausted: "paused_window_exhausted",
+      GateBlocked: "gate_blocked",
       Fail: "failed",
     },
     paused_for_interrupt: {
@@ -97,6 +103,12 @@ export const TRANSITION_TABLE: Readonly<Record<FsmState, Partial<Record<FsmEvent
     paused_window_exhausted: {
       OperatorResponded: "running",
     },
+    gate_blocked: {
+      // Story 2.4: gate Story→Dev falhou. Não-terminal: re-dispatch após
+      // correct-course (OperatorResponded→running). Fail → failed.
+      OperatorResponded: "running",
+      Fail: "failed",
+    },
     failed: {
       // terminal — sem transições
     },

```

---

→ Aprovar: `hdd-worker review approve story-2-4` · Pedir alterações: `hdd-worker review request-changes story-2-4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-4 --reason "<razão>"`

