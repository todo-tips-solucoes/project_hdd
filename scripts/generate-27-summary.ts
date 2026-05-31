/**
 * Story 2.7 — DOGFOOD: gera summary via summaryGenerator.finalize() (20ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words). FECHA o Epic 2.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-7",
  workflowName: "Story 2.7 — DevOutput/ReviewOutput/QAOutput schemas concretos",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "Última story do Epic 2 (fecha 7/7). Dá tipos concretos ao parse da 2.2: 3 schemas Zod .strict() formais (Architecture Step 06, AR-050/051/052) para DevOutput/ReviewOutput/QAOutput + mapeamento SchemaDrift. Desvios do BMAD CLI (campos extra, enums inválidos) passam a ser apanhados em runtime em vez de propagarem silenciosamente.",
  whatWasDone: [
    { artifact: "src/ports/sub-agent-outputs.port.ts", description: "NEW: 3 schemas Zod .strict() (Step 06 fiel) + tipos inferidos + parseSubAgentOutput (unrecognized_keys→SchemaDrift{field}; resto→SchemaInvalid). 122 linhas." },
    { artifact: "src/adapters/bmad/cli-wrapper.adapter.ts", description: "MODIFY: CliWrapperInvoker extends BmadInvokerPort + wrappers runDevOutput/runReviewOutput/runQaOutput via runParsed. BmadError intacto." },
    { artifact: "tests/ports/sub-agent-schemas.test.ts", description: "NEW: 10 specs — AC1 SchemaDrift (top+nested), AC2 verdict unsure/pass reject + 4 formais aceites, AC3 happy+tipo errado, AC4 wrappers do adapter." },
  ],
  decisions: [
    { n: 1, decision: "verdict segue a ARQUITECTURA (APPROVED|APPROVED_WITH_WARNINGS|REJECTED|BLOCKED_P1).", reason: "Conflito spec×arquitectura: o enum 'pass|fail-gap|fail-bug' do epics-AC era esboço superado pelo contrato formal (AO-106 + 6 P1-trigger criteria). AC2 ('rejeita unsure') preservada. Divergência AI-S0-4.", id: "Q-2.7-1" },
    { n: 2, decision: "SchemaDrift no helper do port + wrappers tipados no adapter.", reason: "parseSubAgentOutput mapeia unrecognized_keys→SchemaDrift{field}; adapter ganha runDevOutput/… via runParsed. BmadError/bmad-invoker.port intactos (fora de files_modified).", id: "Q-2.7-2" },
    { n: 3, decision: "Shape completa do Step 06 (todos .strict(), storyId z.string()).", reason: "Fidelidade ao contrato formal; valida os campos que o pipeline usará.", id: "Q-2.7-3" },
    { n: 4, decision: "Deferir reconciliação com o devOutputSchema base da 2.3.", reason: "2.3 mantém o base; 2.7 entrega o concreto no port. Não toca sub-agent-runner (fora de files_modified). O-2.7-1 futura.", id: "Q-2.7-4" },
  ],
  tradeoffs: [
    "Conflito spec×arquitectura resolvido a favor do canon formal (arquitectura) — o epics-AC era um esboço. Documentado para o downstream (P1-trigger criteria dependem do enum formal).",
    "Schemas .strict() em todos os níveis (incl. nested): qualquer campo extra do BMAD CLI = SchemaDrift detectável, não silent pass. Trade: schemas mais rígidos exigem outputs exactos do sub-agent.",
  ],
  openItems: [
    { id: "O-2.7-1", description: "Reconciliar o devOutputSchema base da 2.3 (sub-agent-runner) com o DevOutput concreto deste port numa story futura (a 2.3 mantém o base local por agora)." },
    { id: "fronteiras", description: "P1-trigger criteria / gap-detector sobre ReviewOutput (Epic 4/5); a 2.7 entrega só o schema, não a lógica de decisão." },
  ],
  metrics: [
    { key: "Tests", value: "351 pass / 3 skip / 0 fail (era 341; +10 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Epic 2", value: "7/7 — FECHADO" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-2.7` → marco done + commit `feat(story-2.7): sub-agent output schemas concretos`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "Epic 2 FECHADO (7/7). Próximo: retrospetiva opcional do Epic 2, ou Epic 3 (Canal WhatsApp clihelper + fallback e-mail, 6 stories)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/ports/sub-agent-outputs.port.ts", "src/adapters/bmad/cli-wrapper.adapter.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
