> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

---

<!--
  Tier-B template — briefing 600-900 palavras, target ≤715 para folga.

  Story 1.a.8 (F8 FR-070..076, D-019, AO-146 defer p/ Tier-A).
  Renderizado por `summaryGenerator.finalize()` em src/services/summary-generator.service.ts.

  Anti-padrões a EVITAR (per finalization-summary-templates canon):
    × "Foi feito muito trabalho" — usar ARTEFACTOS como prova
    × Listas FR sem dizer o que ficou diferente — mostrar CONSEQUÊNCIA, não actividade
    × "Várias decisões foram tomadas" — enumerá-las (tabela)
    × Tier-B sem Trade-offs — sinal de processo low-judgment
    × "Tudo correu bem" — preferir verdict formal (ready-to-merge etc.)

  Mantém: artefactos como prova, decisões enumeradas, trade-offs narrativos,
  open items distintos das próximas etapas.
-->
---
workflowId: story-1c1
workflowName: Story 1.c.1 — systemd unit Type=simple + /healthz endpoint
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.1 — systemd unit Type=simple + /healthz endpoint · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

1ª story do Epic 1.c (Bootstrap & Operations). Torna o worker supervisionável por systemd. Como o Bun não suporta sd_notify (D-04.14), a saúde é exposta por HTTP /healthz + poll Healthchecks.io (Type=simple, sem WatchdogSec). 1º servidor HTTP do HDD (Hono).

## O que foi feito

- **src/cli/healthz.handler.ts** — createHealthzApp Hono; GET /healthz → {status:ok, uptime}; injectável (clock+bootEpochMs).
- **src/cli/hdd-worker.ts** — MODIFY: registerStartCommand (bootstrap daemon + Bun.serve /healthz); review preservado; build compila esta CLI.
- **systemd/hdd-worker.service + .env.example** — Type=simple, sem WatchdogSec, ExecStartPost poll /healthz, binário directo.
- **tests/cli/healthz.test.ts + tests/integration/healthz.integration.test.ts** — 3 unit (mock app.request) + 2 integração real (Bun.serve+fetch, D-053).
- **docs/runbooks/systemd-deploy.md** — Deploy + Healthchecks.io/WhatsApp (AC4 deferido E3) + troubleshooting.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Instalar Hono (4.12.23, zero-dep). | Stack canónico; serve também rotas Epic 3. | Q-C1-1 |
| 2 | hdd-worker start = launcher daemon; build compila hdd-worker.ts. | Story pede start mounts /healthz; systemd chama dist/hdd-worker start. | Q-C1-2 |
| 3 | ExecStart binário directo (litestream na 1.c.3). | Litestream não instalado; unit arranca standalone já. | Q-C1-3 |
| 4 | start exige sandbox image (fail-closed). | Coerente com 1.b.4; runbook manda prepull antes. | Q-C1-4 |

## Trade-offs aplicados

- Quis dev parity, fiquei com divergência: `bun --hot src/main.ts` (dev) não serve /healthz; binário usa hdd-worker start. Follow-up O-C1-1.
- Quis smoke HTTP completo, fiquei com LISTEN+log: curl/fetch inline bloqueados pelo hook; o HTTP real é provado pela integração Bun.serve+fetch.

## Open items deferidos

- **O-C1-1:** Alinhar dev entry (main.ts) com hdd-worker start, ou consolidar os 2 entries (main.ts não serve /healthz).
- **O-C1-2:** AC4: Healthchecks.io + WhatsApp hdd_heartbeat — depende de E3 (canal WhatsApp).
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema quando chegar.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 270 pass / 1 skip / 0 fail (was 265; +5). Integração real: 11 specs (3 ficheiros).
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Deps adicionadas:** 1 (hono@4.12.23, zero-dep)
- **Smoke binário:** dist/hdd-worker start → LISTEN :8199 + log started (95MB compiled)
- **Token usage approx:** dentro estimated 48-72K

## Próximos passos sugeridos

1. Operador aprova `approve story-1c1` → marco done + commit. Mensagem: `feat(story-1c1): systemd unit + /healthz endpoint (Hono; AR-020/D-04.14)`. Push toca .github? NÃO (só systemd/ + src + docs) — sem scope workflow desta vez.
2. Sprint 0: 17/22 done. Epic 1.c: 2/7. Próxima: 1.c.2 (secrets EnvironmentFile) ou 1.c.3 (Litestream/R2 — candidato a integração real).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c1` · Pedir alterações: `hdd-worker review request-changes story-1c1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c1 --reason "<razão>"`


---

<!--
  Tier-C template — full briefing, sem limite estricto de palavras.

  Story 1.a.8 (F8 FR-070..076, D-019). Superset do Tier-B + diff opcional.

  Renderizado por `summaryGenerator.finalize()`. Tier-C inclui git diff
  unified dentro de fence ```diff (Q-A8-3 Recommended); side-by-side fica
  para v1.1+. Quando `diffAgainst` é undefined, a section "Diff" exibe
  "(no diff requested)" como placeholder.
