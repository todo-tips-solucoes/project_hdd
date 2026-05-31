/**
 * Story 3.3 — DOGFOOD: gera summary via summaryGenerator.finalize() (23ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-3-3",
  workflowName: "Story 3.3 — 6 templates UTILITY (design + register tracking)",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "Story docs-pesada: catálogo tipado dos 6 templates UTILITY + tracking manual da aprovação Meta (sem API). Gate de negócio: 3 aprovados = M1 mínimo viável (FR-026). É a peça que destrava o envio real (adapters 3.1/3.2 correm em dry-run até haver templates aprovados). O spot-check AI-E2-3 apanhou 2 divergências cross-artifact antes de implementar.",
  whatWasDone: [
    { artifact: "src/lib/template-catalog.ts", description: "NEW: TEMPLATE_CATALOG (6× {name, trigger, var counts, buttons[doc real], m1Required}) + parseSubmissionState + evaluateM1. Puro. 152 linhas." },
    { artifact: "scripts/template-submission-status.ts + template-submission-status.json", description: "NEW: script lê estado JSON + catálogo → checklist + M1 gate (exit 0/1). Estado manual (operador actualiza)." },
    { artifact: "whatsapp-templates-utility.md", description: "REFINE: {CLIHELPER_BASE_URL} env, m1_required, shape Meta-component autoritativo (O-3.1-1), nota buttons vs PAYLOAD_MAP (O-3.3-1)." },
    { artifact: "tests/lib/template-catalog.test.ts", description: "NEW: 11 specs — nomes, m1Required, buttons, parseSubmissionState, evaluateM1." },
  ],
  decisions: [
    { n: 1, decision: "Diferir reconciliação do shape errado da 3.1; catálogo com shape correcto.", reason: "Spot-check: template[] real (Meta-component) ≠ assumido na 3.1. Sem dano live (dry-run); o catálogo é a fonte da verdade; o wiring do adapter é follow-up. Respeita escopo docs.", id: "Q-3.3-1" },
    { n: 2, decision: "Estado de submissão em JSON separado (não YAML).", reason: "JSON evita dep de parser YAML (0-deps mantido); separa spec imutável de estado mutável.", id: "Q-3.3-2" },
    { n: 3, decision: "M1 gate via exit code (PASS/FAIL).", reason: "3 m1Required approved → exit 0; senão exit 1 + lista. Gate-able como runbook-completeness.sh.", id: "Q-3.3-3" },
  ],
  tradeoffs: [
    "O spot-check AI-E2-3 (disciplina da retro do Epic 2) provou-se DE NOVO: apanhou 2 divergências silenciosas — o shape template[] errado na 3.1 (O-3.1-1, agora 'shape conhecido') e os buttons doc vs PAYLOAD_MAP (O-3.3-1, p/ 3.4) — antes de implementar, não no fim. Lição meta: o spot-check tem de ler os docs de planning, não só architecture.md.",
    "Catálogo é a fonte da verdade tipada; o adapter (3.1) ainda envia o shape errado mas só em dry-run — reconciliação deliberadamente diferida para não enfiar um rewrite de schema numa story docs.",
  ],
  openItems: [
    { id: "O-3.1-1", description: "Reconciliar payload-schema.ts/buildBody da 3.1 com o shape Meta-component real (consumir template-catalog.ts) — follow-up dedicado." },
    { id: "O-3.3-1", description: "Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — Story 3.4 (parser inbound)." },
  ],
  metrics: [
    { key: "Tests", value: "383 pass / 3 skip / 0 fail (era 372; +11 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0 (JSON em vez de YAML)" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-3.3` → marco done + commit `feat(story-3.3): catálogo de templates + tracking`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "Epic 3: 3/6. Próxima: Story 3.4 (InboundCommandPort + Hono /callback + Quick Reply parsing; reconcilia O-3.3-1; cuidado O-B5-3 webhook-mock)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/template-catalog.ts", "scripts/template-submission-status.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
