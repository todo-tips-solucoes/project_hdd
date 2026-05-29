# Story 1.c.1: systemd unit Type=simple + /healthz endpoint

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador` (operations),
I want uma systemd unit `hdd-worker.service` (`Type=simple`) + um endpoint Hono `/healthz` pollável por Healthchecks.io,
so that o worker é supervisionado **sem `sd_notify`** (gotcha do Bun) e eu sou notificado em flap (AR-020, NFR-P1; D-04.14).

## Acceptance Criteria

1. **(binary — NFR-P1)** **Given** o worker arrancado via `hdd-worker start`
   **When** o processo inicializa
   **Then** o servidor HTTP fica a responder em <30s **e** `GET /healthz` devolve `200` com body `{ status: "ok", uptime: <segundos> }` (uptime cresce monotonicamente).

2. **(binary — handler)** **Given** o handler `/healthz`
   **When** é invocado (via `app.request('/healthz')` em unit-test e via `fetch` real a um `Bun.serve` efémero em integração — D-053)
   **Then** responde `200 application/json` com `status:"ok"` e `uptime` ≥ 0; qualquer outra rota → `404`.

3. **(binary — systemd canon)** **Given** `systemd/hdd-worker.service`
   **When** é inspeccionada
   **Then** tem `Type=simple` (NÃO `notify`), **sem** `WatchdogSec`, `Restart=on-failure`, `EnvironmentFile=/etc/hdd/secrets.env`, `User=hdd-worker`, e `ExecStartPost` que faz poll a `/healthz` (espelha architecture.md:687-712).

4. **(deferido/documentado — depende de E3)** **Given** deadlock simulado **When** Healthchecks.io timeout 60s **Then** alerta WhatsApp `hdd_heartbeat`. ⚠️ O canal WhatsApp (E3) ainda não existe → AC documentado no runbook como configuração externa (Healthchecks.io URL + template Meta); a parte **verificável agora** é o `/healthz` pollável (AC1/AC2).

## Tasks / Subtasks

- [x] **Task 0 — dep Hono** (AC: #1, #2) — `bun add hono` → **hono@4.12.23** (zero-dep). package.json + bun.lock.
- [x] **Task 1 — `src/cli/healthz.handler.ts` (NEW)** (AC: #1, #2) — `createHealthzApp({ clock, bootEpochMs }): Hono`; `GET /healthz` → `{status:"ok", uptime}`; outras → 404. Injectável, testável sem servidor.
- [x] **Task 2 — `src/cli/hdd-worker.ts` (MODIFY)** (AC: #1) — `registerStartCommand`: `start [--port]` → `bootstrap()` daemon → `createHealthzApp` → `Bun.serve({port, fetch: app.fetch})`. `review` + `import.meta.main` preservados. `formatBootError` inclui `BootSandboxImageMissing`. Build → compila `hdd-worker.ts` (Q-C1-2).
- [x] **Task 3 — `systemd/hdd-worker.service` + `.env.example` (NEW)** (AC: #3) — espelha architecture:687-712; `Type=simple`, sem `WatchdogSec`, `ExecStart=/opt/hdd/dist/hdd-worker start`, `ExecStartPost` poll `/healthz` (Q-C1-3 binário directo).
- [x] **Task 4 — `tests/cli/healthz.test.ts` (NEW)** (AC: #2) — 3 specs mock: 200+shape, uptime cresce (`advance`), 404.
- [x] **Task 5 — `tests/integration/healthz.integration.test.ts` (NEW)** (AC: #1, #2; D-053) — `Bun.serve` porta 0 + `fetch` real → 200 JSON + 404; `server.stop()` no fim.
- [x] **Task 6 — `docs/runbooks/systemd-deploy.md` (NEW)** (AC: #3, #4) — deploy (build/secrets/unit/verify), Healthchecks.io+WhatsApp (AC4 deferido E3), troubleshooting.
- [x] **Task 7 — gates**: type-check clean · lint exit 0 · `bun test` 270 pass/1 skip/0 fail · `test:integration` 11 specs. **Smoke real:** binário compilado `start` → boota + LISTEN :8199 + log "started".
- [x] **Task 8 (FINAL) — Tier-B summary via generator (8ª dogfood)**: `scripts/generate-1c1-summary.ts` + `finalize()` → auto-commit. Sprint-status `1-c-1 → review`.

## Dev Notes

### Big picture

1ª story do Epic 1.c (Bootstrap & Operations). Torna o worker **supervisionável em produção**: systemd arranca-o, e como o Bun **não suporta `sd_notify`** (gotcha confirmado, D-04.14), a saúde é exposta por HTTP `/healthz` + poll externo (Healthchecks.io) em vez de `Type=notify`/`WatchdogSec`. É o 1º servidor HTTP do HDD (Hono).

### Scope delimitation (LER)

- **IN-SCOPE:** handler `/healthz` (Hono) + `hdd-worker start` que boota e serve + systemd unit canónica + runbook + testes (unit mock + **integração real fetch**, D-053).
- **OUT-OF-SCOPE / DIFERIDO:**
  - **AC4 (Healthchecks.io + WhatsApp `hdd_heartbeat`)** — o canal WhatsApp é **E3** (não existe). Documentado no runbook como config externa; o gancho verificável agora é o `/healthz`.
  - **`litestream run --` no ExecStart** — Story 1.c.3. Agora ExecStart chama o binário directo (Q-C1-3).
  - **EnvironmentFile 0600 / user `hdd-worker` provisioning** — Story 1.c.2 (secrets). O `.env.example` só documenta.
  - Rotas `/callback`/`/confirmation` (webhook) — Epic 3.

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **AR-020 / D-04.14** | `sd_notify` → HTTP `/healthz` (Bun gotcha) | `healthz.handler.ts` + `Type=simple` |
| **NFR-P1** | cold start ≤30s | `start` boota rápido; binário compilado (D-04.15) no deploy |
| **AO-20** | Heartbeat Healthchecks.io + WhatsApp (default 4h) | runbook (AC4 deferido E3) |
| **AO-16** | user não-privilegiado + EnvironmentFile | unit `User=hdd-worker` + `.env.example` (provisioning → 1.c.2) |

### Current state do ficheiro MODIFY

- **`src/cli/hdd-worker.ts`** — Commander root (1.a.8); só regista `review`; docstring diz "Story 2.1 vai expandir com start/stop". **Delta:** `registerStartCommand` que boota daemon + serve `/healthz`. Preservar `review` + `import.meta.main`. (Nota: a 1.c.1 antecipa o `start` que a 1.a.8 atribuía à 2.1 — registar isso.)
- **`src/bootstrap.ts`** — `bootstrap(deps): Result<BootResult,BootError>` síncrono, daemon-mode arma shutdown + ProcessStarted; tem `sandboxImageCheck` (corre fora de cliMode → o `start` real vai exigir a sandbox image presente, OU passa-se um stub/flag; ver Q-C1-2). `BootResult` traz `{ db, audit, shutdown, bootRunId }`.

### Esboços de tipos

```ts
// src/cli/healthz.handler.ts
import { Hono } from "hono";
export function createHealthzApp(deps: { clock: ClockPort; bootEpochMs: number }): Hono;
// GET /healthz -> 200 { status: "ok", uptime: number }

