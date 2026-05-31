/**
 * Story 2.6 — DOGFOOD: gera summary via summaryGenerator.finalize() (19ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-6",
  workflowName: "Story 2.6 — Worker lifecycle start/pause/resume",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "A maior story do Epic 2 e a que liga tudo: dá state real ao worker. pause/resume transitam a FSM (1.a.4) e persistem em SQLite (runs table, 1.a.5); recover() torna o arranque crash-safe (parcial — E5 completa). A AC4 é o wiring de segurança (Pre-Mortem #2): toda acção irreversível passa pelo confirmation-gate (1.b.2) antes de executar. É aqui que o gate_blocked (2.4) e o RetryExhausted (2.5) ganham state persistido a montante.",
  whatWasDone: [
    { artifact: "src/services/worker-lifecycle.service.ts", description: "NEW: createWorkerLifecycle; pause/resume/recover/guardIrreversible; lê latest run, transition() puro valida, persiste runs.status via drizzle, audit. 134 linhas." },
    { artifact: "src/cli/pause.command.ts + resume.command.ts", description: "NEW: comandos reais (substituem stubs); buildCliLifecycle (bootstrap cliMode + clock + confirmation-gate + lifecycle), io injectável." },
    { artifact: "src/core/fsm.ts", description: "MODIFY: +evento OperatorPaused (running→paused_for_interrupt); sem novo estado (enum DB intacto). Divergência files_modified registada (AI-S0-4)." },
    { artifact: "src/cli/hdd-worker.ts + tests/services/lifecycle.test.ts", description: "MODIFY hdd-worker (stubs→reais); NEW test 10 specs com :memory:+migrations (DB real, D-053) + ConfirmationGate real." },
  ],
  decisions: [
    { n: 1, decision: "Evento OperatorPaused na FSM para o pause.", reason: "Semântica honesta (running→paused_for_interrupt); pausedTrigger null; sem novo estado. Modifica fsm.ts (divergência files_modified aceite).", id: "Q-2.6-1" },
    { n: 2, decision: "recover() transita running órfã → paused_for_interrupt.", reason: "Estado consistente e seguro: operador faz resume explícito, sem auto-resume pós-crash. E5 completa o replay.", id: "Q-2.6-2" },
    { n: 3, decision: "Confirmação CLI: waId sentinela 'cli-operator' + --i-really-mean-it→cliOverride.", reason: "Quick Reply WhatsApp two-step é Epic 3; em CLI a flag é o human-in-loop. Reusa confirmation-gate.", id: "Q-2.6-3" },
    { n: 4, decision: "Lifecycle escreve runs.status via drizzle directo (db injectado).", reason: "Consistente com worker-status.service read; bun:sqlite sync; sem ficheiro novo (honra files_created).", id: "Q-2.6-4" },
  ],
  tradeoffs: [
    "AC4 (núcleo AI Safety) é wiring enforcement: guardIrreversible é o chokepoint — toda acção catalogada (deploy/branch-delete/force-push/schema-drop/audit-purge) passa pelo confirmation-gate antes de executar. Sem confirmação nem flag → ConfirmationRequired.",
    "recover() é deliberadamente PARTIAL (detect+consistência); o replay de in-flight story é E5. A 2.6 garante que nunca há auto-resume silencioso após crash (segurança > conveniência).",
  ],
  openItems: [
    { id: "O-2.6-1", description: "Extrair RunStateRepository port quando um 2º writer de runs aparecer (hoje lifecycle escreve, worker-status lê — drizzle directo em ambos)." },
    { id: "files_modified", description: "Divergência aceite: 2.6 modifica src/core/fsm.ts além de hdd-worker.ts (registado em readiness-open-items.md / AI-S0-4)." },
    { id: "fronteiras", description: "E5 (recovery boot completo/replay), Epic 3 (Quick Reply WhatsApp), Epic 4 (triggers P1/S1/S2/S3 reais); --i-really-mean-it ainda sem comando CLI irreversível ligado." },
  ],
  metrics: [
    { key: "Tests", value: "341 pass / 3 skip / 0 fail (era 331; +10 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-2.6` → marco done + commit `feat(story-2.6): worker lifecycle start/pause/resume`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "M1/Epic 2: 6/7. Próxima e ÚLTIMA do épico: Story 2.7 (DevOutput/ReviewOutput/QAOutput schemas Zod concretos — fecha o Epic 2)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/services/worker-lifecycle.service.ts", "src/cli/pause.command.ts", "src/cli/resume.command.ts", "src/core/fsm.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