-->
---
workflowId: story-1c1
workflowName: Story 1.c.1 — systemd unit Type=simple + /healthz endpoint
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.1 — systemd unit Type=simple + /healthz endpoint

### Contexto detalhado

1ª story do Epic 1.c (Bootstrap & Operations). Torna o worker supervisionável por systemd. Como o Bun não suporta sd_notify (D-04.14), a saúde é exposta por HTTP /healthz + poll Healthchecks.io (Type=simple, sem WatchdogSec). 1º servidor HTTP do HDD (Hono).

### O que foi feito (verbose)

- **src/cli/healthz.handler.ts** — createHealthzApp Hono; GET /healthz → {status:ok, uptime}; injectável (clock+bootEpochMs).
- **src/cli/hdd-worker.ts** — MODIFY: registerStartCommand (bootstrap daemon + Bun.serve /healthz); review preservado; build compila esta CLI.
- **systemd/hdd-worker.service + .env.example** — Type=simple, sem WatchdogSec, ExecStartPost poll /healthz, binário directo.
- **tests/cli/healthz.test.ts + tests/integration/healthz.integration.test.ts** — 3 unit (mock app.request) + 2 integração real (Bun.serve+fetch, D-053).
- **docs/runbooks/systemd-deploy.md** — Deploy + Healthchecks.io/WhatsApp (AC4 deferido E3) + troubleshooting.

### Full file list

- **src/cli/healthz.handler.ts** — createHealthzApp Hono; GET /healthz → {status:ok, uptime}; injectável (clock+bootEpochMs).
- **src/cli/hdd-worker.ts** — MODIFY: registerStartCommand (bootstrap daemon + Bun.serve /healthz); review preservado; build compila esta CLI.
- **systemd/hdd-worker.service + .env.example** — Type=simple, sem WatchdogSec, ExecStartPost poll /healthz, binário directo.
- **tests/cli/healthz.test.ts + tests/integration/healthz.integration.test.ts** — 3 unit (mock app.request) + 2 integração real (Bun.serve+fetch, D-053).
- **docs/runbooks/systemd-deploy.md** — Deploy + Healthchecks.io/WhatsApp (AC4 deferido E3) + troubleshooting.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Instalar Hono (4.12.23, zero-dep). | Stack canónico; serve também rotas Epic 3. | Q-C1-1 |
| 2 | hdd-worker start = launcher daemon; build compila hdd-worker.ts. | Story pede start mounts /healthz; systemd chama dist/hdd-worker start. | Q-C1-2 |
| 3 | ExecStart binário directo (litestream na 1.c.3). | Litestream não instalado; unit arranca standalone já. | Q-C1-3 |
| 4 | start exige sandbox image (fail-closed). | Coerente com 1.b.4; runbook manda prepull antes. | Q-C1-4 |

### Trade-offs aplicados (narrativa)

- Quis dev parity, fiquei com divergência: `bun --hot src/main.ts` (dev) não serve /healthz; binário usa hdd-worker start. Follow-up O-C1-1.
- Quis smoke HTTP completo, fiquei com LISTEN+log: curl/fetch inline bloqueados pelo hook; o HTTP real é provado pela integração Bun.serve+fetch.

### Open items deferidos (com onde serão resolvidos)

- **O-C1-1:** Alinhar dev entry (main.ts) com hdd-worker start, ou consolidar os 2 entries (main.ts não serve /healthz).
- **O-C1-2:** AC4: Healthchecks.io + WhatsApp hdd_heartbeat — depende de E3 (canal WhatsApp).
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema quando chegar.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 270 pass / 1 skip / 0 fail (was 265; +5). Integração real: 11 specs (3 ficheiros).
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Deps adicionadas:** 1 (hono@4.12.23, zero-dep)
- **Smoke binário:** dist/hdd-worker start → LISTEN :8199 + log started (95MB compiled)
- **Token usage approx:** dentro estimated 48-72K

### Próximos passos sugeridos

