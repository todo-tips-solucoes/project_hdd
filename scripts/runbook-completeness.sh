#!/usr/bin/env bash
# runbook-completeness.sh — gate anti-rot dos runbooks must-have (Story 1.c.6, AC1).
#
# Verifica que cada um dos 8 runbooks de incident-response tem as 5 secções
# canónicas (PT — Q-C6-2). Exit ≠0 se algum tiver <5. Materializa a lição
# feedback-hdd-soft-convention-rot: o gate impede que um runbook degrade.
#
# Scope (Q-C6-1): SÓ os 8 must-have. ssh-deploy/systemd-deploy são how-to
# operacional (entram no index, não neste gate).
set -euo pipefail

cd "$(dirname "$0")/.."
RUNBOOKS_DIR="docs/runbooks"

# Lista canónica dos 8 must-have (epics.md#Story-1.c.6).
MUST_HAVE=(
  secret-rotation
  ban-anthropic-emergency
  litestream-restore
  hash-chain-corruption
  whatsapp-template-rejection
  clihelper-endpoint-down
  vps-disk-full
  manual-rollback
)

# As 5 secções obrigatórias (headings markdown, PT).
SECTIONS=("## Sintoma" "## Diagnóstico" "## Passos de Recuperação" "## Verificação" "## Post-mortem")

fail=0
for name in "${MUST_HAVE[@]}"; do
  file="${RUNBOOKS_DIR}/${name}.md"
  if [[ ! -f "${file}" ]]; then
    printf '  ✗ %-28s AUSENTE\n' "${name}" >&2
    fail=1
    continue
  fi
  found=0
  missing=""
  for section in "${SECTIONS[@]}"; do
    if grep -qF "${section}" "${file}"; then
      found=$((found + 1))
    else
      missing="${missing} '${section}'"
    fi
  done
  if [[ "${found}" -eq 5 ]]; then
    printf '  ✓ %-28s 5/5\n' "${name}"
  else
    printf '  ✗ %-28s %d/5 — falta:%s\n' "${name}" "${found}" "${missing}" >&2
    fail=1
  fi
done

echo "  ----------------------------------------"
if [[ "${fail}" -eq 0 ]]; then
  echo "✓ 8/8 runbooks must-have completos (5/5 secções cada)."
else
  echo "✗ runbooks incompletos — ver acima." >&2
  exit 1
fi
