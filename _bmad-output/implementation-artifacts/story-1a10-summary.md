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
workflowId: story-1a10
workflowName: Story 1.a.10 — LLMPort + AnthropicAdapter foundational
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.a.10 — LLMPort + AnthropicAdapter foundational · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

Última story foundational de Epic 1.a (10/10). Estabelece a porta única LLM + 2 adapters reais (Anthropic SDK + claude --print CLI) que servem E3/E4/E6.a/E7.b downstream. D-050 routing por FASE: SDK default impl; CLI planning + overflow.

## O que foi feito

- **src/ports/llm.port.ts** — 81 linhas. LLMPort + LLMRole (7) + LLMRequest + LLMResult + LLMError (8 kinds).
- **src/adapters/llm/anthropic-sdk.adapter.ts** — 114 linhas. SDK direct calls; AO-42 cache_control opt-in; error map.
- **src/adapters/llm/claude-cli.adapter.ts** — 126 linhas. Bun.spawn claude --print; sessionId via --resume; JSON parse.
- **src/lib/llm-session-id.ts** — 53 linhas. extractSessionIdFromCliJson helper; UUID v4 validation.
- **src/lib/branded.ts** — +15 linhas. SessionId + mkSessionId factory (UUID v4).
- **tests/adapters/llm-foundational.test.ts** — 332 linhas, 13 specs cobrindo 5 ACs binary.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — BUG FIX latente: current_date é SQL keyword; SELECT sem quoting devolvia CURRENT_DATE built-in (TODAY) → false rotation trigger. Quoted column name.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Mock-only network policy nos tests. | CI offline-safe; smoke real fica para dev local + 1.c.7 process. | Q-A10-1 |
| 2 | Session map persistence in-memory; defer DB persistence. | Scope minimal; Story 6.a.1 handles token-ledger + sessions. | Q-A10-2 |
| 3 | cache_control opt-in (default false). | Explicit; caller decide per role; sem surpresas de cost. | Q-A10-3 |
| 4 | Plan B autonomous swap defer. | 2 adapters expostos isolados; AO-123 swap detector vai para story dedicada (6.b). | Q-A10-4 |
| 5 | Bug fix audit_chain_state SELECT keyword collision. | current_date é SQL function; SELECT sem quoting devolvia TODAY em vez da coluna. Latent bug que manifestou em 2026-05-29 quando real-clock divergiu do test-clock. | — |
| 6 | MessageParam shape: text block array só quando cacheControl=true. | API aceita string OU array; usar array sem cache adiciona ruído desnecessário. | — |
| 7 | AnthropicAdapter.client injectable via deps. | Tests mock client shape; produção usa real `new Anthropic({ apiKey })`. | — |

## Trade-offs aplicados

- Quis ChainStateRow query devolver com tipo seguro, fiquei com runtime fallback: column name keyword conflict é SQL parser detail; quote força resolução.
- Quis Plan B detector + swap nesta story, fiquei com defer (Q-A10-4): scope-creep significativo; AO-123 merece spec dedicada.
- Quis real-network spec opcional com skip flag, fiquei com mock-only (Q-A10-1): CI flake risk + cost imprevisível; 1.c.7 já valida claude --print.

## Open items deferidos

- **O-A10-1:** Plan B autonomous swap detector (AO-123) — Story 6.b.
- **O-A10-2:** Token ledger persistence (AO-114) — Story 6.a.1.
- **O-A10-3:** Session map persistence DB — defer.
- **O-A10-4:** Bootstrap wiring (escolher SDK vs CLI no boot) — Story 2.x.
- **O-A10-5:** BUG FIX colateral: audit_chain_state SQL keyword fix landed; podia ter spec regressão dedicada (date != real-today).
- **O-A6-6 acumula:** epics.md AO codes vs canon reconciliação.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 155 pass / 0 fail (was 142; +13 novos: 1 AC-1 + 4 AC-2 + 4 AC-3 + 2 AC-4 + 2 AC-5)
- **Type-check:** clean
- **Lint:** exit 0 (21 infos pré-existentes useLiteralKeys)
- **Linhas novas:** ~520 (port 81 + sdk 114 + cli 126 + session 53 + tests 332)
- **Deps adicionadas:** 1 (@anthropic-ai/sdk@0.100.1)
- **Bug fix bonus:** audit_chain_state SQL keyword fix (1 linha)
- **Token usage approx:** ~75K (dentro estimated 80K)

## Próximos passos sugeridos

