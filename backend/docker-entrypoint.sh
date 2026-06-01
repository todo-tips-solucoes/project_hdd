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
    # Configura o git para autenticar via GH_TOKEN (credential helper do gh) —
    # sem isto, clone/push de repos privados no contêiner falha ("could not read
    # Username"). Só ter GH_TOKEN no env não basta. Descoberto no smoke compose.
    if command -v gh >/dev/null 2>&1; then
        gh auth setup-git 2>/dev/null || true
    fi
fi

if [ -f /run/secrets/hdd_claude_oauth_token ]; then
    CLAUDE_CODE_OAUTH_TOKEN="$(cat /run/secrets/hdd_claude_oauth_token)"
    export CLAUDE_CODE_OAUTH_TOKEN
fi

exec "$@"
