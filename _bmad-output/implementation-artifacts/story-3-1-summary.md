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
workflowId: story-3-1
workflowName: Story 3.1 — OutboundNotifyPort + clihelper adapter
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 3.1 — OutboundNotifyPort + clihelper adapter · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

1ª story do Epic 3 (canal WhatsApp). Entrega a porta de saída do worker: adapter HTTP nu sobre o app proprietário do operador (clihelper), que envuelve a Meta Cloud API. POST + Authorization + payload Zod-validado + dry-run. O leaky-bucket 1 req/s + retry + circuit breaker são da 3.2 (envolvem este adapter). Precedido pelo spot-check AI-E2-3 (arquitectura×epics×memórias) que confirmou clear-to-implement.

## O que foi feito

- **src/ports/outbound-notify.port.ts** — NEW: OutboundNotifyPort (transporte; sendTemplate) + OutboundNotifyError. Distinto do NotifyPort de domínio (1.a.3). 38 linhas.
- **src/adapters/whatsapp/payload-schema.ts** — NEW: clihelperBodySchema .strict() (number, name, language=pt_BR, openTicket, queueId, template[]). 37 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts** — NEW: createClihelperAdapter(config, deps); HttpPort injectável; selectEndpoint (vars→endpoint), dry-run redacted, mapStatus (429/5xx/4xx). 129 linhas.
- **tests/adapters/clihelper.test.ts** — NEW: 10 specs — AC1-4 + status HTTP + transporte. Fake HttpPort spy, sem rede real (D-053).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | OutboundNotifyPort (transporte) distinto do NotifyPort (domínio). | Spot-check apanhou: NotifyPort 1.a.3 existe; a 3.1 constrói o transporte (files_created). Mapper NotifyEvent→template = story posterior. | Q-3.1-1 |
| 2 | vars named (Record<string,string>); template[] = assumção documentada. | Arquitectura lista template[] sem estrutura interna; vars named alinha a AC; shape interno é O-3.1-1 (pendente confirmação operador). | Q-3.1-2 |
| 3 | Endpoint derivado de vars (vazio→sem-variavel). | arch:653 tem dois endpoints; derivar de vars evita parâmetro redundante. | Q-3.1-3 |
| 4 | HttpPort injectável; idempotency diferida p/ 3.2; env.ts não tocado. | Espelha SpawnPort (testável sem rede); idempotency pareia com retry (3.2); adapter recebe config injectado. | Q-3.1-4 |

## Trade-offs aplicados

- Spot-check AI-E2-3 antes de implementar apanhou o layering NotifyPort vs OutboundNotifyPort (classe do conflito verdict da 2.7) — cedo, não no fim do épico. Confirmou também que O-B5-3 (inbound) NÃO bloqueia a 3.1 (outbound especificado).
- Dry-run redacted por omissão: o log não contém values de vars nem o token (testado). Fail-closed: payload inválido → 0 POSTs (não envia lixo ao clihelper).

## Open items deferidos

