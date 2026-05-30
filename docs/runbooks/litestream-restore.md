# Runbook — Litestream backup & restore (Story 1.c.3)

**Objectivo:** garantir que crash de VPS ou disk failure não perde state
(`/opt/hdd/.hdd-state.db`) nem audit. Defesa de que o crash recovery (Epic 5)
depende. Dois mecanismos em defesa-em-profundidade:

| Camada | Ferramenta | RPO | RTO | Onde |
|---|---|---|---|---|
| **Primária** | Litestream (stream WAL → R2 EU) | ~1s | 5-15s | `litestream.service` + `litestream.yml` |
| **Secundária** | rclone (dump diário gzipped → R2) | 6h | minutos | `scripts/rclone-daily-backup.sh` (cron) |

Retention: **24h** na réplica Litestream (D-04.21 → restore com ≤24h de perda);
remoto até 1 ano nos dumps rclone (architecture.md:730).

---

## Sintoma

- Disco da VPS perdido / `/opt/hdd/.hdd-state.db` ausente após crash.
- Boot do worker falha por DB inexistente; necessidade de restaurar state+audit.
- DB corrompida (cruzar `[[hash-chain-corruption]]`).

## Diagnóstico

```bash
ls -l /opt/hdd/.hdd-state.db        # existe? tamanho 0?
litestream snapshots /opt/hdd/.hdd-state.db   # há réplica/snapshots no R2?
```
Confirmar que o Litestream estava a replicar antes do incidente (RPO ~1s).

## Passos de Recuperação

Procedimento detalhado nas secções numeradas abaixo: instalação dos binários
(**§1**), config R2 + credenciais (**§2-3**), e o **restore em VPS limpa (§4)** —
o passo central: `litestream restore` reconstrói a DB do snapshot + WAL (perda ≤
retention 24h). Fallback do dump rclone secundário em **§4**.

## Verificação

```bash
sqlite3 /opt/hdd/.hdd-state.db "PRAGMA integrity_check; SELECT COUNT(*) FROM schema_migrations;"
bun run scripts/verify-audit-chain.ts $(date -u +%F)   # chain intacta
systemctl status hdd-worker                             # active após restore
```
Drill de verificação mensal documentado em **§5** (réplica `file://`, sem tocar produção).

## Post-mortem

- **Timeline:** perda do disco/DB → restore → worker recuperado.
- **Causa-raiz:** falha de hardware/VPS? disco cheio (`[[vps-disk-full]]`)? corrupção?
- **Prevenção:** Litestream a replicar (RPO ~1s); drill mensal (§5); rclone 4×/dia;
  monitorizar lag da réplica.

---

## 1. Pré-requisitos (binários de sistema — NÃO são deps bun/npm)

Litestream e rclone são binários externos. **Versões pinadas** (Renovate nunca
faz automerge destes — architecture.md:736). `sqlite3` CLI é prereq do dump rclone.

```bash
# Litestream (GitHub releases — fixar a versão, não usar latest):
LS_VER=v0.3.13
curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/${LS_VER}/litestream-${LS_VER}-linux-amd64.tar.gz" \
  | tar -xz -C /usr/local/bin litestream

# rclone (fixar versão):
RCLONE_VER=v1.66.0
curl -fsSL "https://downloads.rclone.org/${RCLONE_VER}/rclone-${RCLONE_VER}-linux-amd64.zip" -o /tmp/rclone.zip
unzip -j /tmp/rclone.zip '*/rclone' -d /usr/local/bin

# sqlite3 CLI (dump consistente do script secundário):
apt-get install -y sqlite3
```

Verificar: `litestream version && rclone version && sqlite3 --version`.

---

## 2. Cloudflare R2 EU — bucket + credenciais

1. Cloudflare dashboard → **R2** → criar bucket `hdd-backup` na **jurisdição EU**.
2. **R2 → Manage API Tokens → Create API Token** (S3-compatible) → guardar
   `Access Key ID` + `Secret Access Key`. O endpoint é
   `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`.
3. Substituir `<ACCOUNT_ID>` em `litestream.yml` (deploy → `/etc/litestream.yml`).

### Credenciais do Litestream (Q-C3-3 — EnvironmentFile próprio, separado do worker)

```bash
install -d -m 0750 -o hdd-worker -g hdd-worker /etc/litestream
cp systemd/litestream.env.example /etc/litestream/litestream.env
# preencher LITESTREAM_ACCESS_KEY_ID / LITESTREAM_SECRET_ACCESS_KEY
chmod 0600 /etc/litestream/litestream.env
chown hdd-worker:hdd-worker /etc/litestream/litestream.env
```

O `litestream.service` tem `ExecStartPre` que recusa arrancar se este ficheiro
não for `0600` (mesmo gate de NFR-S1 que o `secrets.env` em 1.c.2). O worker
**nunca** vê estas creds (separação de concerns).

