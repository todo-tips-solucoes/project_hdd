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
workflowId: story-3-4
workflowName: Story 3.4 — InboundCommandPort + Hono /callback + Quick Reply parsing
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 3.4 — InboundCommandPort + Hono /callback + Quick Reply parsing · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

O lado INBOUND: POST /callback (Hono) recebe respostas do operador via n8n (trust boundary), valida Zod minimal drop-at-ingress, parseia Quick Reply contra interrupt-commands.ts (1.a.4) → InboundCommand tipado. Feature de segurança: allowlist wa_id, Bearer auth, e AC4 (AI Safety) = redaction pre-write. O spot-check AI-E2-3 confirmou inbound=n8n (não clihelper) e que a AC4 já estava quase-wired (1.b.3).

## O que foi feito

- **src/ports/inbound-command.port.ts + callback-schema.ts** — NEW: InboundCommand (InterruptCommand + correlation) + minimalInboundSchema (.passthrough()=z.unknown() resto sob AO-86) + parseCallback.
- **src/adapters/whatsapp/callback-listener.adapter.ts** — NEW: createCallbackApp(Hono); POST /callback: Bearer auth (n8n) → audit InboundCallback raw → mock warning → allowlist drop-at-ingress → parseInterruptCommand. Sempre 200 (AC3). 90 linhas.
- **src/cli/start.command.ts** — MODIFY: monta /callback (audit de boot.value.audit) no mesmo Bun.serve; config via env (fail-closed: allowlist vazia → tudo dropped).
- **tests: callback-listener.test.ts + callback.security.test.ts** — NEW: 7 specs (AC1-3 + auth) + 1 security (audit REAL, 3 secrets → 0 raw, D-053).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Inbound = n8n→HDD, Bearer token; HDD não verifica X-Hub-Signature. | Memória n8n-topology + ao_subset autoritativos (n8n=trust boundary, trata a assinatura Meta). Arquitectura 'clihelper→HDD' desactualizada. Divergência registada. | Q-3.4-1 |
| 2 | Minimal schema extrai {wa_id, payload, runId?, storyId?} + z.unknown() resto. | Drop-at-ingress mesmo sob webhook-mock (AO-86); aperta quando o schema real chegar. | Q-3.4-2 |
| 3 | Diferir reconciliação do PAYLOAD_MAP (O-3.3-1). | AC2 só pede p1_continuar_assim (já mapeado); buttons não-mapeados → UnknownCommand (→ NLP 3.5). Não toca interrupt-commands.ts. | Q-3.4-3 |
| 4 | Redaction só no audit adapter (listener passa raw). | Pre-write no jsonl-hash-chain (1.b.3, já wired); single source of truth, nunca pós-write. Security test prova 0-raw com adapter REAL. | Q-3.4-4 |

## Trade-offs aplicados

