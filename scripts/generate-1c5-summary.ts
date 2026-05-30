/**
 * Story 1.c.5 — DOGFOOD: gera summary via summaryGenerator.finalize() (12ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c5",
  workflowName: "Story 1.c.5 — SSH restricted deploy",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "5ª story de operações do Epic 1.c — deploy auditável sem shell livre. SSH forced-command (command=/opt/hdd/scripts/deploy.sh) → operador faz `ssh hdd-worker@vps deploy <sha>` e nada mais; cada deploy regista DeployCompleted na hash-chain do worker. Complementa o release.yml (1.c.4). NFR-S6/AR-112/D-04.25.",
  whatWasDone: [
    { artifact: "scripts/audit-deploy.ts", description: "NEW: recordDeploy() — adapter directo (sem bootstrap) append DeployCompleted{commitSha} runId deploy-<sha>; zero src mod (AuditEntry.type é string)." },
    { artifact: "scripts/deploy.sh", description: "NEW: forced-command target; parseia $SSH_ORIGINAL_COMMAND; valida sha ^[0-9a-f]{7,40}$ antes de git; build+restart+audit." },
    { artifact: "scripts/install-authorized-keys.sh", description: "NEW: instala linha command=…+hardening; valida pubkey; 0600/0700; idempotente; não cria user." },
    { artifact: "tests/integration/deploy.integration.test.ts", description: "NEW: AC2 audit round-trip real + AC1 deploy.sh rejeita shell-livre/sha-inválido via bash (5 specs, sem sshd)." },
    { artifact: "docs/runbooks/ssh-deploy.md", description: "NEW: key/forced-command, fluxo deploy, verificação audit, troubleshooting." },
  ],
  decisions: [
    { n: 1, decision: "Registo via script standalone audit-deploy.ts.", reason: "Monta adapter directo, sem bootstrap completo; zero src mod. AuditEntry.type string livre.", id: "Q-C5-1" },
    { n: 2, decision: "deploy.sh: git checkout + bun build + restart.", reason: "Binário fresco da fonte; bun na VPS garantido; forward-only.", id: "Q-C5-2" },
    { n: 3, decision: ".integration.test.ts (não .test.sh).", reason: "Corre em test:integration; ambos ACs reais sem sshd (.test.sh fica órfão).", id: "Q-C5-3" },
    { n: 4, decision: "runId = deploy-<sha>.", reason: "Legível; correlaciona com o commit; seq/ts distinguem re-deploys.", id: "Q-C5-4" },
  ],
  tradeoffs: [
    "audit-deploy.ts via bun (não subcommand) evita tocar src/cli, mas exige bun na VPS — aceitável porque o deploy já recompila com bun (Q-C5-2).",
    "Segurança concentrada na validação do sha em bash: ^[0-9a-f]{7,40}$ ANTES de git (fronteira anti-injection do $SSH_ORIGINAL_COMMAND); flags no-pty/no-forwarding no authorized_keys completam o hardening.",
  ],
  openItems: [
    { id: "O-C5-1", description: "Forced-command end-to-end com sshd real (testado via bash + env; o SSH layer em si fica para drill de host)." },
    { id: "O-C5-2", description: "Restart precisa de polkit/sudoers p/ hdd-worker reiniciar a unit (host setup, documentado no runbook)." },
    { id: "O-C4-2/3 acumula", description: "license-checker no release.yml e instalação da Renovate App ainda por confirmar (1.c.4)." },
  ],
  metrics: [
    { key: "Tests", value: "285 pass / 2 skip / 0 fail (era 280; +5 deploy)" },
    { key: "Integration", value: "16 pass / 2 skip / 0 fail" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos; 1 formatter fixado)" },
    { key: "Deps adicionadas", value: "0; src/ intacto" },
    { key: "Segurança", value: "forced-command + sha regex anti-injection + DeployCompleted na hash-chain" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c5` → marco done + commit `feat(story-1c5): SSH restricted deploy + DeployCompleted audit (NFR-S6/AR-112)`. Não toca workflows → push normal; verificar CI verde via gh run após push.",
    },
    { n: 2, description: "Sprint 0: 21/22 done. Epic 1.c: 6/7. Próxima e última do epic: 1.c.6 (8 runbooks must-have; blocked_by 1.c.2+1.c.3 done)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["scripts/audit-deploy.ts", "scripts/deploy.sh", "scripts/install-authorized-keys.sh"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
