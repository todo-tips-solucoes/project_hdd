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
workflowId: story-1c3
workflowName: Story 1.c.3 — Litestream supervisor + R2 EU + rclone
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.3 — Litestream supervisor + R2 EU + rclone · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

3ª story de operações do Epic 1.c — camada de durabilidade. Litestream stream WAL → R2 EU (primário, RPO~1s/RTO5-15s, retention 24h D-04.21) + rclone dump 4×/dia gzipped (secundário) + runbook. Defesa contra crash de VPS/disk failure de que o crash recovery do Epic 5 depende. WAL já ligado em 1.a.5. AR-014/AO-38/AO-51.

## O que foi feito

- **litestream.yml** — NEW: config R2 EU (s3, bucket hdd-backup, retention 24h, snapshot 1h); path /opt/hdd/.hdd-state.db (default real); bloco file:// p/ drill.
- **systemd/litestream.service + .env.example** — NEW: daemon `litestream replicate` independente; EnvironmentFile próprio 0600-gate (creds R2 separadas do worker).
- **systemd/hdd-worker.service** — MODIFY: +Requires/After litestream.service (fail-closed na durabilidade).
- **scripts/rclone-daily-backup.sh** — NEW: VACUUM INTO (snapshot atómico) + gzip + rclone copy; guards fail-closed; sem set -x.
- **tests/integration/backup-restore.integration.test.ts** — NEW: AC2 snapshot real (VACUUM INTO+gzip, sempre); AC1 litestream skipIf.
- **docs/runbooks/litestream-restore.md** — NEW: prereqs/deploy/restore/drill mensal/troubleshooting.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Serviço Litestream separado (não wrapper). | Alinha com files_created do StorySpec; Requires=/After= dá fail-closed na durabilidade. Diverge do canon AO-51. | Q-C3-1 |
| 2 | Binários ausentes → skipIf + runbook. | litestream/rclone/sqlite3 são binários de sistema; não instalar. AC2 prova-se local; AC1 skip (CI verde). | Q-C3-2 |
| 3 | Creds R2 fora do Zod do worker. | EnvironmentFile próprio do Litestream 0600; zero churn em env.ts/BootError; worker nunca vê creds. | Q-C3-3 |
| 4 | .integration.test.ts (não .test.sh). | Corre em test:integration; .test.sh fica órfão (1.c.7). | Q-C3-4 |

## Trade-offs aplicados

- StorySpec dizia data.db / .test.sh; usei .hdd-state.db (default real do código) e .integration.test.ts (suite executável) — fidelidade ao comportamento > literal.
- Requires=litestream → worker não arranca sem réplica; coerente com durabilidade, mas runbook documenta o Wants= para modo degradado.

## Open items deferidos

- **O-C3-1:** Validar litestream.yml/replicate→restore com binário real + R2 EU live (creds indisponíveis no ambiente); correr o drill quando provisionado.
- **O-C3-2:** Alinhamento de path: garantir HDD_DB_PATH (se override) == path no litestream.yml no deploy.
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 280 pass / 2 skip / 0 fail (was 279/1; +1 pass AC2 snapshot, +1 skip AC1 litestream)
- **Integration:** 11 pass / 2 skip / 0 fail
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes; 1 organizeImports corrigido)
- **Deps adicionadas:** 0 (litestream/rclone/sqlite3 = binários de sistema)
- **Durabilidade:** Litestream R2 RPO~1s + rclone 4×/dia; retention 24h; creds R2 0600 isoladas

## Próximos passos sugeridos