- **O-3.1-1:** Shape interno de template[] é assumção ({name, parameters:[{key,value}]}); confirmar quando o clihelper outbound real for sondado (análogo a O-B5-3, mas outbound).
- **fronteiras:** 3.2 (bucket 1 req/s + retry + CB + idempotency key, envolve este adapter), 3.3 (6 templates UTILITY + tracking Meta), inbound/n8n (story posterior). Wiring env→config = integração.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 361 pass / 3 skip / 0 fail (era 351; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-3.1` → marco done + commit `feat(story-3.1): OutboundNotifyPort + clihelper adapter`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 1/6. Próxima: Story 3.2 (leaky bucket 1 req/s + retry + circuit breaker; envolve este adapter; idempotency key).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-3-1` · Pedir alterações: `hdd-worker review request-changes story-3-1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-1 --reason "<razão>"`


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
workflowId: story-3-1
workflowName: Story 3.1 — OutboundNotifyPort + clihelper adapter
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 3.1 — OutboundNotifyPort + clihelper adapter

### Contexto detalhado

1ª story do Epic 3 (canal WhatsApp). Entrega a porta de saída do worker: adapter HTTP nu sobre o app proprietário do operador (clihelper), que envuelve a Meta Cloud API. POST + Authorization + payload Zod-validado + dry-run. O leaky-bucket 1 req/s + retry + circuit breaker são da 3.2 (envolvem este adapter). Precedido pelo spot-check AI-E2-3 (arquitectura×epics×memórias) que confirmou clear-to-implement.

### O que foi feito (verbose)

- **src/ports/outbound-notify.port.ts** — NEW: OutboundNotifyPort (transporte; sendTemplate) + OutboundNotifyError. Distinto do NotifyPort de domínio (1.a.3). 38 linhas.
- **src/adapters/whatsapp/payload-schema.ts** — NEW: clihelperBodySchema .strict() (number, name, language=pt_BR, openTicket, queueId, template[]). 37 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts** — NEW: createClihelperAdapter(config, deps); HttpPort injectável; selectEndpoint (vars→endpoint), dry-run redacted, mapStatus (429/5xx/4xx). 129 linhas.
- **tests/adapters/clihelper.test.ts** — NEW: 10 specs — AC1-4 + status HTTP + transporte. Fake HttpPort spy, sem rede real (D-053).

### Full file list

- **src/ports/outbound-notify.port.ts** — NEW: OutboundNotifyPort (transporte; sendTemplate) + OutboundNotifyError. Distinto do NotifyPort de domínio (1.a.3). 38 linhas.
- **src/adapters/whatsapp/payload-schema.ts** — NEW: clihelperBodySchema .strict() (number, name, language=pt_BR, openTicket, queueId, template[]). 37 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts** — NEW: createClihelperAdapter(config, deps); HttpPort injectável; selectEndpoint (vars→endpoint), dry-run redacted, mapStatus (429/5xx/4xx). 129 linhas.
- **tests/adapters/clihelper.test.ts** — NEW: 10 specs — AC1-4 + status HTTP + transporte. Fake HttpPort spy, sem rede real (D-053).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | OutboundNotifyPort (transporte) distinto do NotifyPort (domínio). | Spot-check apanhou: NotifyPort 1.a.3 existe; a 3.1 constrói o transporte (files_created). Mapper NotifyEvent→template = story posterior. | Q-3.1-1 |
| 2 | vars named (Record<string,string>); template[] = assumção documentada. | Arquitectura lista template[] sem estrutura interna; vars named alinha a AC; shape interno é O-3.1-1 (pendente confirmação operador). | Q-3.1-2 |
| 3 | Endpoint derivado de vars (vazio→sem-variavel). | arch:653 tem dois endpoints; derivar de vars evita parâmetro redundante. | Q-3.1-3 |
| 4 | HttpPort injectável; idempotency diferida p/ 3.2; env.ts não tocado. | Espelha SpawnPort (testável sem rede); idempotency pareia com retry (3.2); adapter recebe config injectado. | Q-3.1-4 |

### Trade-offs aplicados (narrativa)

- Spot-check AI-E2-3 antes de implementar apanhou o layering NotifyPort vs OutboundNotifyPort (classe do conflito verdict da 2.7) — cedo, não no fim do épico. Confirmou também que O-B5-3 (inbound) NÃO bloqueia a 3.1 (outbound especificado).
- Dry-run redacted por omissão: o log não contém values de vars nem o token (testado). Fail-closed: payload inválido → 0 POSTs (não envia lixo ao clihelper).

### Open items deferidos (com onde serão resolvidos)

- **O-3.1-1:** Shape interno de template[] é assumção ({name, parameters:[{key,value}]}); confirmar quando o clihelper outbound real for sondado (análogo a O-B5-3, mas outbound).
- **fronteiras:** 3.2 (bucket 1 req/s + retry + CB + idempotency key, envolve este adapter), 3.3 (6 templates UTILITY + tracking Meta), inbound/n8n (story posterior). Wiring env→config = integração.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 361 pass / 3 skip / 0 fail (era 351; +10 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-3.1` → marco done + commit `feat(story-3.1): OutboundNotifyPort + clihelper adapter`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 1/6. Próxima: Story 3.2 (leaky bucket 1 req/s + retry + circuit breaker; envolve este adapter; idempotency key).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-3-1` · Pedir alterações: `hdd-worker review request-changes story-3-1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-1 --reason "<razão>"`

