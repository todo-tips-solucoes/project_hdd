/**
 * Story 1.c.1 — DOGFOOD: gera summary via summaryGenerator.finalize() (8ª vez).
 *
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. 1ª story do Epic 1.c (Bootstrap & Ops).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c1",
  workflowName: "Story 1.c.1 — systemd unit Type=simple + /healthz endpoint",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "1ª story do Epic 1.c (Bootstrap & Operations). Torna o worker supervisionável por systemd. Como o Bun não suporta sd_notify (D-04.14), a saúde é exposta por HTTP /healthz + poll Healthchecks.io (Type=simple, sem WatchdogSec). 1º servidor HTTP do HDD (Hono).",
  whatWasDone: [
    { artifact: "src/cli/healthz.handler.ts", description: "createHealthzApp Hono; GET /healthz → {status:ok, uptime}; injectável (clock+bootEpochMs)." },
    { artifact: "src/cli/hdd-worker.ts", description: "MODIFY: registerStartCommand (bootstrap daemon + Bun.serve /healthz); review preservado; build compila esta CLI." },
    { artifact: "systemd/hdd-worker.service + .env.example", description: "Type=simple, sem WatchdogSec, ExecStartPost poll /healthz, binário directo." },
    { artifact: "tests/cli/healthz.test.ts + tests/integration/healthz.integration.test.ts", description: "3 unit (mock app.request) + 2 integração real (Bun.serve+fetch, D-053)." },
    { artifact: "docs/runbooks/systemd-deploy.md", description: "Deploy + Healthchecks.io/WhatsApp (AC4 deferido E3) + troubleshooting." },
  ],
  decisions: [
    { n: 1, decision: "Instalar Hono (4.12.23, zero-dep).", reason: "Stack canónico; serve também rotas Epic 3.", id: "Q-C1-1" },
    { n: 2, decision: "hdd-worker start = launcher daemon; build compila hdd-worker.ts.", reason: "Story pede start mounts /healthz; systemd chama dist/hdd-worker start.", id: "Q-C1-2" },
    { n: 3, decision: "ExecStart binário directo (litestream na 1.c.3).", reason: "Litestream não instalado; unit arranca standalone já.", id: "Q-C1-3" },
    { n: 4, decision: "start exige sandbox image (fail-closed).", reason: "Coerente com 1.b.4; runbook manda prepull antes.", id: "Q-C1-4" },
  ],
  tradeoffs: [
    "Quis dev parity, fiquei com divergência: `bun --hot src/main.ts` (dev) não serve /healthz; binário usa hdd-worker start. Follow-up O-C1-1.",
    "Quis smoke HTTP completo, fiquei com LISTEN+log: curl/fetch inline bloqueados pelo hook; o HTTP real é provado pela integração Bun.serve+fetch.",
  ],
  openItems: [
    { id: "O-C1-1", description: "Alinhar dev entry (main.ts) com hdd-worker start, ou consolidar os 2 entries (main.ts não serve /healthz)." },
    { id: "O-C1-2", description: "AC4: Healthchecks.io + WhatsApp hdd_heartbeat — depende de E3 (canal WhatsApp)." },
    { id: "O-B5-3 acumula", description: "AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema quando chegar." },
  ],
  metrics: [
    { key: "Tests", value: "270 pass / 1 skip / 0 fail (was 265; +5). Integração real: 11 specs (3 ficheiros)." },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes)" },
    { key: "Deps adicionadas", value: "1 (hono@4.12.23, zero-dep)" },
    { key: "Smoke binário", value: "dist/hdd-worker start → LISTEN :8199 + log started (95MB compiled)" },
    { key: "Token usage approx", value: "dentro estimated 48-72K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c1` → marco done + commit. Mensagem: `feat(story-1c1): systemd unit + /healthz endpoint (Hono; AR-020/D-04.14)`. Push toca .github? NÃO (só systemd/ + src + docs) — sem scope workflow desta vez.",
    },
    { n: 2, description: "Sprint 0: 17/22 done. Epic 1.c: 2/7. Próxima: 1.c.2 (secrets EnvironmentFile) ou 1.c.3 (Litestream/R2 — candidato a integração real)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/cli/healthz.handler.ts", "src/cli/hdd-worker.ts", "systemd/hdd-worker.service"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
