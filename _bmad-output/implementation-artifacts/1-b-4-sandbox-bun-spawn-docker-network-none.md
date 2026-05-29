# Story 1.b.4: Sandbox Bun.spawn docker --network=none

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `Dev sub-agent`,
I want executar código LLM-generated dentro de `docker run --rm --network=none` com user não-privilegiado, image pre-pulled e hardening (cap-drop, no-new-privileges, read-only, pids-limit),
so that o código gerado não consegue exfiltrar dados pela rede nem aceder ao host filesystem fora do mount declarado (AR-015 + AO-47, DRB safety).

## Acceptance Criteria

1. **(binary — `--network=none`)** **Given** um sandbox que corre um script com `curl https://example.com`
   **When** o spawn completa
   **Then** o exit code é ≠ 0 (network unreachable) — garantido por o comando docker construído **conter sempre** `--network=none`.

2. **(binary — fail-closed)** **Given** a sandbox image NÃO está pre-pulled
   **When** o worker arranca (boot, não-CLI)
   **Then** o boot falha com `err({ kind: 'BootSandboxImageMissing', image })` em **<500ms** (verificação síncrona com timeout; fail-closed).

3. **(coverage — Pentest PT-1 escapes)** **Given** vectores de escape (volume mount host, `--privileged`/`--cap-add`, `--pid=host`, `no-new-privileges` ausente)
   **When** o suite corre
   **Then** 0/N escapes possíveis — o comando construído **nunca** inclui flags perigosas E **sempre** inclui as protectoras.

## Tasks / Subtasks

