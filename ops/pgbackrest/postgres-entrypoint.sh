#!/bin/sh
# Entrypoint do postgres+pgBackRest (Story 6.5). Exporta as credenciais R2 de
# /run/secrets para o ambiente do processo postgres — assim o `archive_command`
# (pgbackrest archive-push, filho do postgres) as herda — SEM expô-las via
# `docker inspect`/env do compose. Não-quebra dev: se o secret faltar, segue.
set -e

if [ -f /run/secrets/hdd_r2_access_key ]; then
    PGBACKREST_REPO1_S3_KEY="$(cat /run/secrets/hdd_r2_access_key)"
    export PGBACKREST_REPO1_S3_KEY
fi
if [ -f /run/secrets/hdd_r2_secret_key ]; then
    PGBACKREST_REPO1_S3_KEY_SECRET="$(cat /run/secrets/hdd_r2_secret_key)"
    export PGBACKREST_REPO1_S3_KEY_SECRET
fi

exec docker-entrypoint.sh "$@"
