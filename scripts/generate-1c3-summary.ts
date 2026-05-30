/**
 * Story 1.c.3 — DOGFOOD: gera summary via summaryGenerator.finalize() (10ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c3",
  workflowName: "Story 1.c.3 — Litestream supervisor + R2 EU + rclone",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "3ª story de operações do Epic 1.c — camada de durabilidade. Litestream stream WAL → R2 EU (primário, RPO~1s/RTO5-15s, retention 24h D-04.21) + rclone dump 4×/dia gzipped (secundário) + runbook. Defesa contra crash de VPS/disk failure de que o crash recovery do Epic 5 depende. WAL já ligado em 1.a.5. AR-014/AO-38/AO-51.",
  whatWasDone: [
    { artifact: "litestream.yml", description: "NEW: config R2 EU (s3, bucket hdd-backup, retention 24h, snapshot 1h); path /opt/hdd/.hdd-state.db (default real); bloco file:// p/ drill." },
    { artifact: "systemd/litestream.service + .env.example", description: "NEW: daemon `litestream replicate` independente; EnvironmentFile próprio 0600-gate (creds R2 separadas do worker)." },
    { artifact: "systemd/hdd-worker.service", description: "MODIFY: +Requires/After litestream.service (fail-closed na durabilidade)." },
    { artifact: "scripts/rclone-daily-backup.sh", description: "NEW: VACUUM INTO (snapshot atómico) + gzip + rclone copy; guards fail-closed; sem set -x." },
    { artifact: "tests/integration/backup-restore.integration.test.ts", description: "NEW: AC2 snapshot real (VACUUM INTO+gzip, sempre); AC1 litestream skipIf." },
    { artifact: "docs/runbooks/litestream-restore.md", description: "NEW: prereqs/deploy/restore/drill mensal/troubleshooting." },
  ],
  decisions: [
    { n: 1, decision: "Serviço Litestream separado (não wrapper).", reason: "Alinha com files_created do StorySpec; Requires=/After= dá fail-closed na durabilidade. Diverge do canon AO-51.", id: "Q-C3-1" },
    { n: 2, decision: "Binários ausentes → skipIf + runbook.", reason: "litestream/rclone/sqlite3 são binários de sistema; não instalar. AC2 prova-se local; AC1 skip (CI verde).", id: "Q-C3-2" },
    { n: 3, decision: "Creds R2 fora do Zod do worker.", reason: "EnvironmentFile próprio do Litestream 0600; zero churn em env.ts/BootError; worker nunca vê creds.", id: "Q-C3-3" },
    { n: 4, decision: ".integration.test.ts (não .test.sh).", reason: "Corre em test:integration; .test.sh fica órfão (1.c.7).", id: "Q-C3-4" },
  ],
  tradeoffs: [
    "StorySpec dizia data.db / .test.sh; usei .hdd-state.db (default real do código) e .integration.test.ts (suite executável) — fidelidade ao comportamento > literal.",
    "Requires=litestream → worker não arranca sem réplica; coerente com durabilidade, mas runbook documenta o Wants= para modo degradado.",
  ],
  openItems: [
    { id: "O-C3-1", description: "Validar litestream.yml/replicate→restore com binário real + R2 EU live (creds indisponíveis no ambiente); correr o drill quando provisionado." },
    { id: "O-C3-2", description: "Alinhamento de path: garantir HDD_DB_PATH (se override) == path no litestream.yml no deploy." },
    { id: "O-B5-3 acumula", description: "AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema." },
  ],
  metrics: [
    { key: "Tests", value: "280 pass / 2 skip / 0 fail (was 279/1; +1 pass AC2 snapshot, +1 skip AC1 litestream)" },
    { key: "Integration", value: "11 pass / 2 skip / 0 fail" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes; 1 organizeImports corrigido)" },
    { key: "Deps adicionadas", value: "0 (litestream/rclone/sqlite3 = binários de sistema)" },
    { key: "Durabilidade", value: "Litestream R2 RPO~1s + rclone 4×/dia; retention 24h; creds R2 0600 isoladas" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c3` → marco done + commit `feat(story-1c3): Litestream supervisor + R2 EU + rclone (AR-014/D-04.21)`. Push NÃO toca .github/workflows.",
    },
    { n: 2, description: "Sprint 0: 19/22 done. Epic 1.c: 4/7. Próxima: 1.c.4 (CI GitHub Actions — vai tocar .github/workflows → gh auth refresh -s workflow se push falhar)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["litestream.yml", "systemd/litestream.service", "systemd/hdd-worker.service", "scripts/rclone-daily-backup.sh"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
