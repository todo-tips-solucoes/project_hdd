/**
 * Story 2.2 — DOGFOOD: gera summary via summaryGenerator.finalize() (15ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-2",
  workflowName: "Story 2.2 — BMAD invoker port + CLI-wrapper adapter",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "Coração do M1: a ponte worker→agentes BMAD. D-052 (ratificado): não há skill runner no bmad-method; invoca-se via `claude -p` headless. Esta story entrega o port + adapter + parse do stream-json + validação Zod + hooks FR-005. Contexto isolado (2.3), FSM (2.6) e schemas concretos (2.7) ficam para depois.",
  whatWasDone: [
    { artifact: "src/ports/bmad-invoker.port.ts", description: "NEW: BmadInvokerPort (run/runParsed<T>) + BmadResult/BmadError + BmadLifecycleHooks (FR-005)." },
    { artifact: "src/adapters/bmad/cli-wrapper.adapter.ts", description: "NEW: claude -p --output-format stream-json --verbose --allowedTools via SpawnPort; parseia evento type:result; runParsed valida JSON com Zod." },
    { artifact: "tests/adapters/bmad-invoker.test.ts", description: "NEW: 8 specs (run/args D-052, BmadFailed, BmadOutputMalformed, SpawnError propagado, runParsed ok/malformado, hooks)." },
    { artifact: "tests/integration/bmad-invoker.integration.test.ts", description: "NEW: claude -p real, opt-in HDD_BMAD_LIVE (skip por defeito)." },
  ],
  decisions: [
    { n: 1, decision: "Hooks FR-005 = pontos de extensão + audit event.", reason: "bmad_save_artifact/complete_workflow não existem como ferramenta; onArtifact/onComplete no port; state-transition diferido p/ 2.6.", id: "Q-2.2-3" },
    { n: 2, decision: "Parse real do stream-json (evento type:result).", reason: "Formato sondado empiricamente; extrai .result/is_error; runParsed valida com Zod.", id: "Q-2.2-2" },
    { n: 3, decision: "fake-spawn unit + integração real opt-in (HDD_BMAD_LIVE).", reason: "claude -p real custa tokens/é lento/não-determinístico; gated evita custo recorrente. Sonda manual já validou.", id: "Q-2.2-4" },
    { n: 4, decision: "prompt template + allowedTools restrito por skill.", reason: "Least-privilege; configurável depois.", id: "Q-2.2-1" },
  ],
  tradeoffs: [
    "Sondei o claude -p real (~$0.15) para conhecer o formato do stream-json em vez de o inventar — descobri que --verbose é obrigatório com stream-json+--print (achado que o StorySpec não tinha).",
    "AC3/AC4 (hooks) materializados como pontos de extensão minimalistas: honra FR-005 sem ultrapassar as fronteiras 2.3 (RunContext) / 2.6 (FSM) — o wiring completo vem nessas stories.",
  ],
  openItems: [
    { id: "O-2.2-1", description: "Integração real claude -p só corre com HDD_BMAD_LIVE=1 (opt-in); considerar um job CI dedicado com claude autenticado + budget, se quisermos cobertura live regular." },
    { id: "O-2.2-2", description: "Prompt template + allowedTools por skill são mínimos — afinar por skill (ex: dev-story precisa de Write/Edit; code-review só Read) quando a 2.3/Epic avançar." },
    { id: "fronteiras", description: "2.3 (RunContext/workdir + apply-diff), 2.6 (FSM state-transition no onComplete), 2.7 (DevOutput/ReviewOutput/QAOutput schemas concretos para runParsed)." },
  ],
  metrics: [
    { key: "Tests", value: "304 pass / 3 skip / 0 fail (era 296; +8 unit; +1 skip integração opt-in)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (no-unsafe-assignment do JSON.parse corrigido com cast)" },
    { key: "claude CLI", value: "v2.1.158; stream-json+--verbose; evento type:result confirmado" },
    { key: "Deps adicionadas", value: "0 (zod já existia)" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-2.2` → marco done + commit `feat(story-2.2): BMAD invoker port + cli-wrapper (claude -p, D-052)`. Não toca workflows → push normal; verificar CI verde.",
    },
    { n: 2, description: "M1/Epic 2: 2/7. Próxima: Story 2.3 (sub-agent context isolation — RunContext/workdir + wiring apply-diff; usa o BmadInvoker desta story)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/ports/bmad-invoker.port.ts", "src/adapters/bmad/cli-wrapper.adapter.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
