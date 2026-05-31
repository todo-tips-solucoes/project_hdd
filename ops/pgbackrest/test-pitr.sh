#!/usr/bin/env bash
# Teste local de PITR (point-in-time recovery) com pgBackRest — Story 5.5.
#
# Prova o PROCEDIMENTO de restauração ponto-no-tempo usando um repositório local
# (repo1-type=posix). Em produção, a ÚNICA diferença é o repo apontar para o
# Cloudflare R2 (repo1-type=s3) — ver ops/pgbackrest/pgbackrest.conf.
#
# Uso (autocontido, sem R2):
#   docker run --rm -v "$PWD/ops/pgbackrest:/ops:ro" postgres:17 bash /ops/test-pitr.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq pgbackrest >/dev/null

export PGDATA=/tmp/pgdata
REPO=/tmp/pgbackrest
mkdir -p "$PGDATA" "$REPO" /tmp/log /etc/pgbackrest
chown -R postgres:postgres "$PGDATA" "$REPO" /tmp/log /etc/pgbackrest

cat > /etc/pgbackrest/pgbackrest.conf <<EOF
[global]
repo1-path=$REPO
repo1-retention-full=2
start-fast=y
log-path=/tmp/log
log-level-console=warn

[hdd]
pg1-path=$PGDATA
pg1-port=5599
EOF
chown postgres:postgres /etc/pgbackrest/pgbackrest.conf

run() { su postgres -c "$1"; }
PSQL="psql -p 5599 -tA -v ON_ERROR_STOP=1"

run "initdb -D $PGDATA >/dev/null"
cat >> "$PGDATA/postgresql.conf" <<EOF
archive_mode = on
archive_command = 'pgbackrest --stanza=hdd archive-push %p'
wal_level = replica
listen_addresses = '127.0.0.1'
port = 5599
EOF

run "pg_ctl -D $PGDATA -l /tmp/log/pg.log -w start"
run "pgbackrest --stanza=hdd stanza-create"
run "pgbackrest --stanza=hdd --type=full backup"
sleep 2  # margem: T1 deve ficar claramente após o stop time do backup full

run "$PSQL -c \"CREATE TABLE t(id int, marca text)\""
run "$PSQL -c \"INSERT INTO t VALUES (1,'antes-T1')\""
T1=$(run "$PSQL -c \"SELECT now()\"")
echo "alvo PITR (T1) = $T1"
run "$PSQL -c \"SELECT pg_sleep(1)\""
run "$PSQL -c \"INSERT INTO t VALUES (2,'depois-T1')\""
# Garante que o WAL com as duas inserções foi arquivado antes de parar.
run "$PSQL -c \"SELECT pg_switch_wal()\""
run "$PSQL -c \"CHECKPOINT\""
sleep 2

run "pg_ctl -D $PGDATA -m fast -w stop"

# PITR: restaura ao instante T1 (antes da 2ª inserção) e promove.
run "pgbackrest --stanza=hdd --delta --type=time --target=\"$T1\" --target-action=promote restore"
run "pg_ctl -D $PGDATA -l /tmp/log/pg.log -w start"
for _ in $(seq 1 30); do
  [ "$(run "$PSQL -c \"SELECT pg_is_in_recovery()\"" 2>/dev/null || echo t)" = "f" ] && break
  sleep 1
done

ROWS=$(run "$PSQL -c \"SELECT coalesce(string_agg(marca, ',' ORDER BY id),'(vazio)') FROM t\"")
echo "conteúdo após PITR para T1: [$ROWS]"
if [ "$ROWS" = "antes-T1" ]; then
  echo "PITR OK — 'depois-T1' revertido, 'antes-T1' preservado"
else
  echo "PITR FALHOU — esperado 'antes-T1'"
  exit 1
fi
