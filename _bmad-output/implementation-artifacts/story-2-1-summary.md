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
workflowId: story-2-1
workflowName: Story 2.1 — hdd-worker CLI Commander scaffold
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 2.1 — hdd-worker CLI Commander scaffold · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

1ª story do M1 (Epic 2 — Worker Autónomo). Scaffold da CLI de operação: hdd-worker com 6 subcomandos + --help claro (NFR-U4) + status que lê o estado real da DB em ≤2s (NFR-O1). start+review já existiam; esta acrescenta status/logs, extrai start, unifica o entry, e cria stubs pause/resume (lógica real = Story 2.6).

## O que foi feito

- **src/cli/{status,logs,start}.command.ts** — NEW: status (lê DB via service), logs (tail audit JSONL), start (extraído + [project] + deps injectáveis).
- **src/services/worker-status.service.ts** — NEW: readWorkerStatus — 1ª leitura DB do projeto (última run + agregado de stories); DB fresca → no-runs.
- **src/cli/boot-error.format.ts** — NEW: formatBootError consolidado (removida tripla duplicação).
- **src/cli/hdd-worker.ts + main.ts + package.json** — MODIFY: regista os 6 + stubs pause/resume; main.ts delega para createCli (fecha O-C1-1); dev/module → CLI.
- **tests/cli/commands.test.ts** — NEW: 11 specs (AC1 6 subcomandos; status no-runs/run :memory:/QueryFailure/guarda<2s; logs; start; stubs).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Unificar entry (main.ts delega para createCli). | Fecha O-C1-1; um só entry dev/build/systemd. build já compilava hdd-worker.ts (confirmado). | Q-2.1-1 |
| 2 | status lê a DB (runs/stories), não /healthz. | Estado real persistido; funciona com worker parado. /healthz só dá uptime. | Q-2.1-2 |
| 3 | Consolidar formatBootError num módulo. | Estava duplicado em 2 sítios; status seria o 3º. Switch exaustivo num só sítio. | Q-2.1-3 |
| 4 | pause/resume = stubs (exit 1) no --help. | Fronteira com Story 2.6 (lifecycle FSM); aparecem no help sem implementar. | Q-2.1-4 |

## Trade-offs aplicados

- StorySpec listava hdd-worker.ts em files_created (é MODIFY) e start.command.ts como novo (extração do inline); boot-error.format.ts é ficheiro extra. Divergências registadas em readiness-open-items.md (AI-S0-4) — fidelidade à realidade > spec literal.
- status precisa de bootstrap (valida secrets) → sem env o smoke falha no boot (esperado); o caminho de sucesso prova-se com env dummy (idle) + teste unitário com boot mockado.

## Open items deferidos

- **O-2.1-1:** status mostra só a última run; multi-run/histórico fica para quando o worker loop (Epic 2/5) gerar várias runs.
- **O-C1-1:** FECHADO: dev/module/main.ts unificados no CLI (createCli).
- **fronteira 2.6:** pause/resume stubs → Story 2.6 implementa worker-lifecycle.service + comandos reais (substitui os stubs).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 296 pass / 2 skip / 0 fail (era 285; +11 commands)
- **Integration:** 16 pass / 2 skip
- **Type-check:** clean
- **Lint:** exit 0 (25 infos useLiteralKeys; 4 erros eslint corrigidos)
- **Smoke binário:** --help lista 6 (AC1); status→idle rc=0 (AC2); logs→sem eventos rc=0
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-2.1` → marco done + commit `feat(story-2.1): hdd-worker CLI scaffold (status/logs + entry unificado)`. Não toca workflows → push normal; verificar CI verde via gh run.
2. M1/Epic 2: 1/7. Próxima: Story 2.2 (BMAD invoker port + CLI-wrapper adapter; assenta no D-052 validado em 1.c.7).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-2-1` · Pedir alterações: `hdd-worker review request-changes story-2-1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-1 --reason "<razão>"`


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
workflowId: story-2-1
workflowName: Story 2.1 — hdd-worker CLI Commander scaffold
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 2.1 — hdd-worker CLI Commander scaffold

### Contexto detalhado

