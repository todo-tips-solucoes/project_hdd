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
workflowId: story-3-3
workflowName: Story 3.3 — 6 templates UTILITY (design + register tracking)
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 3.3 — 6 templates UTILITY (design + register tracking) · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Story docs-pesada: catálogo tipado dos 6 templates UTILITY + tracking manual da aprovação Meta (sem API). Gate de negócio: 3 aprovados = M1 mínimo viável (FR-026). É a peça que destrava o envio real (adapters 3.1/3.2 correm em dry-run até haver templates aprovados). O spot-check AI-E2-3 apanhou 2 divergências cross-artifact antes de implementar.

## O que foi feito

- **src/lib/template-catalog.ts** — NEW: TEMPLATE_CATALOG (6× {name, trigger, var counts, buttons[doc real], m1Required}) + parseSubmissionState + evaluateM1. Puro. 152 linhas.
- **scripts/template-submission-status.ts + template-submission-status.json** — NEW: script lê estado JSON + catálogo → checklist + M1 gate (exit 0/1). Estado manual (operador actualiza).
- **whatsapp-templates-utility.md** — REFINE: {CLIHELPER_BASE_URL} env, m1_required, shape Meta-component autoritativo (O-3.1-1), nota buttons vs PAYLOAD_MAP (O-3.3-1).
- **tests/lib/template-catalog.test.ts** — NEW: 11 specs — nomes, m1Required, buttons, parseSubmissionState, evaluateM1.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Diferir reconciliação do shape errado da 3.1; catálogo com shape correcto. | Spot-check: template[] real (Meta-component) ≠ assumido na 3.1. Sem dano live (dry-run); o catálogo é a fonte da verdade; o wiring do adapter é follow-up. Respeita escopo docs. | Q-3.3-1 |
| 2 | Estado de submissão em JSON separado (não YAML). | JSON evita dep de parser YAML (0-deps mantido); separa spec imutável de estado mutável. | Q-3.3-2 |
| 3 | M1 gate via exit code (PASS/FAIL). | 3 m1Required approved → exit 0; senão exit 1 + lista. Gate-able como runbook-completeness.sh. | Q-3.3-3 |

## Trade-offs aplicados

- O spot-check AI-E2-3 (disciplina da retro do Epic 2) provou-se DE NOVO: apanhou 2 divergências silenciosas — o shape template[] errado na 3.1 (O-3.1-1, agora 'shape conhecido') e os buttons doc vs PAYLOAD_MAP (O-3.3-1, p/ 3.4) — antes de implementar, não no fim. Lição meta: o spot-check tem de ler os docs de planning, não só architecture.md.
- Catálogo é a fonte da verdade tipada; o adapter (3.1) ainda envia o shape errado mas só em dry-run — reconciliação deliberadamente diferida para não enfiar um rewrite de schema numa story docs.

## Open items deferidos

