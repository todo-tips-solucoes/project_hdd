/**
 * Story 1.b.2 — DOGFOOD: gera summary via summaryGenerator.finalize() (4ª vez).
 *
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (generator usa mesmos dados em B e C).
 * 2ª story do Epic 1.b (DRB BLOCKER #2).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1b2",
  workflowName: "Story 1.b.2 — Two-step confirmation acções irreversíveis",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "2ª story do Epic 1.b e DRB BLOCKER #2 (AO-155+AO-164). Gate de two-step confirmation: worker LLM-driven não executa acção destrutiva (deploy/branch-delete/force-push/schema-drop/audit-purge) sem código 6-char confirmado por humano via WhatsApp, ou bypass CLI human-driven.",
  whatWasDone: [
    {
      artifact: "src/lib/irreversible-action-catalog.ts",
      description: "~25L. 5 acções + IrreversibleAction + isIrreversibleAction type guard.",
    },
    {
      artifact: "src/services/confirmation-gate.service.ts",
      description:
        "~150L. requireConfirmation + confirm; código 6-char ambiguity-safe single-use, expiry 60s, tied waId, rate-limit 3/h; bypass cliOverride.",
    },
    {
      artifact: "src/core/domain/interrupt-commands.ts",
      description: "MODIFY: +IrrevConfirmYes/IrrevConfirmNo no union + PAYLOAD_MAP (5→7).",
    },
    {
      artifact: "tests/services/confirmation-gate.test.ts",
      description: "16 specs (AC1-4 + catálogo + parser regression).",
    },
  ],
  decisions: [
    { n: 1, decision: "Store pending por código (single-use).", reason: "Operador devolve o código; lookup directo.", id: "Q-B2-1" },
    { n: 2, decision: "Rate-limit conta emissões/hora por waId.", reason: "AO-164 literal; limita brute-force de geração.", id: "Q-B2-2" },
    { n: 3, decision: "cliOverride no serviço; subcommand deploy diferido.", reason: "Sem scope-creep; Story 2.x expande CLI.", id: "Q-B2-3" },
    { n: 4, decision: "Charset 6-char ambiguity-safe (sem 0/O/1/I/L).", reason: "Transcrição humana via WhatsApp; ~31^6 combos.", id: "Q-B2-4" },
    {
      n: 5,
      decision: "WaIdMismatch NÃO consome o código.",
      reason: "Anti-DoS: atacante com waId errado não queima o código do operador legítimo.",
    },
    { n: 6, decision: "Não alterar a FSM.", reason: "Reusa paused_for_interrupt/OperatorResponded; wiring é Epic 4.x." },
  ],
  tradeoffs: [
    "Quis wiring na FSM/orquestração, fiquei com serviço isolado: scope da story é o gate; wiring é Epic 4.x.",
    "Quis subcommand deploy real, fiquei com flag cliOverride (Q-B2-3): files_modified não inclui CLI; Story 2.x expande.",
  ],
  openItems: [
    { id: "O-B2-1", description: "Wiring FSM + envio do código via NotifyPort/WhatsApp (Epic 4.x orquestração)." },
    { id: "O-B2-2", description: "Subcommand hdd-worker deploy --i-really-mean-it (Story 2.x CLI)." },
    { id: "O-B2-3", description: "Persistência DB do pending store (sobrevive restart) — orquestração." },
    { id: "O-A6-6 acumula", description: "AR-071 (epics) vs AO-155/164 (canon) reconciliação." },
  ],
  metrics: [
    { key: "Tests", value: "188 pass / 0 fail (was 172; +16). Regressão PAYLOAD_MAP sanity 5→7 actualizada." },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (22 infos pré-existentes)" },
    { key: "Linhas novas", value: "~175 src (catalog 25 + service 150) + interrupt +5" },
    { key: "Deps adicionadas", value: "0" },
    { key: "Token usage approx", value: "dentro estimated 48-72K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1b2` → marco done + commit. Mensagem: `feat(story-1b2): two-step confirmation acções irreversíveis (4 ACs verde; BLOCKER #2 M1)`.",
    },
    { n: 2, description: "Sprint 0: 13/22 done. Epic 1.b: 2/5. Próxima: Story 1.b.3 (audit redaction multi-pattern)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/services/confirmation-gate.service.ts", "src/lib/irreversible-action-catalog.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
