/**
 * Story 1.b.5 — DOGFOOD: gera summary via summaryGenerator.finalize() (7ª vez).
 *
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. Capstone do Epic 1.b (5/5).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1b5",
  workflowName: "Story 1.b.5 — 8 Pentest Tasks PT-1..PT-8 test suite",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "Capstone do Epic 1.b (AR-076). Suite agregadora que PROVA (não reimplementa) as 4 defesas de 1.b.1-1.b.4 + audit 1.a.6 como 8 baterias de pentest verificáveis + report auditável p/ sign-off M1. Fecha O-B1-1 (numeração PT) e dá estrutura ao O-B4-1 (escapes reais → integração).",
  whatWasDone: [
    { artifact: "tests/security/pt-1..8-*.test.ts", description: "8 ficheiros, 31 specs: sandbox/path/redaction/ssrf/prompt-inj/audit-tamper/secret-extract/ratelimit." },
    { artifact: "scripts/pentest-report.ts", description: "Bun.spawnSync bun test + parse → report markdown com commit SHA; exit≠0 se falha." },
    { artifact: "scripts/check-webhook-schema.ts", description: "Day-7 escalation gate (PM-5/AO-86): marker → feature-flags.json + [OPEN] readiness; exit 0." },
    { artifact: "docs/pre-m1-pentest-tasks.md", description: "Canon PT-1..8 (= esta suite); reconcilia divergência com architecture. Fecha O-B1-1." },
    { artifact: "package.json + .github/workflows/ci.yml", description: "test:security broaden + check:webhook-schema; job security-suite + upload report." },
  ],
  decisions: [
    { n: 1, decision: "PT-5 rebuff estrutural via confirmation gate.", reason: "Sem LLM-handler ainda; injecção não faz bypass da gate. Semântico → Epic 4.", id: "Q-B5-1" },
    { n: 2, decision: "Criar docs/pre-m1-pentest-tasks.md.", reason: "Fecha O-B1-1; esta suite = canon.", id: "Q-B5-2" },
    { n: 3, decision: "check-webhook-schema.ts minimal não-bloqueante.", reason: "PM-5: força decisão consciente; exit 0 + [OPEN] log.", id: "Q-B5-3" },
    { n: 4, decision: "pentest-report via spawnSync + parse.", reason: "Sem acoplar os testes ao formato de report.", id: "Q-B5-4" },
    { n: 5, decision: "PT-6/PT-7 com adapter audit REAL (não fake).", reason: "tamper/chain/redaction-pre-write exigem hash-chain + ficheiro reais." },
  ],
  tradeoffs: [
    "Quis escapes de docker reais nos PT tests, fiquei com mock-only (herda Q-B4-4): docker no CI viola política; O-B4-1 cobre integração.",
    "Quis PT-5 com classificador semântico, fiquei com rebuff estrutural: o handler LLM não existe até Epic 4.",
  ],
  openItems: [
    { id: "O-B5-1", description: "Run de integração com docker real (escapes PT-1/PT-4 ao vivo) — herda O-B4-1." },
    { id: "O-B5-2", description: "PT-5 rebuff semântico (classificador prompt-injection) — Epic 4." },
    { id: "O-B5-3", description: "AO-86: schema clihelper inbound real ainda não recebido; webhook-mock=true ([OPEN] em readiness). Re-correr check:webhook-schema quando chegar." },
    { id: "O-B1-1", description: "FECHADO — docs/pre-m1-pentest-tasks.md criado." },
  ],
  metrics: [
    { key: "Tests", value: "257 pass / 0 fail (was 226; +31). Security suite: 31 specs / 8 ficheiros." },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes)" },
    { key: "pentest-report", value: "exit 0; report gerado" },
    { key: "check-webhook-schema", value: "exit 0; [OPEN] (marker ausente, esperado)" },
    { key: "Deps adicionadas", value: "0" },
    { key: "Token usage approx", value: "dentro estimated 80-120K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1b5` → marco done + epic-1b done (5/5) + commit. Mensagem: `feat(story-1b5): 8 Pentest Tasks PT-1..PT-8 (8/8; Epic 1.b 5/5 DONE)`. Push toca .github/workflows (scope ok).",
    },
    { n: 2, description: "Sprint 0: 16/22 done. **Epic 1.b FECHADO** (3 DRB BLOCKERS + sandbox + pentest suite). Resta Epic 1.c (Bootstrap & Operations, 6 stories)." },
    { n: 3, description: "Opcional: epic-1b-retrospective antes de arrancar Epic 1.c." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["docs/pre-m1-pentest-tasks.md", "scripts/pentest-report.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
