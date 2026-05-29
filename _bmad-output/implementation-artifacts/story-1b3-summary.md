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
workflowId: story-1b3
workflowName: Story 1.b.3 — Audit redaction multi-pattern
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.b.3 — Audit redaction multi-pattern · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

3ª story do Epic 1.b e DRB BLOCKER #3 (AO-160+166+175). Fecha o buraco do audit que delegava redaction ao caller: a redaction multi-pattern passa a ser aplicada DENTRO do adapter, antes de hash+write, garantindo never-store-raw-tokens mesmo com código LLM-generated.

## O que foi feito

- **src/lib/redaction.ts** — ~95L. 10 patterns (anthropic/ghp_/AKIA/bearer/basic/generic/env-var/phone-pt/phone-br/wa_id) + size-cap n8n; redactString/Value/Payload recursivo sem mutação.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — MODIFY: redactPayload antes de computeHash; hash+line ambos do redigido (AC3).
- **tests/lib/redaction.security.test.ts** — 16 specs (AC1 exacto + 9/9 + property + recursão).
- **tests/adapters/audit.test.ts** — MODIFY: +regressão (secret ausente do JSONL + verifyChain verde).
- **scripts/verify-redaction.ts** — Gate CI/local: 9 assinaturas, 0 leaks → exit 0.
- **.github/workflows/ci.yml** — NEW — 1º CI do repo: lint/typecheck/test + verify-redaction + truffleHog.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Token uniforme ***REDACTED***. | AC1 literal; sem leak do tipo de segredo. | Q-B3-1 |
| 2 | n8n-verbose-body por size-cap + truncar (~2KB). | Cobre AP-3 disk + secrets escondidos. | Q-B3-2 |
| 3 | Hash sobre payload redigido. | Chain=bytes escritos; never-store-raw AO-166; verifyChain verde. | Q-B3-3 |
| 4 | Criar ci.yml mínimo + truffleHog; verify-redaction.ts gate local. | Não havia CI; cumpre AC4 sem depender de truffleHog local. | Q-B3-4 |
| 5 | redactValue devolve cópia (não muta event.payload). | Caller pode reusar o objecto; evita side-effects surpresa. | — |

## Trade-offs aplicados

- Quis reason fino por categoria, fiquei com token uniforme (Q-B3-1): AC1 literal + não revelar tipo de segredo.
- Quis truffleHog a correr no gate local, fiquei com verify-redaction.ts: truffleHog pode não estar instalado neste ambiente; corre em GH Actions.

## Open items deferidos

- **O-B3-1:** R2 publicAccessBlock (AO-160 deployment) — runbook infra.
- **O-B3-2:** Pino transport interceptando TODAS as mensagens (AO-175) — story observabilidade.
- **O-B3-3:** Backup destinations validation + periodic ACL audit (AO-166 cauda) — runbook.
- **O-B1-1 acumula:** Numeração PT (epics PT-3 vs architecture) — criar docs/pre-m1-pentest-tasks.md.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 205 pass / 0 fail (was 188; +17: 16 redaction + 1 audit regressão)
- **Type-check:** clean
- **Lint:** exit 0 (removido dead var 'covered'; 23 infos pré-existentes)
- **Linhas novas:** ~95 redaction + ~45 verify-redaction + ci.yml
- **Deps adicionadas:** 0
- **verify-redaction:** exit 0 (9 assinaturas, 0 leaks)
- **Token usage approx:** dentro estimated 56-84K

## Próximos passos sugeridos

