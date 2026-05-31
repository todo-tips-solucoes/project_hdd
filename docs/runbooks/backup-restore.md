# Runbook — Backup WAL/PITR → Cloudflare R2 (Story 5.5)

Backup contínuo (WAL archiving) + base backups do Postgres para o **Cloudflare
R2** (S3-compatível) com **pgBackRest**, e restauração point-in-time (PITR).

> Estado: R2 ainda não provisionado. A config (`ops/pgbackrest/pgbackrest.conf`)
> vem com placeholders; o **procedimento de PITR já foi testado localmente** com
> repositório posix (`ops/pgbackrest/test-pitr.sh`, verde). Ligar à R2 é só
> mudar `repo1-type` e as credenciais — nada do fluxo muda.

## Componentes

- **Imagem** `ops/pgbackrest/Dockerfile`: `pgvector/pgvector:pg17` + pgBackRest.
  Substitui a imagem do serviço `postgres` no `stack.yaml` quando se liga o
  archiving.
- **Config** `ops/pgbackrest/pgbackrest.conf`: repo S3 (R2), stanza `hdd`,
  retenção (4 fulls), compressão zstd. Credenciais via env/secret (nunca no repo).
- **WAL archiving**: o Postgres empurra cada segmento via
  `archive_command = pgbackrest --stanza=hdd archive-push %p`.

## Provisionar (quando a R2 existir)

1. **Bucket + credenciais R2** (S3 API token com leitura/escrita no bucket
   `hdd-backups`). Anote o `R2_ACCOUNT_ID`, a Access Key e a Secret.
2. Preencha `ops/pgbackrest/pgbackrest.conf` (endpoint/bucket) e exporte os
   segredos no nó (Docker secret ou env):
   ```bash
   export PGBACKREST_REPO1_S3_KEY=...          # R2 Access Key ID
   export PGBACKREST_REPO1_S3_KEY_SECRET=...   # R2 Secret Access Key
   ```
3. No `stack.yaml`, troque a imagem do `postgres` pela buildada do Dockerfile e
   adicione o `command` com `archive_mode=on` + `archive_command` (ver Dockerfile),
   monte o `pgbackrest.conf` em `/etc/pgbackrest/` e injete as credenciais.
4. Inicialize a stanza e o primeiro backup:
   ```bash
   docker exec hdd_postgres pgbackrest --stanza=hdd stanza-create
   docker exec hdd_postgres pgbackrest --stanza=hdd check
   docker exec hdd_postgres pgbackrest --stanza=hdd --type=full backup
   ```

## Agendamento

Backups recorrentes via cron no nó (full semanal, diferencial diário):

```cron
# /etc/cron.d/hdd-pgbackrest
30 3 * * 0 root docker exec hdd_postgres pgbackrest --stanza=hdd --type=full backup
30 3 * * 1-6 root docker exec hdd_postgres pgbackrest --stanza=hdd --type=diff backup
```

A retenção (`repo1-retention-full=4`) expira backups antigos automaticamente.

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