- [x] **Task 1 — `src/ports/sandbox.port.ts` (NEW)** (AC: #1, #3) — `SandboxPort.runInSandbox`; tipos + `SandboxError` (SpawnError | SandboxImageMissing | **UnsafeMount** — AO-174 arg-injection).
- [x] **Task 2 — `src/adapters/sandbox/docker-spawn.adapter.ts` (NEW)** (AC: #1, #2, #3) — `buildDockerArgs` (hardened); `checkSandboxImageSync` (Bun.spawnSync inspect, 400ms); `isSafeMountDir`; `createDockerSandboxAdapter` (valida mount → err UnsafeMount; `deps.spawn.spawn(...)`).
- [x] **Task 3 — `docker/sandbox/Dockerfile` (NEW)** (AC: #1, #3) — `alpine:3.20` + `USER 65534:65534`, sem curl/wget (defesa em profundidade), threat-model documentado.
- [x] **Task 4 — `scripts/prepull-sandbox-image.sh` (NEW)** (AC: #2) — `docker build` + `image inspect` verify; idempotente; +x.
- [x] **Task 5 — `src/bootstrap.ts` (MODIFY)** (AC: #2) — `sandboxImageCheck?` injectável (default `checkSandboxImageSync(SANDBOX_IMAGE)`); passo 1b após env, skip cliMode, antes da db; `BootError` +`BootSandboxImageMissing`. Contrato sync preservado.
- [x] **Task 6 — `src/main.ts` (MODIFY)** (AC: #2) — `case "BootSandboxImageMissing"` no `formatBootError`.
- [x] **Task 7 — `tests/adapters/sandbox.security.test.ts` (NEW)** (AC: #1–3) — 21 specs: spawn spy + AC1 (--network=none) + escape table (7 forbidden / 5 required + non-root) + mount policy + UnsafeMount + AC2 boot fail-closed (<500ms) + ok-path daemon.
- [x] **Task 8 — `.github/workflows/ci.yml` (MODIFY)** (AC: #2) — step prepull best-effort (`|| echo skip`; testes mock-only).
- [x] **Task 9 — gates**: type-check clean · lint exit 0 · `bun test` 226 pass/0 fail. Regressão bootstrap (1.a.7) corrigida: +`sandboxImageCheck: () => ok(true)` nas 5 chamadas VALID_KEY.
- [x] **Task 10 (FINAL) — Tier-B summary via generator (6ª dogfood)**: `scripts/generate-1b4-summary.ts` + `finalize()` → auto-commit `summary(story-1b4): ...`. Sprint-status `1-b-4 → review`.

## Dev Notes

### Big picture

4ª das 5 stories do Epic 1.b. Fecha o vector de execução: código gerado por LLM corre **dentro de um container docker endurecido** (`--network=none` + non-root + cap-drop + read-only), não no host. Combina com 1.b.1 (path safety dos writes) para conter o blast-radius de qualquer código malicioso/buggy. AR-015 (sandbox) + AO-47 (non-privileged) + AO-174 (realpath nos `-v` args, herdado de path-sanitize 1.b.1).

### Scope delimitation (LER — crítico)

- **IN-SCOPE:** o port + adapter que **constrói o comando docker endurecido** e o invoca via `SpawnPort` (1.a.3); verificação fail-closed da image no boot; Dockerfile mínimo + script de prepull; suite de segurança que **assere a construção dos args** (mock-only, CI-safe).
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Execução real de docker nos testes unit** — política mock-only (1.a.10): sem docker real em CI. Os testes asseram que o comando é inescapável por construção + simulam outcomes via spawn spy. A **execução real dos escapes PT-1** (curl bloqueado de facto, escape de volume, etc.) é validada em **Story 1.b.5** (PT-1..PT-8 com docker presente) e/ou run de integração manual do operador.
  - Worker loop que invoca o sandbox no fluxo real (Epic 4.x orquestração).
  - `--memory`/`--pids-limit` tuning fino — valores conservadores agora.

### AO / requirement matrix

| Código | Obrigação | Onde nesta story |
|---|---|---|
| **AR-015** | Sandbox de execução de código LLM-generated | port + docker-spawn adapter |
| **AO-47** | User não-privilegiado + image pre-pulled | `--user 65534:65534` + `checkSandboxImageSync` boot |
| **AO-174** (1.b.1) | realpath nos `-v`/mount args (anti `../`) | reusar `sanitizeRelPath` no mountDir |
| **NFR-S3** (epics-only) | rótulo; canon = AR-015/AO-47 (O-A6-6) | nota reconciliação |
| **Pentest PT-1** (label) | escape attempts 0/N | escape-table no security test |

> **Nota numeração PT (O-B1-1 acumula):** epics rotula "PT-1"; `architecture.md:1971` define PT-1 = rate-limit inbound. Label material implementado; reconciliação no follow-up (Story 1.b.5 vai materializar `docs/pre-m1-pentest-tasks.md`).

### Current state dos ficheiros MODIFY

- **`src/bootstrap.ts`** — `bootstrap(deps): Result<BootResult, BootError>` **síncrono**, 4 passos (env→db→audit→shutdown), `cliMode` skipa shutdown.arm()+ProcessStarted. **Delta:** injectar `sandboxImageCheck` (default sync `Bun.spawnSync docker image inspect`) corrido após env, skip em cliMode; novo `BootError` variant. **Preservar** o contrato sync — por isso `Bun.spawnSync` (não `SpawnPort` async).
- **`src/main.ts`** — `formatBootError` tem `switch` **exaustivo**. **Delta:** +1 `case "BootSandboxImageMissing"`. Sem isto, type-check falha (exhaustiveness).
- **`.github/workflows/ci.yml`** — criado na 1.b.3 (lint/typecheck/test + verify-redaction + truffleHog). **Delta:** +step prepull (best-effort).

### Esboços de tipos

```ts
// src/ports/sandbox.port.ts
export type SandboxRunRequest = {
  readonly script: string;
  readonly mountDir?: string;
  readonly mountWritable?: boolean;
  readonly timeoutMs?: number;
};
export type SandboxResult = { readonly stdout: string; readonly stderr: string; readonly exitCode: number };
export type SandboxImageMissing = { readonly kind: "SandboxImageMissing"; readonly image: string };
export type SandboxError = SpawnError | SandboxImageMissing;
export interface SandboxPort {
  runInSandbox(req: SandboxRunRequest): ResultAsync<SandboxResult, SandboxError>;
}

// adapter
export const SANDBOX_IMAGE = "hdd-sandbox:0.0.1";
export function buildDockerArgs(req: SandboxRunRequest, image: string): string[];
export function checkSandboxImageSync(image: string): Result<true, SandboxImageMissing>;
export function createDockerSandboxAdapter(deps: { spawn: SpawnPort; image: string }): SandboxPort;
```

### Previous story intelligence

- **1.a.3 (spawn):** `SpawnPort.spawn(cmd, args, opts): ResultAsync<SpawnResult, SpawnError>`; `createFakeSpawnAdapter` NÃO captura args → construir **spawn spy** próprio no test file (regista cmd/args/opts).
- **1.b.1 (path-sanitize):** reusar `sanitizeRelPath` p/ validar `mountDir` antes de o passar a `-v`/mount (AO-174 — evita `../` no bind).
- **1.b.3 (ci.yml):** workflow já existe; só adicionar 1 step. **Push de `.github/workflows/` exige scope `workflow`** ([[project-hdd-git-workflow-scope]]) — operador corre `gh auth refresh -s workflow` antes do push (já feito esta sessão; scope persiste).
- **1.a.7/1.a.8 (bootstrap):** sync contract, `cliMode` gating, `BootError` union + `main.ts` switch exaustivo.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** tornar `bootstrap()` async — usar `Bun.spawnSync` (sync) p/ o image check, com `timeout` curto (<500ms AC2).
- ❌ **NÃO** correr docker real nos testes unit (mock-only; CI sem docker garantido). Spy + asserção de args.
- ❌ **NÃO** construir o comando com string concat (shell injection) — array de args para `Bun.spawn`/`SpawnPort`, nunca `sh -c "<interpolado>"` com input não-validado no próprio array docker.
- ❌ **NÃO** omitir nenhuma flag protectora nem permitir override que reintroduza `--privileged`/`--cap-add`/`--pid=host`.
- ❌ **NÃO** montar o mount como `rw` por defeito (Q-B4-3 = `ro`); writable só com opt-in explícito.
- ❌ **NÃO** esquecer o `case` novo em `main.ts` (exhaustiveness).
- ❌ **NÃO** exceder `maxLines: 200` (Biome HARD em `src/**`).

### Project Structure Notes

- NEW: `src/ports/sandbox.port.ts`, `src/adapters/sandbox/docker-spawn.adapter.ts`, `docker/sandbox/Dockerfile`, `scripts/prepull-sandbox-image.sh`, `tests/adapters/sandbox.security.test.ts`.
- MODIFY: `src/bootstrap.ts`, `src/main.ts` (exhaustiveness), `.github/workflows/ci.yml`.
- `src/adapters/sandbox/` é nova pasta de adapter (segue layout `adapters/<name>/<name>.adapter.ts`).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.b.4] — StorySpec, ACs, files, blocked_by [1.a.3].
- [Source: src/ports/spawn.port.ts] — SpawnPort (injecção).
- [Source: src/adapters/spawn/fake-spawn.adapter.ts] — fake (não captura args → spy próprio).
- [Source: src/bootstrap.ts] — ficheiro MODIFY (sync, 4 passos, cliMode).
- [Source: src/main.ts:21] — formatBootError switch exaustivo (MODIFY).
- [Source: architecture.md — AR-015/AO-47/AO-174] — sandbox + non-priv + realpath mount.

## Open Questions for Operator

- **Q-B4-1 (image check no boot):** [RESOLVED — `Bun.spawnSync` sync] `docker image inspect` com timeout 400ms; mantém bootstrap sync; injectável.
- **Q-B4-2 (base image):** [RESOLVED — Dockerfile próprio alpine] `alpine:3.20` + `USER 65534`, tag `hdd-sandbox:0.0.1`; prepull = `docker build`.
- **Q-B4-3 (mount policy):** [RESOLVED — read-only por defeito] `,ro`; writable só com `mountWritable:true`.
- **Q-B4-4 (teste real de docker):** [RESOLVED — mock-only agora] spawn spy + asserção de args; escapes reais PT-1 na Story 1.b.5/integração.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- type-check: 1 erro inicial — `deps.spawn(...)` (SpawnPort é objecto) → `deps.spawn.spawn(...)`. Depois clean.
- sandbox tests: 21 pass.
- full suite: **regressão apanhada** — os 14 testes de bootstrap (1.a.7) chamavam `bootstrap()` sem o novo check → o default `checkSandboxImageSync` falhava (sem docker no test env) → BootSandboxImageMissing. Fix: `+sandboxImageCheck: () => ok(true)` (replace_all) nas 5 chamadas com VALID_KEY + import `ok`. Depois 226 pass/0 fail.
- lint: format auto-fix; exit 0 (23 infos `useLiteralKeys` pré-existentes).

### Completion Notes List

- **AR-015 + AO-47** materializados: comando docker endurecido inescapável por construção (`--network=none` + non-root 65534 + `--cap-drop=ALL` + `no-new-privileges` + `--read-only` + pids/memory limits + `--rm`).
- **AC2 fail-closed sem quebrar o contrato sync** do bootstrap: `Bun.spawnSync docker image inspect` (timeout 400ms), injectável p/ tests. Skip em `cliMode`.
- **AO-174 herdado:** `isSafeMountDir` rejeita `:`/`,`/espaços/`..`/relativo no mountDir antes do `--mount` → `err UnsafeMount`, nunca chega ao spawn (anti arg-injection).
- **Mock-only (Q-B4-4):** spawn spy assere a construção; **a execução real dos escapes PT-1 (curl bloqueado de facto, escape de volume/cap) fica para a Story 1.b.5/integração com docker presente** — esta story prova que o comando é seguro por construção, não que o docker do host o respeita.
- **main.ts** exhaustiveness: +1 case (sem isto type-check falhava).
- Push deste commit toca `.github/workflows/` → exige scope `workflow` (já refrescado esta sessão; ver [[project-hdd-git-workflow-scope]]).

### File List

- `src/ports/sandbox.port.ts` (NEW)
- `src/adapters/sandbox/docker-spawn.adapter.ts` (NEW, ~95L)
- `docker/sandbox/Dockerfile` (NEW)
- `scripts/prepull-sandbox-image.sh` (NEW, +x)
- `tests/adapters/sandbox.security.test.ts` (NEW, 21 specs)
- `src/bootstrap.ts` (MODIFY — sandbox check + BootError)
- `src/main.ts` (MODIFY — switch case)
- `tests/bootstrap.test.ts` (MODIFY — sandboxImageCheck stub nas 5 chamadas)
- `.github/workflows/ci.yml` (MODIFY — prepull step)
- `scripts/generate-1b4-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.b.4 criada (`ready-for-dev`); 4 Open Questions resolvidas (todas Recommended). |
| 2026-05-29 | Implementação completa: sandbox port + docker-spawn adapter (hardened) + Dockerfile + prepull + 21 specs + boot fail-closed + ci.yml step. Regressão bootstrap 1.a.7 corrigida. type-check/lint/test verdes (226 pass). AR-015/AO-47 materializados. Status → `review`. |
