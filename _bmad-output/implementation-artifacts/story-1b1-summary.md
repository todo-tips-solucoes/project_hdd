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
workflowId: story-1b1
workflowName: Story 1.b.1 — Path traversal sanitization (NO apply-diff)
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.b.1 — Path traversal sanitization (NO apply-diff) · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

1ª story do Epic 1.b (Safety BLOCKERS) e 3ª das 4 DRB Sprint-0 Hard Conditions (C2: AO-164/165/166). Gate de path-safety para writes LLM-generated: nenhum diff escreve fora do workspace via ../, absolute, encoded, symlink ou null-byte. 'NO apply-diff' = não herdar resolution do utility vulnerável.

## O que foi feito

- **src/lib/path-sanitize.ts** — ~110 linhas. sanitizeRelPath lexical puro: 2 passagens (canónica decode+NFKC p/ detecção; literal p/ resolução). 6 reasons.
- **src/services/apply-diff.service.ts** — ~135 linhas. createApplyDiffService: lexical → realpath anti-symlink → write; promise-chain mutex (AO-165); audit SecurityViolation.
- **tests/services/apply-diff.security.test.ts** — ~165 linhas, 17 specs: 15 payloads (5 categorias) + 2 happy-path.
- **package.json** — alias test:security.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | kind único {kind:'PathTraversal', attempted, reason}. | Falha de path é 1 categoria de erro; idiom neverthrow + satisfaz AC literal. | Q-B1-1 |
| 2 | Encoded: decode-once percent + NFKC, rejeitar só se escapar. | Canonicalizar-depois-validar; O(n); evita falsos-positivos legítimos. | Q-B1-2 |
| 3 | Scope: gate + applyWrite fino; sem parser de unified-diff. | YAGNI; nenhum AC testa gramática do diff. | Q-B1-3 |
| 4 | Serialização AO-165 agora via promise-chain mutex. | AO-165 exige; mutex minúsculo elimina TOCTOU; custo nulo (I/O-bound). | Q-B1-4 |
| 5 | Detecção de control chars por charCodeAt, não regex literal. | Write tool corrompe bytes de control no source; charCodeAt/fromCharCode é robusto. | — |

## Trade-offs aplicados

- Quis classificar encoded-escape com reason fino, fiquei com 'encoded' agregado: a forma canónica é o sinal de ataque; granularidade extra não muda a decisão de bloqueio.
- Quis tmpfs mount do AO-165, fiquei com out-of-scope: é deployment/systemd, não código de lib.

## Open items deferidos

- **O-B1-1:** Reconciliar numeração PT: epics diz 'PT-2' p/ path mas architecture tem PT-2=egress/PT-3=docker; criar docs/pre-m1-pentest-tasks.md.
- **O-B1-2:** Wiring: invocar apply-diff.service no caminho real de write do dev sub-agent (story de orquestração).
- **O-B1-3:** tmpfs mount workspace (AO-165 deployment) — runbook systemd.
- **O-A6-6 acumula:** epics.md AO/AR codes vs canon architecture reconciliação.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 172 pass / 0 fail (was 155; +17: 9 lexical + 3 control + 3 symlink + 2 happy)
- **Type-check:** clean
- **Lint:** exit 0 (21 infos pré-existentes)
- **Linhas novas:** ~410 (lib 110 + service 135 + tests 165)
- **Deps adicionadas:** 0
- **ΔCI:** +72ms (suite security); <<10s budget AC-3
- **Token usage approx:** dentro estimated 56-84K

## Próximos passos sugeridos

