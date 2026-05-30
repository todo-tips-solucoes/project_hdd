/**
 * Story 2.4 — DOGFOOD: gera summary via summaryGenerator.finalize() (17ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-4",
  workflowName: "Story 2.4 — Gate Story→Dev (AC validation)",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "Primeiro dos dois gates do pipeline bimodal (2.4 Story→Dev, 2.5 Dev→Review). Fail-fast: impede que o bmad-dev-story arranque numa story mal-formed (FR-050 pt1). Valida a spec estática (≥1 Given/When/Then, files_created, ao_subset), emite audit GateFailed (FR-051) e materializa um diagnostic inspecionável (FR-052). Não corre testes nem conta retries (2.5), não faz wiring lifecycle (2.6).",
  whatWasDone: [
    { artifact: "src/lib/story-spec-validator.ts", description: "NEW: StorySpec + validateStorySpec puro; 4 razões curto-circuito (no AC defined / no Given-When-Then / no files_created / no ao_subset); hasGivenWhenThen. 64 linhas." },
    { artifact: "src/services/gates/story-to-dev.gate.ts", description: "NEW: createStoryToDevGate; check→ResultAsync. Falha→GateFailure(gate 'Story→Dev', evidence storyId) + audit GateFailed('StoryToDev') + diagnostic via DiagnosticWriter injectado (best-effort). 110 linhas." },
    { artifact: "src/core/fsm.ts", description: "MODIFY: +estado gate_blocked (não-terminal) +evento GateBlocked; running→gate_blocked→running (re-dispatch). Transições existentes intactas." },
    { artifact: "tests/gates/story-to-dev.test.ts", description: "NEW: 12 specs — AC1-4 + writer REAL (mkdtemp, D-053) + property hasGivenWhenThen + 3 FSM gate_blocked." },
  ],
  decisions: [
    { n: 1, decision: "Estado gate_blocked não-terminal + evento GateBlocked.", reason: "Honra 'add gate state'; permite re-dispatch após correct-course (human-in-loop). Não muda idle→running.", id: "Q-2.4-1" },
    { n: 2, decision: "StorySpec mínimo (strings) + regex Given/When/Then.", reason: "Parser markdown→StorySpec é de outra story; input estruturado aqui. Pragmático, desacoplado, testável.", id: "Q-2.4-2" },
    { n: 3, decision: "DiagnosticWriter injectado (port); gate ResultAsync.", reason: "Hexagonal/ports-adapters; testável (writer real no teste), seguro (root configurável), autonomia (destino redirecionável).", id: "Q-2.4-3" },
    { n: 4, decision: "Error label 'Story→Dev' + audit enum 'StoryToDev'.", reason: "Honra AC literal E reutiliza GateName tipado de events.ts. Sem divergência.", id: "Q-2.4-4" },
  ],
  tradeoffs: [
    "Diagnostic é best-effort: um writer que falha (disk full) NÃO muda o verdict (GateFailure na mesma) — o gate nunca esconde a falha de spec por causa de I/O. Testado explicitamente.",
    "events.ts já tinha GateFailed+GateName (stub 1.a.4) → reuso em vez de inventar; a 2.4 deu-lhe o primeiro caller real.",
  ],
  openItems: [
    { id: "O-2.4-1", description: "Adapter fs real do DiagnosticWriter ainda não existe em src/ (no teste usa-se um real sobre mkdtemp); materializa-se quando o worker fizer o wiring end-to-end do pipeline." },
    { id: "fronteiras", description: "2.5 (gate Dev→Review: bun test/lint verdes + retry counter + RetryExhausted), 2.6 (lifecycle FSM: wiring gate_blocked↔persistência/pause-resume)." },
  ],
  metrics: [
    { key: "Tests", value: "324 pass / 3 skip / 0 fail (era 312; +12 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "FSM", value: "7 estados (era 6; +gate_blocked); property totalidade 19 pass" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-2.4` → marco done + commit `feat(story-2.4): gate Story→Dev (AC validation)`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "M1/Epic 2: 4/7. Próxima: Story 2.5 (gate Dev→Review — test suite verde + retry counter)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/story-spec-validator.ts", "src/services/gates/story-to-dev.gate.ts", "src/core/fsm.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
