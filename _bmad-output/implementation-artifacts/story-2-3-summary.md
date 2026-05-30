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
workflowId: story-2-3
workflowName: Story 2.3 — Sub-agent context isolation per workflow
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.3 — Sub-agent context isolation per workflow · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Dá isolamento à ponte da 2.2: cada sub-agente (Dev/Review/QA) corre em célula própria — RunContext (1.a.9), workdir efémero, audit discriminado por subAgent. O núcleo não é o isolamento, é o wiring de segurança da AC3 (Pre-Mortem #2 AI Safety): o Dev é output-only e TODO write passa por apply-diff.service (1.b.1), que rejeita path traversal. FSM (2.6) e schemas concretos (2.7) ficam para depois.

## O que foi feito

- **src/lib/workdir-mount.ts** — NEW: createWorkdir (mkdtempSync efémero) + handoffArtifact (único canal entre workdirs; valida com sanitizeRelPath contra origem+destino) + cleanupWorkdir. 84 linhas.
- **src/services/sub-agent-runner.service.ts** — NEW: createSubAgentRunner; runDev (output-only, aplica diff via apply-diff bound ao workdir) + runReadOnly + handoff; emitStarted (runId distinto + subAgent no payload). 148 linhas.
- **tests/services/sub-agent-runner.test.ts** — NEW: 8 specs — AC1 property (fast-check, 25 runs), AC2 handoff (workdirs reais), AC3 diff malicioso→PathTraversal+SecurityViolation + output-only.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | subAgent no payload + runId distinto por sub-agente. | Zero churn em audit.port/run-context → honra files_modified:—; AC1 satisfeito. | Q-2.3-1 |
| 2 | Workdir temp efémero (mkdtempSync). | Higiénico/seguro; nada persiste entre runs (evita soft convention rot). | Q-2.3-2 |
| 3 | Dev output-only — allowedTools sem Write/Edit. | Least-privilege; força TODO write pelo apply-diff (AC3). Alinha 2.2/O-2.2-2. | Q-2.3-3 |
| 4 | AC1 property-based (fast-check). | Honra 'property AC'; cobre o espaço de runIds vs example fixo. | Q-2.3-4 |

## Trade-offs aplicados

- AC3 (núcleo AI Safety) é wiring enforcement de composição: negar Write/Edit ao Dev E centralizar o write no apply-diff — nenhuma das medidas sozinha basta ([[project-hdd-composition-risks]]).
- handoffArtifact valida contra origem E destino (não só destino) — defesa redundante barata; o canal explícito é o que satisfaz a AC2 ('não fs access directo').

## Open items deferidos

- **O-2.3-1:** devOutputSchema é base ({files:[{path,contents}]}); os concretos DevOutput/ReviewOutput/QAOutput são da Story 2.7 (runParsed já aceita schema injectável).
- **fronteiras:** 2.6 (FSM pause/resume + state-transition no onComplete da 2.2), 2.7 (schemas concretos). A 2.3 só isola contexto — não transita FSM.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 312 pass / 3 skip / 0 fail (era 304; +8 unit)
- **Integração:** 16 pass / 3 skip (sem novos; claude -p gated HDD_BMAD_LIVE)
- **Type-check:** clean
- **Lint:** exit 0 (payload["subAgent"] bracket por noPropertyAccessFromIndexSignature)
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-2.3` → marco done + commit `feat(story-2.3): sub-agent context isolation`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 3/7. Próxima: Story 2.4 (gate Story→Dev — AC validation).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-3` · Pedir alterações: `hdd-worker review request-changes story-2-3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-3 --reason "<razão>"`


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
workflowId: story-2-3
workflowName: Story 2.3 — Sub-agent context isolation per workflow
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.3 — Sub-agent context isolation per workflow

### Contexto detalhado

Dá isolamento à ponte da 2.2: cada sub-agente (Dev/Review/QA) corre em célula própria — RunContext (1.a.9), workdir efémero, audit discriminado por subAgent. O núcleo não é o isolamento, é o wiring de segurança da AC3 (Pre-Mortem #2 AI Safety): o Dev é output-only e TODO write passa por apply-diff.service (1.b.1), que rejeita path traversal. FSM (2.6) e schemas concretos (2.7) ficam para depois.

### O que foi feito (verbose)

- **src/lib/workdir-mount.ts** — NEW: createWorkdir (mkdtempSync efémero) + handoffArtifact (único canal entre workdirs; valida com sanitizeRelPath contra origem+destino) + cleanupWorkdir. 84 linhas.
- **src/services/sub-agent-runner.service.ts** — NEW: createSubAgentRunner; runDev (output-only, aplica diff via apply-diff bound ao workdir) + runReadOnly + handoff; emitStarted (runId distinto + subAgent no payload). 148 linhas.
- **tests/services/sub-agent-runner.test.ts** — NEW: 8 specs — AC1 property (fast-check, 25 runs), AC2 handoff (workdirs reais), AC3 diff malicioso→PathTraversal+SecurityViolation + output-only.

### Full file list

- **src/lib/workdir-mount.ts** — NEW: createWorkdir (mkdtempSync efémero) + handoffArtifact (único canal entre workdirs; valida com sanitizeRelPath contra origem+destino) + cleanupWorkdir. 84 linhas.
- **src/services/sub-agent-runner.service.ts** — NEW: createSubAgentRunner; runDev (output-only, aplica diff via apply-diff bound ao workdir) + runReadOnly + handoff; emitStarted (runId distinto + subAgent no payload). 148 linhas.
- **tests/services/sub-agent-runner.test.ts** — NEW: 8 specs — AC1 property (fast-check, 25 runs), AC2 handoff (workdirs reais), AC3 diff malicioso→PathTraversal+SecurityViolation + output-only.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | subAgent no payload + runId distinto por sub-agente. | Zero churn em audit.port/run-context → honra files_modified:—; AC1 satisfeito. | Q-2.3-1 |
| 2 | Workdir temp efémero (mkdtempSync). | Higiénico/seguro; nada persiste entre runs (evita soft convention rot). | Q-2.3-2 |
| 3 | Dev output-only — allowedTools sem Write/Edit. | Least-privilege; força TODO write pelo apply-diff (AC3). Alinha 2.2/O-2.2-2. | Q-2.3-3 |
| 4 | AC1 property-based (fast-check). | Honra 'property AC'; cobre o espaço de runIds vs example fixo. | Q-2.3-4 |

### Trade-offs aplicados (narrativa)

- AC3 (núcleo AI Safety) é wiring enforcement de composição: negar Write/Edit ao Dev E centralizar o write no apply-diff — nenhuma das medidas sozinha basta ([[project-hdd-composition-risks]]).
- handoffArtifact valida contra origem E destino (não só destino) — defesa redundante barata; o canal explícito é o que satisfaz a AC2 ('não fs access directo').

### Open items deferidos (com onde serão resolvidos)

- **O-2.3-1:** devOutputSchema é base ({files:[{path,contents}]}); os concretos DevOutput/ReviewOutput/QAOutput são da Story 2.7 (runParsed já aceita schema injectável).
- **fronteiras:** 2.6 (FSM pause/resume + state-transition no onComplete da 2.2), 2.7 (schemas concretos). A 2.3 só isola contexto — não transita FSM.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 312 pass / 3 skip / 0 fail (era 304; +8 unit)
- **Integração:** 16 pass / 3 skip (sem novos; claude -p gated HDD_BMAD_LIVE)
- **Type-check:** clean
- **Lint:** exit 0 (payload["subAgent"] bracket por noPropertyAccessFromIndexSignature)
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-2.3` → marco done + commit `feat(story-2.3): sub-agent context isolation`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 3/7. Próxima: Story 2.4 (gate Story→Dev — AC validation).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-2-3` · Pedir alterações: `hdd-worker review request-changes story-2-3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-3 --reason "<razão>"`

