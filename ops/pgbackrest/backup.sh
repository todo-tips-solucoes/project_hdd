#!/usr/bin/env bash
# Backup periódico do pgBackRest (stanza hdd, Story 6.5) via docker exec no
# container postgres de prod. As credenciais R2 vêm dos SECRETS montados no
# container (/run/secrets/hdd_r2_*) — nunca expostas no env do host nem nos args
# (não aparecem em `docker inspect`/`ps`).
#
# Uso: backup.sh <full|diff|incr>   (default: full)
# Cron (usuário hdd): full semanal (dom) + diff diário (seg-sáb).
#   17 3 * * 0  .../backup.sh full  >> .../backup.log 2>&1
#   17 3 * * 1-6 .../backup.sh diff >> .../backup.log 2>&1
# Retenção: repo1-retention-full=4 (pgbackrest.conf) → ~4 semanas de fulls.
set -uo pipefail

TYPE="${1:-full}"
CONTAINER="${HDD_PG_CONTAINER:-projeto_hdd-postgres-1}"
DOCKER="$(command -v docker || echo /usr/bin/docker)"

ts() { date -u +'%Y-%m-%dT%H:%M:%SZ'; }

echo "[$(ts)] pgbackrest backup --type=${TYPE} — início (container=${CONTAINER})"

if "$DOCKER" exec -e BK_TYPE="$TYPE" "$CONTAINER" sh -c '
      export PGBACKREST_REPO1_S3_KEY="$(cat /run/secrets/hdd_r2_access_key)"
      export PGBACKREST_REPO1_S3_KEY_SECRET="$(cat /run/secrets/hdd_r2_secret_key)"
      exec pgbackrest --stanza=hdd --type="$BK_TYPE" backup
   '; then
  rc=0
else
  rc=$?
fi

echo "[$(ts)] pgbackrest backup --type=${TYPE} — fim (rc=${rc})"
exit "$rc"
