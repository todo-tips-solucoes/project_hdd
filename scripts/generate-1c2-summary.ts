/**
 * Story 1.c.2 — DOGFOOD: gera summary via summaryGenerator.finalize() (9ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c2",
  workflowName: "Story 1.c.2 — Secrets management EnvironmentFile",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "2ª story de operações do Epic 1.c. Secrets em /etc/hdd/secrets.env (systemd EnvironmentFile, fora do repo), perm 0600 + user hdd-worker, validação Zod fail-closed. Complementa redaction (1.b.3) e a unit/healthz (1.c.1). NFR-S1/AR-019/D-04.6'.",
  whatWasDone: [
    { artifact: "src/lib/env.ts", description: "MODIFY: +CLIHELPER_TOKEN required; +checkSecretsFilePerms (rejeita mode & 0o077), SecretsError." },
    { artifact: "systemd/hdd-worker.service + .env.example", description: "MODIFY: ExecStartPre gate stat 0600; +CLIHELPER_TOKEN." },
    { artifact: "scripts/install-secrets.sh", description: "install 0600+owner + verify + recusa origem laxa; idempotente; não cria user." },
    { artifact: "tests/lib/env-secrets.test.ts", description: "9 specs: parseEnv required + checkSecretsFilePerms (fs reais chmod)." },
    { artifact: "docs/runbooks/secret-rotation.md", description: "install/rotação/revogação + troubleshooting." },
  ],
  decisions: [
    { n: 1, decision: "CLIHELPER_TOKEN REQUIRED já.", reason: "Decisão do operador (não-Recommended); fail-closed total. Custo: regressão 10 sites de teste (corrigida).", id: "Q-C2-1" },
    { n: 2, decision: "Perm gate via systemd ExecStartPre.", reason: "Sem churn em BootError/main/CLI; checkSecretsFilePerms in-code p/ defesa-em-profundidade.", id: "Q-C2-2" },
    { n: 3, decision: "install-secrets.sh: install+verify, não cria user.", reason: "Separar gestão de secret de provisioning de host.", id: "Q-C2-3" },
    { n: 4, decision: "Rejeitar mode & 0o077.", reason: "Permite 0600/0400; foca 'ninguém além do owner lê'.", id: "Q-C2-4" },
  ],
  tradeoffs: [
    "Quis perm-check no boot (bootstrap), fiquei com ExecStartPre (Q-C2-2): evitar novo BootError + churn nos switches; in-code fica disponível.",
    "CLIHELPER required (Q-C2-1) custou 10 fixes de teste, mas alinha com fail-closed e o pedido explícito.",
  ],
  openItems: [
    { id: "O-C2-1", description: "Wiring de CLIHELPER_TOKEN no cliente HTTP clihelper — Epic 3 (outbound)." },
    { id: "O-C2-2", description: "Opcional: wire checkSecretsFilePerms no boot in-code (defesa extra além do ExecStartPre) — story de hardening." },
    { id: "O-B5-3 acumula", description: "AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema." },
  ],
  metrics: [
    { key: "Tests", value: "279 pass / 1 skip / 0 fail (was 270; +9 env-secrets). Regressão CLIHELPER: 10 sites corrigidos." },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes)" },
    { key: "Deps adicionadas", value: "0" },
    { key: "Segurança", value: "secrets 0600 (ExecStartPre + checkSecretsFilePerms); .gitignore cobre *.env; redaction cobre os 2 tokens" },
    { key: "Token usage approx", value: "dentro estimated 40-56K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c2` → marco done + commit. Mensagem: `feat(story-1c2): secrets EnvironmentFile 0600 + CLIHELPER_TOKEN required (NFR-S1)`. Push NÃO toca .github/workflows.",
    },
    { n: 2, description: "Sprint 0: 18/22 done. Epic 1.c: 3/7. Próxima: 1.c.3 (Litestream/R2 — candidato a integração real, precisa creds R2)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/lib/env.ts", "systemd/hdd-worker.service"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