// src/cli/hdd-worker.ts (start)
program.command("start").option("--port <n>", "...").action(async () => {
  const boot = bootstrap();                 // daemon
  if (boot.isErr()) { process.stderr.write(...); process.exit(1); }
  const app = createHealthzApp({ clock: createSystemClockAdapter(), bootEpochMs: Date.now() });
  Bun.serve({ port: Number(process.env["PORT"] ?? 8080), fetch: app.fetch });
});
```

### Previous story intelligence
- **1.a.8 (CLI):** Commander root + `registerXCommand(program)`; `program.exitOverride()` + `requiredOption()` em tests.
- **1.a.7 (bootstrap):** sync; daemon arma shutdown; `main.ts` é o entry daemon alternativo (este `start` é o caminho CLI — ver Q-C1-2 sobre qual vira canónico p/ o binário compilado).
- **1.b.4 (sandbox/spawn):** `createSystemSpawnAdapter` real existe agora; `bootstrap()` non-cliMode corre `checkSandboxImageSync` → em dev/test sem docker, passar `sandboxImageCheck: () => ok(true)` ou `cliMode`. **Atenção** no `start`.
- **D-053 (integração real):** esta story estreia o padrão "unit mock + integração real" de raiz — `tests/integration/healthz.integration.test.ts` com `Bun.serve` efémero.

### Anti-pattern guardrails (NÃO fazer)
- ❌ **NÃO** usar `Type=notify`/`WatchdogSec` (Bun não tem `sd_notify` — D-04.14). `Type=simple` + `/healthz` polling.
- ❌ **NÃO** `bun run` interpreted no ExecStart de produção (viola NFR-P1; D-04.15 → binário compilado). O `.service` aponta para `dist/hdd-worker`.
- ❌ **NÃO** ler `process.env.PORT` com dot-access (`noPropertyAccessFromIndexSignature` → bracket `process.env["PORT"]` ou destructuring).
- ❌ **NÃO** usar `setTimeout`/`setInterval` globais em `src/core/**` (irrelevante aqui — isto é CLI/shell).
- ❌ **NÃO** deixar o `Bun.serve` sem fecho nos testes de integração (vaza porta) — guardar o handle e `.stop()` no fim.
- ❌ **NÃO** exceder Biome `maxLines:200` em `src/**`.
- ❌ **NÃO** instalar Hono sem OK do operador (Q-C1-1).

### Project Structure Notes
- NEW: `src/cli/healthz.handler.ts`, `tests/cli/healthz.test.ts`, `tests/integration/healthz.integration.test.ts`, `systemd/hdd-worker.service`, `systemd/hdd-worker.env.example`, `docs/runbooks/systemd-deploy.md`.
- MODIFY: `src/cli/hdd-worker.ts`, `package.json` (+hono), `bun.lock`.
- `systemd/` e `docs/runbooks/` são pastas novas.

### References
- [Source: epics.md#Story-1.c.1] — StorySpec, ACs, files, blocked_by [1.a.7].
- [Source: architecture.md:687-712] — systemd unit canónica (Type=simple, ExecStartPost /healthz, sem WatchdogSec).
- [Source: architecture.md:504] — D-04.14 sd_notify → /healthz. [:505] D-04.15 compile.
- [Source: src/cli/hdd-worker.ts] — ficheiro MODIFY. [src/bootstrap.ts] — boot daemon.
- [Memory: project-hdd-bun-sd-notify-gotcha] — Type=simple + /healthz + Healthchecks.io.

## Open Questions for Operator

- **Q-C1-1 (dep Hono):** [RESOLVED — `bun add hono`] stack canónico; serve também rotas Epic 3.
- **Q-C1-2 (entry daemon):** [RESOLVED — `hdd-worker start` (CLI)] launcher daemon; systemd chama `dist/hdd-worker start`; build compila `hdd-worker.ts`.
- **Q-C1-3 (litestream no unit):** [RESOLVED — binário directo agora] `litestream run --` na Story 1.c.3 (nota no runbook).
- **Q-C1-4 (sandbox no `start`):** [RESOLVED — exigir image, fail-closed] runbook manda correr `prepull-sandbox-image.sh` antes do `systemctl start`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `bun add hono` → 4.12.23 (zero-dep).
- type-check: 1 erro — `Server` (de "bun") é genérico → trocado por `ReturnType<typeof Bun.serve>` no test. Clean depois.
- lint: 1 erro real — `server.stop(true)` no `afterAll` é floating promise (`no-floating-promises`) → `afterAll(async … await server.stop())`. Depois exit 0.
- `bun test` 270 pass / 1 skip / 0 fail (was 265; +5: 3 healthz unit + 2 healthz integração). `test:integration` 11 specs (3 ficheiros).
- **Smoke do binário compilado:** `bun run build` (95MB, compila `hdd-worker.ts`) → `./dist/hdd-worker start` → processo RUNNING + `ss` mostra LISTEN :8199 (pid hdd-worker) + log `hdd-worker started — /healthz on :8199`. (curl/fetch inline bloqueados pelo hook context-mode; o HTTP real é provado pela integração `Bun.serve`+`fetch`.)

### Completion Notes List

- **AR-020 / D-04.14 materializado:** `/healthz` HTTP (Hono) + systemd `Type=simple` sem `WatchdogSec` — supervisão por polling, contornando o gotcha sd_notify do Bun.
- **D-053 de raiz:** esta foi a 1ª story a nascer com unit (mock, `app.request`) **+** integração real (`Bun.serve` efémero + `fetch`) desde o início.
- **Q-C1-2:** `hdd-worker start` é o launcher daemon canónico; build agora compila `src/cli/hdd-worker.ts` (não `main.ts`).
- **Fail-closed mantido (Q-C1-4):** `start` corre `bootstrap()` completo → exige sandbox image; runbook manda `prepull-sandbox-image.sh` antes.
- **AC4 deferido (E3):** Healthchecks.io + WhatsApp `hdd_heartbeat` documentados no runbook como config externa; gancho verificável (`/healthz`) entregue.
- **O-C1-1 (follow-up):** `dev` script (`bun --hot src/main.ts`) e o binário (`hdd-worker start`) divergem — `main.ts` não serve `/healthz`. Alinhar `dev` para `bun --hot src/cli/hdd-worker.ts start` OU consolidar entries numa story de limpeza.

### File List

- `src/cli/healthz.handler.ts` (NEW)
- `src/cli/hdd-worker.ts` (MODIFY — +start, +formatBootError)
- `systemd/hdd-worker.service` (NEW) · `systemd/hdd-worker.env.example` (NEW)
- `tests/cli/healthz.test.ts` (NEW, 3 specs)
- `tests/integration/healthz.integration.test.ts` (NEW, 2 specs)
- `docs/runbooks/systemd-deploy.md` (NEW)
- `package.json` (MODIFY — +hono, build → hdd-worker.ts) · `bun.lock` (MODIFY)
- `scripts/generate-1c1-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.c.1 criada (`ready-for-dev`); 4 Open Questions resolvidas (todas Recommended; OK p/ Hono). |
| 2026-05-29 | Implementação completa: Hono `/healthz` + `hdd-worker start` daemon + systemd unit + runbook + 5 specs (unit+integração real D-053) + binário compilado smoke (LISTEN verificado). type-check/lint/test verdes (270 pass). AR-020/NFR-P1/D-04.14. Status → `review`. |
