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
workflowId: story-1b5
workflowName: Story 1.b.5 — 8 Pentest Tasks PT-1..PT-8 test suite
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.b.5 — 8 Pentest Tasks PT-1..PT-8 test suite · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Capstone do Epic 1.b (AR-076). Suite agregadora que PROVA (não reimplementa) as 4 defesas de 1.b.1-1.b.4 + audit 1.a.6 como 8 baterias de pentest verificáveis + report auditável p/ sign-off M1. Fecha O-B1-1 (numeração PT) e dá estrutura ao O-B4-1 (escapes reais → integração).

## O que foi feito

- **tests/security/pt-1..8-*.test.ts** — 8 ficheiros, 31 specs: sandbox/path/redaction/ssrf/prompt-inj/audit-tamper/secret-extract/ratelimit.
- **scripts/pentest-report.ts** — Bun.spawnSync bun test + parse → report markdown com commit SHA; exit≠0 se falha.
- **scripts/check-webhook-schema.ts** — Day-7 escalation gate (PM-5/AO-86): marker → feature-flags.json + [OPEN] readiness; exit 0.
- **docs/pre-m1-pentest-tasks.md** — Canon PT-1..8 (= esta suite); reconcilia divergência com architecture. Fecha O-B1-1.
- **package.json + .github/workflows/ci.yml** — test:security broaden + check:webhook-schema; job security-suite + upload report.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | PT-5 rebuff estrutural via confirmation gate. | Sem LLM-handler ainda; injecção não faz bypass da gate. Semântico → Epic 4. | Q-B5-1 |
| 2 | Criar docs/pre-m1-pentest-tasks.md. | Fecha O-B1-1; esta suite = canon. | Q-B5-2 |
| 3 | check-webhook-schema.ts minimal não-bloqueante. | PM-5: força decisão consciente; exit 0 + [OPEN] log. | Q-B5-3 |
| 4 | pentest-report via spawnSync + parse. | Sem acoplar os testes ao formato de report. | Q-B5-4 |
| 5 | PT-6/PT-7 com adapter audit REAL (não fake). | tamper/chain/redaction-pre-write exigem hash-chain + ficheiro reais. | — |

## Trade-offs aplicados

- Quis escapes de docker reais nos PT tests, fiquei com mock-only (herda Q-B4-4): docker no CI viola política; O-B4-1 cobre integração.
- Quis PT-5 com classificador semântico, fiquei com rebuff estrutural: o handler LLM não existe até Epic 4.

## Open items deferidos

- **O-B5-1:** Run de integração com docker real (escapes PT-1/PT-4 ao vivo) — herda O-B4-1.
- **O-B5-2:** PT-5 rebuff semântico (classificador prompt-injection) — Epic 4.
- **O-B5-3:** AO-86: schema clihelper inbound real ainda não recebido; webhook-mock=true ([OPEN] em readiness). Re-correr check:webhook-schema quando chegar.
- **O-B1-1:** FECHADO — docs/pre-m1-pentest-tasks.md criado.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 257 pass / 0 fail (was 226; +31). Security suite: 31 specs / 8 ficheiros.
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **pentest-report:** exit 0; report gerado
- **check-webhook-schema:** exit 0; [OPEN] (marker ausente, esperado)
- **Deps adicionadas:** 0
- **Token usage approx:** dentro estimated 80-120K

## Próximos passos sugeridos

