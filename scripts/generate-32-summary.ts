/**
 * Story 3.2 — DOGFOOD: gera summary via summaryGenerator.finalize() (22ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-3-2",
  workflowName: "Story 3.2 — Leaky bucket 1 req/s + retry + circuit breaker",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "A 3.1 entregou o adapter clihelper nu (POST). A 3.2 envolve-o com a tríade de resiliência: leaky bucket 1 req/s (AO-45), retry expo (D-04.7) e circuit breaker (FR-027), tudo em src/lib/ (primitivas reutilizáveis com ClockPort → testes determinísticos). AR-038: o adapter OWNS retry+CB; o core recebe só o Result final. As falhas transitórias são absorvidas antes de chegarem à FSM.",
  whatWasDone: [
    { artifact: "src/lib/leaky-bucket.ts", description: "NEW: createLeakyBucket (modelo nextSlot, 1 req/s) via ClockPort.setTimeout; FIFO. 43 linhas." },
    { artifact: "src/lib/retry-policy.ts", description: "NEW: computeBackoffMs (puro) + withRetry (decide: 429→Retry-After, 5xx→expo, 4xx→não). 53 linhas." },
    { artifact: "src/lib/circuit-breaker.ts", description: "NEW: createCircuitBreaker (5 falhas/60s→CircuitOpen{resetAt}; recordFailure/Success). 56 linhas." },
    { artifact: "src/adapters/whatsapp/clihelper.adapter.ts + outbound-notify.port.ts", description: "MODIFY: withResilience (CB→bucket→retry) + Idempotency-Key header (SHA-256 getRunContext); +CircuitOpen na union. tests: 11 specs (property bucket+retry+CB)." },
  ],
  decisions: [
    { n: 1, decision: "Idempotency-Key = SHA-256(runId||storyId||template||seq) via getRunContext, header no POST.", reason: "Honra AO-39 sem mudar o input do port; o dedup é do clihelper (não confirmado, O-3.2-1).", id: "Q-3.2-1" },
    { n: 2, decision: "CircuitOpen adicionado a OutboundNotifyError.", reason: "AC3 exige err({kind:'CircuitOpen'}) de sendTemplate; pertence à union do port. Divergência files_modified registada.", id: "Q-3.2-2" },
    { n: 3, decision: "CB conta só send esgotado Transient/Permanent; 429 NÃO conta; ordem CB→bucket→retry.", reason: "429 é rate-limit (não falha de serviço) — contar tripava o breaker sob pressão. Sucesso reseta.", id: "Q-3.2-3" },
  ],
  tradeoffs: [
    "As 3 primitivas usam ClockPort injectado → o property AC (10 sends→9s) e os delays de retry são determinísticos via TestClockPort.advance / clock spy imediato, sem timers reais (AO-103). fast-check no bucket e no backoff.",
    "withResilience envolve qualquer OutboundNotifyPort (não só o clihelper) — primitivas reutilizáveis. O wrapping fica no adapter (files_modified) a 199 linhas (<200 HARD), apertado mas dentro.",
  ],
  openItems: [
    { id: "O-3.2-1", description: "Clihelper honrar o Idempotency-Key não confirmado (a chave é computada+enviada; dedup é do clihelper). Cruza O-3.1-1." },
    { id: "fronteiras", description: "Epic 4 liga CircuitOpen/retry-exhaustion à FSM; 3.3 (6 templates UTILITY); inbound/n8n. AI-E2-2 (extrair ao 3º caller) — as primitivas lib são novas, não extracções." },
  ],
  metrics: [
    { key: "Tests", value: "372 pass / 3 skip / 0 fail (era 361; +11 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (adapter 199 linhas <200)" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-3.2` → marco done + commit `feat(story-3.2): leaky bucket + retry + circuit breaker`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "Epic 3: 2/6. Próxima: Story 3.3 (6 templates UTILITY — design + tracking de submissão Meta)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/leaky-bucket.ts", "src/lib/retry-policy.ts", "src/lib/circuit-breaker.ts", "src/adapters/whatsapp/clihelper.adapter.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
