/**
 * Story 2.3 — DOGFOOD: gera summary via summaryGenerator.finalize() (16ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-3",
  workflowName: "Story 2.3 — Sub-agent context isolation per workflow",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "Dá isolamento à ponte da 2.2: cada sub-agente (Dev/Review/QA) corre em célula própria — RunContext (1.a.9), workdir efémero, audit discriminado por subAgent. O núcleo não é o isolamento, é o wiring de segurança da AC3 (Pre-Mortem #2 AI Safety): o Dev é output-only e TODO write passa por apply-diff.service (1.b.1), que rejeita path traversal. FSM (2.6) e schemas concretos (2.7) ficam para depois.",
  whatWasDone: [
    { artifact: "src/lib/workdir-mount.ts", description: "NEW: createWorkdir (mkdtempSync efémero) + handoffArtifact (único canal entre workdirs; valida com sanitizeRelPath contra origem+destino) + cleanupWorkdir. 84 linhas." },
    { artifact: "src/services/sub-agent-runner.service.ts", description: "NEW: createSubAgentRunner; runDev (output-only, aplica diff via apply-diff bound ao workdir) + runReadOnly + handoff; emitStarted (runId distinto + subAgent no payload). 148 linhas." },
    { artifact: "tests/services/sub-agent-runner.test.ts", description: "NEW: 8 specs — AC1 property (fast-check, 25 runs), AC2 handoff (workdirs reais), AC3 diff malicioso→PathTraversal+SecurityViolation + output-only." },
  ],
  decisions: [
    { n: 1, decision: "subAgent no payload + runId distinto por sub-agente.", reason: "Zero churn em audit.port/run-context → honra files_modified:—; AC1 satisfeito.", id: "Q-2.3-1" },
    { n: 2, decision: "Workdir temp efémero (mkdtempSync).", reason: "Higiénico/seguro; nada persiste entre runs (evita soft convention rot).", id: "Q-2.3-2" },
    { n: 3, decision: "Dev output-only — allowedTools sem Write/Edit.", reason: "Least-privilege; força TODO write pelo apply-diff (AC3). Alinha 2.2/O-2.2-2.", id: "Q-2.3-3" },
    { n: 4, decision: "AC1 property-based (fast-check).", reason: "Honra 'property AC'; cobre o espaço de runIds vs example fixo.", id: "Q-2.3-4" },
  ],
  tradeoffs: [
    "AC3 (núcleo AI Safety) é wiring enforcement de composição: negar Write/Edit ao Dev E centralizar o write no apply-diff — nenhuma das medidas sozinha basta ([[project-hdd-composition-risks]]).",
    "handoffArtifact valida contra origem E destino (não só destino) — defesa redundante barata; o canal explícito é o que satisfaz a AC2 ('não fs access directo').",
  ],
  openItems: [
    { id: "O-2.3-1", description: "devOutputSchema é base ({files:[{path,contents}]}); os concretos DevOutput/ReviewOutput/QAOutput são da Story 2.7 (runParsed já aceita schema injectável)." },
    { id: "fronteiras", description: "2.6 (FSM pause/resume + state-transition no onComplete da 2.2), 2.7 (schemas concretos). A 2.3 só isola contexto — não transita FSM." },
  ],
  metrics: [
    { key: "Tests", value: "312 pass / 3 skip / 0 fail (era 304; +8 unit)" },
    { key: "Integração", value: "16 pass / 3 skip (sem novos; claude -p gated HDD_BMAD_LIVE)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (payload[\"subAgent\"] bracket por noPropertyAccessFromIndexSignature)" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-2.3` → marco done + commit `feat(story-2.3): sub-agent context isolation`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "M1/Epic 2: 3/7. Próxima: Story 2.4 (gate Story→Dev — AC validation)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/workdir-mount.ts", "src/services/sub-agent-runner.service.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
