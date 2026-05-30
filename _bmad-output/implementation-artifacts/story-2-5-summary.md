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
workflowId: story-2-5
workflowName: Story 2.5 — Gate Dev→Review (test suite verde)
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.5 — Gate Dev→Review (test suite verde) · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Segundo gate do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Garante que o Review só recebe diff que passa: bun test exit 0, bun run lint exit 0, e files_created declarados existem (FR-050 pt2). Introduz o retry counter (FR-012) que, à 5ª falha, devolve RetryExhausted — o sinal para o trigger S2 (Epic 4) e recovery (Epic 5). Reusa o padrão de gate da 2.4 + SpawnPort da 1.a.3.

## O que foi feito

- **src/services/gates/dev-to-review.gate.ts** — NEW: createDevToReviewGate; corre bun test/lint via SpawnPort + files_created via probe; short-circuit; falha→GateFailure+audit+diagnostic+counter++; 5ª→RetryExhausted. 173 linhas.
- **tests/gates/dev-to-review.test.ts** — NEW: 7 specs — AC1 tests red, AC2 RetryExhausted(5), AC3 lint red/files missing, AC4 happy+reset, SpawnError propagado. SpawnPort fake keyed por args; DiagnosticWriter REAL (mkdtemp, D-053).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Retry counter Map in-process por instância do gate. | Precedente confirmation-gate; reset em sucesso; persistência DB = Epic 4.x. Casa o literal da AC ('counter incremented'). | Q-2.5-1 |
| 2 | files_created via probe fileExists injectado. | Testável, sem acoplar o gate ao node:fs. | Q-2.5-2 |
| 3 | Short-circuit na 1ª falha (test→lint→files). | Rápido; uma razão de cada vez; alinha 'corrige uma coisa por retry'. | Q-2.5-3 |
| 4 | DiagnosticWriter importado da 2.4 (não extraído). | Zero churn; honra files_modified:—. Extração para port partilhado = open item futuro. | Q-2.5-4 |

## Trade-offs aplicados

- SpawnPort devolve ok({exitCode}) mesmo em exit≠0 — o gate decide o significado (tests red). SpawnError real (binário ausente) é infra, propagado e NÃO conta como retry — separa falha-do-Dev de falha-de-ambiente.
- GateFailure/RetryExhausted desta story são tipos próprios (gate 'Dev→Review') distintos dos da 2.4; um GateFailure<Gate,Reason> genérico fica como refactor futuro para não tocar a 2.4 (files_modified:—).

## Open items deferidos

- **O-2.5-1:** DiagnosticWriter está definido em story-to-dev.gate.ts (2.4) e importado aqui; extrair para src/ports/diagnostic-writer.port.ts quando um 3º caller aparecer (evita acoplamento gate→gate).
- **fronteiras:** 2.6 (wiring RetryExhausted→FSM/persistência do counter + pause-resume), Epic 4 (trigger S2 após RetryExhausted), unificação GateFailure genérico.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 331 pass / 3 skip / 0 fail (era 324; +7 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-2.5` → marco done + commit `feat(story-2.5): gate Dev→Review (test suite verde)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 5/7. Próxima: Story 2.6 (worker lifecycle start/pause/resume — FSM + persistência; liga o gate_blocked/RetryExhausted ao state real).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-5` · Pedir alterações: `hdd-worker review request-changes story-2-5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-5 --reason "<razão>"`


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
workflowId: story-2-5
workflowName: Story 2.5 — Gate Dev→Review (test suite verde)
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.5 — Gate Dev→Review (test suite verde)

### Contexto detalhado

Segundo gate do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Garante que o Review só recebe diff que passa: bun test exit 0, bun run lint exit 0, e files_created declarados existem (FR-050 pt2). Introduz o retry counter (FR-012) que, à 5ª falha, devolve RetryExhausted — o sinal para o trigger S2 (Epic 4) e recovery (Epic 5). Reusa o padrão de gate da 2.4 + SpawnPort da 1.a.3.

### O que foi feito (verbose)

- **src/services/gates/dev-to-review.gate.ts** — NEW: createDevToReviewGate; corre bun test/lint via SpawnPort + files_created via probe; short-circuit; falha→GateFailure+audit+diagnostic+counter++; 5ª→RetryExhausted. 173 linhas.
- **tests/gates/dev-to-review.test.ts** — NEW: 7 specs — AC1 tests red, AC2 RetryExhausted(5), AC3 lint red/files missing, AC4 happy+reset, SpawnError propagado. SpawnPort fake keyed por args; DiagnosticWriter REAL (mkdtemp, D-053).

### Full file list

- **src/services/gates/dev-to-review.gate.ts** — NEW: createDevToReviewGate; corre bun test/lint via SpawnPort + files_created via probe; short-circuit; falha→GateFailure+audit+diagnostic+counter++; 5ª→RetryExhausted. 173 linhas.
- **tests/gates/dev-to-review.test.ts** — NEW: 7 specs — AC1 tests red, AC2 RetryExhausted(5), AC3 lint red/files missing, AC4 happy+reset, SpawnError propagado. SpawnPort fake keyed por args; DiagnosticWriter REAL (mkdtemp, D-053).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Retry counter Map in-process por instância do gate. | Precedente confirmation-gate; reset em sucesso; persistência DB = Epic 4.x. Casa o literal da AC ('counter incremented'). | Q-2.5-1 |
| 2 | files_created via probe fileExists injectado. | Testável, sem acoplar o gate ao node:fs. | Q-2.5-2 |
| 3 | Short-circuit na 1ª falha (test→lint→files). | Rápido; uma razão de cada vez; alinha 'corrige uma coisa por retry'. | Q-2.5-3 |
| 4 | DiagnosticWriter importado da 2.4 (não extraído). | Zero churn; honra files_modified:—. Extração para port partilhado = open item futuro. | Q-2.5-4 |

### Trade-offs aplicados (narrativa)

- SpawnPort devolve ok({exitCode}) mesmo em exit≠0 — o gate decide o significado (tests red). SpawnError real (binário ausente) é infra, propagado e NÃO conta como retry — separa falha-do-Dev de falha-de-ambiente.
- GateFailure/RetryExhausted desta story são tipos próprios (gate 'Dev→Review') distintos dos da 2.4; um GateFailure<Gate,Reason> genérico fica como refactor futuro para não tocar a 2.4 (files_modified:—).

### Open items deferidos (com onde serão resolvidos)

- **O-2.5-1:** DiagnosticWriter está definido em story-to-dev.gate.ts (2.4) e importado aqui; extrair para src/ports/diagnostic-writer.port.ts quando um 3º caller aparecer (evita acoplamento gate→gate).
- **fronteiras:** 2.6 (wiring RetryExhausted→FSM/persistência do counter + pause-resume), Epic 4 (trigger S2 após RetryExhausted), unificação GateFailure genérico.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 331 pass / 3 skip / 0 fail (era 324; +7 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-2.5` → marco done + commit `feat(story-2.5): gate Dev→Review (test suite verde)`. Não toca workflows → push normal; verificar CI verde.
2. M1/Epic 2: 5/7. Próxima: Story 2.6 (worker lifecycle start/pause/resume — FSM + persistência; liga o gate_blocked/RetryExhausted ao state real).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-2-5` · Pedir alterações: `hdd-worker review request-changes story-2-5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-5 --reason "<razão>"`

