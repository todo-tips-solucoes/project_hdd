/**
 * Story 1.a.10 — DOGFOOD: gera summary via summaryGenerator.finalize() (2ª vez).
 *
 * Lessons aplicadas da 1.a.9 (O-A9-5): Tier-B trim AGRESSIVO porque generator
 * usa mesmos dados em B e C. Word cap 900.
 */

import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";
import type { SummaryInput } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1a10",
  workflowName: "Story 1.a.10 — LLMPort + AnthropicAdapter foundational",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "Última story foundational de Epic 1.a (10/10). Estabelece a porta única LLM + 2 adapters reais (Anthropic SDK + claude --print CLI) que servem E3/E4/E6.a/E7.b downstream. D-050 routing por FASE: SDK default impl; CLI planning + overflow.",
  whatWasDone: [
    {
      artifact: "src/ports/llm.port.ts",
      description: "81 linhas. LLMPort + LLMRole (7) + LLMRequest + LLMResult + LLMError (8 kinds).",
    },
    {
      artifact: "src/adapters/llm/anthropic-sdk.adapter.ts",
      description: "114 linhas. SDK direct calls; AO-42 cache_control opt-in; error map.",
    },
    {
      artifact: "src/adapters/llm/claude-cli.adapter.ts",
      description: "126 linhas. Bun.spawn claude --print; sessionId via --resume; JSON parse.",
    },
    {
      artifact: "src/lib/llm-session-id.ts",
      description: "53 linhas. extractSessionIdFromCliJson helper; UUID v4 validation.",
    },
    {
      artifact: "src/lib/branded.ts",
      description: "+15 linhas. SessionId + mkSessionId factory (UUID v4).",
    },
    {
      artifact: "tests/adapters/llm-foundational.test.ts",
      description: "332 linhas, 13 specs cobrindo 5 ACs binary.",
    },
    {
      artifact: "src/adapters/audit/jsonl-hash-chain.adapter.ts",
      description:
        "BUG FIX latente: current_date é SQL keyword; SELECT sem quoting devolvia CURRENT_DATE built-in (TODAY) → false rotation trigger. Quoted column name.",
    },
  ],
  decisions: [
    {
      n: 1,
      decision: "Mock-only network policy nos tests.",
      reason: "CI offline-safe; smoke real fica para dev local + 1.c.7 process.",
      id: "Q-A10-1",
    },
    {
      n: 2,
      decision: "Session map persistence in-memory; defer DB persistence.",
      reason: "Scope minimal; Story 6.a.1 handles token-ledger + sessions.",
      id: "Q-A10-2",
    },
    {
      n: 3,
      decision: "cache_control opt-in (default false).",
      reason: "Explicit; caller decide per role; sem surpresas de cost.",
      id: "Q-A10-3",
    },
    {
      n: 4,
      decision: "Plan B autonomous swap defer.",
      reason: "2 adapters expostos isolados; AO-123 swap detector vai para story dedicada (6.b).",
      id: "Q-A10-4",
    },
    {
      n: 5,
      decision: "Bug fix audit_chain_state SELECT keyword collision.",
      reason: "current_date é SQL function; SELECT sem quoting devolvia TODAY em vez da coluna. Latent bug que manifestou em 2026-05-29 quando real-clock divergiu do test-clock.",
    },
    {
      n: 6,
      decision: "MessageParam shape: text block array só quando cacheControl=true.",
      reason: "API aceita string OU array; usar array sem cache adiciona ruído desnecessário.",
    },
    {
      n: 7,
      decision: "AnthropicAdapter.client injectable via deps.",
      reason: "Tests mock client shape; produção usa real `new Anthropic({ apiKey })`.",
    },
  ],
  tradeoffs: [
    "Quis ChainStateRow query devolver com tipo seguro, fiquei com runtime fallback: column name keyword conflict é SQL parser detail; quote força resolução.",
    "Quis Plan B detector + swap nesta story, fiquei com defer (Q-A10-4): scope-creep significativo; AO-123 merece spec dedicada.",
    "Quis real-network spec opcional com skip flag, fiquei com mock-only (Q-A10-1): CI flake risk + cost imprevisível; 1.c.7 já valida claude --print.",
  ],
  openItems: [
    { id: "O-A10-1", description: "Plan B autonomous swap detector (AO-123) — Story 6.b." },
    { id: "O-A10-2", description: "Token ledger persistence (AO-114) — Story 6.a.1." },
    { id: "O-A10-3", description: "Session map persistence DB — defer." },
    { id: "O-A10-4", description: "Bootstrap wiring (escolher SDK vs CLI no boot) — Story 2.x." },
    { id: "O-A10-5", description: "BUG FIX colateral: audit_chain_state SQL keyword fix landed; podia ter spec regressão dedicada (date != real-today)." },
    { id: "O-A6-6 acumula", description: "epics.md AO codes vs canon reconciliação." },
  ],
  metrics: [
    { key: "Tests", value: "155 pass / 0 fail (was 142; +13 novos: 1 AC-1 + 4 AC-2 + 4 AC-3 + 2 AC-4 + 2 AC-5)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (21 infos pré-existentes useLiteralKeys)" },
    { key: "Linhas novas", value: "~520 (port 81 + sdk 114 + cli 126 + session 53 + tests 332)" },
    { key: "Deps adicionadas", value: "1 (@anthropic-ai/sdk@0.100.1)" },
    { key: "Bug fix bonus", value: "audit_chain_state SQL keyword fix (1 linha)" },
    { key: "Token usage approx", value: "~75K (dentro estimated 80K)" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1a10` → marco done + commit dos ficheiros restantes (sem push). Mensagem proposta: `feat(story-1a10): LLMPort + AnthropicSDK + ClaudeCli adapters (5 ACs verde; epic 1.a 10/10 done)`.",
    },
    {
      n: 2,
      description:
        "Epic 1.a transita para done — 10/10 stories foundational entregues. Sprint 0 progresso: 11/22.",
    },
    {
      n: 3,
      description:
        "Próxima escolha do operador: Epic 1.b (Safety BLOCKERS) OU Epic 1.c (Bootstrap/Operations restantes). 1.b é DRB-mandated antes M1; 1.c é operational polish.",
    },
  ],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