1. Operador aprova `approve story-1c3` → marco done + commit `feat(story-1c3): Litestream supervisor + R2 EU + rclone (AR-014/D-04.21)`. Push NÃO toca .github/workflows.
2. Sprint 0: 19/22 done. Epic 1.c: 4/7. Próxima: 1.c.4 (CI GitHub Actions — vai tocar .github/workflows → gh auth refresh -s workflow se push falhar).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c3` · Pedir alterações: `hdd-worker review request-changes story-1c3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c3 --reason "<razão>"`


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
workflowId: story-1c3
workflowName: Story 1.c.3 — Litestream supervisor + R2 EU + rclone
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.3 — Litestream supervisor + R2 EU + rclone

### Contexto detalhado

3ª story de operações do Epic 1.c — camada de durabilidade. Litestream stream WAL → R2 EU (primário, RPO~1s/RTO5-15s, retention 24h D-04.21) + rclone dump 4×/dia gzipped (secundário) + runbook. Defesa contra crash de VPS/disk failure de que o crash recovery do Epic 5 depende. WAL já ligado em 1.a.5. AR-014/AO-38/AO-51.

### O que foi feito (verbose)

- **litestream.yml** — NEW: config R2 EU (s3, bucket hdd-backup, retention 24h, snapshot 1h); path /opt/hdd/.hdd-state.db (default real); bloco file:// p/ drill.
- **systemd/litestream.service + .env.example** — NEW: daemon `litestream replicate` independente; EnvironmentFile próprio 0600-gate (creds R2 separadas do worker).
- **systemd/hdd-worker.service** — MODIFY: +Requires/After litestream.service (fail-closed na durabilidade).
- **scripts/rclone-daily-backup.sh** — NEW: VACUUM INTO (snapshot atómico) + gzip + rclone copy; guards fail-closed; sem set -x.
- **tests/integration/backup-restore.integration.test.ts** — NEW: AC2 snapshot real (VACUUM INTO+gzip, sempre); AC1 litestream skipIf.
- **docs/runbooks/litestream-restore.md** — NEW: prereqs/deploy/restore/drill mensal/troubleshooting.

### Full file list

- **litestream.yml** — NEW: config R2 EU (s3, bucket hdd-backup, retention 24h, snapshot 1h); path /opt/hdd/.hdd-state.db (default real); bloco file:// p/ drill.
- **systemd/litestream.service + .env.example** — NEW: daemon `litestream replicate` independente; EnvironmentFile próprio 0600-gate (creds R2 separadas do worker).
- **systemd/hdd-worker.service** — MODIFY: +Requires/After litestream.service (fail-closed na durabilidade).
- **scripts/rclone-daily-backup.sh** — NEW: VACUUM INTO (snapshot atómico) + gzip + rclone copy; guards fail-closed; sem set -x.
- **tests/integration/backup-restore.integration.test.ts** — NEW: AC2 snapshot real (VACUUM INTO+gzip, sempre); AC1 litestream skipIf.
- **docs/runbooks/litestream-restore.md** — NEW: prereqs/deploy/restore/drill mensal/troubleshooting.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Serviço Litestream separado (não wrapper). | Alinha com files_created do StorySpec; Requires=/After= dá fail-closed na durabilidade. Diverge do canon AO-51. | Q-C3-1 |
| 2 | Binários ausentes → skipIf + runbook. | litestream/rclone/sqlite3 são binários de sistema; não instalar. AC2 prova-se local; AC1 skip (CI verde). | Q-C3-2 |
| 3 | Creds R2 fora do Zod do worker. | EnvironmentFile próprio do Litestream 0600; zero churn em env.ts/BootError; worker nunca vê creds. | Q-C3-3 |
| 4 | .integration.test.ts (não .test.sh). | Corre em test:integration; .test.sh fica órfão (1.c.7). | Q-C3-4 |

### Trade-offs aplicados (narrativa)

- StorySpec dizia data.db / .test.sh; usei .hdd-state.db (default real do código) e .integration.test.ts (suite executável) — fidelidade ao comportamento > literal.
- Requires=litestream → worker não arranca sem réplica; coerente com durabilidade, mas runbook documenta o Wants= para modo degradado.

### Open items deferidos (com onde serão resolvidos)

- **O-C3-1:** Validar litestream.yml/replicate→restore com binário real + R2 EU live (creds indisponíveis no ambiente); correr o drill quando provisionado.
- **O-C3-2:** Alinhamento de path: garantir HDD_DB_PATH (se override) == path no litestream.yml no deploy.
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 280 pass / 2 skip / 0 fail (was 279/1; +1 pass AC2 snapshot, +1 skip AC1 litestream)
- **Integration:** 11 pass / 2 skip / 0 fail
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes; 1 organizeImports corrigido)
- **Deps adicionadas:** 0 (litestream/rclone/sqlite3 = binários de sistema)
- **Durabilidade:** Litestream R2 RPO~1s + rclone 4×/dia; retention 24h; creds R2 0600 isoladas

### Próximos passos sugeridos

1. Operador aprova `approve story-1c3` → marco done + commit `feat(story-1c3): Litestream supervisor + R2 EU + rclone (AR-014/D-04.21)`. Push NÃO toca .github/workflows.
2. Sprint 0: 19/22 done. Epic 1.c: 4/7. Próxima: 1.c.4 (CI GitHub Actions — vai tocar .github/workflows → gh auth refresh -s workflow se push falhar).

### Diff vs `HEAD`

```diff
diff --git a/systemd/hdd-worker.service b/systemd/hdd-worker.service
index 8d8af93..395d810 100644
--- a/systemd/hdd-worker.service
+++ b/systemd/hdd-worker.service
@@ -5,14 +5,18 @@
 # WatchdogSec por isso mesmo.
 #
 # ExecStart usa o BINÁRIO COMPILADO (D-04.15: `bun build --compile`, não `bun
-# run` interpreted — evita JIT 2-5s, cumpre NFR-P1 ≤30s). O wrapper
-# `litestream run --` entra na Story 1.c.3 (backup). Pré-requisito de boot
+# run` interpreted — evita JIT 2-5s, cumpre NFR-P1 ≤30s). Pré-requisito de boot
 # (fail-closed): a sandbox image tem de estar pre-pulled — correr
 # `scripts/prepull-sandbox-image.sh` antes do primeiro start (ver runbook).
+#
+# Story 1.c.3 (Q-C3-1 = serviço separado): durabilidade via `litestream.service`
+# (daemon de replicação independente). O worker declara Requires=/After= →
+# arranca DEPOIS da replicação e NÃO corre sem ela (fail-closed na durabilidade).
 
 [Unit]
 Description=HDD Worker
-After=network.target
+After=network.target litestream.service
+Requires=litestream.service
 ConditionPathExists=/etc/hdd/secrets.env
 
 [Service]

```

---

→ Aprovar: `hdd-worker review approve story-1c3` · Pedir alterações: `hdd-worker review request-changes story-1c3 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c3 --reason "<razão>"`

