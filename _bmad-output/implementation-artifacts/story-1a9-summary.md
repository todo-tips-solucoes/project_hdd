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
workflowId: story-1a9
workflowName: Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs
date: 2026-05-28
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs · projeto_hdd · 2026-05-28

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

1.a.7/1.a.8 introduziram bootRunId UUID hardcoded passado em cada audit.append(). Esta story estabelece o mecanismo canónico de propagação cross-async via node:async_hooks.AsyncLocalStorage wrapped em withRunContext(ctx, fn). Auto-inject no audit adapter substitui o pattern explicit (Q-A9-1).

## O que foi feito

- **src/lib/run-context.ts** (`src/lib/run-context.ts`) — 55 linhas. RunContext + withRunContext + getRunContext + requireRunContext (throws AO-66 #1).
- **src/ports/audit.port.ts** — +8 linhas. AuditEntry.runId opcional + RunIdMissing variant.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — +7 linhas. Resolve runId via explicit > ctx > err.
- **tests/lib/run-context.test.ts** — 199 linhas, 12 specs: 5 helper + 4 AC-1 + 3 AC-2 (Promise.all isolation + nested).
- **tests/cli/review.test.ts** — Compat shim: AppendCall.runId 'string | undefined'.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | AuditEntry.runId opcional + RunIdMissing variant. | Sem isto, AC-1 impossível type-wise. Backward compat 100% em runtime. | Q-A9-1 |
| 2 | RunContext inclui traceId placeholder OpenTelemetry. | Zero cost agora; future-proof. | Q-A9-2 |
| 3 | NÃO wirear bootstrap.ts / review.command.ts em withRunContext. | Spec só lista audit adapter; defer para Story 2.1+ worker loop. | Q-A9-3 |
| 4 | NÃO instalar pino dep. | withRunContext é genérico; logger entra em story dedicada. | Q-A9-4 |
| 5 | Precedência: explicit > ctx > err RunIdMissing. | Permite caller override; menos-surpresa pattern. | — |
| 6 | runId NÃO entra na hash chain formula. | Manter compat com docs/audit-format.md + chains 1.a.6. | — |
| 7 | requireRunContext throws com AO-66 #1 inline. | Programmer error categoria #1; ESLint comment documenta. | — |

## Trade-offs aplicados

- Quis wirear bootstrap/review em withRunContext, fiquei com scope-min defer (Q-A9-3): wiring real entra com worker loop 2.1+.
- Quis test ordering deterministic em Promise.all, fiquei com per-payload validation: racers não têm ordering garantido.
- Quis pino + logger.child(getRunContext()), fiquei sem (Q-A9-4): scope creep; logger merece story própria.

## Open items deferidos

- **O-A9-1:** Wire bootstrap/review em withRunContext — Story 2.1+.
- **O-A9-2:** pino logger + getRunContext() — story dedicada futura.
- **O-A9-3:** traceId real OpenTelemetry integration — v1.1+.
- **O-A9-4:** setTimeout/setInterval callbacks SAEM do context frame; doc-it-out futuro.
- **O-A9-5:** REVIEWER FINDING (live dogfood): generator Tier-B = Tier-C dados (TierBOverflow 955w). Generator deve aceitar `tierBBrief` separado OU templates diferentes. Fix Story 1.a.10+.
- **O-A6-6 acumula:** epics.md ao_subset codes vs canon D-04.x reconciliação — próximo docs:.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 142 pass / 0 fail (was 130 após 1.a.8; +12 novos: 12 run-context)
- **Type-check:** clean (exit 0)
- **Lint:** exit 0 (19 infos pré-existentes useLiteralKeys; não-blocker)
- **Linhas src/lib/run-context.ts:** 55 (dentro Biome 200 cap)
- **Linhas modified:** audit.port.ts +8, jsonl-hash-chain.adapter.ts +7, review.test.ts +5 (compat shim)
- **Linhas tests/lib/run-context.test.ts:** 199 (test files isent do cap)
- **Dependências adicionadas:** 0
- **Token usage approx:** ~50K (dentro do estimated_tokens.dev_with_retry 56K)

## Próximos passos sugeridos

1. Operador aprova `approve story-1a9` → marco done + commit dos restantes ficheiros (sem push). Mensagem proposta: `feat(story-1a9): AsyncLocalStorage withRunContext + correlation IDs (2 ACs verde; auto-inject audit)`.
2. Story 1.a.10 — LLMPort + AnthropicAdapter foundational (API SDK Sonnet+Haiku + Max 20x CLI fallback) — próxima (`blocked_by: [1.a.7]` done). 1ª integração com Anthropic real.
3. Em paralelo (opcional): push origin agora vs adia para batch após 1.a.10 (closing 10/22 do Sprint 0).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1a9` · Pedir alterações: `hdd-worker review request-changes story-1a9 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1a9 --reason "<razão>"`


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
workflowId: story-1a9
workflowName: Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs
date: 2026-05-28
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs

### Contexto detalhado

1.a.7/1.a.8 introduziram bootRunId UUID hardcoded passado em cada audit.append(). Esta story estabelece o mecanismo canónico de propagação cross-async via node:async_hooks.AsyncLocalStorage wrapped em withRunContext(ctx, fn). Auto-inject no audit adapter substitui o pattern explicit (Q-A9-1).

### O que foi feito (verbose)

- **src/lib/run-context.ts** (`src/lib/run-context.ts`) — 55 linhas. RunContext + withRunContext + getRunContext + requireRunContext (throws AO-66 #1).
- **src/ports/audit.port.ts** — +8 linhas. AuditEntry.runId opcional + RunIdMissing variant.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — +7 linhas. Resolve runId via explicit > ctx > err.
- **tests/lib/run-context.test.ts** — 199 linhas, 12 specs: 5 helper + 4 AC-1 + 3 AC-2 (Promise.all isolation + nested).
- **tests/cli/review.test.ts** — Compat shim: AppendCall.runId 'string | undefined'.

### Full file list

- **src/lib/run-context.ts** (`src/lib/run-context.ts`) — 55 linhas. RunContext + withRunContext + getRunContext + requireRunContext (throws AO-66 #1).
- **src/ports/audit.port.ts** — +8 linhas. AuditEntry.runId opcional + RunIdMissing variant.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — +7 linhas. Resolve runId via explicit > ctx > err.
- **tests/lib/run-context.test.ts** — 199 linhas, 12 specs: 5 helper + 4 AC-1 + 3 AC-2 (Promise.all isolation + nested).
- **tests/cli/review.test.ts** — Compat shim: AppendCall.runId 'string | undefined'.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | AuditEntry.runId opcional + RunIdMissing variant. | Sem isto, AC-1 impossível type-wise. Backward compat 100% em runtime. | Q-A9-1 |
| 2 | RunContext inclui traceId placeholder OpenTelemetry. | Zero cost agora; future-proof. | Q-A9-2 |
| 3 | NÃO wirear bootstrap.ts / review.command.ts em withRunContext. | Spec só lista audit adapter; defer para Story 2.1+ worker loop. | Q-A9-3 |
| 4 | NÃO instalar pino dep. | withRunContext é genérico; logger entra em story dedicada. | Q-A9-4 |
| 5 | Precedência: explicit > ctx > err RunIdMissing. | Permite caller override; menos-surpresa pattern. | — |
| 6 | runId NÃO entra na hash chain formula. | Manter compat com docs/audit-format.md + chains 1.a.6. | — |
| 7 | requireRunContext throws com AO-66 #1 inline. | Programmer error categoria #1; ESLint comment documenta. | — |

### Trade-offs aplicados (narrativa)

- Quis wirear bootstrap/review em withRunContext, fiquei com scope-min defer (Q-A9-3): wiring real entra com worker loop 2.1+.
- Quis test ordering deterministic em Promise.all, fiquei com per-payload validation: racers não têm ordering garantido.
- Quis pino + logger.child(getRunContext()), fiquei sem (Q-A9-4): scope creep; logger merece story própria.

### Open items deferidos (com onde serão resolvidos)

- **O-A9-1:** Wire bootstrap/review em withRunContext — Story 2.1+.
- **O-A9-2:** pino logger + getRunContext() — story dedicada futura.
- **O-A9-3:** traceId real OpenTelemetry integration — v1.1+.
- **O-A9-4:** setTimeout/setInterval callbacks SAEM do context frame; doc-it-out futuro.
- **O-A9-5:** REVIEWER FINDING (live dogfood): generator Tier-B = Tier-C dados (TierBOverflow 955w). Generator deve aceitar `tierBBrief` separado OU templates diferentes. Fix Story 1.a.10+.
- **O-A6-6 acumula:** epics.md ao_subset codes vs canon D-04.x reconciliação — próximo docs:.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 142 pass / 0 fail (was 130 após 1.a.8; +12 novos: 12 run-context)
- **Type-check:** clean (exit 0)
- **Lint:** exit 0 (19 infos pré-existentes useLiteralKeys; não-blocker)
- **Linhas src/lib/run-context.ts:** 55 (dentro Biome 200 cap)
- **Linhas modified:** audit.port.ts +8, jsonl-hash-chain.adapter.ts +7, review.test.ts +5 (compat shim)
- **Linhas tests/lib/run-context.test.ts:** 199 (test files isent do cap)
- **Dependências adicionadas:** 0
- **Token usage approx:** ~50K (dentro do estimated_tokens.dev_with_retry 56K)

### Próximos passos sugeridos

1. Operador aprova `approve story-1a9` → marco done + commit dos restantes ficheiros (sem push). Mensagem proposta: `feat(story-1a9): AsyncLocalStorage withRunContext + correlation IDs (2 ACs verde; auto-inject audit)`.
2. Story 1.a.10 — LLMPort + AnthropicAdapter foundational (API SDK Sonnet+Haiku + Max 20x CLI fallback) — próxima (`blocked_by: [1.a.7]` done). 1ª integração com Anthropic real.
3. Em paralelo (opcional): push origin agora vs adia para batch após 1.a.10 (closing 10/22 do Sprint 0).

### Diff vs `—`

_(no diff requested)_

---

→ Aprovar: `hdd-worker review approve story-1a9` · Pedir alterações: `hdd-worker review request-changes story-1a9 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1a9 --reason "<razão>"`

