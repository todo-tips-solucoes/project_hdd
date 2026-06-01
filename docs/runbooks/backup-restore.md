# Runbook — Backup WAL/PITR → Cloudflare R2 (Story 5.5)

Backup contínuo (WAL archiving) + base backups do Postgres para o **Cloudflare
R2** (S3-compatível) com **pgBackRest**, e restauração point-in-time (PITR).

> Estado: **R2 PROVISIONADO e validado em produção (2026-06-01, Story 6.5)** —
> stanza-create, backup full+diff, WAL archiving e `verify` (integridade do repo)
> todos OK contra o bucket real. O procedimento de PITR (restore) está provado
> localmente (`ops/pgbackrest/test-pitr.sh`, posix); em produção valida-se com
> `verify` (read-only) para não tocar a base viva.

## Componentes

- **Imagem** `ops/pgbackrest/Dockerfile`: `pgvector/pgvector:pg17` + pgBackRest.
  Substitui a imagem do serviço `postgres` no `stack.yaml` quando se liga o
  archiving.
- **Config** `ops/pgbackrest/pgbackrest.conf`: repo S3 (R2), stanza `hdd`,
  retenção (4 fulls), compressão zstd. Credenciais via env/secret (nunca no repo).
- **WAL archiving**: o Postgres empurra cada segmento via
  `archive_command = pgbackrest --stanza=hdd archive-push %p`.

## Provisionar (compose — feito em produção 2026-06-01)

1. **Bucket + R2 API Token** (Object Read & Write, escopado ao bucket). Anote:
   Account ID (→ endpoint `<id>.r2.cloudflarestorage.com`), nome do bucket,
   Access Key ID, Secret. **Gotcha:** confirme o nome EXATO do bucket — um
   `403 AccessDenied` no `ListObjects` quase sempre é nome/escopo errado (diagnostique
   com `aws-cli --endpoint-url ... s3 ls s3://<bucket>/`).
2. Escreva as keys em secrets (gitignored) e o endpoint/bucket no `deploy.env`:
   ```bash
   printf '%s' "<ACCESS_KEY_ID>" > secrets/hdd_r2_access_key && chmod 644 secrets/hdd_r2_access_key
   printf '%s' "<SECRET_KEY>"    > secrets/hdd_r2_secret_key && chmod 644 secrets/hdd_r2_secret_key
   # deploy.env:
   PGBACKREST_REPO1_S3_ENDPOINT=<id>.r2.cloudflarestorage.com
   PGBACKREST_REPO1_S3_BUCKET=<bucket>
   ```
   As keys vão para o ENV do `pgbackrest` via o **entrypoint** da imagem
   (`ops/pgbackrest/postgres-entrypoint.sh`) — nunca em `docker inspect`.
3. `compose.prod.yaml` já usa a imagem `hdd-postgres` (pgvector+pgBackRest+**ca-certificates**),
   liga `archive_mode=on`+`archive_command`, monta o `pgbackrest.conf` e os R2 secrets.
   ```bash
   docker build -t hdd-postgres:latest ops/pgbackrest
   docker compose --env-file deploy.env -f compose.prod.yaml up -d --force-recreate postgres
   ```
4. Inicialize (rode como `postgres`, exportando as keys do secret no exec):
   ```bash
   docker compose -f compose.prod.yaml exec -u postgres postgres sh -c '
     export PGBACKREST_REPO1_S3_KEY=$(cat /run/secrets/hdd_r2_access_key)
     export PGBACKREST_REPO1_S3_KEY_SECRET=$(cat /run/secrets/hdd_r2_secret_key)
     pgbackrest --stanza=hdd stanza-create
     pgbackrest --stanza=hdd --type=full backup
     pgbackrest --stanza=hdd check          # valida o WAL archiving
     pgbackrest --stanza=hdd verify'        # integridade do repo (read-only)
   ```
   > **Gotchas resolvidos:** (a) o role/db é `hdd`, não `postgres` → `pg1-user=hdd`/
   > `pg1-database=hdd` no conf; (b) falta de `ca-certificates` na imagem → erro de
   > cert TLS (instalado no Dockerfile); (c) editar o `pgbackrest.conf` bind-montado
   > exige recriar o contêiner (inode novo).

## Agendamento (ativo em produção)

`ops/pgbackrest/scheduled-backup.sh <full|diff>` invoca o pgbackrest no contêiner
postgres (keys dos secrets, nunca em env). Cron instalado no nó:

```cron
0 3 * * 0   /var/lib/projeto_hdd/ops/pgbackrest/scheduled-backup.sh full >> /var/log/hdd-backup.log 2>&1
0 3 * * 1-6 /var/lib/projeto_hdd/ops/pgbackrest/scheduled-backup.sh diff >> /var/log/hdd-backup.log 2>&1
```

Full semanal (Dom 03h) + diferencial diário (Seg–Sáb 03h). A retenção
(`repo1-retention-full=4`) expira backups antigos automaticamente.

## Restauração point-in-time (PITR)

Restaura o cluster ao instante `T` (ex.: logo antes de um incidente):

```bash
docker exec hdd_postgres pg_ctl -D /var/lib/postgresql/data -m fast stop
docker exec hdd_postgres pgbackrest --stanza=hdd --delta \
    --type=time --target="2026-05-31 23:20:59+00" --target-action=promote restore
docker exec hdd_postgres pg_ctl -D /var/lib/postgresql/data start
# acompanhar até sair do recovery:
docker exec hdd_postgres psql -tAc "SELECT pg_is_in_recovery()"   # → f
```

`--type=time` exige um backup full com *stop time* anterior ao alvo. Sem alvo
(`--type=default`), restaura ao fim do WAL disponível (recuperação total).

### Teste do procedimento (sem R2)

`ops/pgbackrest/test-pitr.sh` valida o fluxo completo num container isolado com
repo local: full backup → insere `antes-T1` (marca T1) → insere `depois-T1` →
PITR para T1 → confirma que só `antes-T1` sobrevive.

```bash
docker run --rm -v "$PWD/ops/pgbackrest:/ops:ro" postgres:17 bash /ops/test-pitr.sh
# → "PITR OK — 'depois-T1' revertido, 'antes-T1' preservado"
```

## Interação com a LGPD (crypto-shredding)

Um titular cujos dados foram crypto-shredded (`docs/runbooks/lgpd.md`) **não
reaparece** num restore: o backup só contém o ciphertext, e a chave (DEK)
descartada não está em lugar nenhum recuperável. Restaurar não desfaz a exclusão.
