/**
 * Story 1.c.4 — DOGFOOD: gera summary via summaryGenerator.finalize() (11ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c4",
  workflowName: "Story 1.c.4 — CI GitHub Actions + bun build --compile + Renovate",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "4ª story de operações do Epic 1.c — gate de CI + artifact reproduzível + manutenção de deps. Descoberta: ci.yml já existia (criado por 1.b.3-1.b.5) → MODIFY, não NEW. Fecha o ciclo código→validação→binário antes do deploy SSH (1.c.5). AR-017/AR-111/D-04.11'/NFR-P1.",
  whatWasDone: [
    { artifact: ".github/workflows/ci.yml", description: "MODIFY: +step test:security +step build:compile (bun build --compile src/cli/hdd-worker.ts + smoke --help); jobs 1.b preservados." },
    { artifact: ".github/workflows/release.yml", description: "NEW: tag v*/dispatch → license-checker (failOn GPL/AGPL/LGPL) + compile + upload-artifact; sem auto-deploy." },
    { artifact: "renovate.json", description: "NEW: patch automerge; minor/major manual; vulnerability automerge; runtime/binários NUNCA (regra final, vence security)." },
    { artifact: "scripts/measure-ci-time.sh", description: "NEW: proxy local do <60s (9s real); número autoritativo = GH Actions UI." },
  ],
  decisions: [
    { n: 1, decision: "ci.yml MODIFY incremental (não rewrite).", reason: "Já existia (1.b.3-1.b.5); convention rot benigno; preservar verify-redaction/truffleHog/pentest/integration.", id: "Q-C4-1" },
    { n: 2, decision: "Entry compile = src/cli/hdd-worker.ts.", reason: "Entry real de produção (1.c.1); StorySpec src/main.ts impreciso; package.json/systemd intactos.", id: "Q-C4-2" },
    { n: 3, decision: "release.yml em tag v* + workflow_dispatch.", reason: "Release deliberado/versionado; deploy continua SSH manual (1.c.5).", id: "Q-C4-3" },
    { n: 4, decision: "Renovate D-04.11'; runtime nunca automerge vence security.", reason: "Estabilidade do runtime > velocidade do patch; security-patch do Bun não auto-mergir sem revisão.", id: "Q-C4-4" },
  ],
  tradeoffs: [
    "StorySpec dizia ci.yml 'created' + entry src/main.ts; realidade = MODIFY + src/cli/hdd-worker.ts. Fidelidade ao estado/produção > literal do spec.",
    "measure-ci-time.sh é proxy local (9s), não o wall-clock real do CI — o número <60s autoritativo só se confirma no GH Actions UI após o 1º push (open item honesto, sem afirmar 'verificado').",
  ],
  openItems: [
    { id: "O-C4-1", description: "Confirmar <60s no GH Actions UI após o 1º push (proxy local = 9s, mas CI inclui setup-bun/install/jobs paralelos)." },
    { id: "O-C4-2", description: "Validar license-checker no GH real (compat com node_modules do bun); ajustar se a ferramenta falhar." },
    { id: "O-C4-3", description: "Renovate App tem de estar instalada no repo GitHub para o renovate.json ter efeito (onboarding PR)." },
  ],
  metrics: [
    { key: "Tests", value: "280 pass / 2 skip / 0 fail (sem regressão; só YAML/JSON/sh novos)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes; 0 TS novo)" },
    { key: "Build", value: "bun build --compile rc=0 (~440ms); dist/hdd-worker --help rc=0" },
    { key: "CI proxy", value: "9s local (alvo <60s; autoritativo GH UI)" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c4` → marco done + commit `feat(story-1c4): CI build:compile + release.yml + Renovate (AR-017/D-04.11')`. Push TOCA .github/workflows → scope workflow já presente (push normal); confirmar tempos no GH Actions UI após push (O-C4-1).",
    },
    { n: 2, description: "Sprint 0: 20/22 done. Epic 1.c: 5/7. Próxima: 1.c.5 (SSH restricted deploy — blocked_by 1.c.4 agora resolvido)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: [".github/workflows/ci.yml", ".github/workflows/release.yml", "renovate.json", "scripts/measure-ci-time.sh"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
