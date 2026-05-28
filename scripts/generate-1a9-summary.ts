/**
 * Story 1.a.9 — DOGFOOD: gera o próprio summary via summaryGenerator.finalize().
 *
 * Primeira execução real do generator construído na Story 1.a.8.
 * Após esta execução, o ficheiro é escrito + auto-committed via --no-verify.
 *
 * Run: `bun run scripts/generate-1a9-summary.ts`
 */

import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";
import type { SummaryInput } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1a9",
  workflowName: "Story 1.a.9 — AsyncLocalStorage withRunContext + correlation IDs",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-28",
  contexto:
    "1.a.7/1.a.8 introduziram bootRunId UUID hardcoded passado em cada audit.append(). Esta story estabelece o mecanismo canónico de propagação cross-async via node:async_hooks.AsyncLocalStorage wrapped em withRunContext(ctx, fn). Auto-inject no audit adapter substitui o pattern explicit (Q-A9-1).",
  whatWasDone: [
    {
      artifact: "src/lib/run-context.ts",
      path: "src/lib/run-context.ts",
      description:
        "55 linhas. RunContext + withRunContext + getRunContext + requireRunContext (throws AO-66 #1).",
    },
    {
      artifact: "src/ports/audit.port.ts",
      description: "+8 linhas. AuditEntry.runId opcional + RunIdMissing variant.",
    },
    {
      artifact: "src/adapters/audit/jsonl-hash-chain.adapter.ts",
      description: "+7 linhas. Resolve runId via explicit > ctx > err.",
    },
    {
      artifact: "tests/lib/run-context.test.ts",
      description:
        "199 linhas, 12 specs: 5 helper + 4 AC-1 + 3 AC-2 (Promise.all isolation + nested).",
    },
    {
      artifact: "tests/cli/review.test.ts",
      description: "Compat shim: AppendCall.runId 'string | undefined'.",
    },
  ],
  decisions: [
    {
      n: 1,
      decision: "AuditEntry.runId opcional + RunIdMissing variant.",
      reason: "Sem isto, AC-1 impossível type-wise. Backward compat 100% em runtime.",
      id: "Q-A9-1",
    },
    {
      n: 2,
      decision: "RunContext inclui traceId placeholder OpenTelemetry.",
      reason: "Zero cost agora; future-proof.",
      id: "Q-A9-2",
    },
    {
      n: 3,
      decision: "NÃO wirear bootstrap.ts / review.command.ts em withRunContext.",
      reason: "Spec só lista audit adapter; defer para Story 2.1+ worker loop.",
      id: "Q-A9-3",
    },
    {
      n: 4,
      decision: "NÃO instalar pino dep.",
      reason: "withRunContext é genérico; logger entra em story dedicada.",
      id: "Q-A9-4",
    },
    {
      n: 5,
      decision: "Precedência: explicit > ctx > err RunIdMissing.",
      reason: "Permite caller override; menos-surpresa pattern.",
    },
    {
      n: 6,
      decision: "runId NÃO entra na hash chain formula.",
      reason: "Manter compat com docs/audit-format.md + chains 1.a.6.",
    },
    {
      n: 7,
      decision: "requireRunContext throws com AO-66 #1 inline.",
      reason: "Programmer error categoria #1; ESLint comment documenta.",
    },
  ],
  tradeoffs: [
    "Quis wirear bootstrap/review em withRunContext, fiquei com scope-min defer (Q-A9-3): wiring real entra com worker loop 2.1+.",
    "Quis test ordering deterministic em Promise.all, fiquei com per-payload validation: racers não têm ordering garantido.",
    "Quis pino + logger.child(getRunContext()), fiquei sem (Q-A9-4): scope creep; logger merece story própria.",
  ],
  openItems: [
    { id: "O-A9-1", description: "Wire bootstrap/review em withRunContext — Story 2.1+." },
    { id: "O-A9-2", description: "pino logger + getRunContext() — story dedicada futura." },
    { id: "O-A9-3", description: "traceId real OpenTelemetry integration — v1.1+." },
    {
      id: "O-A9-4",
      description:
        "setTimeout/setInterval callbacks SAEM do context frame; doc-it-out futuro.",
    },
    {
      id: "O-A9-5",
      description:
        "REVIEWER FINDING (live dogfood): generator Tier-B = Tier-C dados (TierBOverflow 955w). Generator deve aceitar `tierBBrief` separado OU templates diferentes. Fix Story 1.a.10+.",
    },
    {
      id: "O-A6-6 acumula",
      description: "epics.md ao_subset codes vs canon D-04.x reconciliação — próximo docs:.",
    },
  ],
  metrics: [
    { key: "Tests", value: "142 pass / 0 fail (was 130 após 1.a.8; +12 novos: 12 run-context)" },
    { key: "Type-check", value: "clean (exit 0)" },
    { key: "Lint", value: "exit 0 (19 infos pré-existentes useLiteralKeys; não-blocker)" },
    { key: "Linhas src/lib/run-context.ts", value: "55 (dentro Biome 200 cap)" },
    {
      key: "Linhas modified",
      value: "audit.port.ts +8, jsonl-hash-chain.adapter.ts +7, review.test.ts +5 (compat shim)",
    },
    { key: "Linhas tests/lib/run-context.test.ts", value: "199 (test files isent do cap)" },
    { key: "Dependências adicionadas", value: "0" },
    { key: "Token usage approx", value: "~50K (dentro do estimated_tokens.dev_with_retry 56K)" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1a9` → marco done + commit dos restantes ficheiros (sem push). Mensagem proposta: `feat(story-1a9): AsyncLocalStorage withRunContext + correlation IDs (2 ACs verde; auto-inject audit)`.",
    },
    {
      n: 2,
      description:
        "Story 1.a.10 — LLMPort + AnthropicAdapter foundational (API SDK Sonnet+Haiku + Max 20x CLI fallback) — próxima (`blocked_by: [1.a.7]` done). 1ª integração com Anthropic real.",
    },
    {
      n: 3,
      description:
        "Em paralelo (opcional): push origin agora vs adia para batch após 1.a.10 (closing 10/22 do Sprint 0).",
    },
  ],
  // diffAgainst omitido — primeiro uso do generator; sem ref prévia para diff.
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