1ª story do M1 (Epic 2 — Worker Autónomo). Scaffold da CLI de operação: hdd-worker com 6 subcomandos + --help claro (NFR-U4) + status que lê o estado real da DB em ≤2s (NFR-O1). start+review já existiam; esta acrescenta status/logs, extrai start, unifica o entry, e cria stubs pause/resume (lógica real = Story 2.6).

### O que foi feito (verbose)

- **src/cli/{status,logs,start}.command.ts** — NEW: status (lê DB via service), logs (tail audit JSONL), start (extraído + [project] + deps injectáveis).
- **src/services/worker-status.service.ts** — NEW: readWorkerStatus — 1ª leitura DB do projeto (última run + agregado de stories); DB fresca → no-runs.
- **src/cli/boot-error.format.ts** — NEW: formatBootError consolidado (removida tripla duplicação).
- **src/cli/hdd-worker.ts + main.ts + package.json** — MODIFY: regista os 6 + stubs pause/resume; main.ts delega para createCli (fecha O-C1-1); dev/module → CLI.
- **tests/cli/commands.test.ts** — NEW: 11 specs (AC1 6 subcomandos; status no-runs/run :memory:/QueryFailure/guarda<2s; logs; start; stubs).

### Full file list

- **src/cli/{status,logs,start}.command.ts** — NEW: status (lê DB via service), logs (tail audit JSONL), start (extraído + [project] + deps injectáveis).
- **src/services/worker-status.service.ts** — NEW: readWorkerStatus — 1ª leitura DB do projeto (última run + agregado de stories); DB fresca → no-runs.
- **src/cli/boot-error.format.ts** — NEW: formatBootError consolidado (removida tripla duplicação).
- **src/cli/hdd-worker.ts + main.ts + package.json** — MODIFY: regista os 6 + stubs pause/resume; main.ts delega para createCli (fecha O-C1-1); dev/module → CLI.
- **tests/cli/commands.test.ts** — NEW: 11 specs (AC1 6 subcomandos; status no-runs/run :memory:/QueryFailure/guarda<2s; logs; start; stubs).

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Unificar entry (main.ts delega para createCli). | Fecha O-C1-1; um só entry dev/build/systemd. build já compilava hdd-worker.ts (confirmado). | Q-2.1-1 |
| 2 | status lê a DB (runs/stories), não /healthz. | Estado real persistido; funciona com worker parado. /healthz só dá uptime. | Q-2.1-2 |
| 3 | Consolidar formatBootError num módulo. | Estava duplicado em 2 sítios; status seria o 3º. Switch exaustivo num só sítio. | Q-2.1-3 |
| 4 | pause/resume = stubs (exit 1) no --help. | Fronteira com Story 2.6 (lifecycle FSM); aparecem no help sem implementar. | Q-2.1-4 |

### Trade-offs aplicados (narrativa)

- StorySpec listava hdd-worker.ts em files_created (é MODIFY) e start.command.ts como novo (extração do inline); boot-error.format.ts é ficheiro extra. Divergências registadas em readiness-open-items.md (AI-S0-4) — fidelidade à realidade > spec literal.
- status precisa de bootstrap (valida secrets) → sem env o smoke falha no boot (esperado); o caminho de sucesso prova-se com env dummy (idle) + teste unitário com boot mockado.

### Open items deferidos (com onde serão resolvidos)

