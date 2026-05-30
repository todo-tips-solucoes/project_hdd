/**
 * Story 2.5 — DOGFOOD: gera summary via summaryGenerator.finalize() (18ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-5",
  workflowName: "Story 2.5 — Gate Dev→Review (test suite verde)",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "Segundo gate do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Garante que o Review só recebe diff que passa: bun test exit 0, bun run lint exit 0, e files_created declarados existem (FR-050 pt2). Introduz o retry counter (FR-012) que, à 5ª falha, devolve RetryExhausted — o sinal para o trigger S2 (Epic 4) e recovery (Epic 5). Reusa o padrão de gate da 2.4 + SpawnPort da 1.a.3.",
  whatWasDone: [
    { artifact: "src/services/gates/dev-to-review.gate.ts", description: "NEW: createDevToReviewGate; corre bun test/lint via SpawnPort + files_created via probe; short-circuit; falha→GateFailure+audit+diagnostic+counter++; 5ª→RetryExhausted. 173 linhas." },
    { artifact: "tests/gates/dev-to-review.test.ts", description: "NEW: 7 specs — AC1 tests red, AC2 RetryExhausted(5), AC3 lint red/files missing, AC4 happy+reset, SpawnError propagado. SpawnPort fake keyed por args; DiagnosticWriter REAL (mkdtemp, D-053)." },
  ],
  decisions: [
    { n: 1, decision: "Retry counter Map in-process por instância do gate.", reason: "Precedente confirmation-gate; reset em sucesso; persistência DB = Epic 4.x. Casa o literal da AC ('counter incremented').", id: "Q-2.5-1" },
    { n: 2, decision: "files_created via probe fileExists injectado.", reason: "Testável, sem acoplar o gate ao node:fs.", id: "Q-2.5-2" },
    { n: 3, decision: "Short-circuit na 1ª falha (test→lint→files).", reason: "Rápido; uma razão de cada vez; alinha 'corrige uma coisa por retry'.", id: "Q-2.5-3" },
    { n: 4, decision: "DiagnosticWriter importado da 2.4 (não extraído).", reason: "Zero churn; honra files_modified:—. Extração para port partilhado = open item futuro.", id: "Q-2.5-4" },
  ],
  tradeoffs: [
    "SpawnPort devolve ok({exitCode}) mesmo em exit≠0 — o gate decide o significado (tests red). SpawnError real (binário ausente) é infra, propagado e NÃO conta como retry — separa falha-do-Dev de falha-de-ambiente.",
    "GateFailure/RetryExhausted desta story são tipos próprios (gate 'Dev→Review') distintos dos da 2.4; um GateFailure<Gate,Reason> genérico fica como refactor futuro para não tocar a 2.4 (files_modified:—).",
  ],
  openItems: [
    { id: "O-2.5-1", description: "DiagnosticWriter está definido em story-to-dev.gate.ts (2.4) e importado aqui; extrair para src/ports/diagnostic-writer.port.ts quando um 3º caller aparecer (evita acoplamento gate→gate)." },
    { id: "fronteiras", description: "2.6 (wiring RetryExhausted→FSM/persistência do counter + pause-resume), Epic 4 (trigger S2 após RetryExhausted), unificação GateFailure genérico." },
  ],
  metrics: [
    { key: "Tests", value: "331 pass / 3 skip / 0 fail (era 324; +7 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-2.5` → marco done + commit `feat(story-2.5): gate Dev→Review (test suite verde)`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "M1/Epic 2: 5/7. Próxima: Story 2.6 (worker lifecycle start/pause/resume — FSM + persistência; liga o gate_blocked/RetryExhausted ao state real)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/services/gates/dev-to-review.gate.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
