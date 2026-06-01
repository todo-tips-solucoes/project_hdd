#!/bin/sh
# Entrypoint do api/worker (Story 6.4 — hardening). Carrega segredos montados em
# /run/secrets para o ambiente dos CLIs que leem ENV (claude lê CLAUDE_CODE_OAUTH_TOKEN,
# gh lê GH_TOKEN), SEM expor os tokens via `docker inspect`/env do compose.
#
# Não-quebra dev: se o arquivo de secret não existir, mantém o que veio do ambiente.
set -e

if [ -f /run/secrets/hdd_gh_token ]; then
    GH_TOKEN="$(cat /run/secrets/hdd_gh_token)"
    export GH_TOKEN
fi

if [ -f /run/secrets/hdd_claude_oauth_token ]; then
    CLAUDE_CODE_OAUTH_TOKEN="$(cat /run/secrets/hdd_claude_oauth_token)"
    export CLAUDE_CODE_OAUTH_TOKEN
fi

exec "$@"
