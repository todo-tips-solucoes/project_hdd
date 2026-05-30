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
workflowId: story-2-2
workflowName: Story 2.2 — BMAD invoker port + CLI-wrapper adapter
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.2 — BMAD invoker port + CLI-wrapper adapter · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Coração do M1: a ponte worker→agentes BMAD. D-052 (ratificado): não há skill runner no bmad-method; invoca-se via `claude -p` headless. Esta story entrega o port + adapter + parse do stream-json + validação Zod + hooks FR-005. Contexto isolado (2.3), FSM (2.6) e schemas concretos (2.7) ficam para depois.

## O que foi feito

- **src/ports/bmad-invoker.port.ts** — NEW: BmadInvokerPort (run/runParsed<T>) + BmadResult/BmadError + BmadLifecycleHooks (FR-005).
- **src/adapters/bmad/cli-wrapper.adapter.ts** — NEW: claude -p --output-format stream-json --verbose --allowedTools via SpawnPort; parseia evento type:result; runParsed valida JSON com Zod.
- **tests/adapters/bmad-invoker.test.ts** — NEW: 8 specs (run/args D-052, BmadFailed, BmadOutputMalformed, SpawnError propagado, runParsed ok/malformado, hooks).
- **tests/integration/bmad-invoker.integration.test.ts** — NEW: claude -p real, opt-in HDD_BMAD_LIVE (skip por defeito).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Hooks FR-005 = pontos de extensão + audit event. | bmad_save_artifact/complete_workflow não existem como ferramenta; onArtifact/onComplete no port; state-transition diferido p/ 2.6. | Q-2.2-3 |
| 2 | Parse real do stream-json (evento type:result). | Formato sondado empiricamente; extrai .result/is_error; runParsed valida com Zod. | Q-2.2-2 |
| 3 | fake-spawn unit + integração real opt-in (HDD_BMAD_LIVE). | claude -p real custa tokens/é lento/não-determinístico; gated evita custo recorrente. Sonda manual já validou. | Q-2.2-4 |
| 4 | prompt template + allowedTools restrito por skill. | Least-privilege; configurável depois. | Q-2.2-1 |

## Trade-offs aplicados

- Sondei o claude -p real (~$0.15) para conhecer o formato do stream-json em vez de o inventar — descobri que --verbose é obrigatório com stream-json+--print (achado que o StorySpec não tinha).
- AC3/AC4 (hooks) materializados como pontos de extensão minimalistas: honra FR-005 sem ultrapassar as fronteiras 2.3 (RunContext) / 2.6 (FSM) — o wiring completo vem nessas stories.

## Open items deferidos

- **O-2.2-1:** Integração real claude -p só corre com HDD_BMAD_LIVE=1 (opt-in); considerar um job CI dedicado com claude autenticado + budget, se quisermos cobertura live regular.
- **O-2.2-2:** Prompt template + allowedTools por skill são mínimos — afinar por skill (ex: dev-story precisa de Write/Edit; code-review só Read) quando a 2.3/Epic avançar.
- **fronteiras:** 2.3 (RunContext/workdir + apply-diff), 2.6 (FSM state-transition no onComplete), 2.7 (DevOutput/ReviewOutput/QAOutput schemas concretos para runParsed).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 304 pass / 3 skip / 0 fail (era 296; +8 unit; +1 skip integração opt-in)
- **Type-check:** clean
- **Lint:** exit 0 (no-unsafe-assignment do JSON.parse corrigido com cast)
- **claude CLI:** v2.1.158; stream-json+--verbose; evento type:result confirmado
- **Deps adicionadas:** 0 (zod já existia)

## Próximos passos sugeridos

1. Operador aprova `approve story-2.2` → marco done + commit `feat(story-2.2): BMAD invoker port + cli-wrapper (claude -p, D-052)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 2/7. Próxima: Story 2.3 (sub-agent context isolation — RunContext/workdir + wiring apply-diff; usa o BmadInvoker desta story).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-2` · Pedir alterações: `hdd-worker review request-changes story-2-2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-2 --reason "<razão>"`


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
workflowId: story-2-2
workflowName: Story 2.2 — BMAD invoker port + CLI-wrapper adapter
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.2 — BMAD invoker port + CLI-wrapper adapter

### Contexto detalhado

Coração do M1: a ponte worker→agentes BMAD. D-052 (ratificado): não há skill runner no bmad-method; invoca-se via `claude -p` headless. Esta story entrega o port + adapter + parse do stream-json + validação Zod + hooks FR-005. Contexto isolado (2.3), FSM (2.6) e schemas concretos (2.7) ficam para depois.

