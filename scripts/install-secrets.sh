#!/usr/bin/env bash
# install-secrets.sh — instala /etc/hdd/secrets.env com perm 0600 (Story 1.c.2).
#
# Scope (Q-C2-3): install + verify, idempotente. NÃO cria o user hdd-worker
# (host setup → docs/runbooks/secret-rotation.md). Nunca ecoa o conteúdo.
set -euo pipefail   # NB: sem `set -x` — não vazar secrets

DEST="/etc/hdd/secrets.env"
OWNER="hdd-worker"
SRC="${1:-}"

if [[ -z "${SRC}" ]]; then
  echo "uso: install-secrets.sh <ficheiro-secrets-preenchido>" >&2
  echo "  (copia de systemd/hdd-worker.env.example, preenche, e passa o path)" >&2
  exit 2
fi
if [[ ! -f "${SRC}" ]]; then
  echo "erro: ficheiro de origem não existe: ${SRC}" >&2
  exit 2
fi

# Recusa se a origem já estiver com perm laxa (não propagar exposição).
src_perm="$(stat -c %a "${SRC}")"
if [[ "${src_perm}" != "600" && "${src_perm}" != "400" ]]; then
  echo "erro: origem ${SRC} tem perm ${src_perm} (laxa). chmod 600 antes." >&2
  exit 1
fi

install -d -m 0750 -o "${OWNER}" -g "${OWNER}" /etc/hdd
install -m 0600 -o "${OWNER}" -g "${OWNER}" "${SRC}" "${DEST}"

# Verify (AC-1): perm final tem de ser 0600.
final_perm="$(stat -c %a "${DEST}")"
if [[ "${final_perm}" != "600" ]]; then
  echo "erro: ${DEST} ficou com perm ${final_perm}, esperado 600" >&2
  exit 1
fi

echo "✓ ${DEST} instalado (0600, owner ${OWNER}). Re-correr é idempotente."
echo "  → systemctl restart hdd-worker para aplicar."
