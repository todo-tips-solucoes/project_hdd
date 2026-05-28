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
workflowId: {{workflowId}}
workflowName: {{workflowName}}
date: {{date}}
projectName: {{projectName}}
phase: {{phase}}
tier: b
---

# {{workflowName}} · {{projectName}} · {{date}}

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

{{contexto}}

## O que foi feito

{{whatWasDone}}

## Decisões críticas

{{decisions}}

## Trade-offs aplicados

{{tradeoffs}}

## Open items deferidos

{{openItems}}

## Reviewer findings

{{reviewerFindings}}

## Métricas

{{metrics}}

## Próximos passos sugeridos

{{nextSteps}}

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve {{workflowId}}` · Pedir alterações: `hdd-worker review request-changes {{workflowId}} --note "<nota>"` · Rejeitar: `hdd-worker review reject {{workflowId}} --reason "<razão>"`