1. Operador aprova `approve story-1a10` → marco done + commit dos ficheiros restantes (sem push). Mensagem proposta: `feat(story-1a10): LLMPort + AnthropicSDK + ClaudeCli adapters (5 ACs verde; epic 1.a 10/10 done)`.
2. Epic 1.a transita para done — 10/10 stories foundational entregues. Sprint 0 progresso: 11/22.
3. Próxima escolha do operador: Epic 1.b (Safety BLOCKERS) OU Epic 1.c (Bootstrap/Operations restantes). 1.b é DRB-mandated antes M1; 1.c é operational polish.

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1a10` · Pedir alterações: `hdd-worker review request-changes story-1a10 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1a10 --reason "<razão>"`


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
workflowId: story-1a10
workflowName: Story 1.a.10 — LLMPort + AnthropicAdapter foundational
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.a.10 — LLMPort + AnthropicAdapter foundational

### Contexto detalhado

Última story foundational de Epic 1.a (10/10). Estabelece a porta única LLM + 2 adapters reais (Anthropic SDK + claude --print CLI) que servem E3/E4/E6.a/E7.b downstream. D-050 routing por FASE: SDK default impl; CLI planning + overflow.

### O que foi feito (verbose)

- **src/ports/llm.port.ts** — 81 linhas. LLMPort + LLMRole (7) + LLMRequest + LLMResult + LLMError (8 kinds).
- **src/adapters/llm/anthropic-sdk.adapter.ts** — 114 linhas. SDK direct calls; AO-42 cache_control opt-in; error map.
- **src/adapters/llm/claude-cli.adapter.ts** — 126 linhas. Bun.spawn claude --print; sessionId via --resume; JSON parse.
- **src/lib/llm-session-id.ts** — 53 linhas. extractSessionIdFromCliJson helper; UUID v4 validation.
- **src/lib/branded.ts** — +15 linhas. SessionId + mkSessionId factory (UUID v4).
- **tests/adapters/llm-foundational.test.ts** — 332 linhas, 13 specs cobrindo 5 ACs binary.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — BUG FIX latente: current_date é SQL keyword; SELECT sem quoting devolvia CURRENT_DATE built-in (TODAY) → false rotation trigger. Quoted column name.

### Full file list

- **src/ports/llm.port.ts** — 81 linhas. LLMPort + LLMRole (7) + LLMRequest + LLMResult + LLMError (8 kinds).
- **src/adapters/llm/anthropic-sdk.adapter.ts** — 114 linhas. SDK direct calls; AO-42 cache_control opt-in; error map.
- **src/adapters/llm/claude-cli.adapter.ts** — 126 linhas. Bun.spawn claude --print; sessionId via --resume; JSON parse.
- **src/lib/llm-session-id.ts** — 53 linhas. extractSessionIdFromCliJson helper; UUID v4 validation.
- **src/lib/branded.ts** — +15 linhas. SessionId + mkSessionId factory (UUID v4).
- **tests/adapters/llm-foundational.test.ts** — 332 linhas, 13 specs cobrindo 5 ACs binary.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — BUG FIX latente: current_date é SQL keyword; SELECT sem quoting devolvia CURRENT_DATE built-in (TODAY) → false rotation trigger. Quoted column name.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Mock-only network policy nos tests. | CI offline-safe; smoke real fica para dev local + 1.c.7 process. | Q-A10-1 |
| 2 | Session map persistence in-memory; defer DB persistence. | Scope minimal; Story 6.a.1 handles token-ledger + sessions. | Q-A10-2 |
| 3 | cache_control opt-in (default false). | Explicit; caller decide per role; sem surpresas de cost. | Q-A10-3 |
| 4 | Plan B autonomous swap defer. | 2 adapters expostos isolados; AO-123 swap detector vai para story dedicada (6.b). | Q-A10-4 |
| 5 | Bug fix audit_chain_state SELECT keyword collision. | current_date é SQL function; SELECT sem quoting devolvia TODAY em vez da coluna. Latent bug que manifestou em 2026-05-29 quando real-clock divergiu do test-clock. | — |
| 6 | MessageParam shape: text block array só quando cacheControl=true. | API aceita string OU array; usar array sem cache adiciona ruído desnecessário. | — |
| 7 | AnthropicAdapter.client injectable via deps. | Tests mock client shape; produção usa real `new Anthropic({ apiKey })`. | — |

### Trade-offs aplicados (narrativa)

- Quis ChainStateRow query devolver com tipo seguro, fiquei com runtime fallback: column name keyword conflict é SQL parser detail; quote força resolução.
- Quis Plan B detector + swap nesta story, fiquei com defer (Q-A10-4): scope-creep significativo; AO-123 merece spec dedicada.
- Quis real-network spec opcional com skip flag, fiquei com mock-only (Q-A10-1): CI flake risk + cost imprevisível; 1.c.7 já valida claude --print.

### Open items deferidos (com onde serão resolvidos)

- **O-A10-1:** Plan B autonomous swap detector (AO-123) — Story 6.b.
- **O-A10-2:** Token ledger persistence (AO-114) — Story 6.a.1.
- **O-A10-3:** Session map persistence DB — defer.
- **O-A10-4:** Bootstrap wiring (escolher SDK vs CLI no boot) — Story 2.x.
- **O-A10-5:** BUG FIX colateral: audit_chain_state SQL keyword fix landed; podia ter spec regressão dedicada (date != real-today).
- **O-A6-6 acumula:** epics.md AO codes vs canon reconciliação.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 155 pass / 0 fail (was 142; +13 novos: 1 AC-1 + 4 AC-2 + 4 AC-3 + 2 AC-4 + 2 AC-5)
- **Type-check:** clean
- **Lint:** exit 0 (21 infos pré-existentes useLiteralKeys)
- **Linhas novas:** ~520 (port 81 + sdk 114 + cli 126 + session 53 + tests 332)
- **Deps adicionadas:** 1 (@anthropic-ai/sdk@0.100.1)
- **Bug fix bonus:** audit_chain_state SQL keyword fix (1 linha)
- **Token usage approx:** ~75K (dentro estimated 80K)

### Próximos passos sugeridos

1. Operador aprova `approve story-1a10` → marco done + commit dos ficheiros restantes (sem push). Mensagem proposta: `feat(story-1a10): LLMPort + AnthropicSDK + ClaudeCli adapters (5 ACs verde; epic 1.a 10/10 done)`.
2. Epic 1.a transita para done — 10/10 stories foundational entregues. Sprint 0 progresso: 11/22.
3. Próxima escolha do operador: Epic 1.b (Safety BLOCKERS) OU Epic 1.c (Bootstrap/Operations restantes). 1.b é DRB-mandated antes M1; 1.c é operational polish.

### Diff vs `—`

_(no diff requested)_

---

→ Aprovar: `hdd-worker review approve story-1a10` · Pedir alterações: `hdd-worker review request-changes story-1a10 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1a10 --reason "<razão>"`

