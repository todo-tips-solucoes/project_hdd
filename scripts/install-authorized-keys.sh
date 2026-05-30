#!/usr/bin/env bash
# install-authorized-keys.sh — instala a SSH key de deploy com forced command
# (Story 1.c.5, NFR-S6/AR-112). Restringe a key a correr APENAS deploy.sh.
#
# Scope (como install-secrets.sh em 1.c.2): install + verify, idempotente. NÃO
# cria o user hdd-worker (host setup → docs/runbooks/ssh-deploy.md). set -u, sem set -x.
set -euo pipefail

USER_NAME="${HDD_USER:-hdd-worker}"
DEPLOY_SCRIPT="${HDD_DEPLOY_SCRIPT:-/opt/hdd/scripts/deploy.sh}"
SSH_DIR="$(getent passwd "${USER_NAME}" | cut -d: -f6)/.ssh"
AUTH_KEYS="${SSH_DIR}/authorized_keys"
PUBKEY_FILE="${1:-}"

if [[ -z "${PUBKEY_FILE}" ]]; then
  echo "uso: install-authorized-keys.sh <ficheiro-pubkey>" >&2
  exit 2
fi
if [[ ! -f "${PUBKEY_FILE}" ]]; then
  echo "erro: pubkey não existe: ${PUBKEY_FILE}" >&2
  exit 2
fi
# Valida que é uma pubkey SSH legítima antes de a instalar.
if ! ssh-keygen -l -f "${PUBKEY_FILE}" >/dev/null 2>&1; then
  echo "erro: ${PUBKEY_FILE} não é uma chave pública SSH válida" >&2
  exit 1
fi

# Opções de hardening: força o comando, desliga pty/forwarding (NFR-S6).
OPTS='command="'"${DEPLOY_SCRIPT}"'",no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding'
LINE="${OPTS} $(cat "${PUBKEY_FILE}")"

install -d -m 0700 -o "${USER_NAME}" -g "${USER_NAME}" "${SSH_DIR}"
touch "${AUTH_KEYS}"

# Idempotente: não duplica a mesma pubkey (compara o material da chave).
KEY_MATERIAL="$(awk '{print $2}' "${PUBKEY_FILE}")"
if grep -qF "${KEY_MATERIAL}" "${AUTH_KEYS}" 2>/dev/null; then
  echo "✓ pubkey já presente em ${AUTH_KEYS} (idempotente — sem mudança)"
else
  printf '%s\n' "${LINE}" >>"${AUTH_KEYS}"
  echo "✓ forced-command key instalada em ${AUTH_KEYS}"
fi

chmod 0600 "${AUTH_KEYS}"
chown "${USER_NAME}:${USER_NAME}" "${AUTH_KEYS}"
echo "  → testar: ssh ${USER_NAME}@<vps> deploy <sha>"