1. Operador aprova `approve story-1b3` → marco done + commit. Mensagem: `feat(story-1b3): audit redaction multi-pattern (4 ACs verde; BLOCKER #3 M1)`.
2. Sprint 0: 14/22 done. Epic 1.b: 3/5. Próxima: Story 1.b.4 (sandbox Bun.spawn docker --network=none).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1b3` · Pedir alterações: `hdd-worker review request-changes story-1b3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b3 --reason "<razão>"`


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
workflowId: story-1b3
workflowName: Story 1.b.3 — Audit redaction multi-pattern
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.b.3 — Audit redaction multi-pattern

### Contexto detalhado

3ª story do Epic 1.b e DRB BLOCKER #3 (AO-160+166+175). Fecha o buraco do audit que delegava redaction ao caller: a redaction multi-pattern passa a ser aplicada DENTRO do adapter, antes de hash+write, garantindo never-store-raw-tokens mesmo com código LLM-generated.

### O que foi feito (verbose)

- **src/lib/redaction.ts** — ~95L. 10 patterns (anthropic/ghp_/AKIA/bearer/basic/generic/env-var/phone-pt/phone-br/wa_id) + size-cap n8n; redactString/Value/Payload recursivo sem mutação.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — MODIFY: redactPayload antes de computeHash; hash+line ambos do redigido (AC3).
- **tests/lib/redaction.security.test.ts** — 16 specs (AC1 exacto + 9/9 + property + recursão).
- **tests/adapters/audit.test.ts** — MODIFY: +regressão (secret ausente do JSONL + verifyChain verde).
- **scripts/verify-redaction.ts** — Gate CI/local: 9 assinaturas, 0 leaks → exit 0.
- **.github/workflows/ci.yml** — NEW — 1º CI do repo: lint/typecheck/test + verify-redaction + truffleHog.

### Full file list

- **src/lib/redaction.ts** — ~95L. 10 patterns (anthropic/ghp_/AKIA/bearer/basic/generic/env-var/phone-pt/phone-br/wa_id) + size-cap n8n; redactString/Value/Payload recursivo sem mutação.
- **src/adapters/audit/jsonl-hash-chain.adapter.ts** — MODIFY: redactPayload antes de computeHash; hash+line ambos do redigido (AC3).
- **tests/lib/redaction.security.test.ts** — 16 specs (AC1 exacto + 9/9 + property + recursão).
- **tests/adapters/audit.test.ts** — MODIFY: +regressão (secret ausente do JSONL + verifyChain verde).
- **scripts/verify-redaction.ts** — Gate CI/local: 9 assinaturas, 0 leaks → exit 0.
- **.github/workflows/ci.yml** — NEW — 1º CI do repo: lint/typecheck/test + verify-redaction + truffleHog.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Token uniforme ***REDACTED***. | AC1 literal; sem leak do tipo de segredo. | Q-B3-1 |
| 2 | n8n-verbose-body por size-cap + truncar (~2KB). | Cobre AP-3 disk + secrets escondidos. | Q-B3-2 |
| 3 | Hash sobre payload redigido. | Chain=bytes escritos; never-store-raw AO-166; verifyChain verde. | Q-B3-3 |
| 4 | Criar ci.yml mínimo + truffleHog; verify-redaction.ts gate local. | Não havia CI; cumpre AC4 sem depender de truffleHog local. | Q-B3-4 |
| 5 | redactValue devolve cópia (não muta event.payload). | Caller pode reusar o objecto; evita side-effects surpresa. | — |

### Trade-offs aplicados (narrativa)

- Quis reason fino por categoria, fiquei com token uniforme (Q-B3-1): AC1 literal + não revelar tipo de segredo.
- Quis truffleHog a correr no gate local, fiquei com verify-redaction.ts: truffleHog pode não estar instalado neste ambiente; corre em GH Actions.

### Open items deferidos (com onde serão resolvidos)

- **O-B3-1:** R2 publicAccessBlock (AO-160 deployment) — runbook infra.
- **O-B3-2:** Pino transport interceptando TODAS as mensagens (AO-175) — story observabilidade.
- **O-B3-3:** Backup destinations validation + periodic ACL audit (AO-166 cauda) — runbook.
- **O-B1-1 acumula:** Numeração PT (epics PT-3 vs architecture) — criar docs/pre-m1-pentest-tasks.md.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 205 pass / 0 fail (was 188; +17: 16 redaction + 1 audit regressão)
- **Type-check:** clean
- **Lint:** exit 0 (removido dead var 'covered'; 23 infos pré-existentes)
- **Linhas novas:** ~95 redaction + ~45 verify-redaction + ci.yml
- **Deps adicionadas:** 0
- **verify-redaction:** exit 0 (9 assinaturas, 0 leaks)
- **Token usage approx:** dentro estimated 56-84K

### Próximos passos sugeridos

1. Operador aprova `approve story-1b3` → marco done + commit. Mensagem: `feat(story-1b3): audit redaction multi-pattern (4 ACs verde; BLOCKER #3 M1)`.
2. Sprint 0: 14/22 done. Epic 1.b: 3/5. Próxima: Story 1.b.4 (sandbox Bun.spawn docker --network=none).

### Diff vs `HEAD`

```diff
diff --git a/src/adapters/audit/jsonl-hash-chain.adapter.ts b/src/adapters/audit/jsonl-hash-chain.adapter.ts
index 810521e..9a492b9 100644
--- a/src/adapters/audit/jsonl-hash-chain.adapter.ts
+++ b/src/adapters/audit/jsonl-hash-chain.adapter.ts
@@ -23,6 +23,7 @@ import type { Database } from "bun:sqlite";
 import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from "node:fs";
 import { join } from "node:path";
 import type { Sha256Hash } from "../../lib/branded.ts";
+import { redactPayload } from "../../lib/redaction.ts";
 import { err, ok } from "../../lib/result.ts";
 import { getRunContext } from "../../lib/run-context.ts";
 import type { AuditPort } from "../../ports/audit.port.ts";
@@ -129,14 +130,17 @@ export function createAuditAdapter(deps: {
           seq = 0;
         }
 
-        const thisHash = computeHash(prevHash, event.ts, seq, event.type, event.payload);
+        // Story 1.b.3 (AO-160/166): redige secrets ANTES de hash + write
+        // (never-store-raw-tokens). Hash e line ambos do payload redigido (AC3).
+        const safePayload = redactPayload(event.payload);
+        const thisHash = computeHash(prevHash, event.ts, seq, event.type, safePayload);
         const line = JSON.stringify({
           ts: event.ts,
           seq,
           run_id: runId,
           story_id: storyId ?? null,
           type: event.type,
-          payload: event.payload,
+          payload: safePayload,
           prev_hash: prevHash,
           this_hash: thisHash,
         });

```

---

→ Aprovar: `hdd-worker review approve story-1b3` · Pedir alterações: `hdd-worker review request-changes story-1b3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b3 --reason "<razão>"`