### Credenciais do rclone (dump secundário)

```bash
rclone config create r2-secondary s3 \
  provider=Cloudflare \
  access_key_id=<ACCESS_KEY_ID> \
  secret_access_key=<SECRET_ACCESS_KEY> \
  endpoint=https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com
```

---

## 3. Deploy das units

```bash
cp litestream.yml /etc/litestream.yml            # ajustar <ACCOUNT_ID>
cp systemd/litestream.service /etc/systemd/system/
cp systemd/hdd-worker.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now litestream.service        # arranca PRIMEIRO
systemctl enable --now hdd-worker.service        # Requires=/After=litestream
systemctl status litestream.service hdd-worker.service
```

**Path da DB (CRÍTICO):** o `litestream.yml` aponta para `/opt/hdd/.hdd-state.db`
(default do worker — `src/bootstrap.ts:39`, WorkingDirectory=/opt/hdd). Se usares
override `HDD_DB_PATH` no `secrets.env` do worker, o `path:` em `litestream.yml`
**TEM** de coincidir, senão o Litestream replica um ficheiro diferente do que o
worker escreve. WAL já está ligado (`src/db/connection.ts:28`) — pré-requisito do
Litestream satisfeito.

**Ordem de arranque (Q-C3-1 = serviço separado):** `hdd-worker.service` declara
`Requires=litestream.service` + `After=litestream.service` → o worker **não
arranca** se a replicação falhar (fail-closed na durabilidade). Se precisares de
arrancar o worker em modo degradado (sem réplica), trocar `Requires=` por `Wants=`
manualmente — decisão de ops, documentar.

### Cron do dump secundário

```cron
# /etc/cron.d/hdd-backup — 4×/dia (architecture.md:729)
0 */6 * * * hdd-worker /opt/hdd/scripts/rclone-daily-backup.sh >> /var/log/hdd-backup.log 2>&1
```

---

## 4. Restore numa VPS limpa (RTO 5-15s)

Cenário: disco perdido, `/opt/hdd/.hdd-state.db` ausente. Restaurar da réplica R2:

```bash
systemctl stop hdd-worker.service          # garante que ninguém escreve
litestream restore -o /opt/hdd/.hdd-state.db /opt/hdd/.hdd-state.db
# (com -config: `litestream restore -config /etc/litestream.yml /opt/hdd/.hdd-state.db`)
chown hdd-worker:hdd-worker /opt/hdd/.hdd-state.db
systemctl start hdd-worker.service
```

Litestream restaura o snapshot mais recente + replay do WAL → perda ≤ retention
(24h, normalmente segundos). Restore inicial só é relevante quando o DB local
está ausente (architecture.md:725); no piloto normal a réplica acompanha o vivo.

### Fallback: restore a partir do dump rclone (secundário)

```bash
rclone copy r2-secondary:hdd-backup/daily/data-<DATE>.db.gz /tmp/
gunzip /tmp/data-<DATE>.db.gz
mv /tmp/data-<DATE>.db /opt/hdd/.hdd-state.db
```

---

## 5. Drill de verificação mensal (D-053 — prova o mecanismo)

Sem tocar produção, com réplica **local** (`file://`):

1. Descomentar o bloco `type: file` em `litestream.yml` (réplica `/var/lib/hdd-litestream-replica`).
2. `litestream replicate -config /etc/litestream.yml` (deixar correr 1-2 min).
3. Noutro terminal: `litestream restore -o /tmp/drill.db file:///var/lib/hdd-litestream-replica`.
4. Verificar: `sqlite3 /tmp/drill.db "PRAGMA integrity_check; SELECT COUNT(*) FROM schema_migrations;"`.
5. Re-comentar o bloco `file`. Registar o resultado (data + integridade OK).

O teste automatizado `tests/integration/backup-restore.integration.test.ts`
cobre o mesmo round-trip (`skipIf(!hasLitestream)`) + o snapshot consistente
(`VACUUM INTO` + gzip, sempre activo).

---

## 6. Troubleshooting

| Sintoma | Causa provável | Acção |
|---|---|---|
| `litestream.service` falha no arranque | `litestream.env` ≠ 0600 (ExecStartPre) | `chmod 0600 /etc/litestream/litestream.env` |
| `hdd-worker` não arranca | `litestream.service` em falha (Requires=) | `journalctl -u litestream.service` → corrigir creds/endpoint |
| Réplica vazia / sem snapshots | path da DB no `.yml` ≠ path real do worker | alinhar `path:` com `HDD_DB_PATH`/default |
| `VACUUM INTO` falha no dump | `sqlite3` ausente | `apt-get install sqlite3` |
| Backup corrompido | alguém usou `cp` num WAL vivo | usar SEMPRE `VACUUM INTO`/`.backup` (o script já faz) |
| Upload rclone falha | remote `r2-secondary` não configurado | `rclone config` (secção 2) |