- **O-3.1-1:** Reconciliar payload-schema.ts/buildBody da 3.1 com o shape Meta-component real (consumir template-catalog.ts) — follow-up dedicado.
- **O-3.3-1:** Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — Story 3.4 (parser inbound).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 383 pass / 3 skip / 0 fail (era 372; +11 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0 (JSON em vez de YAML)

## Próximos passos sugeridos

1. Operador aprova `approve story-3.3` → marco done + commit `feat(story-3.3): catálogo de templates + tracking`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 3/6. Próxima: Story 3.4 (InboundCommandPort + Hono /callback + Quick Reply parsing; reconcilia O-3.3-1; cuidado O-B5-3 webhook-mock).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-3-3` · Pedir alterações: `hdd-worker review request-changes story-3-3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-3 --reason "<razão>"`


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
workflowId: story-3-3
workflowName: Story 3.3 — 6 templates UTILITY (design + register tracking)
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 3.3 — 6 templates UTILITY (design + register tracking)

### Contexto detalhado

Story docs-pesada: catálogo tipado dos 6 templates UTILITY + tracking manual da aprovação Meta (sem API). Gate de negócio: 3 aprovados = M1 mínimo viável (FR-026). É a peça que destrava o envio real (adapters 3.1/3.2 correm em dry-run até haver templates aprovados). O spot-check AI-E2-3 apanhou 2 divergências cross-artifact antes de implementar.

### O que foi feito (verbose)

- **src/lib/template-catalog.ts** — NEW: TEMPLATE_CATALOG (6× {name, trigger, var counts, buttons[doc real], m1Required}) + parseSubmissionState + evaluateM1. Puro. 152 linhas.
- **scripts/template-submission-status.ts + template-submission-status.json** — NEW: script lê estado JSON + catálogo → checklist + M1 gate (exit 0/1). Estado manual (operador actualiza).
- **whatsapp-templates-utility.md** — REFINE: {CLIHELPER_BASE_URL} env, m1_required, shape Meta-component autoritativo (O-3.1-1), nota buttons vs PAYLOAD_MAP (O-3.3-1).
- **tests/lib/template-catalog.test.ts** — NEW: 11 specs — nomes, m1Required, buttons, parseSubmissionState, evaluateM1.

### Full file list

- **src/lib/template-catalog.ts** — NEW: TEMPLATE_CATALOG (6× {name, trigger, var counts, buttons[doc real], m1Required}) + parseSubmissionState + evaluateM1. Puro. 152 linhas.
- **scripts/template-submission-status.ts + template-submission-status.json** — NEW: script lê estado JSON + catálogo → checklist + M1 gate (exit 0/1). Estado manual (operador actualiza).
- **whatsapp-templates-utility.md** — REFINE: {CLIHELPER_BASE_URL} env, m1_required, shape Meta-component autoritativo (O-3.1-1), nota buttons vs PAYLOAD_MAP (O-3.3-1).
- **tests/lib/template-catalog.test.ts** — NEW: 11 specs — nomes, m1Required, buttons, parseSubmissionState, evaluateM1.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Diferir reconciliação do shape errado da 3.1; catálogo com shape correcto. | Spot-check: template[] real (Meta-component) ≠ assumido na 3.1. Sem dano live (dry-run); o catálogo é a fonte da verdade; o wiring do adapter é follow-up. Respeita escopo docs. | Q-3.3-1 |
| 2 | Estado de submissão em JSON separado (não YAML). | JSON evita dep de parser YAML (0-deps mantido); separa spec imutável de estado mutável. | Q-3.3-2 |
| 3 | M1 gate via exit code (PASS/FAIL). | 3 m1Required approved → exit 0; senão exit 1 + lista. Gate-able como runbook-completeness.sh. | Q-3.3-3 |

### Trade-offs aplicados (narrativa)

- O spot-check AI-E2-3 (disciplina da retro do Epic 2) provou-se DE NOVO: apanhou 2 divergências silenciosas — o shape template[] errado na 3.1 (O-3.1-1, agora 'shape conhecido') e os buttons doc vs PAYLOAD_MAP (O-3.3-1, p/ 3.4) — antes de implementar, não no fim. Lição meta: o spot-check tem de ler os docs de planning, não só architecture.md.
- Catálogo é a fonte da verdade tipada; o adapter (3.1) ainda envia o shape errado mas só em dry-run — reconciliação deliberadamente diferida para não enfiar um rewrite de schema numa story docs.

### Open items deferidos (com onde serão resolvidos)

- **O-3.1-1:** Reconciliar payload-schema.ts/buildBody da 3.1 com o shape Meta-component real (consumir template-catalog.ts) — follow-up dedicado.
- **O-3.3-1:** Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — Story 3.4 (parser inbound).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 383 pass / 3 skip / 0 fail (era 372; +11 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0 (JSON em vez de YAML)

### Próximos passos sugeridos

1. Operador aprova `approve story-3.3` → marco done + commit `feat(story-3.3): catálogo de templates + tracking`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 3/6. Próxima: Story 3.4 (InboundCommandPort + Hono /callback + Quick Reply parsing; reconcilia O-3.3-1; cuidado O-B5-3 webhook-mock).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-3-3` · Pedir alterações: `hdd-worker review request-changes story-3-3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-3 --reason "<razão>"`

