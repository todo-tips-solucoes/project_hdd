#!/usr/bin/env bash
# rclone-daily-backup.sh — backup SECUNDÁRIO do state (Story 1.c.3, AC2).
#
# Litestream (primário) faz stream contínuo do WAL → R2 (RPO ~1s). Este script
# é a 2ª linha de defesa: dump point-in-time gzipped → bucket R2 secundário,
# 4×/dia via cron `0 */6 * * *` (architecture.md:729). Defende contra corrupção
# lógica que o stream propagaria.
#
# Snapshot CONSISTENTE (NÃO `cp` de um WAL vivo → backup corrompido): usa
# `sqlite3 VACUUM INTO` (transacção atómica, lê estado consistente mesmo com o
# worker a escrever). sqlite3 é prereq de produção (ver runbook).
#
# Credenciais R2: rclone remote `r2-secondary` configurado em ~/.config/rclone
# (ver runbook). Sem `set -x` (paths/creds não devem vazar nos logs do cron).
set -euo pipefail

DB="${HDD_DB_PATH:-/opt/hdd/.hdd-state.db}"
REMOTE="${HDD_RCLONE_REMOTE:-r2-secondary:hdd-backup/daily}"
DATE="$(date -u +%Y-%m-%d)"
SNAP="data-${DATE}.db"

if [[ ! -f "${DB}" ]]; then
  echo "erro: db não existe: ${DB}" >&2
  exit 1
fi
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "erro: sqlite3 não instalado (prereq — ver runbook)" >&2
  exit 1
fi
if ! command -v rclone >/dev/null 2>&1; then
  echo "erro: rclone não instalado (prereq — ver runbook)" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# Snapshot atómico (consistente mesmo com escritas concorrentes ao WAL).
sqlite3 "${DB}" "VACUUM INTO '${WORK}/${SNAP}'"
gzip "${WORK}/${SNAP}"

# Upload para o bucket secundário (idempotente — rclone copy não duplica).
rclone copy "${WORK}/${SNAP}.gz" "${REMOTE}/"

echo "✓ dump ${SNAP}.gz → ${REMOTE}/"
