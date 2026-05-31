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
workflowId: story-2-7
workflowName: Story 2.7 — DevOutput/ReviewOutput/QAOutput schemas concretos
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.7 — DevOutput/ReviewOutput/QAOutput schemas concretos · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Última story do Epic 2 (fecha 7/7). Dá tipos concretos ao parse da 2.2: 3 schemas Zod .strict() formais (Architecture Step 06, AR-050/051/052) para DevOutput/ReviewOutput/QAOutput + mapeamento SchemaDrift. Desvios do BMAD CLI (campos extra, enums inválidos) passam a ser apanhados em runtime em vez de propagarem silenciosamente.

## O que foi feito

- **src/ports/sub-agent-outputs.port.ts** — NEW: 3 schemas Zod .strict() (Step 06 fiel) + tipos inferidos + parseSubAgentOutput (unrecognized_keys→SchemaDrift{field}; resto→SchemaInvalid). 122 linhas.
- **src/adapters/bmad/cli-wrapper.adapter.ts** — MODIFY: CliWrapperInvoker extends BmadInvokerPort + wrappers runDevOutput/runReviewOutput/runQaOutput via runParsed. BmadError intacto.
- **tests/ports/sub-agent-schemas.test.ts** — NEW: 10 specs — AC1 SchemaDrift (top+nested), AC2 verdict unsure/pass reject + 4 formais aceites, AC3 happy+tipo errado, AC4 wrappers do adapter.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | verdict segue a ARQUITECTURA (APPROVED\|APPROVED_WITH_WARNINGS\|REJECTED\|BLOCKED_P1). | Conflito spec×arquitectura: o enum 'pass\|fail-gap\|fail-bug' do epics-AC era esboço superado pelo contrato formal (AO-106 + 6 P1-trigger criteria). AC2 ('rejeita unsure') preservada. Divergência AI-S0-4. | Q-2.7-1 |
| 2 | SchemaDrift no helper do port + wrappers tipados no adapter. | parseSubAgentOutput mapeia unrecognized_keys→SchemaDrift{field}; adapter ganha runDevOutput/… via runParsed. BmadError/bmad-invoker.port intactos (fora de files_modified). | Q-2.7-2 |
| 3 | Shape completa do Step 06 (todos .strict(), storyId z.string()). | Fidelidade ao contrato formal; valida os campos que o pipeline usará. | Q-2.7-3 |
| 4 | Deferir reconciliação com o devOutputSchema base da 2.3. | 2.3 mantém o base; 2.7 entrega o concreto no port. Não toca sub-agent-runner (fora de files_modified). O-2.7-1 futura. | Q-2.7-4 |

## Trade-offs aplicados

- Conflito spec×arquitectura resolvido a favor do canon formal (arquitectura) — o epics-AC era um esboço. Documentado para o downstream (P1-trigger criteria dependem do enum formal).
- Schemas .strict() em todos os níveis (incl. nested): qualquer campo extra do BMAD CLI = SchemaDrift detectável, não silent pass. Trade: schemas mais rígidos exigem outputs exactos do sub-agent.

## Open items deferidos