- AC4 (AI Safety, Pre-Mortem #2) é wiring enforcement: o listener NÃO redige — encaminha raw ao audit adapter que redige pre-write (1.b.3). A security test usa o adapter REAL (não fake) + 3 secrets reais (Bearer, wa_id, sk-ant) → prova 0/3 raw no JSONL end-to-end (D-053).
- Drop-at-ingress: wa_id não-allowlisted → 200 (não 401, não vazar) + UnauthorizedInbound. Fail-closed: allowlist vazia por defeito → tudo dropped até o operador configurar HDD_ALLOWED_WAIDS.

## Open items deferidos

- **O-3.3-1:** Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — buttons não-mapeados caem em UnknownCommand; reconciliação dedicada ou via NLP (3.5).
- **AO-86/O-B5-3:** Schema inbound real ainda não recebido → webhook-mock=true (z.unknown()). Apertar minimalInboundSchema quando o operador partilhar o payload n8n real.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 391 pass / 3 skip / 0 fail (era 383; +8 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-3.4` → marco done + commit `feat(story-3.4): inbound /callback + Quick Reply parsing`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 4/6. Próxima: Story 3.5 (NLP fallback livre via Haiku — texto livre → intent; modifica este listener no UnknownCommand).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-3-4` · Pedir alterações: `hdd-worker review request-changes story-3-4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-4 --reason "<razão>"`


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
workflowId: story-3-4
workflowName: Story 3.4 — InboundCommandPort + Hono /callback + Quick Reply parsing
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 3.4 — InboundCommandPort + Hono /callback + Quick Reply parsing

### Contexto detalhado

O lado INBOUND: POST /callback (Hono) recebe respostas do operador via n8n (trust boundary), valida Zod minimal drop-at-ingress, parseia Quick Reply contra interrupt-commands.ts (1.a.4) → InboundCommand tipado. Feature de segurança: allowlist wa_id, Bearer auth, e AC4 (AI Safety) = redaction pre-write. O spot-check AI-E2-3 confirmou inbound=n8n (não clihelper) e que a AC4 já estava quase-wired (1.b.3).

### O que foi feito (verbose)

- **src/ports/inbound-command.port.ts + callback-schema.ts** — NEW: InboundCommand (InterruptCommand + correlation) + minimalInboundSchema (.passthrough()=z.unknown() resto sob AO-86) + parseCallback.
- **src/adapters/whatsapp/callback-listener.adapter.ts** — NEW: createCallbackApp(Hono); POST /callback: Bearer auth (n8n) → audit InboundCallback raw → mock warning → allowlist drop-at-ingress → parseInterruptCommand. Sempre 200 (AC3). 90 linhas.
- **src/cli/start.command.ts** — MODIFY: monta /callback (audit de boot.value.audit) no mesmo Bun.serve; config via env (fail-closed: allowlist vazia → tudo dropped).
- **tests: callback-listener.test.ts + callback.security.test.ts** — NEW: 7 specs (AC1-3 + auth) + 1 security (audit REAL, 3 secrets → 0 raw, D-053).

### Full file list

- **src/ports/inbound-command.port.ts + callback-schema.ts** — NEW: InboundCommand (InterruptCommand + correlation) + minimalInboundSchema (.passthrough()=z.unknown() resto sob AO-86) + parseCallback.
- **src/adapters/whatsapp/callback-listener.adapter.ts** — NEW: createCallbackApp(Hono); POST /callback: Bearer auth (n8n) → audit InboundCallback raw → mock warning → allowlist drop-at-ingress → parseInterruptCommand. Sempre 200 (AC3). 90 linhas.
- **src/cli/start.command.ts** — MODIFY: monta /callback (audit de boot.value.audit) no mesmo Bun.serve; config via env (fail-closed: allowlist vazia → tudo dropped).
- **tests: callback-listener.test.ts + callback.security.test.ts** — NEW: 7 specs (AC1-3 + auth) + 1 security (audit REAL, 3 secrets → 0 raw, D-053).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Inbound = n8n→HDD, Bearer token; HDD não verifica X-Hub-Signature. | Memória n8n-topology + ao_subset autoritativos (n8n=trust boundary, trata a assinatura Meta). Arquitectura 'clihelper→HDD' desactualizada. Divergência registada. | Q-3.4-1 |
| 2 | Minimal schema extrai {wa_id, payload, runId?, storyId?} + z.unknown() resto. | Drop-at-ingress mesmo sob webhook-mock (AO-86); aperta quando o schema real chegar. | Q-3.4-2 |
| 3 | Diferir reconciliação do PAYLOAD_MAP (O-3.3-1). | AC2 só pede p1_continuar_assim (já mapeado); buttons não-mapeados → UnknownCommand (→ NLP 3.5). Não toca interrupt-commands.ts. | Q-3.4-3 |
| 4 | Redaction só no audit adapter (listener passa raw). | Pre-write no jsonl-hash-chain (1.b.3, já wired); single source of truth, nunca pós-write. Security test prova 0-raw com adapter REAL. | Q-3.4-4 |

### Trade-offs aplicados (narrativa)

- AC4 (AI Safety, Pre-Mortem #2) é wiring enforcement: o listener NÃO redige — encaminha raw ao audit adapter que redige pre-write (1.b.3). A security test usa o adapter REAL (não fake) + 3 secrets reais (Bearer, wa_id, sk-ant) → prova 0/3 raw no JSONL end-to-end (D-053).
- Drop-at-ingress: wa_id não-allowlisted → 200 (não 401, não vazar) + UnauthorizedInbound. Fail-closed: allowlist vazia por defeito → tudo dropped até o operador configurar HDD_ALLOWED_WAIDS.

### Open items deferidos (com onde serão resolvidos)

- **O-3.3-1:** Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — buttons não-mapeados caem em UnknownCommand; reconciliação dedicada ou via NLP (3.5).
- **AO-86/O-B5-3:** Schema inbound real ainda não recebido → webhook-mock=true (z.unknown()). Apertar minimalInboundSchema quando o operador partilhar o payload n8n real.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 391 pass / 3 skip / 0 fail (era 383; +8 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-3.4` → marco done + commit `feat(story-3.4): inbound /callback + Quick Reply parsing`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 4/6. Próxima: Story 3.5 (NLP fallback livre via Haiku — texto livre → intent; modifica este listener no UnknownCommand).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-3-4` · Pedir alterações: `hdd-worker review request-changes story-3-4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-4 --reason "<razão>"`

