/**
 * Story 2.1 — DOGFOOD: gera summary via summaryGenerator.finalize() (14ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. 1ª story do M1 (Epic 2).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-2-1",
  workflowName: "Story 2.1 — hdd-worker CLI Commander scaffold",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "1ª story do M1 (Epic 2 — Worker Autónomo). Scaffold da CLI de operação: hdd-worker com 6 subcomandos + --help claro (NFR-U4) + status que lê o estado real da DB em ≤2s (NFR-O1). start+review já existiam; esta acrescenta status/logs, extrai start, unifica o entry, e cria stubs pause/resume (lógica real = Story 2.6).",
  whatWasDone: [
    { artifact: "src/cli/{status,logs,start}.command.ts", description: "NEW: status (lê DB via service), logs (tail audit JSONL), start (extraído + [project] + deps injectáveis)." },
    { artifact: "src/services/worker-status.service.ts", description: "NEW: readWorkerStatus — 1ª leitura DB do projeto (última run + agregado de stories); DB fresca → no-runs." },
    { artifact: "src/cli/boot-error.format.ts", description: "NEW: formatBootError consolidado (removida tripla duplicação)." },
    { artifact: "src/cli/hdd-worker.ts + main.ts + package.json", description: "MODIFY: regista os 6 + stubs pause/resume; main.ts delega para createCli (fecha O-C1-1); dev/module → CLI." },
    { artifact: "tests/cli/commands.test.ts", description: "NEW: 11 specs (AC1 6 subcomandos; status no-runs/run :memory:/QueryFailure/guarda<2s; logs; start; stubs)." },
  ],
  decisions: [
    { n: 1, decision: "Unificar entry (main.ts delega para createCli).", reason: "Fecha O-C1-1; um só entry dev/build/systemd. build já compilava hdd-worker.ts (confirmado).", id: "Q-2.1-1" },
    { n: 2, decision: "status lê a DB (runs/stories), não /healthz.", reason: "Estado real persistido; funciona com worker parado. /healthz só dá uptime.", id: "Q-2.1-2" },
    { n: 3, decision: "Consolidar formatBootError num módulo.", reason: "Estava duplicado em 2 sítios; status seria o 3º. Switch exaustivo num só sítio.", id: "Q-2.1-3" },
    { n: 4, decision: "pause/resume = stubs (exit 1) no --help.", reason: "Fronteira com Story 2.6 (lifecycle FSM); aparecem no help sem implementar.", id: "Q-2.1-4" },
  ],
  tradeoffs: [
    "StorySpec listava hdd-worker.ts em files_created (é MODIFY) e start.command.ts como novo (extração do inline); boot-error.format.ts é ficheiro extra. Divergências registadas em readiness-open-items.md (AI-S0-4) — fidelidade à realidade > spec literal.",
    "status precisa de bootstrap (valida secrets) → sem env o smoke falha no boot (esperado); o caminho de sucesso prova-se com env dummy (idle) + teste unitário com boot mockado.",
  ],
  openItems: [
    { id: "O-2.1-1", description: "status mostra só a última run; multi-run/histórico fica para quando o worker loop (Epic 2/5) gerar várias runs." },
    { id: "O-C1-1", description: "FECHADO: dev/module/main.ts unificados no CLI (createCli)." },
    { id: "fronteira 2.6", description: "pause/resume stubs → Story 2.6 implementa worker-lifecycle.service + comandos reais (substitui os stubs)." },
  ],
  metrics: [
    { key: "Tests", value: "296 pass / 2 skip / 0 fail (era 285; +11 commands)" },
    { key: "Integration", value: "16 pass / 2 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (25 infos useLiteralKeys; 4 erros eslint corrigidos)" },
    { key: "Smoke binário", value: "--help lista 6 (AC1); status→idle rc=0 (AC2); logs→sem eventos rc=0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-2.1` → marco done + commit `feat(story-2.1): hdd-worker CLI scaffold (status/logs + entry unificado)`. Não toca workflows → push normal; verificar CI verde via gh run.",
    },
    { n: 2, description: "M1/Epic 2: 1/7. Próxima: Story 2.2 (BMAD invoker port + CLI-wrapper adapter; assenta no D-052 validado em 1.c.7)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/cli/hdd-worker.ts", "src/cli/status.command.ts", "src/services/worker-status.service.ts", "src/main.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