- **O-2.7-1:** Reconciliar o devOutputSchema base da 2.3 (sub-agent-runner) com o DevOutput concreto deste port numa story futura (a 2.3 mantém o base local por agora).
- **fronteiras:** P1-trigger criteria / gap-detector sobre ReviewOutput (Epic 4/5); a 2.7 entrega só o schema, não a lógica de decisão.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 351 pass / 3 skip / 0 fail (era 341; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Epic 2:** 7/7 — FECHADO

## Próximos passos sugeridos

1. Operador aprova `approve story-2.7` → marco done + commit `feat(story-2.7): sub-agent output schemas concretos`. Não toca workflows → push normal; verificar CI verde.
2. Epic 2 FECHADO (7/7). Próximo: retrospetiva opcional do Epic 2, ou Epic 3 (Canal WhatsApp clihelper + fallback e-mail, 6 stories).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-7` · Pedir alterações: `hdd-worker review request-changes story-2-7 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-7 --reason "<razão>"`


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
workflowId: story-2-7
workflowName: Story 2.7 — DevOutput/ReviewOutput/QAOutput schemas concretos
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.7 — DevOutput/ReviewOutput/QAOutput schemas concretos

### Contexto detalhado

Última story do Epic 2 (fecha 7/7). Dá tipos concretos ao parse da 2.2: 3 schemas Zod .strict() formais (Architecture Step 06, AR-050/051/052) para DevOutput/ReviewOutput/QAOutput + mapeamento SchemaDrift. Desvios do BMAD CLI (campos extra, enums inválidos) passam a ser apanhados em runtime em vez de propagarem silenciosamente.

### O que foi feito (verbose)

- **src/ports/sub-agent-outputs.port.ts** — NEW: 3 schemas Zod .strict() (Step 06 fiel) + tipos inferidos + parseSubAgentOutput (unrecognized_keys→SchemaDrift{field}; resto→SchemaInvalid). 122 linhas.
- **src/adapters/bmad/cli-wrapper.adapter.ts** — MODIFY: CliWrapperInvoker extends BmadInvokerPort + wrappers runDevOutput/runReviewOutput/runQaOutput via runParsed. BmadError intacto.
- **tests/ports/sub-agent-schemas.test.ts** — NEW: 10 specs — AC1 SchemaDrift (top+nested), AC2 verdict unsure/pass reject + 4 formais aceites, AC3 happy+tipo errado, AC4 wrappers do adapter.

### Full file list

- **src/ports/sub-agent-outputs.port.ts** — NEW: 3 schemas Zod .strict() (Step 06 fiel) + tipos inferidos + parseSubAgentOutput (unrecognized_keys→SchemaDrift{field}; resto→SchemaInvalid). 122 linhas.
- **src/adapters/bmad/cli-wrapper.adapter.ts** — MODIFY: CliWrapperInvoker extends BmadInvokerPort + wrappers runDevOutput/runReviewOutput/runQaOutput via runParsed. BmadError intacto.
- **tests/ports/sub-agent-schemas.test.ts** — NEW: 10 specs — AC1 SchemaDrift (top+nested), AC2 verdict unsure/pass reject + 4 formais aceites, AC3 happy+tipo errado, AC4 wrappers do adapter.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | verdict segue a ARQUITECTURA (APPROVED\|APPROVED_WITH_WARNINGS\|REJECTED\|BLOCKED_P1). | Conflito spec×arquitectura: o enum 'pass\|fail-gap\|fail-bug' do epics-AC era esboço superado pelo contrato formal (AO-106 + 6 P1-trigger criteria). AC2 ('rejeita unsure') preservada. Divergência AI-S0-4. | Q-2.7-1 |
| 2 | SchemaDrift no helper do port + wrappers tipados no adapter. | parseSubAgentOutput mapeia unrecognized_keys→SchemaDrift{field}; adapter ganha runDevOutput/… via runParsed. BmadError/bmad-invoker.port intactos (fora de files_modified). | Q-2.7-2 |
| 3 | Shape completa do Step 06 (todos .strict(), storyId z.string()). | Fidelidade ao contrato formal; valida os campos que o pipeline usará. | Q-2.7-3 |
| 4 | Deferir reconciliação com o devOutputSchema base da 2.3. | 2.3 mantém o base; 2.7 entrega o concreto no port. Não toca sub-agent-runner (fora de files_modified). O-2.7-1 futura. | Q-2.7-4 |

### Trade-offs aplicados (narrativa)

- Conflito spec×arquitectura resolvido a favor do canon formal (arquitectura) — o epics-AC era um esboço. Documentado para o downstream (P1-trigger criteria dependem do enum formal).
- Schemas .strict() em todos os níveis (incl. nested): qualquer campo extra do BMAD CLI = SchemaDrift detectável, não silent pass. Trade: schemas mais rígidos exigem outputs exactos do sub-agent.

### Open items deferidos (com onde serão resolvidos)

- **O-2.7-1:** Reconciliar o devOutputSchema base da 2.3 (sub-agent-runner) com o DevOutput concreto deste port numa story futura (a 2.3 mantém o base local por agora).
- **fronteiras:** P1-trigger criteria / gap-detector sobre ReviewOutput (Epic 4/5); a 2.7 entrega só o schema, não a lógica de decisão.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 351 pass / 3 skip / 0 fail (era 341; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Epic 2:** 7/7 — FECHADO

### Próximos passos sugeridos

1. Operador aprova `approve story-2.7` → marco done + commit `feat(story-2.7): sub-agent output schemas concretos`. Não toca workflows → push normal; verificar CI verde.
2. Epic 2 FECHADO (7/7). Próximo: retrospetiva opcional do Epic 2, ou Epic 3 (Canal WhatsApp clihelper + fallback e-mail, 6 stories).

### Diff vs `HEAD`

```diff
diff --git a/src/adapters/bmad/cli-wrapper.adapter.ts b/src/adapters/bmad/cli-wrapper.adapter.ts
index 193489e..56b4549 100644
--- a/src/adapters/bmad/cli-wrapper.adapter.ts
+++ b/src/adapters/bmad/cli-wrapper.adapter.ts
@@ -10,7 +10,7 @@
  */
 
 import type { ZodType } from "zod";
-import { err, ok, type Result } from "../../lib/result.ts";
+import { err, ok, type Result, type ResultAsync } from "../../lib/result.ts";
 import type {
   BmadError,
   BmadInvokeOptions,
@@ -19,6 +19,24 @@ import type {
   BmadResult,
 } from "../../ports/bmad-invoker.port.ts";
 import type { SpawnOptions, SpawnPort } from "../../ports/spawn.port.ts";
+import {
+  type DevOutput,
+  devOutputSchema,
+  type QAOutput,
+  qaOutputSchema,
+  type ReviewOutput,
+  reviewOutputSchema,
+} from "../../ports/sub-agent-outputs.port.ts";
+
+/**
+ * `BmadInvokerPort` + wrappers tipados que ligam os schemas concretos da Story 2.7
+ * (Q-2.7-2). Cada wrapper delega em `runParsed` com o schema `.strict()` respectivo.
+ */
+export interface CliWrapperInvoker extends BmadInvokerPort {
+  runDevOutput(skill: string, opts?: BmadInvokeOptions): ResultAsync<DevOutput, BmadError>;
+  runReviewOutput(skill: string, opts?: BmadInvokeOptions): ResultAsync<ReviewOutput, BmadError>;
+  runQaOutput(skill: string, opts?: BmadInvokeOptions): ResultAsync<QAOutput, BmadError>;
+}
 
 const CLAUDE_BIN = "claude";
 const DEFAULT_TIMEOUT_MS = 30_000;
@@ -71,7 +89,7 @@ function extractResult(stdout: string): Result<{ result: string; isError: boolea
   return err({ kind: "BmadOutputMalformed", detail: "sem evento type:'result' no stream-json" });
 }
 
-export function createCliWrapperAdapter(deps: CliWrapperDeps): BmadInvokerPort {
+export function createCliWrapperAdapter(deps: CliWrapperDeps): CliWrapperInvoker {
   const bin = deps.claudeBin ?? CLAUDE_BIN;
 
   const run = (skill: string, opts?: BmadInvokeOptions) => {
@@ -97,20 +115,25 @@ export function createCliWrapperAdapter(deps: CliWrapperDeps): BmadInvokerPort {
       });
   };
 
+  const runParsed = <T>(skill: string, schema: ZodType<T>, opts?: BmadInvokeOptions) =>
+    run(skill, opts).andThen((r): Result<T, BmadError> => {
+      let parsed: unknown;
+      try {
+        parsed = JSON.parse(r.result);
+      } catch {
+        return err({ kind: "BmadOutputMalformed", detail: "'.result' não é JSON válido" });
+      }
+      const v = schema.safeParse(parsed);
+      if (!v.success) return err({ kind: "BmadOutputMalformed", detail: v.error.message });
+      return ok(v.data);
+    });
+
   return {
     run,
-    runParsed<T>(skill: string, schema: ZodType<T>, opts?: BmadInvokeOptions) {
-      return run(skill, opts).andThen((r): Result<T, BmadError> => {
-        let parsed: unknown;
-        try {
-          parsed = JSON.parse(r.result);
-        } catch {
-          return err({ kind: "BmadOutputMalformed", detail: "'.result' não é JSON válido" });
-        }
-        const v = schema.safeParse(parsed);
-        if (!v.success) return err({ kind: "BmadOutputMalformed", detail: v.error.message });
-        return ok(v.data);
-      });
-    },
+    runParsed,
+    // Wrappers tipados (Story 2.7, Q-2.7-2) — usam os schemas concretos.
+    runDevOutput: (skill, opts) => runParsed(skill, devOutputSchema, opts),
+    runReviewOutput: (skill, opts) => runParsed(skill, reviewOutputSchema, opts),
+    runQaOutput: (skill, opts) => runParsed(skill, qaOutputSchema, opts),
   };
 }

```

---

→ Aprovar: `hdd-worker review approve story-2-7` · Pedir alterações: `hdd-worker review request-changes story-2-7 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-7 --reason "<razão>"`

