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
workflowId: story-1b4
workflowName: Story 1.b.4 — Sandbox Bun.spawn docker --network=none
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.b.4 — Sandbox Bun.spawn docker --network=none · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

4ª story do Epic 1.b (Safety). Código LLM-generated passa a correr dentro de docker run endurecido (--network=none + non-root + cap-drop + read-only), não no host. Combina com 1.b.1 (path safety) para conter o blast-radius. AR-015 + AO-47.

## O que foi feito

- **src/ports/sandbox.port.ts** — SandboxPort + tipos; SandboxError = SpawnError|SandboxImageMissing|UnsafeMount.
- **src/adapters/sandbox/docker-spawn.adapter.ts** — ~95L. buildDockerArgs hardened; checkSandboxImageSync (Bun.spawnSync inspect 400ms); isSafeMountDir (AO-174); factory injecta SpawnPort.
- **docker/sandbox/Dockerfile** — alpine:3.20 + USER 65534, sem ferramentas de rede.
- **scripts/prepull-sandbox-image.sh** — docker build + inspect verify; idempotente.
- **tests/adapters/sandbox.security.test.ts** — 21 specs: AC1/AC2/AC3 escape table; spawn spy.
- **src/bootstrap.ts + src/main.ts** — MODIFY: image fail-closed (BootSandboxImageMissing) + switch case.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Image check sync via Bun.spawnSync. | Mantém bootstrap() sync; <500ms; injectável. | Q-B4-1 |
| 2 | Dockerfile próprio alpine:3.20 + USER 65534. | Controlo do threat-model; tag hdd-sandbox:0.0.1. | Q-B4-2 |
| 3 | Mount read-only por defeito (rw opt-in). | Menor privilégio; código LLM não escreve no host sem opt-in. | Q-B4-3 |
| 4 | Mock-only nos testes unit. | Política 1.a.10; sem docker no CI; spawn spy assere args. | Q-B4-4 |
| 5 | +UnsafeMount no SandboxError. | AO-174: mountDir com :/,/espaço/.. é vector de escape; rejeitar antes do spawn. | — |

## Trade-offs aplicados

- Quis bootstrap async para usar SpawnPort, fiquei com Bun.spawnSync (Q-B4-1): refactor do contrato sync tocaria main.ts + 14 testes 1.a.7.
- Quis escapes reais no CI, fiquei com mock-only (Q-B4-4): docker no CI viola política + flakiness; PT-1 real fica para 1.b.5.

## Open items deferidos

- **O-B4-1:** Execução REAL dos escapes PT-1 (curl bloqueado, escape de volume/cap/pid) com docker presente — Story 1.b.5/integração.
- **O-B4-2:** Wiring do sandbox no worker loop real (Epic 4.x orquestração).
- **O-B4-3:** Tuning de --memory/--pids-limit por workload — valores conservadores agora.
- **O-B1-1 acumula:** Numeração PT (epics PT-1 vs architecture) — Story 1.b.5 materializa docs/pre-m1-pentest-tasks.md.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 226 pass / 0 fail (was 205; +21)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Linhas novas:** ~95 adapter + port + Dockerfile + script + 21 specs
- **Deps adicionadas:** 0
- **Regressão corrigida:** bootstrap 1.a.7 — +sandboxImageCheck stub nas 5 chamadas VALID_KEY
- **Token usage approx:** dentro estimated 64-96K

## Próximos passos sugeridos

