# Story 3.2: Leaky bucket 1 req/s + retry + circuit breaker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `clihelper adapter`,
I want um leaky bucket queue interno que enforce 1 req/s + retry exponencial (base 2s, max 5, max delay 60s) em 429/5xx + circuit breaker (5 falhas / 1min),
so that não excedemos o rate-limit e falhas transitórias não cascateiam para a FSM.

## Acceptance Criteria

1. **(property — leaky bucket 1 req/s)** **Given** 10 sends enfileirados em 1s
   **When** o bucket processa
   **Then** o primeiro send ocorre em t=0; o último em t≥9s (espaçamento ≥1s — `fast-check` + `TestClockPort.advance`).

2. **(binary — retry 429 com Retry-After)** **Given** o clihelper responde 429 com `Retry-After: 5`
   **When** o adapter recebe
   **Then** faz retry após 5s (honra `Retry-After`); 5xx usa expo backoff (2s base, cap 60s, max 5 tentativas).

3. **(binary — circuit breaker)** **Given** 5 falhas consecutivas em 1 min
   **When** chega o 6º request
   **Then** o circuit breaker está open → retorna `err({kind:'CircuitOpen', resetAt:<date>})` **sem POST** (Q-3.2-2).

4. **(binary — happy path + reset)** **Given** o CB fechado e bucket vazio
   **When** um send tem sucesso
   **Then** passa (POST único) e o contador de falhas consecutivas do CB reseta a 0.

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/leaky-bucket.ts` (NEW)** (AC: #1) — `createLeakyBucket({clock, ratePerSec})`; `enqueue` com modelo `nextSlot` (1º em `now`, i-ésimo em `now+i·1000`); `ClockPort.setTimeout`. FIFO. 43 linhas.
- [x] **Task 2 — `src/lib/retry-policy.ts` (NEW)** (AC: #2) — `computeBackoffMs(attempt, {base,cap})` (puro) + `withRetry(fn, {maxAttempts, clock, decide})`; `decide` devolve retry+delayMs (429→Retry-After, 5xx→expo, 4xx→não). 53 linhas.
- [x] **Task 3 — `src/lib/circuit-breaker.ts` (NEW)** (AC: #3, #4) — `createCircuitBreaker({clock, threshold:5, windowMs:60s, cooldownMs:60s})`; `canPass()→CircuitOpen{resetAt}`, `recordFailure/Success`. 5 falhas na janela → open. 56 linhas.
- [x] **Task 4 — `src/adapters/whatsapp/clihelper.adapter.ts` (MODIFY)** (AC: #1-#4) — `withResilience(inner, cfg)`: `CB.canPass`→`bucket.enqueue`→`withRetry`; CB conta só send esgotado Transient/Permanent (429 não, Q-3.2-3); ok reseta. Idempotency-Key header no `createClihelperAdapter` (SHA-256 via getRunContext, Q-3.2-1). **+`CircuitOpen` em `outbound-notify.port.ts`** (Q-3.2-2). 199 linhas (<200).
- [x] **Task 5 — `tests/lib/leaky-bucket.test.ts` + `tests/lib/retry.property.test.ts` (NEW)** (AC: #1-#4) — bucket property (N sends → i·1000; 10→9s); CB primitiva (5→open+resetAt; sucesso reseta); withResilience (CircuitOpen sem chamar inner; 429 não conta). retry property (`computeBackoffMs` monótono+cap; 429 Retry-After; 5xx expo [2,4,8,16]s; 4xx sem retry). `TestClockPort.advance` + clock spy imediato. 11 specs.
- [x] **Task 6 — gates**: type-check clean · lint exit 0 · `bun test` 372 pass / 3 skip / 0 fail (+11) · integração 16 pass / 3 skip. Testes da 3.1 intactos (Idempotency-Key é aditivo).
- [x] **Task 7 (FINAL) — Tier-B summary (22ª dogfood)**: `scripts/generate-32-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-3-2): …` (`0573b5b`, Tier-B **514 words** ≤715). `workflowId: "story-3-2"`. Sprint-status `3-2 → review`.

## Dev Notes

### Big picture

A 3.1 entregou o adapter clihelper **nu** (POST directo). A 3.2 envolve-o com a tríade de resiliência: **leaky bucket 1 req/s** (constraint clihelper, AO-45/FR-025), **retry** expo (D-04.7) e **circuit breaker** (FR-027), tudo em `src/lib/` (primitivas reutilizáveis). **AR-038:** o adapter OWNS retry+CB; o core recebe só o `Result` final. As primitivas usam `ClockPort` → testes determinísticos (`TestClockPort.advance`), sem timers reais.

### Reuso (NÃO reinventar)

- **`clihelper.adapter.ts`** (3.1): `createClihelperAdapter(config, deps)`; `HttpPort` injectável; `sendTemplate` faz o POST + `mapStatus` (429→RateLimited, 5xx→Transient, 4xx→Permanent). A 3.2 envolve este `sendTemplate`. **NÃO** reimplementar o POST.
- **`ClockPort`** (1.a.3): `now()`, `setTimeout(fn, ms): () => void` (cancel), `setInterval`. `TestClockAdapter.advance(ms)` dispara callbacks pendentes — **base do property AC** (determinístico).
- **`OutboundNotifyPort`/`OutboundNotifyError`** (3.1): union `Transient|Permanent|RateLimited|PayloadInvalid`. `CircuitOpen` → **Q-3.2-2**.
- **`RunContext`** (1.a.9): `getRunContext()` → `{runId, storyId?}` para a idempotency key (Q-3.2-1) sem alterar o input do port.
- Arquitectura retry table (arch:642): clihelper **2s base, max 5, 60s, CB 5 falhas/1min**. Idempotency AO-39: `SHA-256(run_id||story_id||template_name||seq_local)`. `Result`/`ResultAsync` (neverthrow); `branded.ts` (`Sha256Hash`).

### Fronteiras (o que NÃO fazer aqui)

- **Story 3.1 (adapter nu):** o POST + payload schema + dry-run já existem. A 3.2 só envolve.
- **Story 3.3 (templates):** validação dos 6 templates UTILITY. Fora.
- **Inbound/n8n:** a 3.2 é outbound. Fora.
- A 3.2 **não** liga isto à FSM (a tríade absorve as falhas transitórias *antes* de chegarem à FSM — é esse o ponto; o wiring FSM de `CircuitOpen`/exhaustion é Epic 4).

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-3.2-1 [RESOLVED — (a) computar + anexar header]:** `Idempotency-Key = SHA-256(runId||storyId||template||seq)` (runId/storyId de `getRunContext()`, seq = contador do adapter); header no POST. Honra AO-39 sem mudar o input do port. O honrar-dedup é do clihelper (não confirmado → **O-3.2-1**).
- **Q-3.2-2 [RESOLVED — (a) adicionar a `OutboundNotifyError`]:** `CircuitOpen{resetAt}` entra na union de `outbound-notify.port.ts`. **Divergência files_modified** (+`outbound-notify.port.ts`) registada (AI-S0-4/E2). Wrapped adapter continua `OutboundNotifyPort`.
- **Q-3.2-3 [RESOLVED — (a) falha = send esgotado; 429 não conta]:** ordem `CB.canPass → bucket.enqueue → withRetry(POST)`. Falha consecutiva do CB = `sendTemplate` que esgota retries (Transient/Permanent final); **429 NÃO conta** (rate-limit, não falha de serviço). Sucesso reseta o contador.

### Project Structure Notes

- `files_created`: `src/lib/leaky-bucket.ts`, `src/lib/retry-policy.ts`, `src/lib/circuit-breaker.ts`, `tests/lib/leaky-bucket.test.ts`, `tests/lib/retry.property.test.ts`. `files_modified`: `src/adapters/whatsapp/clihelper.adapter.ts` (+`outbound-notify.port.ts` se Q-3.2-2=a — registar divergência).
- 3 primitivas em ficheiros separados (Biome maxLines:200 + reutilização). `ao_subset`: FR-025, FR-027, AR-038, D-04.7.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2] (1467-1494 — StorySpec + ACs)
- [Source: _bmad-output/planning-artifacts/architecture.md] (642 retry table · 207 AO-45 bucket · 584 idempotency AO-39)
- [Source: src/adapters/whatsapp/clihelper.adapter.ts] (3.1 — sendTemplate + mapStatus a envolver) · [Source: src/ports/outbound-notify.port.ts] (erro; Q-3.2-2)
- [Source: src/adapters/clock/test-clock.adapter.ts] (`advance` — base do property AC) · [Source: src/ports/clock.port.ts]
- [Source: src/lib/run-context.ts] (getRunContext — idempotency Q-3.2-1)
- Story anterior: `_bmad-output/implementation-artifacts/3-1-...md` (HttpPort, OutboundNotifyError, O-3.1-1)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0. Adapter 199 linhas (<200 HARD).
- `bun test` → 372 pass / 3 skip / 0 fail (era 361; +11). `bun run test:integration` → 16 pass / 3 skip.
- `clihelper.test.ts` (3.1) intacto — o header `Idempotency-Key` é aditivo (não asserido como ausente).

### Completion Notes List

- **AC1 (property):** `leaky-bucket` 1 req/s — N sends → i-ésimo em `i·1000` (10→9s). `TestClockPort.advance` drive determinístico.
- **AC2:** `withRetry` — 429 → `Retry-After`·1000 (5s); 5xx → expo `[2,4,8,16]s`, max 5; 4xx → sem retry. `computeBackoffMs` property (monótono, cap 60s).
- **AC3:** `circuit-breaker` — 5 falhas na janela → `CircuitOpen{resetAt}`; `withResilience` fail-fast (inner **não** chamado no 6º).
- **AC4 + Q-3.2-3:** sucesso reseta; **429 NÃO conta** para o CB (testado: 6 sends RateLimited → nunca CircuitOpen).
- **Q-3.2-1:** Idempotency-Key = `SHA-256(runId||storyId||template||seq)` (getRunContext + seq), header no POST. **Q-3.2-2:** `CircuitOpen` adicionado a `OutboundNotifyError`.
- **Fronteiras:** sem wiring FSM (Epic 4 liga CircuitOpen/exhaustion); sem inbound; sem validação dos 6 templates (3.3). Sem deps novas.
- **O-3.2-1:** o clihelper honrar o `Idempotency-Key` não está confirmado (como O-3.1-1, outbound).

### File List

- `src/lib/leaky-bucket.ts` (NEW)
- `src/lib/retry-policy.ts` (NEW)
- `src/lib/circuit-breaker.ts` (NEW)
- `src/adapters/whatsapp/clihelper.adapter.ts` (MODIFY — withResilience + Idempotency-Key)
- `src/ports/outbound-notify.port.ts` (MODIFY — +`CircuitOpen`; divergência files_modified vs StorySpec)
- `tests/lib/leaky-bucket.test.ts` (NEW)
- `tests/lib/retry.property.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/3-2-...md` (story file) · `sprint-status.yaml` · `readiness-open-items.md` (O-3.2-1)
- `scripts/generate-32-summary.ts` (NEW — Task 7, dogfood)
