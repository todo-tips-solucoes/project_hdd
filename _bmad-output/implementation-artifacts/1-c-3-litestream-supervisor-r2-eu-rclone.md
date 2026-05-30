# Story 1.c.3: Litestream supervisor + R2 EU + rclone

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador` (operations),
I want Litestream streaming WAL → Cloudflare R2 EU (primário, RPO ~1s) + rclone secundário (dump diário gzipped) + runbook de restore,
so that crash de VPS ou disk failure não perde state nem audit (F9 + F5; defesa de que o crash recovery do Epic 5 depende).

## Acceptance Criteria

1. **(binary — restore)** **Given** `data.db` em WAL mode + Litestream activo (a replicar)
   **When** simulo crash do worker + restore em ambiente limpo (DB local ausente)
   **Then** o db é restaurado a partir da réplica com ≤24h de retention loss (D-04.21). **Prova local (D-053):** `litestream replicate` → réplica local `file://` + `litestream restore` reconstrói o db; verificação de integridade (`PRAGMA integrity_check` + contagem de linhas em `schema_migrations`). R2 real é a configuração de produção (documentada no runbook), mas o mecanismo é provado com réplica local.

2. **(binary — rclone dump)** **Given** R2 EU bucket `hdd-backup` configurado
   **When** o `rclone-daily-backup.sh` corre (cron)
   **Then** um dump `data-<date>.db.gz` aparece no bucket secundário. **Prova local (D-053):** o script usa um snapshot consistente (`VACUUM INTO` ou `sqlite3 .backup`, **não** `cp` num WAL vivo) → gzip → upload via `rclone copy`; testado contra um remote local (`rclone` ou fallback de cópia de ficheiro) já que credenciais R2 reais não estão disponíveis no ambiente. Config R2 documentada no runbook.

## Tasks / Subtasks