1. Operador aprova `approve story-1b1` → marco done + commit. Mensagem: `feat(story-1b1): path traversal sanitization (4 ACs verde; 1ª BLOCKER M1)`.
2. Sprint 0: 12/22 done. Epic 1.b: 1/5 (in-progress). Próxima: Story 1.b.2 (two-step confirmation).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1b1` · Pedir alterações: `hdd-worker review request-changes story-1b1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b1 --reason "<razão>"`


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
workflowId: story-1b1
workflowName: Story 1.b.1 — Path traversal sanitization (NO apply-diff)
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.b.1 — Path traversal sanitization (NO apply-diff)

### Contexto detalhado

1ª story do Epic 1.b (Safety BLOCKERS) e 3ª das 4 DRB Sprint-0 Hard Conditions (C2: AO-164/165/166). Gate de path-safety para writes LLM-generated: nenhum diff escreve fora do workspace via ../, absolute, encoded, symlink ou null-byte. 'NO apply-diff' = não herdar resolution do utility vulnerável.

### O que foi feito (verbose)

- **src/lib/path-sanitize.ts** — ~110 linhas. sanitizeRelPath lexical puro: 2 passagens (canónica decode+NFKC p/ detecção; literal p/ resolução). 6 reasons.
- **src/services/apply-diff.service.ts** — ~135 linhas. createApplyDiffService: lexical → realpath anti-symlink → write; promise-chain mutex (AO-165); audit SecurityViolation.
- **tests/services/apply-diff.security.test.ts** — ~165 linhas, 17 specs: 15 payloads (5 categorias) + 2 happy-path.
- **package.json** — alias test:security.

### Full file list

- **src/lib/path-sanitize.ts** — ~110 linhas. sanitizeRelPath lexical puro: 2 passagens (canónica decode+NFKC p/ detecção; literal p/ resolução). 6 reasons.
- **src/services/apply-diff.service.ts** — ~135 linhas. createApplyDiffService: lexical → realpath anti-symlink → write; promise-chain mutex (AO-165); audit SecurityViolation.
- **tests/services/apply-diff.security.test.ts** — ~165 linhas, 17 specs: 15 payloads (5 categorias) + 2 happy-path.
- **package.json** — alias test:security.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | kind único {kind:'PathTraversal', attempted, reason}. | Falha de path é 1 categoria de erro; idiom neverthrow + satisfaz AC literal. | Q-B1-1 |
| 2 | Encoded: decode-once percent + NFKC, rejeitar só se escapar. | Canonicalizar-depois-validar; O(n); evita falsos-positivos legítimos. | Q-B1-2 |
| 3 | Scope: gate + applyWrite fino; sem parser de unified-diff. | YAGNI; nenhum AC testa gramática do diff. | Q-B1-3 |
| 4 | Serialização AO-165 agora via promise-chain mutex. | AO-165 exige; mutex minúsculo elimina TOCTOU; custo nulo (I/O-bound). | Q-B1-4 |
| 5 | Detecção de control chars por charCodeAt, não regex literal. | Write tool corrompe bytes de control no source; charCodeAt/fromCharCode é robusto. | — |

### Trade-offs aplicados (narrativa)

- Quis classificar encoded-escape com reason fino, fiquei com 'encoded' agregado: a forma canónica é o sinal de ataque; granularidade extra não muda a decisão de bloqueio.
- Quis tmpfs mount do AO-165, fiquei com out-of-scope: é deployment/systemd, não código de lib.

### Open items deferidos (com onde serão resolvidos)

- **O-B1-1:** Reconciliar numeração PT: epics diz 'PT-2' p/ path mas architecture tem PT-2=egress/PT-3=docker; criar docs/pre-m1-pentest-tasks.md.
- **O-B1-2:** Wiring: invocar apply-diff.service no caminho real de write do dev sub-agent (story de orquestração).
- **O-B1-3:** tmpfs mount workspace (AO-165 deployment) — runbook systemd.
- **O-A6-6 acumula:** epics.md AO/AR codes vs canon architecture reconciliação.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 172 pass / 0 fail (was 155; +17: 9 lexical + 3 control + 3 symlink + 2 happy)
- **Type-check:** clean
- **Lint:** exit 0 (21 infos pré-existentes)
- **Linhas novas:** ~410 (lib 110 + service 135 + tests 165)
- **Deps adicionadas:** 0
- **ΔCI:** +72ms (suite security); <<10s budget AC-3
- **Token usage approx:** dentro estimated 56-84K

### Próximos passos sugeridos

1. Operador aprova `approve story-1b1` → marco done + commit. Mensagem: `feat(story-1b1): path traversal sanitization (4 ACs verde; 1ª BLOCKER M1)`.
2. Sprint 0: 12/22 done. Epic 1.b: 1/5 (in-progress). Próxima: Story 1.b.2 (two-step confirmation).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-1b1` · Pedir alterações: `hdd-worker review request-changes story-1b1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b1 --reason "<razão>"`

