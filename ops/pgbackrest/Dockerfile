# syntax=docker/dockerfile:1
# Postgres 17 + pgvector + pgBackRest (Story 5.5) — substitui a imagem do serviço
# postgres no stack.yaml quando se habilita o archiving WAL para R2.
FROM pgvector/pgvector:pg17

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest \
    && rm -rf /var/lib/apt/lists/*

# A config (ops/pgbackrest/pgbackrest.conf) é montada em /etc/pgbackrest/.
# O archive_command e o archive_mode são ligados via `command:` no stack.yaml:
#   command:
#     - postgres
#     - -c
#     - archive_mode=on
#     - -c
#     - archive_command=pgbackrest --stanza=hdd archive-push %p
