#!/usr/bin/env bash
# measure-ci-time.sh — proxy LOCAL do wall-clock do gate de CI (Story 1.c.4, AR-017).
#
# O número AUTORITATIVO do alvo <60s é o GitHub Actions UI (`gh run view`), que
# inclui setup-bun + install + jobs paralelos. Este script cronometra os mesmos
# comandos do gate localmente como proxy rápido de regressão (sem rede/cache do
# runner). Resolução de segundos — suficiente para detectar drift grosseiro.
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET=60
declare -a NAMES TIMES
total_start=$SECONDS

step() {
  local name="$1"
  shift
  local t=$SECONDS
  if "$@" >/dev/null 2>&1; then
    local elapsed=$((SECONDS - t))
    NAMES+=("${name}")
    TIMES+=("${elapsed}")
    printf '  ✓ %-16s %3ds\n' "${name}" "${elapsed}"
  else
    printf '  ✗ %-16s FALHOU\n' "${name}" >&2
    exit 1
  fi
}

echo "Proxy local do gate de CI (alvo <${TARGET}s; autoritativo = GH Actions UI):"
step "lint" bun run lint
step "type-check" bun run type-check
step "test" bun test
step "test:security" bun run test:security
step "build:compile" bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker

total=$((SECONDS - total_start))
echo "  ----------------------------------"
printf '  TOTAL (proxy)     %3ds  (alvo <%ds)\n' "${total}" "${TARGET}"
rm -f dist/hdd-worker

if [[ "${total}" -lt "${TARGET}" ]]; then
  echo "✓ proxy local dentro do alvo — confirmar no GH Actions UI apos push."
else
  echo "⚠ proxy local ≥${TARGET}s — o CI real (jobs paralelos) pode diferir; verificar GH Actions." >&2
fi