1. Operador aprova `approve story-1b4` → marco done + commit. Mensagem: `feat(story-1b4): sandbox docker --network=none (3 ACs verde; isolamento exec)`. Push toca .github/workflows → scope workflow já refrescado.
2. Sprint 0: 15/22 done. Epic 1.b: 4/5. Última: Story 1.b.5 (8 Pentest Tasks PT-1..PT-8 — reconcilia numeração PT, fecha O-B1-1).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1b4` · Pedir alterações: `hdd-worker review request-changes story-1b4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b4 --reason "<razão>"`


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
workflowId: story-1b4
workflowName: Story 1.b.4 — Sandbox Bun.spawn docker --network=none
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.b.4 — Sandbox Bun.spawn docker --network=none

### Contexto detalhado

4ª story do Epic 1.b (Safety). Código LLM-generated passa a correr dentro de docker run endurecido (--network=none + non-root + cap-drop + read-only), não no host. Combina com 1.b.1 (path safety) para conter o blast-radius. AR-015 + AO-47.

### O que foi feito (verbose)

- **src/ports/sandbox.port.ts** — SandboxPort + tipos; SandboxError = SpawnError|SandboxImageMissing|UnsafeMount.
- **src/adapters/sandbox/docker-spawn.adapter.ts** — ~95L. buildDockerArgs hardened; checkSandboxImageSync (Bun.spawnSync inspect 400ms); isSafeMountDir (AO-174); factory injecta SpawnPort.
- **docker/sandbox/Dockerfile** — alpine:3.20 + USER 65534, sem ferramentas de rede.
- **scripts/prepull-sandbox-image.sh** — docker build + inspect verify; idempotente.
- **tests/adapters/sandbox.security.test.ts** — 21 specs: AC1/AC2/AC3 escape table; spawn spy.
- **src/bootstrap.ts + src/main.ts** — MODIFY: image fail-closed (BootSandboxImageMissing) + switch case.

### Full file list

- **src/ports/sandbox.port.ts** — SandboxPort + tipos; SandboxError = SpawnError|SandboxImageMissing|UnsafeMount.
- **src/adapters/sandbox/docker-spawn.adapter.ts** — ~95L. buildDockerArgs hardened; checkSandboxImageSync (Bun.spawnSync inspect 400ms); isSafeMountDir (AO-174); factory injecta SpawnPort.
- **docker/sandbox/Dockerfile** — alpine:3.20 + USER 65534, sem ferramentas de rede.
- **scripts/prepull-sandbox-image.sh** — docker build + inspect verify; idempotente.
- **tests/adapters/sandbox.security.test.ts** — 21 specs: AC1/AC2/AC3 escape table; spawn spy.
- **src/bootstrap.ts + src/main.ts** — MODIFY: image fail-closed (BootSandboxImageMissing) + switch case.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Image check sync via Bun.spawnSync. | Mantém bootstrap() sync; <500ms; injectável. | Q-B4-1 |
| 2 | Dockerfile próprio alpine:3.20 + USER 65534. | Controlo do threat-model; tag hdd-sandbox:0.0.1. | Q-B4-2 |
| 3 | Mount read-only por defeito (rw opt-in). | Menor privilégio; código LLM não escreve no host sem opt-in. | Q-B4-3 |
| 4 | Mock-only nos testes unit. | Política 1.a.10; sem docker no CI; spawn spy assere args. | Q-B4-4 |
| 5 | +UnsafeMount no SandboxError. | AO-174: mountDir com :/,/espaço/.. é vector de escape; rejeitar antes do spawn. | — |

### Trade-offs aplicados (narrativa)

- Quis bootstrap async para usar SpawnPort, fiquei com Bun.spawnSync (Q-B4-1): refactor do contrato sync tocaria main.ts + 14 testes 1.a.7.
- Quis escapes reais no CI, fiquei com mock-only (Q-B4-4): docker no CI viola política + flakiness; PT-1 real fica para 1.b.5.

### Open items deferidos (com onde serão resolvidos)

- **O-B4-1:** Execução REAL dos escapes PT-1 (curl bloqueado, escape de volume/cap/pid) com docker presente — Story 1.b.5/integração.
- **O-B4-2:** Wiring do sandbox no worker loop real (Epic 4.x orquestração).
- **O-B4-3:** Tuning de --memory/--pids-limit por workload — valores conservadores agora.
- **O-B1-1 acumula:** Numeração PT (epics PT-1 vs architecture) — Story 1.b.5 materializa docs/pre-m1-pentest-tasks.md.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 226 pass / 0 fail (was 205; +21)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Linhas novas:** ~95 adapter + port + Dockerfile + script + 21 specs
- **Deps adicionadas:** 0
- **Regressão corrigida:** bootstrap 1.a.7 — +sandboxImageCheck stub nas 5 chamadas VALID_KEY
- **Token usage approx:** dentro estimated 64-96K

### Próximos passos sugeridos

1. Operador aprova `approve story-1b4` → marco done + commit. Mensagem: `feat(story-1b4): sandbox docker --network=none (3 ACs verde; isolamento exec)`. Push toca .github/workflows → scope workflow já refrescado.
2. Sprint 0: 15/22 done. Epic 1.b: 4/5. Última: Story 1.b.5 (8 Pentest Tasks PT-1..PT-8 — reconcilia numeração PT, fecha O-B1-1).

### Diff vs `HEAD`

```diff
diff --git a/src/bootstrap.ts b/src/bootstrap.ts
index 123c116..98f6d4c 100644
--- a/src/bootstrap.ts
+++ b/src/bootstrap.ts
@@ -28,6 +28,7 @@ import { randomUUID } from "node:crypto";
 
 import { createAuditAdapter } from "./adapters/audit/jsonl-hash-chain.adapter.ts";
 import { createSystemClockAdapter } from "./adapters/clock/system-clock.adapter.ts";
