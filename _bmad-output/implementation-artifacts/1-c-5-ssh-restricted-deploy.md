# Story 1.c.5: SSH restricted deploy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want SSH `authorized_keys` com `command="/opt/hdd/scripts/deploy.sh"` restriction + o script regista o commit SHA no audit JSONL,
so that o operador faz deploy via `ssh hdd-worker@vps deploy <sha>` sem expor shell livre (NFR-S6, AR-112, D-04.25).

## Acceptance Criteria

1. **(binary — forced command)** **Given** a SSH key com a restrição `command="…/deploy.sh"`
   **When** o operador conecta via `ssh hdd-worker@vps` (com qualquer comando)
   **Then** shell livre é **rejeitado** — apenas o `deploy.sh` executa; um comando não-`deploy …` em `$SSH_ORIGINAL_COMMAND` sai ≠0 sem efeito. Prova: `install-authorized-keys.sh` instala a linha com `command=…,no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding`; `deploy.sh` parseia/valida `$SSH_ORIGINAL_COMMAND`.

2. **(binary — audit DeployCompleted)** **Given** `ssh hdd-worker@vps deploy abc1234`
   **When** o deploy completa
   **Then** um audit event `type:"DeployCompleted"` com `payload.commitSha:"abc1234"` é appendado ao JSONL, **na mesma hash-chain do worker** (seq/prev_hash íntegros — `verifyChain` passa). `AuditEntry.type` é `string` livre → **sem modificar src**.

## Tasks / Subtasks