### O que foi feito (verbose)

- **src/ports/bmad-invoker.port.ts** — NEW: BmadInvokerPort (run/runParsed<T>) + BmadResult/BmadError + BmadLifecycleHooks (FR-005).
- **src/adapters/bmad/cli-wrapper.adapter.ts** — NEW: claude -p --output-format stream-json --verbose --allowedTools via SpawnPort; parseia evento type:result; runParsed valida JSON com Zod.
- **tests/adapters/bmad-invoker.test.ts** — NEW: 8 specs (run/args D-052, BmadFailed, BmadOutputMalformed, SpawnError propagado, runParsed ok/malformado, hooks).
- **tests/integration/bmad-invoker.integration.test.ts** — NEW: claude -p real, opt-in HDD_BMAD_LIVE (skip por defeito).

### Full file list

- **src/ports/bmad-invoker.port.ts** — NEW: BmadInvokerPort (run/runParsed<T>) + BmadResult/BmadError + BmadLifecycleHooks (FR-005).
- **src/adapters/bmad/cli-wrapper.adapter.ts** — NEW: claude -p --output-format stream-json --verbose --allowedTools via SpawnPort; parseia evento type:result; runParsed valida JSON com Zod.
- **tests/adapters/bmad-invoker.test.ts** — NEW: 8 specs (run/args D-052, BmadFailed, BmadOutputMalformed, SpawnError propagado, runParsed ok/malformado, hooks).
- **tests/integration/bmad-invoker.integration.test.ts** — NEW: claude -p real, opt-in HDD_BMAD_LIVE (skip por defeito).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Hooks FR-005 = pontos de extensão + audit event. | bmad_save_artifact/complete_workflow não existem como ferramenta; onArtifact/onComplete no port; state-transition diferido p/ 2.6. | Q-2.2-3 |
| 2 | Parse real do stream-json (evento type:result). | Formato sondado empiricamente; extrai .result/is_error; runParsed valida com Zod. | Q-2.2-2 |
| 3 | fake-spawn unit + integração real opt-in (HDD_BMAD_LIVE). | claude -p real custa tokens/é lento/não-determinístico; gated evita custo recorrente. Sonda manual já validou. | Q-2.2-4 |
| 4 | prompt template + allowedTools restrito por skill. | Least-privilege; configurável depois. | Q-2.2-1 |

### Trade-offs aplicados (narrativa)

- Sondei o claude -p real (~$0.15) para conhecer o formato do stream-json em vez de o inventar — descobri que --verbose é obrigatório com stream-json+--print (achado que o StorySpec não tinha).
- AC3/AC4 (hooks) materializados como pontos de extensão minimalistas: honra FR-005 sem ultrapassar as fronteiras 2.3 (RunContext) / 2.6 (FSM) — o wiring completo vem nessas stories.

### Open items deferidos (com onde serão resolvidos)

- **O-2.2-1:** Integração real claude -p só corre com HDD_BMAD_LIVE=1 (opt-in); considerar um job CI dedicado com claude autenticado + budget, se quisermos cobertura live regular.
- **O-2.2-2:** Prompt template + allowedTools por skill são mínimos — afinar por skill (ex: dev-story precisa de Write/Edit; code-review só Read) quando a 2.3/Epic avançar.
- **fronteiras:** 2.3 (RunContext/workdir + apply-diff), 2.6 (FSM state-transition no onComplete), 2.7 (DevOutput/ReviewOutput/QAOutput schemas concretos para runParsed).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 304 pass / 3 skip / 0 fail (era 296; +8 unit; +1 skip integração opt-in)
- **Type-check:** clean
- **Lint:** exit 0 (no-unsafe-assignment do JSON.parse corrigido com cast)
- **claude CLI:** v2.1.158; stream-json+--verbose; evento type:result confirmado
- **Deps adicionadas:** 0 (zod já existia)

### Próximos passos sugeridos

1. Operador aprova `approve story-2.2` → marco done + commit `feat(story-2.2): BMAD invoker port + cli-wrapper (claude -p, D-052)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 2/7. Próxima: Story 2.3 (sub-agent context isolation — RunContext/workdir + wiring apply-diff; usa o BmadInvoker desta story).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-2-2` · Pedir alterações: `hdd-worker review request-changes story-2-2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-2 --reason "<razão>"`