+import { checkSandboxImageSync, SANDBOX_IMAGE } from "./adapters/sandbox/docker-spawn.adapter.ts";
 import { applyMigrations, createDbConnection, type MigrationError } from "./db/connection.ts";
 import { type Env, type EnvValidationError, parseEnv } from "./lib/env.ts";
 import { err, ok, type Result } from "./lib/result.ts";
@@ -57,6 +58,12 @@ export type BootDeps = {
    * 100% com 1.a.7: default `false` mantém behavior daemon.
    */
   readonly cliMode?: boolean;
+  /**
+   * Story 1.b.4 — verificação fail-closed da sandbox image (AO-47). Injectável
+   * p/ tests; default `() => checkSandboxImageSync(SANDBOX_IMAGE)` (Bun.spawnSync
+   * docker image inspect, <500ms). Skip em `cliMode` (CLI não corre sandbox).
+   */
+  readonly sandboxImageCheck?: () => Result<true, { kind: "SandboxImageMissing"; image: string }>;
 };
 
 export type BootResult = {
@@ -71,7 +78,8 @@ export type BootError =
   | { readonly kind: "BootEnvInvalid"; readonly inner: EnvValidationError }
   | { readonly kind: "BootDbFailure"; readonly cause: unknown }
   | { readonly kind: "BootMigrationFailure"; readonly inner: MigrationError }
-  | { readonly kind: "BootAuditFailure"; readonly inner: AuditError };
+  | { readonly kind: "BootAuditFailure"; readonly inner: AuditError }
+  | { readonly kind: "BootSandboxImageMissing"; readonly image: string };
 
 export function bootstrap(deps: BootDeps = {}): Result<BootResult, BootError> {
   // 1. env Zod fail-fast.
@@ -82,6 +90,16 @@ export function bootstrap(deps: BootDeps = {}): Result<BootResult, BootError> {
   const clock = deps.clock ?? createSystemClockAdapter();
   const bootRunId = deps.bootRunId ?? randomUUID();
 
+  // 1b. sandbox image fail-closed (Story 1.b.4, AO-47). Skip em cliMode (CLI
+  //     one-shot não corre sandbox). Antes da db → fail-fast <500ms.
+  if (deps.cliMode !== true) {
+    const imageCheck = deps.sandboxImageCheck ?? (() => checkSandboxImageSync(SANDBOX_IMAGE));
+    const imgR = imageCheck();
+    if (imgR.isErr()) {
+      return err({ kind: "BootSandboxImageMissing", image: imgR.error.image });
+    }
+  }
+
   // 2. db + migrations.
   let db: Database;
   try {

```

---

→ Aprovar: `hdd-worker review approve story-1b4` · Pedir alterações: `hdd-worker review request-changes story-1b4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1b4 --reason "<razão>"`