- **O-2.1-1:** status mostra só a última run; multi-run/histórico fica para quando o worker loop (Epic 2/5) gerar várias runs.
- **O-C1-1:** FECHADO: dev/module/main.ts unificados no CLI (createCli).
- **fronteira 2.6:** pause/resume stubs → Story 2.6 implementa worker-lifecycle.service + comandos reais (substitui os stubs).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 296 pass / 2 skip / 0 fail (era 285; +11 commands)
- **Integration:** 16 pass / 2 skip
- **Type-check:** clean
- **Lint:** exit 0 (25 infos useLiteralKeys; 4 erros eslint corrigidos)
- **Smoke binário:** --help lista 6 (AC1); status→idle rc=0 (AC2); logs→sem eventos rc=0
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-2.1` → marco done + commit `feat(story-2.1): hdd-worker CLI scaffold (status/logs + entry unificado)`. Não toca workflows → push normal; verificar CI verde via gh run.
2. M1/Epic 2: 1/7. Próxima: Story 2.2 (BMAD invoker port + CLI-wrapper adapter; assenta no D-052 validado em 1.c.7).

### Diff vs `HEAD`

```diff
diff --git a/src/cli/hdd-worker.ts b/src/cli/hdd-worker.ts
index e13c39a..229f943 100644
--- a/src/cli/hdd-worker.ts
+++ b/src/cli/hdd-worker.ts
@@ -1,59 +1,43 @@
 /**
  * `hdd-worker.ts` — Commander root CLI entry point.
  *
- * Story 1.a.8 (root + `review`) · Story 1.c.1 (`start` daemon + `/healthz`).
+ * Story 1.a.8 (root + `review`) · Story 1.c.1 (`start` daemon + `/healthz`) ·
+ * Story 2.1 (scaffold completo: status/logs + stubs pause/resume + entry unificado).
  *
- * **`start` (1.c.1):** launcher daemon canónico — `bootstrap()` (daemon, NÃO
- * cliMode → arma shutdown + ProcessStarted + exige sandbox image fail-closed,
- * Q-C1-4) + serve Hono `/healthz` via `Bun.serve`. O systemd chama
- * `dist/hdd-worker start` (binário compilado de ESTE ficheiro — Q-C1-2). O Bun
- * não tem `sd_notify` → supervisão por `/healthz` polling, não `Type=notify`.
+ * Cada subcomando vive no seu ficheiro (`registerXCommand(program, deps)`) —
+ * Biome maxLines 200 + testabilidade. Ordem do `--help`: start, pause, resume,
+ * status, logs, review.
+ *
+ * **Fronteira Story 2.6:** `pause`/`resume` são STUBS aqui (aparecem no `--help`,
+ * mas a lógica FSM/lifecycle é da Story 2.6, que os substitui por ficheiros
+ * próprios). NÃO implementar lifecycle nesta story.
  *
  * `import.meta.main` guard permite import em tests sem auto-executar parse.
  */
 
 import { Command } from "commander";
-import { createSystemClockAdapter } from "../adapters/clock/system-clock.adapter.ts";
-import { type BootError, bootstrap } from "../bootstrap.ts";
-import { createHealthzApp } from "./healthz.handler.ts";
+import { registerLogsCommand } from "./logs.command.ts";
 import { registerReviewCommand } from "./review.command.ts";
+import { registerStartCommand } from "./start.command.ts";
+import { registerStatusCommand } from "./status.command.ts";
 
-const DEFAULT_PORT = 8080;
-
-function formatBootError(e: BootError): string {
-  switch (e.kind) {
-    case "BootEnvInvalid":
-      return e.inner.formatted;
-    case "BootDbFailure":
-      return `db init failed: ${String(e.cause)}`;
-    case "BootMigrationFailure":
-      return `migration failed: ${JSON.stringify(e.inner)}`;
-    case "BootAuditFailure":
-      return `audit init failed: ${JSON.stringify(e.inner)}`;
-    case "BootSandboxImageMissing":
-      return `sandbox image missing: ${e.image} — corre scripts/prepull-sandbox-image.sh`;
-  }
-}
+export type StubDeps = {
+  readonly stderr?: (s: string) => void;
+  readonly exit?: (code: number) => void;
+};
 
