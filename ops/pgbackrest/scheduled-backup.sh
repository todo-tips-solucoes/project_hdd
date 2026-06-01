#!/bin/sh
# Backup agendado do Postgres → R2 (Story 6.5). Uso: scheduled-backup.sh <full|diff>
# Roda no HOST; invoca o pgbackrest DENTRO do contêiner postgres (com as keys R2
# vindas dos secrets, nunca em env). Pensado para cron (ver docs/runbooks/backup-restore.md).
set -e
TYPE="${1:-diff}"
DIR="$(cd "$(dirname "$0")/../.." && pwd)"   # raiz do projeto (onde estão compose/deploy.env)
cd "$DIR"
docker compose --env-file deploy.env -f compose.prod.yaml exec -T -u postgres postgres sh -c "
  export PGBACKREST_REPO1_S3_KEY=\"\$(cat /run/secrets/hdd_r2_access_key)\"
  export PGBACKREST_REPO1_S3_KEY_SECRET=\"\$(cat /run/secrets/hdd_r2_secret_key)\"
  pgbackrest --stanza=hdd --type=${TYPE} backup
"
