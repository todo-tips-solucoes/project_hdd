# Story 1.c.2: Secrets management EnvironmentFile

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador` (operations),
I want secrets em `/etc/hdd/secrets.env` (perm `0600`, user `hdd-worker`, gate no systemd) + validação Zod no boot,
so that segredos nunca aparecem no workspace nem ficam legíveis a outro user na VPS (NFR-S1, AR-019, D-04.6').

## Acceptance Criteria

1. **(binary — perm gate)** **Given** `/etc/hdd/secrets.env` com permissão laxa (`0644`)
   **When** o systemd tenta iniciar
   **Then** a unit **falha** — `ExecStartPre` rejeita perm ≠ `0600` (group/world readable). `ConditionPathExists` cobre o caso de ausência; o gate de permissão é o `ExecStartPre` (Q-C2-2). Em código, `checkSecretsFilePerms` devolve `err({kind:'SecretsFileInsecure'})` (unit-testado).

2. **(binary — Zod typed)** **Given** secrets com `ANTHROPIC_API_KEY=...` válido (+ `CLIHELPER_TOKEN=...` opcional)
   **When** o worker arranca
   **Then** `env.ts` Zod valida e expõe um objecto typed (`ANTHROPIC_API_KEY: string`, `CLIHELPER_TOKEN?: string`).

3. **(binary — sem leak)** **Given** os secrets carregados
   **When** corre qualquer log/audit
   **Then** zero linhas contêm o valor do secret (garantido pela redaction da Story 1.b.3 — `sk-ant-`, Bearer, generic-secret já cobertos; teste de regressão confirma `CLIHELPER_TOKEN` redigido).

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/env.ts` (MODIFY)** (AC: #2, #3) — `CLIHELPER_TOKEN` **required** (msg "CLIHELPER_TOKEN required"); `checkSecretsFilePerms(path, statFn=statSync)` → `SecretsError` (`SecretsFileMissing`/`SecretsFileInsecure`); rejeita `mode & 0o077 !== 0`. Sem throw. **Regressão corrigida:** +`CLIHELPER_TOKEN` em bootstrap.test.ts (5 bootstrap + 2 parseEnv), sandbox.security.test.ts (2), review.test.ts (1).
- [x] **Task 2 — `systemd/hdd-worker.service` (MODIFY)** (AC: #1) — `ExecStartPre` gate `stat 0600`; resto da unit preservado; `.env.example` +`CLIHELPER_TOKEN=`.
- [x] **Task 3 — `scripts/install-secrets.sh` (NEW)** (AC: #1) — install 0600+owner + verify + recusa origem laxa; idempotente; sem `set -x` (não vaza); não cria user.
- [x] **Task 4 — `tests/lib/env-secrets.test.ts` (NEW)** (AC: #1, #2) — 9 specs: parseEnv required (both/missing-clihelper/missing-anthropic) + checkSecretsFilePerms (0600/0400 ok, 0644/0640 insecure, missing, statFn injectável). fs reais.
- [x] **Task 5 — `docs/runbooks/secret-rotation.md` (NEW)** (AC: #1, #3) — install/rotação/revogação, perm 0600, redaction garante audit limpo, troubleshooting.
- [x] **Task 6 — gates**: type-check clean · lint exit 0 · `bun test` 279 pass/1 skip/0 fail · `test:integration` 11 specs · `bash -n` OK.
- [x] **Task 7 (FINAL) — Tier-B summary via generator (9ª dogfood)**: `scripts/generate-1c2-summary.ts` + `finalize()` → auto-commit. Sprint-status `1-c-2 → review`.

## Dev Notes

### Big picture

2ª story de operações do Epic 1.c. Garante que os secrets vivem **fora do repo** (systemd `EnvironmentFile`, não `.env` no workspace), com permissão restrita (`0600`, user dedicado) e validação fail-closed no boot. Complementa a redaction (1.b.3, secrets fora dos logs) e o `/healthz`/unit (1.c.1).

### Scope delimitation (LER)

- **IN-SCOPE:** `CLIHELPER_TOKEN` no schema Zod; `checkSecretsFilePerms` (in-code, testado); `ExecStartPre` perm gate na unit; `install-secrets.sh` (install+verify); runbook de rotação.
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Criação do user `hdd-worker`** + provisioning da VPS — runbook documenta, mas o script não cria o user (Q-C2-3); é setup de host.
  - **Wiring de `CLIHELPER_TOKEN` no cliente HTTP clihelper** — Epic 3 (outbound). Aqui só entra no schema typed.
  - **Secret manager externo (Vault/SOPS)** — fora do M0; EnvironmentFile 0600 é a decisão (D-04.6').
  - **Boot check em `bootstrap()`** — NÃO adicionar variante a `BootError` (evita churn em main.ts/hdd-worker.ts switches). O gate de perm é o `ExecStartPre` (systemd); `checkSecretsFilePerms` fica exportado+testado p/ uso futuro/defesa-em-profundidade (Q-C2-2).

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **NFR-S1 / AR-019 / D-04.6'** | Secrets via systemd EnvironmentFile 0600 + user dedicado; nunca no workspace | unit `ExecStartPre` + `install-secrets.sh` + `checkSecretsFilePerms` |
| **AO-16** | user não-privilegiado `hdd-worker` + EnvironmentFile 0600 | unit (User=, EnvironmentFile=, ExecStartPre) |
| **(1.b.3 dep)** | secrets nunca em log/audit | redaction já cobre; teste regressão `CLIHELPER_TOKEN` |

### Current state dos ficheiros MODIFY

- **`src/lib/env.ts`** — `EnvSchema` só com `ANTHROPIC_API_KEY` (required, trim+min(1), msg "ANTHROPIC_API_KEY required"); `parseEnv(raw=process.env): Result<Env, EnvValidationError>` síncrono. **Delta:** +`CLIHELPER_TOKEN` optional + `checkSecretsFilePerms` (nova export). Preservar `parseEnv` + a mensagem AC.
- **`systemd/hdd-worker.service`** (criado 1.c.1) — já tem `ConditionPathExists=/etc/hdd/secrets.env`, `EnvironmentFile=/etc/hdd/secrets.env`, `User=hdd-worker`, `Type=simple`, `ExecStart`, `ExecStartPost` /healthz, sem `WatchdogSec`. **Delta:** +`ExecStartPre` perm gate (0600). Não duplicar EnvironmentFile/ConditionPathExists.

### Esboços de tipos

```ts
// src/lib/env.ts (additions)
export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string({ error: () => REQUIRED_MSG }).trim().min(1, REQUIRED_MSG),
  CLIHELPER_TOKEN: z.string().trim().min(1).optional(),
});
export type SecretsError =
  | { readonly kind: "SecretsFileMissing"; readonly path: string }
  | { readonly kind: "SecretsFileInsecure"; readonly path: string; readonly mode: string };
export function checkSecretsFilePerms(
  path: string,
  statFn?: (p: string) => { mode: number },
): Result<true, SecretsError>;
// rejeita se (mode & 0o077) !== 0
```

### Previous story intelligence

- **1.a.7 (env):** `parseEnv` Zod síncrono; fail-closed; mensagem é substring de AC. `Env` type via `z.infer`.
- **1.c.1 (systemd/CLI):** a unit já existe e tem EnvironmentFile/ConditionPathExists; o `start` boota via `bootstrap()` (que faz `parseEnv`). `exactOptionalPropertyTypes` → optional Zod vira `field?: T` (cuidado ao consumir).
- **1.b.3 (redaction):** `redactPayload`/`redactString` cobrem `sk-ant-`, Bearer, `(secret|token|password|api_key)=…` (generic-secret) → `CLIHELPER_TOKEN=…` é redigido pelo pattern env-var/generic. Teste de regressão confirma.
- **1.b.4 / D-053:** preferir fs reais nos tests (`mkdtempSync` + `chmodSync`) para `checkSecretsFilePerms` — não mockar `statSync` se o real serve.
- **`process.env` access:** bracket/destructuring (`noPropertyAccessFromIndexSignature`).

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** tornar `CLIHELPER_TOKEN` required em M0 (parte o boot antes de Epic 3; Q-C2-1).
- ❌ **NÃO** adicionar variante a `BootError`/tocar `main.ts`/`hdd-worker.ts` switches (fora do files_modified; o gate é `ExecStartPre`).
- ❌ **NÃO** confiar em `ConditionPathExists` para permissões (só verifica existência) — daí o `ExecStartPre`.
- ❌ **NÃO** logar/ecoar o conteúdo de `secrets.env` no `install-secrets.sh` (nem em set -x).
- ❌ **NÃO** commitar `secrets.env` real — só `.env.example`. (`.gitignore` deve cobrir `*.env` excepto `.example` — verificar.)
- ❌ **NÃO** usar `throw` em `checkSecretsFilePerms` (devolver `err`; perm laxa é input esperado).

### Project Structure Notes
- MODIFY: `src/lib/env.ts`, `systemd/hdd-worker.service`. NEW: `scripts/install-secrets.sh`, `docs/runbooks/secret-rotation.md`, `tests/lib/env-secrets.test.ts`, `scripts/generate-1c2-summary.ts`.
- Verificar `.gitignore` cobre `secrets.env` (não o `.example`).

### References
- [Source: epics.md#Story-1.c.2] — StorySpec, ACs, files, blocked_by [1.a.7, 1.c.1].
- [Source: architecture.md:511] — D-04.6' (Secrets via systemd EnvironmentFile + redaction CI).
- [Source: architecture.md:569,586] — EnvironmentFile 0600 + user `hdd-worker`.
- [Source: src/lib/env.ts] — ficheiro MODIFY. [Source: systemd/hdd-worker.service] — ficheiro MODIFY (1.c.1).

## Open Questions for Operator

- **Q-C2-1 (CLIHELPER_TOKEN):** [RESOLVED — **REQUIRED**] decisão do operador (não-Recommended): `CLIHELPER_TOKEN` é obrigatório no boot já. ⚠️ **Impacto:** parte os testes que só passam `ANTHROPIC_API_KEY` (bootstrap 1.a.7, sandbox 1.b.4, env) — corrigir todos a adicionar `CLIHELPER_TOKEN` (regressão esperada, como o fix da 1.b.4).
- **Q-C2-2 (enforcement de perm):** [RESOLVED — systemd `ExecStartPre`] gate 0600 na unit; sem tocar boot/`BootError`; `checkSecretsFilePerms` exportado+testado.
- **Q-C2-3 (install-secrets.sh):** [RESOLVED — install + verify] não cria o user (host setup → runbook); idempotente.
- **Q-C2-4 (threshold de perm):** [RESOLVED — `mode & 0o077 !== 0`] rejeita group/world acessível; permite 0600/0400.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- type-check: 1 erro (review.test.ts Env literal sem CLIHELPER_TOKEN) → corrigido.
- full suite: 11 fail iniciais (regressão CLIHELPER_TOKEN required, decisão Q-C2-1) → +`CLIHELPER_TOKEN: "clh-test"` em bootstrap.test.ts (5 bootstrap + 2 parseEnv), sandbox.security.test.ts (2), review.test.ts (1). Depois 279 pass / 1 skip / 0 fail.
- env-secrets.test.ts: 9 pass (fs reais com chmod). lint exit 0. `bash -n` OK; usage sem-arg → rc=2.
- `.gitignore` já cobre `*.env` + `!.env.example` (verificado).

### Completion Notes List

- **NFR-S1/AR-019/D-04.6' materializados:** secrets em systemd EnvironmentFile 0600; gate de permissão duplo — `ExecStartPre` (systemd, primário) + `checkSecretsFilePerms` (in-code, defesa-em-profundidade, testado com fs reais).
- **Q-C2-1 (decisão do operador, não-Recommended):** `CLIHELPER_TOKEN` é **required** já. Custo: regressão em 10 call-sites de teste (corrigidos). Benefício: fail-closed total no boot; o token tem de existir antes de Epic 3 o consumir.
- **Q-C2-2:** enforcement no `ExecStartPre` (não no `bootstrap`) → zero churn em `BootError`/main.ts/CLI switches. `checkSecretsFilePerms` exportado p/ uso futuro.
- **Q-C2-4:** rejeita `mode & 0o077` → 0600 e 0400 (read-only) aceites; 0640/0644 rejeitados.
- **Redaction (1.b.3) cobre os 2 secrets:** `sk-ant-` + `CLIHELPER_TOKEN=…`/Bearer já redigidos no JSONL (sem novo pattern necessário).
- Sem novas deps. `secrets.env` real protegido por `.gitignore`.

### File List

- `src/lib/env.ts` (MODIFY — +CLIHELPER_TOKEN required, +checkSecretsFilePerms)
- `systemd/hdd-worker.service` (MODIFY — +ExecStartPre perm gate)
- `systemd/hdd-worker.env.example` (MODIFY — +CLIHELPER_TOKEN)
- `scripts/install-secrets.sh` (NEW, +x)
- `tests/lib/env-secrets.test.ts` (NEW, 9 specs)
- `docs/runbooks/secret-rotation.md` (NEW)
- `tests/bootstrap.test.ts` · `tests/adapters/sandbox.security.test.ts` · `tests/cli/review.test.ts` (MODIFY — regressão CLIHELPER_TOKEN)
- `scripts/generate-1c2-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.c.2 criada (`ready-for-dev`); 4 Open Questions resolvidas (Q-C2-1 = required, escolha não-Recommended do operador). |
| 2026-05-29 | Implementação completa: CLIHELPER_TOKEN required + checkSecretsFilePerms + ExecStartPre gate + install-secrets.sh + runbook + 9 specs; regressão CLIHELPER (10 sites) corrigida; type-check/lint/test verdes (279 pass). NFR-S1/AR-019/D-04.6'. Status → `review`. |
