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
workflowId: story-1b2
workflowName: Story 1.b.2 — Two-step confirmation acções irreversíveis
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.b.2 — Two-step confirmation acções irreversíveis · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

2ª story do Epic 1.b e DRB BLOCKER #2 (AO-155+AO-164). Gate de two-step confirmation: worker LLM-driven não executa acção destrutiva (deploy/branch-delete/force-push/schema-drop/audit-purge) sem código 6-char confirmado por humano via WhatsApp, ou bypass CLI human-driven.

## O que foi feito

- **src/lib/irreversible-action-catalog.ts** — ~25L. 5 acções + IrreversibleAction + isIrreversibleAction type guard.
- **src/services/confirmation-gate.service.ts** — ~150L. requireConfirmation + confirm; código 6-char ambiguity-safe single-use, expiry 60s, tied waId, rate-limit 3/h; bypass cliOverride.
- **src/core/domain/interrupt-commands.ts** — MODIFY: +IrrevConfirmYes/IrrevConfirmNo no union + PAYLOAD_MAP (5→7).
- **tests/services/confirmation-gate.test.ts** — 16 specs (AC1-4 + catálogo + parser regression).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Store pending por código (single-use). | Operador devolve o código; lookup directo. | Q-B2-1 |
| 2 | Rate-limit conta emissões/hora por waId. | AO-164 literal; limita brute-force de geração. | Q-B2-2 |
| 3 | cliOverride no serviço; subcommand deploy diferido. | Sem scope-creep; Story 2.x expande CLI. | Q-B2-3 |
| 4 | Charset 6-char ambiguity-safe (sem 0/O/1/I/L). | Transcrição humana via WhatsApp; ~31^6 combos. | Q-B2-4 |
| 5 | WaIdMismatch NÃO consome o código. | Anti-DoS: atacante com waId errado não queima o código do operador legítimo. | — |
| 6 | Não alterar a FSM. | Reusa paused_for_interrupt/OperatorResponded; wiring é Epic 4.x. | — |

## Trade-offs aplicados

- Quis wiring na FSM/orquestração, fiquei com serviço isolado: scope da story é o gate; wiring é Epic 4.x.
- Quis subcommand deploy real, fiquei com flag cliOverride (Q-B2-3): files_modified não inclui CLI; Story 2.x expande.

## Open items deferidos

- **O-B2-1:** Wiring FSM + envio do código via NotifyPort/WhatsApp (Epic 4.x orquestração).
- **O-B2-2:** Subcommand hdd-worker deploy --i-really-mean-it (Story 2.x CLI).
- **O-B2-3:** Persistência DB do pending store (sobrevive restart) — orquestração.
- **O-A6-6 acumula:** AR-071 (epics) vs AO-155/164 (canon) reconciliação.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 188 pass / 0 fail (was 172; +16). Regressão PAYLOAD_MAP sanity 5→7 actualizada.
- **Type-check:** clean
- **Lint:** exit 0 (22 infos pré-existentes)
- **Linhas novas:** ~175 src (catalog 25 + service 150) + interrupt +5
- **Deps adicionadas:** 0
- **Token usage approx:** dentro estimated 48-72K

## Próximos passos sugeridos