- [x] **Task 1 — `scripts/deploy.sh` (NEW, +x)** (AC: #1, #2) — forced-command target: parse de `$SSH_ORIGINAL_COMMAND` (`read -r verb sha`); só `deploy <sha>` com `^[0-9a-f]{7,40}$` (anti-injection NFR-S6, validado ANTES do `cd`/git); rejeita com exit 2. git fetch+checkout + `bun build --compile` + `systemctl restart` + `audit-deploy.ts`. `set -euo pipefail` sem `set -x`. `bash -n` OK.
- [x] **Task 2 — `scripts/audit-deploy.ts` (NEW — Q-C5-1=a)** (AC: #2) — `recordDeploy()` testável: valida sha → createDbConnection + applyMigrations (idempotente) + createAuditAdapter → append `DeployCompleted{commitSha}` runId `deploy-<sha>`. `import.meta.main` guard; defaults cwd-relative alinhados com o worker + migrations via `dirname(import.meta.dir)`. **Zero src mod** (AuditEntry.type é string livre). DeployError union (InvalidSha|MigrationFailed|AuditError).
- [x] **Task 3 — `scripts/install-authorized-keys.sh` (NEW, +x)** (AC: #1) — instala linha forced-command (`command=…,no-pty,no-port/X11/agent-forwarding`) em `~hdd-worker/.ssh/authorized_keys` (0700 dir / 0600 file, owner); valida pubkey via `ssh-keygen -l`; idempotente (grep do key material); não cria user. `bash -n` OK.
- [x] **Task 4 — `tests/integration/deploy.integration.test.ts` (NEW — Q-C5-3=a)** (AC: #1, #2) — AC2: `recordDeploy` real → lê JSONL → assert type/commitSha/run_id (snake_case) + rejeição InvalidSha (3 specs, sempre). AC1: corre `deploy.sh` via bash real com `$SSH_ORIGINAL_COMMAND` → exit 2 para shell-livre/sha-inválido/vazio (3 specs). 5 pass.
- [x] **Task 5 — `docs/runbooks/ssh-deploy.md` (NEW)** (AC: #1, #2) — forced command explicado, gerar/instalar key, fluxo `deploy <sha>`, passos do deploy, verificação do audit (mesmo DB/baseDir), troubleshooting (6 sintomas), relação com release.yml/manual-rollback.
- [x] **Task 6 — gates**: `bun run type-check` clean · `bun run lint` exit 0 (23 infos) · `bun test` **285 pass / 2 skip / 0 fail** · `bun run test:integration` **16 pass / 2 skip** · `bash -n` deploy.sh + install-authorized-keys.sh OK.
- [x] **Task 7 (FINAL) — Tier-B summary via generator (12ª dogfood)**: `scripts/generate-1c5-summary.ts` → `gen.finalize(input)` → auto-commit `summary(story-1c5): ...`. Sprint-status `1-c-5 → review`.

## Dev Notes

### Big picture

5ª story de operações do Epic 1.c. Dá ao operador um canal de **deploy auditável sem shell livre**: a SSH key só pode disparar `deploy.sh` (forced command), e cada deploy deixa rasto na hash-chain (`DeployCompleted` + commitSha). Complementa o release.yml (1.c.4, artifact) e fecha o gap de "como é que o código chega à VPS de forma controlada".

### Scope delimitation (LER)

- **IN-SCOPE:** deploy.sh (forced-command + validação + passos de deploy + audit), install-authorized-keys.sh, registo de audit `DeployCompleted`, teste de integração do registo, runbook.
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Criação do user `hdd-worker`** + sshd config — host setup (runbook documenta; script não cria user, como 1.c.2).
  - **Auto-deploy / CD** — deploy é deliberado via SSH manual (architecture.md:720); nada automático.
  - **Rollback automático** — `manual-rollback` é runbook da 1.c.6; aqui o deploy é forward-only.
  - **Modificar `src/`** — `AuditEntry.type` é `string` livre → `DeployCompleted` não precisa de novo tipo. NÃO tocar `BootError`/Commander switches.

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **NFR-S6 / AR-112 / D-04.25** | SSH forced-command; sem shell livre; deploy auditado | authorized_keys `command=…` + deploy.sh validação + DeployCompleted |
| **AO-14 (1.a.6)** | audit append mantém hash-chain | registo via adapter (não append de bash) |
| **architecture.md:720** | deploy manual ssh + git pull + restart (não auto-deploy) | deploy.sh |

### Mecânica do forced command (NFR-S6)

`authorized_keys`:
```
command="/opt/hdd/scripts/deploy.sh",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding ssh-ed25519 AAAA... operador-deploy
```
O comando do cliente (`deploy abc1234`) chega ao `deploy.sh` em **`$SSH_ORIGINAL_COMMAND`** (o `command=` força sempre o deploy.sh, ignorando o que o cliente pede). O deploy.sh **tem de** validar `$SSH_ORIGINAL_COMMAND` — sem isso, o forced command corre na mesma mas sem o sha. Validação do sha `^[0-9a-f]{7,40}$` é a fronteira anti-injection.

### Audit `DeployCompleted` — wiring (Q-C5-1)

`createAuditAdapter({ db, baseDir, project, clock })` (jsonl-hash-chain.adapter.ts:73) precisa de:
- `db`: `createDbConnection(HDD_DB_PATH)` — **mesma DB do worker** (state seq/prev_hash).
- `baseDir`: `_bmad-output/audit` (DEFAULT_AUDIT_BASE_DIR, bootstrap.ts:40) — **mesmo dir**.
- `project`: `"projeto_hdd"`.
- `clock`: `createSystemClockAdapter()`.
- `append({ type:"DeployCompleted", payload:{commitSha}, runId })` — **runId explícito obrigatório** (sem RunContext num script standalone → senão `RunIdMissing`).

⚠️ **Alinhamento de path:** se o registo apontar para DB/baseDir diferentes do worker, cria uma chain paralela (o evento não aparece na chain "oficial"). Mesmo cuidado que o litestream.yml (1.c.3).

### Esboço

```bash
# deploy.sh (forced-command target)
set -euo pipefail
CMD="${SSH_ORIGINAL_COMMAND:-}"
read -r verb sha _ <<< "${CMD}"
if [[ "${verb}" != "deploy" || ! "${sha}" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "uso: deploy <commit-sha>" >&2; exit 2
fi
cd /opt/hdd
git fetch --quiet && git checkout --quiet "${sha}"
# Q-C5-2: build + restart
bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker
systemctl --user restart hdd-worker  # ou sudo systemctl (host setup)
# Q-C5-1: regista DeployCompleted
bun run scripts/audit-deploy.ts "${sha}"
```

### Previous story intelligence

- **1.a.6 (audit):** `AuditEntry.type:string` livre; `runId` obrigatório (explicit > context); adapter usa `db` p/ seq/prev_hash + JSONL por data. `verifyChain(date)` valida.
- **1.c.1 (CLI):** Commander root `registerXCommand(program)`; entry compile `src/cli/hdd-worker.ts`. Se Q-C5-1=(b) subcommand, seguir o padrão `review`/`start` — MAS isso modifica src (contraria files_modified).
- **1.c.2 (scripts):** `install-secrets.sh` — padrão para `install-authorized-keys.sh` (0600, owner, idempotente, não cria user, `set -euo pipefail` sem `set -x`).
- **1.c.3 (path alignment):** lição — o registo tem de usar o MESMO DB/baseDir do worker (senão chain paralela). `HDD_DB_PATH` default `/opt/hdd/.hdd-state.db`.
- **1.c.3/Q-C3-4 + 1.c.4 (CI gotcha):** teste `.integration.test.ts` > `.test.sh` (órfão); se um script TS correr em CI, `process.execPath`/`import.meta.dir` (`[[project-hdd-bun-spawn-ci-gotcha]]`).

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** appendar ao JSONL via bash (`echo >> file`) — quebra a hash-chain. Registo só via adapter.
- ❌ **NÃO** confiar no comando do cliente sem validar `$SSH_ORIGINAL_COMMAND` — forced command corre sempre; a validação é a defesa.
- ❌ **NÃO** aceitar sha sem regex `^[0-9a-f]{7,40}$` (command injection via SSH_ORIGINAL_COMMAND — NFR-S6).
- ❌ **NÃO** modificar `src/` (AuditEntry.type já é string; sem novo BootError/Commander se Q-C5-1=(a)).
- ❌ **NÃO** criar o user `hdd-worker` no install script (host setup).
- ❌ **NÃO** registar o audit numa DB/baseDir diferente do worker (chain paralela).
- ❌ **NÃO** `set -x` em scripts (deploy toca paths; não vazar).

### Project Structure Notes

- NEW: `scripts/deploy.sh`, `scripts/install-authorized-keys.sh`, `docs/runbooks/ssh-deploy.md`, `tests/integration/deploy.integration.test.ts`, `scripts/generate-1c5-summary.ts` + (Q-C5-1=a) `scripts/audit-deploy.ts`.
- MODIFY: `_bmad-output/implementation-artifacts/sprint-status.yaml`. **src/ NÃO tocado** (a confirmar pela Q-C5-1).

### References

- [Source: epics.md#Story-1.c.5] (linhas 1175-1197) — StorySpec, ACs, blocked_by [1.a.6, 1.c.4].
- [Source: architecture.md:720] — deploy manual ssh + git pull + restart.
- [Source: src/ports/audit.port.ts] — AuditEntry (type:string, runId obrigatório). [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts:73] — createAuditAdapter deps.
- [Source: src/cli/hdd-worker.ts] — padrão Commander (se subcommand).

## Open Questions for Operator

- **Q-C5-1 (como registar DeployCompleted):** [RESOLVED — **(a) `scripts/audit-deploy.ts`**] standalone via `bun run`; monta `createAuditAdapter` directamente; **zero src mod**; requer bun na VPS (já presente por Q-C5-2).
- **Q-C5-2 (o que o deploy.sh faz):** [RESOLVED — **git checkout + bun build + restart**] git fetch+checkout `<sha>` + `bun build --compile` + `systemctl restart`. bun na VPS garantido.
- **Q-C5-3 (formato do teste):** [RESOLVED — **`.integration.test.ts`**] round-trip de audit real sempre; SSH por validação estática + `skipIf(!hasSshd)`.
- **Q-C5-4 (runId do evento de deploy):** [RESOLVED — **`deploy-<sha>`**] correlaciona com o commit; legível; seq/ts distinguem re-deploys.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `which sshd`/SSH não necessário — `deploy.sh` testado via bash real com `$SSH_ORIGINAL_COMMAND` (env), prova a rejeição sem servidor SSH.
- audit-deploy.ts run real: JSONL correcto (`type:DeployCompleted`, `run_id:deploy-abc1234`, `payload.commitSha`); **seq do 1º evento numa chain fresca = 0** (não 1) → assert corrigido p/ `>= 0`.
- JSONL usa **snake_case** (`run_id`, `prev_hash`, `this_hash`) → teste corrigido `last.run_id` (não `runId`).
- biome: 1 erro formatter (FIXABLE) no teste → `bun run lint:fix`; depois exit 0 (23 infos pré-existentes).
- type-check clean; `bun test` 285 pass / 2 skip / 0 fail (era 280; +5 deploy); integration 16 pass / 2 skip.

### Completion Notes List

- **NFR-S6/AR-112/D-04.25 materializados:** SSH forced-command (`command=…/deploy.sh` + hardening flags) → sem shell livre; deploy auditado (`DeployCompleted`+commitSha) na hash-chain do worker.
- **Q-C5-1 (a) script standalone:** `audit-deploy.ts` monta o adapter directamente (sem bootstrap completo) → **zero modificação de src** (`AuditEntry.type` é string livre; `payload` é Record). `recordDeploy()` exportado e testável.
- **Q-C5-2 git+build+restart:** deploy recompila o binário (bun na VPS garantido); forward-only.
- **Q-C5-3 `.integration.test.ts`:** ambos os ACs provados REAL sem sshd — audit round-trip + rejeição do deploy.sh via bash.
- **Q-C5-4 `deploy-<sha>`:** runId legível; correlaciona o evento com o commit.
- **Segurança:** validação `^[0-9a-f]{7,40}$` ANTES de tocar git (fronteira anti command-injection via `$SSH_ORIGINAL_COMMAND`); install script valida pubkey + perms 0600/0700, não cria user.
- **Alinhamento de path (lição 1.c.3):** audit-deploy usa o MESMO DB/baseDir do worker (senão chain paralela).
- Sem deps novas; src/ intacto.

### File List

- `scripts/audit-deploy.ts` (NEW — recordDeploy + CLI guard)
- `scripts/deploy.sh` (NEW, +x — forced-command target)
- `scripts/install-authorized-keys.sh` (NEW, +x — instala forced-command key)
- `tests/integration/deploy.integration.test.ts` (NEW — AC1 bash + AC2 audit, 5 specs)
- `docs/runbooks/ssh-deploy.md` (NEW)
- `scripts/generate-1c5-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/1-c-5-ssh-restricted-deploy.md` (NEW — story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-30 | Story 1.c.5 criada (`ready-for-dev`); 4 Open Questions (Q-C5-1 registo audit, Q-C5-2 passos do deploy, Q-C5-3 formato do teste, Q-C5-4 runId). Descoberta: AuditEntry.type é string livre → DeployCompleted sem tocar src. |
| 2026-05-30 | Q's resolvidas: Q-C5-1=audit-deploy.ts standalone; Q-C5-2=git+build+restart; Q-C5-3=.integration.test.ts; Q-C5-4=deploy-<sha>. Implementação: deploy.sh + audit-deploy.ts + install-authorized-keys.sh + teste (5 specs) + runbook. src/ intacto; 285 pass/2 skip/0 fail; type-check/lint verdes. Summary `4f5e878`. Status → `review`. |
