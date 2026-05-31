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
workflowId: story-3-2
workflowName: Story 3.2 — Leaky bucket 1 req/s + retry + circuit breaker
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 3.2 — Leaky bucket 1 req/s + retry + circuit breaker · projeto_hdd · 2026-05-31

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

A 3.1 entregou o adapter clihelper nu (POST). A 3.2 envolve-o com a tríade de resiliência: leaky bucket 1 req/s (AO-45), retry expo (D-04.7) e circuit breaker (FR-027), tudo em src/lib/ (primitivas reutilizáveis com ClockPort → testes determinísticos). AR-038: o adapter OWNS retry+CB; o core recebe só o Result final. As falhas transitórias são absorvidas antes de chegarem à FSM.

## O que foi feito

- **src/lib/leaky-bucket.ts** — NEW: createLeakyBucket (modelo nextSlot, 1 req/s) via ClockPort.setTimeout; FIFO. 43 linhas.
- **src/lib/retry-policy.ts** — NEW: computeBackoffMs (puro) + withRetry (decide: 429→Retry-After, 5xx→expo, 4xx→não). 53 linhas.
- **src/lib/circuit-breaker.ts** — NEW: createCircuitBreaker (5 falhas/60s→CircuitOpen{resetAt}; recordFailure/Success). 56 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts + outbound-notify.port.ts** — MODIFY: withResilience (CB→bucket→retry) + Idempotency-Key header (SHA-256 getRunContext); +CircuitOpen na union. tests: 11 specs (property bucket+retry+CB).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Idempotency-Key = SHA-256(runId\|\|storyId\|\|template\|\|seq) via getRunContext, header no POST. | Honra AO-39 sem mudar o input do port; o dedup é do clihelper (não confirmado, O-3.2-1). | Q-3.2-1 |
| 2 | CircuitOpen adicionado a OutboundNotifyError. | AC3 exige err({kind:'CircuitOpen'}) de sendTemplate; pertence à union do port. Divergência files_modified registada. | Q-3.2-2 |
| 3 | CB conta só send esgotado Transient/Permanent; 429 NÃO conta; ordem CB→bucket→retry. | 429 é rate-limit (não falha de serviço) — contar tripava o breaker sob pressão. Sucesso reseta. | Q-3.2-3 |

## Trade-offs aplicados

- As 3 primitivas usam ClockPort injectado → o property AC (10 sends→9s) e os delays de retry são determinísticos via TestClockPort.advance / clock spy imediato, sem timers reais (AO-103). fast-check no bucket e no backoff.
- withResilience envolve qualquer OutboundNotifyPort (não só o clihelper) — primitivas reutilizáveis. O wrapping fica no adapter (files_modified) a 199 linhas (<200 HARD), apertado mas dentro.

## Open items deferidos

