/**
 * Story 1.b.1 — DOGFOOD: gera summary via summaryGenerator.finalize() (3ª vez).
 *
 * Lessons aplicadas: O-A9-5 (Tier-B trim AGRESSIVO — generator usa mesmos dados
 * em B e C → input enxuto evita TierBOverflow). 1ª story do Epic 1.b.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1b1",
  workflowName: "Story 1.b.1 — Path traversal sanitization (NO apply-diff)",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "1ª story do Epic 1.b (Safety BLOCKERS) e 3ª das 4 DRB Sprint-0 Hard Conditions (C2: AO-164/165/166). Gate de path-safety para writes LLM-generated: nenhum diff escreve fora do workspace via ../, absolute, encoded, symlink ou null-byte. 'NO apply-diff' = não herdar resolution do utility vulnerável.",
  whatWasDone: [
    {
      artifact: "src/lib/path-sanitize.ts",
      description:
        "~110 linhas. sanitizeRelPath lexical puro: 2 passagens (canónica decode+NFKC p/ detecção; literal p/ resolução). 6 reasons.",
    },
    {
      artifact: "src/services/apply-diff.service.ts",
      description:
        "~135 linhas. createApplyDiffService: lexical → realpath anti-symlink → write; promise-chain mutex (AO-165); audit SecurityViolation.",
    },
    {
      artifact: "tests/services/apply-diff.security.test.ts",
      description: "~165 linhas, 17 specs: 15 payloads (5 categorias) + 2 happy-path.",
    },
    { artifact: "package.json", description: "alias test:security." },
  ],
  decisions: [
    {
      n: 1,
      decision: "kind único {kind:'PathTraversal', attempted, reason}.",
      reason: "Falha de path é 1 categoria de erro; idiom neverthrow + satisfaz AC literal.",
      id: "Q-B1-1",
    },
    {
      n: 2,
      decision: "Encoded: decode-once percent + NFKC, rejeitar só se escapar.",
      reason: "Canonicalizar-depois-validar; O(n); evita falsos-positivos legítimos.",
      id: "Q-B1-2",
    },
    {
      n: 3,
      decision: "Scope: gate + applyWrite fino; sem parser de unified-diff.",
      reason: "YAGNI; nenhum AC testa gramática do diff.",
      id: "Q-B1-3",
    },
    {
      n: 4,
      decision: "Serialização AO-165 agora via promise-chain mutex.",
      reason: "AO-165 exige; mutex minúsculo elimina TOCTOU; custo nulo (I/O-bound).",
      id: "Q-B1-4",
    },
    {
      n: 5,
      decision: "Detecção de control chars por charCodeAt, não regex literal.",
      reason: "Write tool corrompe bytes de control no source; charCodeAt/fromCharCode é robusto.",
    },
  ],
  tradeoffs: [
    "Quis classificar encoded-escape com reason fino, fiquei com 'encoded' agregado: a forma canónica é o sinal de ataque; granularidade extra não muda a decisão de bloqueio.",
    "Quis tmpfs mount do AO-165, fiquei com out-of-scope: é deployment/systemd, não código de lib.",
  ],
  openItems: [
    {
      id: "O-B1-1",
      description:
        "Reconciliar numeração PT: epics diz 'PT-2' p/ path mas architecture tem PT-2=egress/PT-3=docker; criar docs/pre-m1-pentest-tasks.md.",
    },
    {
      id: "O-B1-2",
      description: "Wiring: invocar apply-diff.service no caminho real de write do dev sub-agent (story de orquestração).",
    },
    { id: "O-B1-3", description: "tmpfs mount workspace (AO-165 deployment) — runbook systemd." },
    { id: "O-A6-6 acumula", description: "epics.md AO/AR codes vs canon architecture reconciliação." },
  ],
  metrics: [
    { key: "Tests", value: "172 pass / 0 fail (was 155; +17: 9 lexical + 3 control + 3 symlink + 2 happy)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (21 infos pré-existentes)" },
    { key: "Linhas novas", value: "~410 (lib 110 + service 135 + tests 165)" },
    { key: "Deps adicionadas", value: "0" },
    { key: "ΔCI", value: "+72ms (suite security); <<10s budget AC-3" },
    { key: "Token usage approx", value: "dentro estimated 56-84K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1b1` → marco done + commit. Mensagem: `feat(story-1b1): path traversal sanitization (4 ACs verde; 1ª BLOCKER M1)`.",
    },
    {
      n: 2,
      description: "Sprint 0: 12/22 done. Epic 1.b: 1/5 (in-progress). Próxima: Story 1.b.2 (two-step confirmation).",
    },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/path-sanitize.ts", "src/services/apply-diff.service.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