1. Operador aprova `approve story-1b5` → marco done + epic-1b done (5/5) + commit. Mensagem: `feat(story-1b5): 8 Pentest Tasks PT-1..PT-8 (8/8; Epic 1.b 5/5 DONE)`. Push toca .github/workflows (scope ok).
2. Sprint 0: 16/22 done. **Epic 1.b FECHADO** (3 DRB BLOCKERS + sandbox + pentest suite). Resta Epic 1.c (Bootstrap & Operations, 6 stories).
3. Opcional: epic-1b-retrospective antes de arrancar Epic 1.c.

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1b5` · Pedir alterações: `hdd-worker review request-changes story-1b5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b5 --reason "<razão>"`


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
workflowId: story-1b5
workflowName: Story 1.b.5 — 8 Pentest Tasks PT-1..PT-8 test suite
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.b.5 — 8 Pentest Tasks PT-1..PT-8 test suite

### Contexto detalhado

Capstone do Epic 1.b (AR-076). Suite agregadora que PROVA (não reimplementa) as 4 defesas de 1.b.1-1.b.4 + audit 1.a.6 como 8 baterias de pentest verificáveis + report auditável p/ sign-off M1. Fecha O-B1-1 (numeração PT) e dá estrutura ao O-B4-1 (escapes reais → integração).

### O que foi feito (verbose)

- **tests/security/pt-1..8-*.test.ts** — 8 ficheiros, 31 specs: sandbox/path/redaction/ssrf/prompt-inj/audit-tamper/secret-extract/ratelimit.
- **scripts/pentest-report.ts** — Bun.spawnSync bun test + parse → report markdown com commit SHA; exit≠0 se falha.
- **scripts/check-webhook-schema.ts** — Day-7 escalation gate (PM-5/AO-86): marker → feature-flags.json + [OPEN] readiness; exit 0.
- **docs/pre-m1-pentest-tasks.md** — Canon PT-1..8 (= esta suite); reconcilia divergência com architecture. Fecha O-B1-1.
- **package.json + .github/workflows/ci.yml** — test:security broaden + check:webhook-schema; job security-suite + upload report.

### Full file list

- **tests/security/pt-1..8-*.test.ts** — 8 ficheiros, 31 specs: sandbox/path/redaction/ssrf/prompt-inj/audit-tamper/secret-extract/ratelimit.
- **scripts/pentest-report.ts** — Bun.spawnSync bun test + parse → report markdown com commit SHA; exit≠0 se falha.
- **scripts/check-webhook-schema.ts** — Day-7 escalation gate (PM-5/AO-86): marker → feature-flags.json + [OPEN] readiness; exit 0.
- **docs/pre-m1-pentest-tasks.md** — Canon PT-1..8 (= esta suite); reconcilia divergência com architecture. Fecha O-B1-1.
- **package.json + .github/workflows/ci.yml** — test:security broaden + check:webhook-schema; job security-suite + upload report.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | PT-5 rebuff estrutural via confirmation gate. | Sem LLM-handler ainda; injecção não faz bypass da gate. Semântico → Epic 4. | Q-B5-1 |
| 2 | Criar docs/pre-m1-pentest-tasks.md. | Fecha O-B1-1; esta suite = canon. | Q-B5-2 |
| 3 | check-webhook-schema.ts minimal não-bloqueante. | PM-5: força decisão consciente; exit 0 + [OPEN] log. | Q-B5-3 |
| 4 | pentest-report via spawnSync + parse. | Sem acoplar os testes ao formato de report. | Q-B5-4 |
| 5 | PT-6/PT-7 com adapter audit REAL (não fake). | tamper/chain/redaction-pre-write exigem hash-chain + ficheiro reais. | — |

### Trade-offs aplicados (narrativa)

- Quis escapes de docker reais nos PT tests, fiquei com mock-only (herda Q-B4-4): docker no CI viola política; O-B4-1 cobre integração.
- Quis PT-5 com classificador semântico, fiquei com rebuff estrutural: o handler LLM não existe até Epic 4.

### Open items deferidos (com onde serão resolvidos)

- **O-B5-1:** Run de integração com docker real (escapes PT-1/PT-4 ao vivo) — herda O-B4-1.
- **O-B5-2:** PT-5 rebuff semântico (classificador prompt-injection) — Epic 4.
- **O-B5-3:** AO-86: schema clihelper inbound real ainda não recebido; webhook-mock=true ([OPEN] em readiness). Re-correr check:webhook-schema quando chegar.
- **O-B1-1:** FECHADO — docs/pre-m1-pentest-tasks.md criado.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 257 pass / 0 fail (was 226; +31). Security suite: 31 specs / 8 ficheiros.
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **pentest-report:** exit 0; report gerado
- **check-webhook-schema:** exit 0; [OPEN] (marker ausente, esperado)
- **Deps adicionadas:** 0
- **Token usage approx:** dentro estimated 80-120K

### Próximos passos sugeridos

1. Operador aprova `approve story-1b5` → marco done + epic-1b done (5/5) + commit. Mensagem: `feat(story-1b5): 8 Pentest Tasks PT-1..PT-8 (8/8; Epic 1.b 5/5 DONE)`. Push toca .github/workflows (scope ok).
2. Sprint 0: 16/22 done. **Epic 1.b FECHADO** (3 DRB BLOCKERS + sandbox + pentest suite). Resta Epic 1.c (Bootstrap & Operations, 6 stories).
3. Opcional: epic-1b-retrospective antes de arrancar Epic 1.c.

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-1b5` · Pedir alterações: `hdd-worker review request-changes story-1b5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b5 --reason "<razão>"`