- [x] **Task 1 — `litestream.yml` (NEW)** (AC: #1) — config Litestream: `path: /opt/hdd/.hdd-state.db` (default real do worker, não inventado), replica primária R2 EU (`type: s3`, endpoint EU, `bucket: hdd-backup`, `region: auto`, `retention: 24h` + `retention-check-interval` + `snapshot-interval: 1h`), creds via env (não hardcoded). Bloco `file://` comentado p/ drill. Nota crítica sobre alinhamento de path com `HDD_DB_PATH`.
- [x] **Task 2 — `systemd/litestream.service` (NEW) + `systemd/hdd-worker.service` (MODIFY)** (AC: #1) — **Q-C3-1 = (b) serviço separado:** `litestream.service` (Type=simple, `ExecStart=litestream replicate -config /etc/litestream.yml`, EnvironmentFile próprio + ExecStartPre 0600-gate, ConditionPathExists). `hdd-worker.service` MODIFY: `+After=...litestream.service` + `Requires=litestream.service` (fail-closed na durabilidade); comentário antecipatório actualizado (já não é wrapper). Tudo o resto da unit preservado (Type=simple, perm-gate, /healthz poll, NotifyAccess=none, sem WatchdogSec).
- [x] **Task 3 — `scripts/rclone-daily-backup.sh` (NEW, +x)** (AC: #2) — `sqlite3 VACUUM INTO` (snapshot atómico, nunca `cp` de WAL vivo) → `gzip` → `rclone copy` p/ `data-<date>.db.gz`; `set -euo pipefail` (sem `set -x`); guards (db existe, sqlite3/rclone presentes) → rc≠0; `mktemp -d` + `trap` cleanup; idempotente. Cron `0 */6 * * *` no runbook. `bash -n` OK + smoke fail-closed (rc=1 sem db).
- [x] **Task 4 — `tests/integration/backup-restore.integration.test.ts` (NEW)** (AC: #1, #2) — **Q-C3-4 = (a) `.integration.test.ts`**. AC2 (snapshot consistente) prova-se SEMPRE com `bun:sqlite`: `VACUUM INTO` → integrity_check + count 100 + gzip round-trip bit-a-bit (1 pass). AC1 (litestream replicate→restore file://) em `describe.skipIf(!hasLitestream)` via Bun.spawn (1 skip aqui — binário ausente, CI verde). Resultado: 1 pass / 1 skip.
- [x] **Task 5 — `docs/runbooks/litestream-restore.md` (NEW)** (AC: #1, #2) — prereqs (litestream/rclone/sqlite3 versões pinadas), R2 EU (bucket+creds+endpoint), creds Litestream EnvironmentFile 0600 + rclone config, deploy das units + ordem de arranque, cron, restore em VPS limpa (RTO 5-15s) + fallback rclone, drill mensal (réplica `file://`), troubleshooting (8 sintomas), nota crítica path/HDD_DB_PATH.
- [x] **Task 6 — creds R2 (NÃO toca `env.ts`)** (AC: #1) — **Q-C3-3 = fora do Zod:** `systemd/litestream.env.example` (NEW) com `LITESTREAM_ACCESS_KEY_ID`/`SECRET`; lidas pelo Litestream do seu EnvironmentFile 0600 (`/etc/litestream/litestream.env`), separado do `secrets.env`. **`env.ts` confirmado intacto** — zero churn em Zod/`BootError`. Worker nunca vê creds R2. `.gitignore` já cobre `*.env` (verificado em 1.c.2).
- [x] **Task 7 — gates**: `bun run type-check` clean · `bun run lint` exit 0 (23 infos pré-existentes) · `bun test` **280 pass / 2 skip / 0 fail** · `bun run test:integration` **11 pass / 2 skip / 0 fail** · `bash -n` rclone-daily-backup.sh OK.
- [x] **Task 8 (FINAL) — Tier-B summary via generator (10ª dogfood)**: `scripts/generate-1c3-summary.ts` → `gen.finalize(input)` → auto-commit `summary(story-1c3): ...` (`8dc8d44`, só o summary file). Tier-B 550 words (dentro do template ≤715). Sprint-status `1-c-3 → review`.

## Dev Notes

### Big picture

3ª story de operações do Epic 1.c (após systemd+/healthz e secrets). É a **camada de durabilidade**: state (`data.db`) + audit chain não podem desaparecer com a VPS. Dois mecanismos em defesa-em-profundidade:
- **Primário — Litestream:** stream contínuo do WAL → R2 EU. RPO ~1s, RTO 5-15s (architecture.md:728). Restore inicial só é relevante quando o DB local está ausente (não no piloto normal — architecture.md:725).
- **Secundário — rclone:** dump periódico gzipped → bucket R2 (4×/dia, cron `0 */6 * * *`). Snapshot point-in-time, defesa contra corrupção lógica que o stream propagaria.

O Epic 5 (crash recovery) **depende** desta story: sem réplica, "restore em VPS limpa" não existe.

### Scope delimitation (LER)

- **IN-SCOPE:** `litestream.yml` (config), unit(s) systemd para supervisão/replicação, `rclone-daily-backup.sh` (snapshot consistente), teste de integração do round-trip replicate→restore (local), runbook de restore + config R2.
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Instalar o binário Litestream/rclone** — são binários de sistema (NÃO deps bun/npm). Ausentes neste ambiente (`which litestream`/`which rclone` → not found). O runbook documenta a instalação; os testes fazem `skipIf` (D-053). **Não instalar.**
  - **R2 real (bucket + creds + upload live)** — creds não disponíveis no ambiente. Prova-se o mecanismo com réplica local (`file://`); config R2 documentada (Q-C3-3).
  - **Litestream restore automático no boot** — architecture.md:725 diz que só é relevante com DB ausente; NÃO adicionar lógica de restore ao `bootstrap()`/`BootError` (evita churn em main.ts/hdd-worker.ts switches). Restore é operação manual via runbook em M0.
  - **Monitorização/alerta de lag da réplica** — Healthchecks.io / observabilidade fica para story de ops posterior.
  - **Backup verification drill automatizado** — documentado como procedimento mensal manual (architecture.md:731), não cron.

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **AR-014 / D-04.21** | Backup com retention 24h; restore ≤24h loss | `litestream.yml` (`retention: 24h`) + drill |
| **AO-38 / AO-51** | Litestream como systemd supervisor (`run --`) + rclone secundário | `systemd/*.service` (Q-C3-1) + `rclone-daily-backup.sh` |
| **`project-hdd-stack-v2-bun` (memory)** | Litestream supervisor em vez de dockerode/PM externo | modelo de supervisão (Q-C3-1) |
| **architecture.md:728-730** | RPO~1s/RTO5-15s primário; rclone cron `0 */6 * * *` secundário; retention local 30d/remoto 1 ano | runbook + script |

### ⚠️ Divergência canon vs. implementação real (Q-C3-1)

O **architecture canon (AO-51, architecture.md:381,405,475)** descreve `ExecStart=litestream run -- bun run src/main.ts` (interpreted, wrapper de 1 processo). MAS:
- A implementação real (1.c.1) usa o **binário compilado**: `ExecStart=/opt/hdd/dist/hdd-worker start` (D-04.15, evita JIT 2-5s, NFR-P1 ≤30s). O comentário da unit (linhas 7-9) já antecipa: *"O wrapper `litestream run --` entra na Story 1.c.3 (backup)"*.
- O **StorySpec (epics.md:1135-1136)** lista `systemd/litestream.service` SEPARADO + `hdd-worker.service` *depend on litestream.service*.

→ Há dois modelos possíveis; ver Q-C3-1. O canon e o StorySpec apontam direcções diferentes — **decisão do operador**.

### Current state dos ficheiros MODIFY

- **`systemd/hdd-worker.service`** (criado 1.c.1, tightened 1.c.2) — `Type=simple`, `ConditionPathExists=/etc/hdd/secrets.env`, `EnvironmentFile=/etc/hdd/secrets.env`, `User=hdd-worker`, `WorkingDirectory=/opt/hdd`, `ExecStartPre` perm-gate (`stat -c %a = 600`), `ExecStart=/opt/hdd/dist/hdd-worker start` (binário compilado directo), `ExecStartPost` poll `/healthz`, `Restart=on-failure`, `RestartSec=5`, `TimeoutStopSec=30`, `NotifyAccess=none`, sem `WatchdogSec`. **Delta depende da Q-C3-1.** Preservar perm-gate, /healthz poll, secrets.
- **`src/db/connection.ts`** (1.a.5) — WAL pragma já aplicado (`PRAGMA journal_mode = WAL`, linha 28) + foreign_keys + busy_timeout + synchronous=NORMAL. **Litestream EXIGE WAL** → pré-requisito já satisfeito. Não tocar; o `data.db` em produção corre com este factory.

### Onde vive o `data.db`

- WorkingDirectory da unit = `/opt/hdd`. Path da DB em produção: `/opt/hdd/data/data.db` (confirmar/derivar do bootstrap — env `DB_PATH` ou default). `litestream.yml` aponta para o path absoluto. Nos testes, usar `mkdtempSync` + DB temporária (não `:memory:` — Litestream precisa de ficheiro WAL on-disk).

### Esboços de config

```yaml
# litestream.yml (R2 EU primário)
dbs:
  - path: /opt/hdd/data/data.db
    replicas:
      - type: s3
        bucket: hdd-backup
        path: data.db
        endpoint: https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
        region: auto
        retention: 24h            # D-04.21
        snapshot-interval: 1h
        # creds via env: LITESTREAM_ACCESS_KEY_ID / LITESTREAM_SECRET_ACCESS_KEY
      # --- drill local (D-053): descomentar p/ teste de restore sem R2 ---
      # - type: file
      #   path: /tmp/hdd-replica
```

```bash
# rclone-daily-backup.sh (esboço — snapshot consistente, NÃO cp de WAL vivo)
set -u
DB="${HDD_DB_PATH:-/opt/hdd/data/data.db}"
DATE="$(date -u +%Y-%m-%d)"
TMP="$(mktemp -d)"
sqlite3 "$DB" "VACUUM INTO '$TMP/data-$DATE.db'"   # snapshot atómico
gzip "$TMP/data-$DATE.db"
rclone copy "$TMP/data-$DATE.db.gz" "r2-secondary:hdd-backup/daily/"
```

### Previous story intelligence

- **1.a.5 (db):** WAL já ligado em `createDbConnection` — Litestream operável sem alterar pragmas. `data.db` é ficheiro on-disk; WAL gera `data.db-wal`/`data.db-shm`.
- **1.c.1 (systemd/CLI):** unit `Type=simple` (Bun sem sd_notify — `[[project-hdd-bun-sd-notify-gotcha]]`); `ExecStart` é binário compilado (`dist/hdd-worker start`), não `bun run`. Padrão de `ExecStartPost` poll via `curl /healthz` (mas hook bloqueia curl inline no Bash — testes via Bun.serve/fetch, não curl).
- **1.c.2 (secrets):** EnvironmentFile 0600; perm-gate `ExecStartPre`. Se Litestream tiver creds R2, vivem num EnvironmentFile próprio 0600 (mesmo padrão), NÃO no `secrets.env` do worker (separação de concerns).
- **1.c.7 (bmad-cli.test.sh):** precedente directo p/ Q-C3-4 — um `.test.sh` **não corre** via `bun test tests/integration` (esse só apanha `.ts`); fica órfão (corre só em CI/manual). Argumento forte para `.integration.test.ts`.
- **1.b.4 / D-053:** integração real onde o recurso existe (`skipIf(!hasX)`); doc o resto. Litestream/rclone ausentes → skip + réplica local quando possível.
- **`SpawnPort` real:** `src/adapters/spawn/system-spawn.adapter.ts` (Bun.spawn) — usar p/ invocar `litestream`/`rclone`/`sqlite3` reais no teste de integração; fake-spawn p/ unit.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** instalar litestream/rclone (binários de sistema; ausentes por design neste ambiente) — `skipIf` + runbook.
- ❌ **NÃO** fazer `cp` de um `data.db` em WAL vivo no rclone script — usa `VACUUM INTO`/`.backup` (snapshot consistente). `cp` de WAL = backup corrompido.
- ❌ **NÃO** tornar creds R2 required no Zod do worker em M0 (parte o boot sem R2; Q-C3-3).
- ❌ **NÃO** adicionar restore automático ao `bootstrap()`/variante a `BootError` (churn em main.ts/hdd-worker.ts switches; restore é manual via runbook em M0).
- ❌ **NÃO** usar `set -x` em scripts que tocam paths/creds (vaza). `set -u` sim.
- ❌ **NÃO** commitar `litestream.yml` com creds reais — creds via env/EnvironmentFile; o `.yml` só referencia.
- ❌ **NÃO** usar `:memory:` no teste de Litestream — exige ficheiro WAL on-disk (`mkdtempSync`).
- ❌ **NÃO** quebrar o que a `hdd-worker.service` já garante (perm-gate, /healthz, Type=simple) ao aplicar o delta da Q-C3-1.

### Project Structure Notes

- NEW: `systemd/litestream.service`, `litestream.yml`, `systemd/litestream.env.example`, `scripts/rclone-daily-backup.sh`, `docs/runbooks/litestream-restore.md`, `tests/integration/backup-restore.integration.test.ts`, `scripts/generate-1c3-summary.ts`.
- MODIFY: `systemd/hdd-worker.service` (+Requires/After litestream.service — Q-C3-1=b), `_bmad-output/implementation-artifacts/sprint-status.yaml`. **`src/lib/env.ts` NÃO muda** (Q-C3-3=fora do Zod).
- `litestream.yml` na raiz do repo (deploy-time copiado p/ `/etc/litestream.yml` ou `/opt/hdd/` — documentar no runbook).

### References

- [Source: epics.md#Story-1.c.3] (linhas 1126-1148) — StorySpec, ACs, files, blocked_by [1.a.5, 1.c.2].
- [Source: architecture.md:379-381,394,405,475] — AO-38/AO-51 Litestream supervisor `run --` (canon).
- [Source: architecture.md:722-731] — cold start + backup orchestration (RPO~1s/RTO5-15s, rclone cron `0 */6 * * *`, retention).
- [Source: architecture.md:736] — Renovate: Litestream binary nunca automerge (pinar versão).
- [Source: systemd/hdd-worker.service] — ficheiro MODIFY (1.c.1/1.c.2). [Source: src/db/connection.ts:28] — WAL pragma.
- [Memory: `project-hdd-stack-v2-bun`] — Litestream supervisor model. [Memory: `project-hdd-d053-integration-testing`] — real onde possível.

## Open Questions for Operator

- **Q-C3-1 (modelo de supervisão):** [RESOLVED — **(b) serviço separado**] `litestream.service` corre `litestream replicate` independente; `hdd-worker.service` ganha `Requires=litestream.service` + `After=litestream.service` (worker mantém ExecStart compilado directo). Alinha com o files_created do StorySpec (cria `litestream.service`); replicação e worker desacoplados. Diverge do wrapper do canon AO-51 — decisão consciente do operador (StorySpec > canon aqui).

- **Q-C3-2 (binário Litestream ausente):** [RESOLVED — **skipIf + runbook**] `which litestream`/`rclone` → not found. NÃO instalar (binários de sistema). Teste de integração faz `skipIf(!hasLitestream)` (CI verde sem o binário); runbook documenta instalação (GitHub releases, versão pinada — Renovate nunca automerge). Mecanismo provado com réplica local onde possível.

- **Q-C3-3 (creds R2 + onde vivem):** [RESOLVED — **fora do Zod**] Litestream lê `LITESTREAM_ACCESS_KEY_ID`/`LITESTREAM_SECRET_ACCESS_KEY` do seu próprio EnvironmentFile 0600 (`/etc/litestream/litestream.env`), separado do `secrets.env` do worker. Zero churn em `env.ts`/`BootError`; separação de concerns; o worker nunca vê creds R2. `litestream.env.example` adicionado. Restore provado com réplica local `file://`.

- **Q-C3-4 (formato do teste backup-restore):** [RESOLVED — **(a) `.integration.test.ts`**] `backup-restore.integration.test.ts` com `describe.skipIf(!hasLitestream)` via Bun.spawn — corre em `bun run test:integration`, consistente com healthz/sandbox. Diverge do nome literal `.test.sh` do StorySpec (precedente 1.c.7: `.test.sh` fica órfão da suite bun test).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- Ambiente: `which litestream`/`rclone`/`sqlite3` → todos ausentes (binários de sistema; Q-C3-2 = skipIf+doc, não instalar).
- `DEFAULT_DB_PATH` real = `./.hdd-state.db` (src/bootstrap.ts:39) → `litestream.yml` usa `/opt/hdd/.hdd-state.db` (não inventei `data/data.db`); nota de alinhamento HDD_DB_PATH no runbook.
- type-check clean à primeira.
- lint: 1 erro FIXABLE (organizeImports — `bun:sqlite` antes de `bun:test` no teste novo) → corrigido à mão. Depois exit 0 (23 infos `useLiteralKeys` pré-existentes).
- `backup-restore.integration.test.ts`: 1 pass (AC2 snapshot real) / 1 skip (AC1 litestream ausente).
- `rclone-daily-backup.sh`: `bash -n` OK; smoke fail-closed rc=1 (db ausente).
- full suite: 280 pass / 2 skip / 0 fail (era 279/1/0; +1 pass AC2, +1 skip AC1). test:integration 11 pass / 2 skip.

### Completion Notes List

- **AR-014/D-04.21 materializados:** Litestream stream WAL → R2 EU (primário, RPO~1s/RTO5-15s, retention 24h) + rclone dump 4×/dia (secundário). WAL pré-requisito já satisfeito (1.a.5).
- **Q-C3-1 (b) serviço separado:** `litestream.service` daemon independente; `hdd-worker.service` `Requires=`/`After=` → **fail-closed na durabilidade** (worker não escreve state sem réplica activa; coerente com a tese de crash-recovery do Epic 5). Diverge do wrapper canon AO-51 por decisão consciente alinhada com o files_created do StorySpec.
- **Q-C3-2 skipIf+runbook:** binários não instalados; AC1 prova-se quando litestream existir (réplica local `file://`), CI verde sem ele. Instalação documentada com versões pinadas (Renovate nunca automerge).
- **Q-C3-3 creds fora do Zod:** EnvironmentFile próprio do Litestream 0600, separado do `secrets.env`; **`env.ts`/`BootError` intactos** (zero churn); worker nunca vê creds R2.
- **Q-C3-4 `.integration.test.ts`:** corre em `test:integration` (vs `.test.sh` órfão — precedente 1.c.7). AC2 (snapshot consistente) é prova REAL local (VACUUM INTO+gzip), não-skipped.
- **Snapshot consistente (anti-corrupção):** o dump usa `VACUUM INTO` (atómico), NUNCA `cp` de WAL vivo — guardrail explícito no script e no teste.
- Sem novas deps bun/npm (litestream/rclone/sqlite3 são binários de sistema).

### File List

- `litestream.yml` (NEW — config Litestream R2 EU + bloco file:// comentado)
- `systemd/litestream.service` (NEW — daemon de replicação, EnvironmentFile próprio 0600-gate)
- `systemd/litestream.env.example` (NEW — creds R2 template)
- `systemd/hdd-worker.service` (MODIFY — +Requires/After litestream.service; comentário actualizado)
- `scripts/rclone-daily-backup.sh` (NEW, +x — dump VACUUM INTO+gzip+rclone)
- `docs/runbooks/litestream-restore.md` (NEW — deploy/restore/drill/troubleshooting)
- `tests/integration/backup-restore.integration.test.ts` (NEW — AC2 real + AC1 skipIf)
- `scripts/generate-1c3-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.c.3 criada (`ready-for-dev`); 4 Open Questions levantadas (Q-C3-1 supervisão wrapper-vs-separado, Q-C3-2 litestream ausente, Q-C3-3 creds R2, Q-C3-4 formato do teste). |
| 2026-05-29 | Open Questions resolvidas pelo operador: Q-C3-1=(b) serviço separado; Q-C3-2=skipIf+runbook; Q-C3-3=creds fora do Zod (EnvironmentFile próprio); Q-C3-4=(a) `.integration.test.ts`. Tasks ajustadas. |
| 2026-05-29 | Implementação completa: litestream.yml + litestream.service (+ env.example) + hdd-worker.service (Requires/After) + rclone-daily-backup.sh + runbook + teste integração (AC2 real / AC1 skipIf). env.ts intacto. type-check/lint verdes; 280 pass/2 skip/0 fail; integration 11 pass/2 skip. Summary auto-commit `8dc8d44`. Status → `review`. |