1. Operador aprova `approve story-1c1` → marco done + commit. Mensagem: `feat(story-1c1): systemd unit + /healthz endpoint (Hono; AR-020/D-04.14)`. Push toca .github? NÃO (só systemd/ + src + docs) — sem scope workflow desta vez.
2. Sprint 0: 17/22 done. Epic 1.c: 2/7. Próxima: 1.c.2 (secrets EnvironmentFile) ou 1.c.3 (Litestream/R2 — candidato a integração real).

### Diff vs `HEAD`

```diff
diff --git a/src/cli/hdd-worker.ts b/src/cli/hdd-worker.ts
index 6639620..e13c39a 100644
--- a/src/cli/hdd-worker.ts
+++ b/src/cli/hdd-worker.ts
@@ -1,30 +1,71 @@
 /**
- * `hdd-worker.ts` — Commander root CLI entry point (minimal, Story 1.a.8).
+ * `hdd-worker.ts` — Commander root CLI entry point.
  *
- * Story 1.a.8 (Q-A8-1 [RESOLVED — Commander root NOW]).
+ * Story 1.a.8 (root + `review`) · Story 1.c.1 (`start` daemon + `/healthz`).
  *
- * **Scope desta story:** apenas o esqueleto Commander + register `review`
- * subcommand. Story 2.1 vai expandir com `start`, `stop`, `status`, etc. para
- * o worker daemon. O `main.ts` separado da 1.a.7 continua a ser o daemon entry
- * (não toca aqui).
- *
- * **CLI lifecycle:** invocado como `bun run src/cli/hdd-worker.ts <subcommand>`
- * OU via binário compilado `hdd-worker <subcommand>` após `bun build --compile`.
+ * **`start` (1.c.1):** launcher daemon canónico — `bootstrap()` (daemon, NÃO
+ * cliMode → arma shutdown + ProcessStarted + exige sandbox image fail-closed,
+ * Q-C1-4) + serve Hono `/healthz` via `Bun.serve`. O systemd chama
+ * `dist/hdd-worker start` (binário compilado de ESTE ficheiro — Q-C1-2). O Bun
+ * não tem `sd_notify` → supervisão por `/healthz` polling, não `Type=notify`.
  *
  * `import.meta.main` guard permite import em tests sem auto-executar parse.
  */
 
 import { Command } from "commander";
+import { createSystemClockAdapter } from "../adapters/clock/system-clock.adapter.ts";
+import { type BootError, bootstrap } from "../bootstrap.ts";
+import { createHealthzApp } from "./healthz.handler.ts";
 import { registerReviewCommand } from "./review.command.ts";
 
+const DEFAULT_PORT = 8080;
+
+function formatBootError(e: BootError): string {
+  switch (e.kind) {
+    case "BootEnvInvalid":
+      return e.inner.formatted;
+    case "BootDbFailure":
+      return `db init failed: ${String(e.cause)}`;
+    case "BootMigrationFailure":
+      return `migration failed: ${JSON.stringify(e.inner)}`;
+    case "BootAuditFailure":
+      return `audit init failed: ${JSON.stringify(e.inner)}`;
+    case "BootSandboxImageMissing":
+      return `sandbox image missing: ${e.image} — corre scripts/prepull-sandbox-image.sh`;
+  }
+}
+
+export function registerStartCommand(program: Command): void {
+  program
+    .command("start")
+    .description("Arranca o worker daemon + serve /healthz (systemd Type=simple)")
+    .option("--port <n>", "porta do /healthz (default PORT env ou 8080)")
+    .action((opts: { port?: string }) => {
+      const boot = bootstrap();
+      if (boot.isErr()) {
+        process.stderr.write(`${formatBootError(boot.error)}\n`);
+        process.exit(1);
+      }
+      const { PORT } = process.env;
+      const port = Number(opts.port ?? PORT ?? DEFAULT_PORT);
+      const app = createHealthzApp({
+        clock: createSystemClockAdapter(),
+        bootEpochMs: Date.now(),
+      });
+      Bun.serve({ port, fetch: app.fetch });
+      process.stdout.write(`hdd-worker started — /healthz on :${port}\n`);
+    });
+}
+
 export function createCli(): Command {
   const program = new Command();
   program
     .name("hdd-worker")
-    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — Story 1.a.8 scope: review subcommand")
+    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — review + start daemon")
     .version("0.0.1");
 
   registerReviewCommand(program);
+  registerStartCommand(program);
 
   return program;
 }

```

---

→ Aprovar: `hdd-worker review approve story-1c1` · Pedir alterações: `hdd-worker review request-changes story-1c1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c1 --reason "<razão>"`

