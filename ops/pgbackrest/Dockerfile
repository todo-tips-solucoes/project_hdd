# syntax=docker/dockerfile:1
# Postgres 17 + pgvector + pgBackRest (Story 5.5) — substitui a imagem do serviço
# postgres no stack.yaml quando se habilita o archiving WAL para R2.
FROM pgvector/pgvector:pg17

RUN apt-get update \
    && apt-get install -y --no-install-recommends pgbackrest ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o postgres -g postgres /var/log/pgbackrest

# Entrypoint que exporta as credenciais R2 de /run/secrets (Story 6.5) e delega
# ao entrypoint oficial do postgres — assim o archive_command as herda sem env.
COPY postgres-entrypoint.sh /usr/local/bin/hdd-postgres-entrypoint.sh
RUN chmod +x /usr/local/bin/hdd-postgres-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/hdd-postgres-entrypoint.sh"]

# A config (ops/pgbackrest/pgbackrest.conf) é montada em /etc/pgbackrest/.
# O archive_command e o archive_mode são ligados via `command:` no stack.yaml:
#   command:
#     - postgres
#     - -c
#     - archive_mode=on
#     - -c
#     - archive_command=pgbackrest --stanza=hdd archive-push %p