-export function registerStartCommand(program: Command): void {
+/** Regista um subcomando placeholder que aparece no --help mas difere a lógica. */
+export function registerStubCommand(
+  program: Command,
+  spec: { readonly name: string; readonly description: string; readonly hint: string },
+  deps: StubDeps = {},
+): void {
   program
-    .command("start")
-    .description("Arranca o worker daemon + serve /healthz (systemd Type=simple)")
-    .option("--port <n>", "porta do /healthz (default PORT env ou 8080)")
-    .action((opts: { port?: string }) => {
-      const boot = bootstrap();
-      if (boot.isErr()) {
-        process.stderr.write(`${formatBootError(boot.error)}\n`);
-        process.exit(1);
-      }
-      const { PORT } = process.env;
-      const port = Number(opts.port ?? PORT ?? DEFAULT_PORT);
-      const app = createHealthzApp({
-        clock: createSystemClockAdapter(),
-        bootEpochMs: Date.now(),
-      });
-      Bun.serve({ port, fetch: app.fetch });
-      process.stdout.write(`hdd-worker started — /healthz on :${port}\n`);
+    .command(spec.name)
+    .description(spec.description)
+    .action(() => {
+      (deps.stderr ?? ((s) => process.stderr.write(s)))(`${spec.hint}\n`);
+      (deps.exit ?? ((c) => process.exit(c)))(1);
     });
 }
 
@@ -61,11 +45,23 @@ export function createCli(): Command {
   const program = new Command();
   program
     .name("hdd-worker")
-    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — review + start daemon")
+    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — operação do worker")
     .version("0.0.1");
 
-  registerReviewCommand(program);
   registerStartCommand(program);
+  registerStubCommand(program, {
+    name: "pause",
+    description: "Pausa o worker (Story 2.6 — lifecycle)",
+    hint: "pause: diferido para a Story 2.6 (worker lifecycle)",
+  });
+  registerStubCommand(program, {
+    name: "resume",
+    description: "Retoma o worker (Story 2.6 — lifecycle)",
+    hint: "resume: diferido para a Story 2.6 (worker lifecycle)",
+  });
+  registerStatusCommand(program);
+  registerLogsCommand(program);
+  registerReviewCommand(program);
 
   return program;
 }
diff --git a/src/main.ts b/src/main.ts
index 16ab70b..5eb0ec8 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,43 +1,17 @@
 /**
- * `main.ts` — top-level entry point do hdd-worker.
+ * `main.ts` — entry point alternativo; delega para o CLI Commander.
  *
- * Story 1.a.7 (Q-A7-5 [RESOLVED — process.exit(1) directo]).
+ * Story 2.1 (Q-2.1-1 — unificar entry, fecha O-C1-1): em vez de um `bootstrap()`
+ * implícito (que não servia `/healthz` nem subcomandos), delega para `createCli()`
+ * — o MESMO entry que o `build` compila e o systemd corre via `dist/hdd-worker`.
+ * Assim `bun src/main.ts` mostra `--help` e o daemon arranca com `start`, sem
+ * divergência entre `dev` e produção.
  *
- * Em err do `bootstrap()`, escreve a mensagem amigável para stderr e chama
- * `process.exit(1)`. NÃO usa `throw` — `process.exit` é syscall, não atinge
- * o lint `no-restricted-syntax: ThrowStatement` (AO-66).
- *
- * Em ok, escreve "hdd-worker started" para stdout. O processo mantém-se vivo
- * via os listeners SIGTERM/SIGINT armed pelo `createShutdownHandler.arm()`
- * (standard Node.js behaviour: process não termina enquanto há listeners
- * registados em event emitters).
- *
- * `import.meta.main` guard permite import do `bootstrap` em tests sem
- * auto-executar este bloco.
+ * `import.meta.main` guard permite import em tests sem auto-executar parse.
  */
 
-import { type BootError, bootstrap } from "./bootstrap.ts";
-
-function formatBootError(e: BootError): string {
-  switch (e.kind) {
-    case "BootEnvInvalid":
-      return e.inner.formatted;
-    case "BootDbFailure":
-      return `db init failed: ${String(e.cause)}`;
-    case "BootMigrationFailure":
-      return `migration failed: ${JSON.stringify(e.inner)}`;
-    case "BootAuditFailure":
-      return `audit init failed: ${JSON.stringify(e.inner)}`;
-    case "BootSandboxImageMissing":
-      return `sandbox image missing: ${e.image} — corre scripts/prepull-sandbox-image.sh`;
-  }
-}
+import { createCli } from "./cli/hdd-worker.ts";
 
 if (import.meta.main) {
-  const result = bootstrap();
-  if (result.isErr()) {
-    process.stderr.write(`${formatBootError(result.error)}\n`);
-    process.exit(1);
-  }
-  process.stdout.write("hdd-worker started\n");
+  void createCli().parseAsync(process.argv);
 }

```

---

→ Aprovar: `hdd-worker review approve story-2-1` · Pedir alterações: `hdd-worker review request-changes story-2-1 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-2-1 --reason "<razão>"`

