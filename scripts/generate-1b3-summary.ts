/**
 * Story 1.b.3 — DOGFOOD: gera summary via summaryGenerator.finalize() (5ª vez).
 *
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. 3ª story do Epic 1.b (DRB BLOCKER #3).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1b3",
  workflowName: "Story 1.b.3 — Audit redaction multi-pattern",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "3ª story do Epic 1.b e DRB BLOCKER #3 (AO-160+166+175). Fecha o buraco do audit que delegava redaction ao caller: a redaction multi-pattern passa a ser aplicada DENTRO do adapter, antes de hash+write, garantindo never-store-raw-tokens mesmo com código LLM-generated.",
  whatWasDone: [
    {
      artifact: "src/lib/redaction.ts",
      description:
        "~95L. 10 patterns (anthropic/ghp_/AKIA/bearer/basic/generic/env-var/phone-pt/phone-br/wa_id) + size-cap n8n; redactString/Value/Payload recursivo sem mutação.",
    },
    {
      artifact: "src/adapters/audit/jsonl-hash-chain.adapter.ts",
      description: "MODIFY: redactPayload antes de computeHash; hash+line ambos do redigido (AC3).",
    },
    { artifact: "tests/lib/redaction.security.test.ts", description: "16 specs (AC1 exacto + 9/9 + property + recursão)." },
    { artifact: "tests/adapters/audit.test.ts", description: "MODIFY: +regressão (secret ausente do JSONL + verifyChain verde)." },
    { artifact: "scripts/verify-redaction.ts", description: "Gate CI/local: 9 assinaturas, 0 leaks → exit 0." },
    { artifact: ".github/workflows/ci.yml", description: "NEW — 1º CI do repo: lint/typecheck/test + verify-redaction + truffleHog." },
  ],
  decisions: [
    { n: 1, decision: "Token uniforme ***REDACTED***.", reason: "AC1 literal; sem leak do tipo de segredo.", id: "Q-B3-1" },
    { n: 2, decision: "n8n-verbose-body por size-cap + truncar (~2KB).", reason: "Cobre AP-3 disk + secrets escondidos.", id: "Q-B3-2" },
    { n: 3, decision: "Hash sobre payload redigido.", reason: "Chain=bytes escritos; never-store-raw AO-166; verifyChain verde.", id: "Q-B3-3" },
    { n: 4, decision: "Criar ci.yml mínimo + truffleHog; verify-redaction.ts gate local.", reason: "Não havia CI; cumpre AC4 sem depender de truffleHog local.", id: "Q-B3-4" },
    { n: 5, decision: "redactValue devolve cópia (não muta event.payload).", reason: "Caller pode reusar o objecto; evita side-effects surpresa." },
  ],
  tradeoffs: [
    "Quis reason fino por categoria, fiquei com token uniforme (Q-B3-1): AC1 literal + não revelar tipo de segredo.",
    "Quis truffleHog a correr no gate local, fiquei com verify-redaction.ts: truffleHog pode não estar instalado neste ambiente; corre em GH Actions.",
  ],
  openItems: [
    { id: "O-B3-1", description: "R2 publicAccessBlock (AO-160 deployment) — runbook infra." },
    { id: "O-B3-2", description: "Pino transport interceptando TODAS as mensagens (AO-175) — story observabilidade." },
    { id: "O-B3-3", description: "Backup destinations validation + periodic ACL audit (AO-166 cauda) — runbook." },
    { id: "O-B1-1 acumula", description: "Numeração PT (epics PT-3 vs architecture) — criar docs/pre-m1-pentest-tasks.md." },
  ],
  metrics: [
    { key: "Tests", value: "205 pass / 0 fail (was 188; +17: 16 redaction + 1 audit regressão)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (removido dead var 'covered'; 23 infos pré-existentes)" },
    { key: "Linhas novas", value: "~95 redaction + ~45 verify-redaction + ci.yml" },
    { key: "Deps adicionadas", value: "0" },
    { key: "verify-redaction", value: "exit 0 (9 assinaturas, 0 leaks)" },
    { key: "Token usage approx", value: "dentro estimated 56-84K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1b3` → marco done + commit. Mensagem: `feat(story-1b3): audit redaction multi-pattern (4 ACs verde; BLOCKER #3 M1)`.",
    },
    { n: 2, description: "Sprint 0: 14/22 done. Epic 1.b: 3/5. Próxima: Story 1.b.4 (sandbox Bun.spawn docker --network=none)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/redaction.ts", "src/adapters/audit/jsonl-hash-chain.adapter.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
