<!--
  Tier-C template — full briefing, sem limite estricto de palavras.

  Story 1.a.8 (F8 FR-070..076, D-019). Superset do Tier-B + diff opcional.

  Renderizado por `summaryGenerator.finalize()`. Tier-C inclui git diff
  unified dentro de fence ```diff (Q-A8-3 Recommended); side-by-side fica
  para v1.1+. Quando `diffAgainst` é undefined, a section "Diff" exibe
  "(no diff requested)" como placeholder.
-->
---
workflowId: {{workflowId}}
workflowName: {{workflowName}}
date: {{date}}
projectName: {{projectName}}
phase: {{phase}}
tier: c
---

## Tier-C — Full · {{workflowName}}

### Contexto detalhado

{{contexto}}

### O que foi feito (verbose)

{{whatWasDone}}

### Full file list

{{fullFileList}}

### Decisões críticas (com detalhes + alternativas rejeitadas)

{{decisions}}

### Trade-offs aplicados (narrativa)

{{tradeoffs}}

### Open items deferidos (com onde serão resolvidos)

{{openItems}}

### Reviewer findings (rubric completo)

{{reviewerFindings}}

### Métricas

{{metrics}}

### Próximos passos sugeridos

{{nextSteps}}

### Diff vs `{{diffAgainst}}`

{{gitDiff}}

---

→ Aprovar: `hdd-worker review approve {{workflowId}}` · Pedir alterações: `hdd-worker review request-changes {{workflowId}} --note "<nota>"` · Rejeitar: `hdd-worker review reject {{workflowId}} --reason "<razão>"`