- **O-3.2-1:** Clihelper honrar o Idempotency-Key não confirmado (a chave é computada+enviada; dedup é do clihelper). Cruza O-3.1-1.
- **fronteiras:** Epic 4 liga CircuitOpen/retry-exhaustion à FSM; 3.3 (6 templates UTILITY); inbound/n8n. AI-E2-2 (extrair ao 3º caller) — as primitivas lib são novas, não extracções.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 372 pass / 3 skip / 0 fail (era 361; +11 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0 (adapter 199 linhas <200)
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-3.2` → marco done + commit `feat(story-3.2): leaky bucket + retry + circuit breaker`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 2/6. Próxima: Story 3.3 (6 templates UTILITY — design + tracking de submissão Meta).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-3-2` · Pedir alterações: `hdd-worker review request-changes story-3-2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-2 --reason "<razão>"`


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
workflowId: story-3-2
workflowName: Story 3.2 — Leaky bucket 1 req/s + retry + circuit breaker
date: 2026-05-31
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 3.2 — Leaky bucket 1 req/s + retry + circuit breaker

### Contexto detalhado

A 3.1 entregou o adapter clihelper nu (POST). A 3.2 envolve-o com a tríade de resiliência: leaky bucket 1 req/s (AO-45), retry expo (D-04.7) e circuit breaker (FR-027), tudo em src/lib/ (primitivas reutilizáveis com ClockPort → testes determinísticos). AR-038: o adapter OWNS retry+CB; o core recebe só o Result final. As falhas transitórias são absorvidas antes de chegarem à FSM.

### O que foi feito (verbose)

- **src/lib/leaky-bucket.ts** — NEW: createLeakyBucket (modelo nextSlot, 1 req/s) via ClockPort.setTimeout; FIFO. 43 linhas.
- **src/lib/retry-policy.ts** — NEW: computeBackoffMs (puro) + withRetry (decide: 429→Retry-After, 5xx→expo, 4xx→não). 53 linhas.
- **src/lib/circuit-breaker.ts** — NEW: createCircuitBreaker (5 falhas/60s→CircuitOpen{resetAt}; recordFailure/Success). 56 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts + outbound-notify.port.ts** — MODIFY: withResilience (CB→bucket→retry) + Idempotency-Key header (SHA-256 getRunContext); +CircuitOpen na union. tests: 11 specs (property bucket+retry+CB).

### Full file list

- **src/lib/leaky-bucket.ts** — NEW: createLeakyBucket (modelo nextSlot, 1 req/s) via ClockPort.setTimeout; FIFO. 43 linhas.
- **src/lib/retry-policy.ts** — NEW: computeBackoffMs (puro) + withRetry (decide: 429→Retry-After, 5xx→expo, 4xx→não). 53 linhas.
- **src/lib/circuit-breaker.ts** — NEW: createCircuitBreaker (5 falhas/60s→CircuitOpen{resetAt}; recordFailure/Success). 56 linhas.
- **src/adapters/whatsapp/clihelper.adapter.ts + outbound-notify.port.ts** — MODIFY: withResilience (CB→bucket→retry) + Idempotency-Key header (SHA-256 getRunContext); +CircuitOpen na union. tests: 11 specs (property bucket+retry+CB).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Idempotency-Key = SHA-256(runId\|\|storyId\|\|template\|\|seq) via getRunContext, header no POST. | Honra AO-39 sem mudar o input do port; o dedup é do clihelper (não confirmado, O-3.2-1). | Q-3.2-1 |
| 2 | CircuitOpen adicionado a OutboundNotifyError. | AC3 exige err({kind:'CircuitOpen'}) de sendTemplate; pertence à union do port. Divergência files_modified registada. | Q-3.2-2 |
| 3 | CB conta só send esgotado Transient/Permanent; 429 NÃO conta; ordem CB→bucket→retry. | 429 é rate-limit (não falha de serviço) — contar tripava o breaker sob pressão. Sucesso reseta. | Q-3.2-3 |

### Trade-offs aplicados (narrativa)

- As 3 primitivas usam ClockPort injectado → o property AC (10 sends→9s) e os delays de retry são determinísticos via TestClockPort.advance / clock spy imediato, sem timers reais (AO-103). fast-check no bucket e no backoff.
- withResilience envolve qualquer OutboundNotifyPort (não só o clihelper) — primitivas reutilizáveis. O wrapping fica no adapter (files_modified) a 199 linhas (<200 HARD), apertado mas dentro.

### Open items deferidos (com onde serão resolvidos)

- **O-3.2-1:** Clihelper honrar o Idempotency-Key não confirmado (a chave é computada+enviada; dedup é do clihelper). Cruza O-3.1-1.
- **fronteiras:** Epic 4 liga CircuitOpen/retry-exhaustion à FSM; 3.3 (6 templates UTILITY); inbound/n8n. AI-E2-2 (extrair ao 3º caller) — as primitivas lib são novas, não extracções.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 372 pass / 3 skip / 0 fail (era 361; +11 unit)
- **Integração:** 16 pass / 3 skip
- **Type-check:** clean
- **Lint:** exit 0 (adapter 199 linhas <200)
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-3.2` → marco done + commit `feat(story-3.2): leaky bucket + retry + circuit breaker`. Não toca workflows → push normal; verificar CI verde.
2. Epic 3: 2/6. Próxima: Story 3.3 (6 templates UTILITY — design + tracking de submissão Meta).

### Diff vs `HEAD`

```diff
diff --git a/src/adapters/whatsapp/clihelper.adapter.ts b/src/adapters/whatsapp/clihelper.adapter.ts
index 5f1ee5b..db2b12b 100644
--- a/src/adapters/whatsapp/clihelper.adapter.ts
+++ b/src/adapters/whatsapp/clihelper.adapter.ts
@@ -10,7 +10,13 @@
  * nem computa idempotency key (pareia com retry → 3.2). Só outbound (inbound = n8n).
  */
 
-import { errAsync, okAsync, type ResultAsync } from "../../lib/result.ts";
+import { createHash } from "node:crypto";
+import { createCircuitBreaker } from "../../lib/circuit-breaker.ts";
+import { createLeakyBucket } from "../../lib/leaky-bucket.ts";
+import { errAsync, okAsync, type Result, ResultAsync } from "../../lib/result.ts";
+import { type BackoffOptions, computeBackoffMs, withRetry } from "../../lib/retry-policy.ts";
+import { getRunContext } from "../../lib/run-context.ts";
+import type { ClockPort } from "../../ports/clock.port.ts";
 import type {
   OutboundNotifyError,
   OutboundNotifyPort,
@@ -91,11 +97,19 @@ function mapStatus(
   return errAsync({ kind: "Permanent", cause: `HTTP ${res.status}` });
 }
 
+/** Idempotency key AO-39: `SHA-256(runId||storyId||template||seq)` (Q-3.2-1). */
+function idempotencyKey(template: string, seq: number): string {
+  const ctx = getRunContext();
+  const material = `${ctx?.runId ?? ""}||${ctx?.storyId ?? ""}||${template}||${seq}`;
+  return createHash("sha256").update(material).digest("hex");
+}
+
 export function createClihelperAdapter(
   config: ClihelperConfig,
   deps: ClihelperDeps,
 ): OutboundNotifyPort {
   const log = deps.log ?? ((line: string) => process.stdout.write(`${line}\n`));
+  let seq = 0;
 
   function sendTemplate(input: SendTemplateInput): ResultAsync<SendResult, OutboundNotifyError> {
     const hasVars = input.vars !== undefined && Object.keys(input.vars).length > 0;
@@ -114,11 +128,16 @@ export function createClihelperAdapter(
       return okAsync({ endpoint, dryRun: true });
     }
 
+    seq += 1;
     return deps.http
       .post({
         url: endpoint,
         method: "POST",
-        headers: { Authorization: config.token, "Content-Type": "application/json" },
+        headers: {
+          Authorization: config.token,
+          "Content-Type": "application/json",
+          "Idempotency-Key": idempotencyKey(input.template, seq),
+        },
         body: JSON.stringify(parsed.data),
       })
       .mapErr((e): OutboundNotifyError => ({ kind: e.kind, cause: e.cause }))
@@ -127,3 +146,54 @@ export function createClihelperAdapter(
 
   return { sendTemplate };
 }
+
+export type ResilienceConfig = {
+  readonly clock: ClockPort;
+  readonly ratePerSec?: number;
+  readonly maxAttempts?: number;
+  readonly backoff?: BackoffOptions;
+};
+
+/**
+ * Envolve um `OutboundNotifyPort` com circuit breaker + leaky bucket + retry
+ * (Story 3.2, Q-3.2-3). Ordem: `CB.canPass` (open → CircuitOpen, sem enqueue) →
+ * `bucket.enqueue` (1 req/s) → `withRetry` (429→Retry-After, 5xx→expo). Conta
+ * falha do CB só em send esgotado Transient/Permanent (429 NÃO conta); ok reseta.
+ */
+export function withResilience(
+  inner: OutboundNotifyPort,
+  cfg: ResilienceConfig,
+): OutboundNotifyPort {
+  const bucket = createLeakyBucket({ clock: cfg.clock, ratePerSec: cfg.ratePerSec ?? 1 });
+  const cb = createCircuitBreaker({ clock: cfg.clock });
+  const backoff = cfg.backoff ?? { base: 2000, cap: 60_000 };
+  const maxAttempts = cfg.maxAttempts ?? 5;
+
+  async function runAndRecord(
+    input: SendTemplateInput,
+  ): Promise<Result<SendResult, OutboundNotifyError>> {
+    const res = await bucket.enqueue(() =>
+      withRetry(() => inner.sendTemplate(input), {
+        maxAttempts,
+        clock: cfg.clock,
+        decide: (e, attempt) => {
+          if (e.kind === "RateLimited") return { retry: true, delayMs: e.retryAfterMs };
+          if (e.kind === "Transient")
+            return { retry: true, delayMs: computeBackoffMs(attempt, backoff) };
+          return { retry: false };
+        },
+      }),
+    );
+    if (res.isOk()) cb.recordSuccess();
+    else if (res.error.kind === "Transient" || res.error.kind === "Permanent") cb.recordFailure();
+    return res;
+  }
+
+  function sendTemplate(input: SendTemplateInput): ResultAsync<SendResult, OutboundNotifyError> {
+    const gate = cb.canPass();
+    if (gate.isErr()) return errAsync(gate.error); // CircuitOpen — fail-fast, sem POST
+    return new ResultAsync(runAndRecord(input));
+  }
+
+  return { sendTemplate };
+}

```

---

→ Aprovar: `hdd-worker review approve story-3-2` · Pedir alterações: `hdd-worker review request-changes story-3-2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-3-2 --reason "<razão>"`

