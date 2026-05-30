#!/usr/bin/env bash
# deploy.sh — alvo do SSH forced command (Story 1.c.5, NFR-S6/AR-112/D-04.25).
#
# Instalado em authorized_keys como `command="/opt/hdd/scripts/deploy.sh"`. O SSH
# IGNORA o comando que o cliente pede e corre SEMPRE este script; o comando
# original chega em $SSH_ORIGINAL_COMMAND. Sem shell livre.
#
# Fluxo (Q-C5-2): valida `deploy <sha>` → git fetch+checkout → bun build --compile
# → systemctl restart → regista DeployCompleted no audit (Q-C5-1).
#
# Segurança: o sha É validado contra ^[0-9a-f]{7,40}$ ANTES de tocar no git
# (fronteira anti command-injection via SSH_ORIGINAL_COMMAND). set -u, sem set -x.
set -euo pipefail

HDD_HOME="${HDD_HOME:-/opt/hdd}"
CMD="${SSH_ORIGINAL_COMMAND:-}"

# Parse defensivo: só aceita exactamente `deploy <sha>`.
read -r verb sha _rest <<<"${CMD}"
if [[ "${verb}" != "deploy" ]]; then
  echo "rejeitado: apenas 'deploy <commit-sha>' é permitido (sem shell livre)" >&2
  exit 2
fi
if [[ ! "${sha}" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "rejeitado: sha inválido '${sha}' (esperado hex 7-40)" >&2
  exit 2
fi

cd "${HDD_HOME}"

# 1. Trazer o código do commit pedido.
git fetch --quiet origin
git checkout --quiet "${sha}"

# 2. Recompilar o binário standalone (NFR-P1; entry real src/cli/hdd-worker.ts).
bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker

# 3. Reiniciar o worker (a unit é gerida pelo host; ver runbook).
systemctl restart hdd-worker.service

# 4. Registar DeployCompleted na audit hash-chain (mesma DB/baseDir do worker).
bun run scripts/audit-deploy.ts "${sha}"

echo "✓ deploy ${sha} aplicado + auditado"