1. Operador aprova `approve story-1b2` → marco done + commit. Mensagem: `feat(story-1b2): two-step confirmation acções irreversíveis (4 ACs verde; BLOCKER #2 M1)`.
2. Sprint 0: 13/22 done. Epic 1.b: 2/5. Próxima: Story 1.b.3 (audit redaction multi-pattern).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1b2` · Pedir alterações: `hdd-worker review request-changes story-1b2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b2 --reason "<razão>"`


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
workflowId: story-1b2
workflowName: Story 1.b.2 — Two-step confirmation acções irreversíveis
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.b.2 — Two-step confirmation acções irreversíveis

### Contexto detalhado

2ª story do Epic 1.b e DRB BLOCKER #2 (AO-155+AO-164). Gate de two-step confirmation: worker LLM-driven não executa acção destrutiva (deploy/branch-delete/force-push/schema-drop/audit-purge) sem código 6-char confirmado por humano via WhatsApp, ou bypass CLI human-driven.

### O que foi feito (verbose)

- **src/lib/irreversible-action-catalog.ts** — ~25L. 5 acções + IrreversibleAction + isIrreversibleAction type guard.
- **src/services/confirmation-gate.service.ts** — ~150L. requireConfirmation + confirm; código 6-char ambiguity-safe single-use, expiry 60s, tied waId, rate-limit 3/h; bypass cliOverride.
- **src/core/domain/interrupt-commands.ts** — MODIFY: +IrrevConfirmYes/IrrevConfirmNo no union + PAYLOAD_MAP (5→7).
- **tests/services/confirmation-gate.test.ts** — 16 specs (AC1-4 + catálogo + parser regression).

### Full file list

- **src/lib/irreversible-action-catalog.ts** — ~25L. 5 acções + IrreversibleAction + isIrreversibleAction type guard.
- **src/services/confirmation-gate.service.ts** — ~150L. requireConfirmation + confirm; código 6-char ambiguity-safe single-use, expiry 60s, tied waId, rate-limit 3/h; bypass cliOverride.
- **src/core/domain/interrupt-commands.ts** — MODIFY: +IrrevConfirmYes/IrrevConfirmNo no union + PAYLOAD_MAP (5→7).
- **tests/services/confirmation-gate.test.ts** — 16 specs (AC1-4 + catálogo + parser regression).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Store pending por código (single-use). | Operador devolve o código; lookup directo. | Q-B2-1 |
| 2 | Rate-limit conta emissões/hora por waId. | AO-164 literal; limita brute-force de geração. | Q-B2-2 |
| 3 | cliOverride no serviço; subcommand deploy diferido. | Sem scope-creep; Story 2.x expande CLI. | Q-B2-3 |
| 4 | Charset 6-char ambiguity-safe (sem 0/O/1/I/L). | Transcrição humana via WhatsApp; ~31^6 combos. | Q-B2-4 |
| 5 | WaIdMismatch NÃO consome o código. | Anti-DoS: atacante com waId errado não queima o código do operador legítimo. | — |
| 6 | Não alterar a FSM. | Reusa paused_for_interrupt/OperatorResponded; wiring é Epic 4.x. | — |

### Trade-offs aplicados (narrativa)

- Quis wiring na FSM/orquestração, fiquei com serviço isolado: scope da story é o gate; wiring é Epic 4.x.
- Quis subcommand deploy real, fiquei com flag cliOverride (Q-B2-3): files_modified não inclui CLI; Story 2.x expande.

### Open items deferidos (com onde serão resolvidos)

- **O-B2-1:** Wiring FSM + envio do código via NotifyPort/WhatsApp (Epic 4.x orquestração).
- **O-B2-2:** Subcommand hdd-worker deploy --i-really-mean-it (Story 2.x CLI).
- **O-B2-3:** Persistência DB do pending store (sobrevive restart) — orquestração.
- **O-A6-6 acumula:** AR-071 (epics) vs AO-155/164 (canon) reconciliação.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 188 pass / 0 fail (was 172; +16). Regressão PAYLOAD_MAP sanity 5→7 actualizada.
- **Type-check:** clean
- **Lint:** exit 0 (22 infos pré-existentes)
- **Linhas novas:** ~175 src (catalog 25 + service 150) + interrupt +5
- **Deps adicionadas:** 0
- **Token usage approx:** dentro estimated 48-72K

### Próximos passos sugeridos

1. Operador aprova `approve story-1b2` → marco done + commit. Mensagem: `feat(story-1b2): two-step confirmation acções irreversíveis (4 ACs verde; BLOCKER #2 M1)`.
2. Sprint 0: 13/22 done. Epic 1.b: 2/5. Próxima: Story 1.b.3 (audit redaction multi-pattern).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-1b2` · Pedir alterações: `hdd-worker review request-changes story-1b2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b2 --reason "<razão>"`

