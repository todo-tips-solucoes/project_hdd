# Runbook — Deploy em produção (Docker Swarm + Caddy/TLS) — Story 5.1

Sobe o control plane do HDD num nó Swarm (Hetzner): Postgres, API, worker,
painel e Caddy (TLS automático). Validado num Swarm local de 1 nó.

## Topologia

```
Internet ──443/80──> caddy ──> api:8000        (/api,/auth,/webhooks,/healthz,…)
                          └──> frontend:3000   (painel Next.js, todo o resto)
  api, worker ──> postgres:5432   (rede interna "backend", sem exposição)
```

- **Imagens** (`backend/Dockerfile` multi-stage, `frontend/Dockerfile`):
  `hdd-api` (uvicorn, enxuta), `hdd-worker` (uvicorn-less; Node+Claude Code CLI
  + git/gh para abrir PR), `hdd-frontend` (Next.js standalone).
- **Same-origin:** painel e API no mesmo domínio → o frontend é buildado com
  `NEXT_PUBLIC_API_BASE=""` (URLs relativas; cookie de sessão httpOnly viaja).
- **Migrations:** o serviço `api` roda `alembic upgrade head` antes do uvicorn
  (idempotente; com 1 réplica não há corrida).

## Pré-requisitos

1. Nó Swarm: `docker swarm init --advertise-addr <IP>`.
2. **DNS:** `A`/`AAAA` de `$HDD_DOMAIN` apontando para o IP do nó (Caddy precisa
   resolver para emitir o certificado ACME). Portas 80 e 443 abertas.
3. **Secrets** criados (ver `docs/runbooks/secrets.md`) — nomes `hdd_*`:
   `hdd_pg_dsn`, `hdd_session_secret`, `hdd_github_client_secret`,
   `hdd_clihelper_token`, `hdd_webhook_hmac_secret`, `hdd_postgres_password`.
   > O `hdd_pg_dsn` deve apontar para `@postgres:5432` e usar a MESMA senha do
   > `hdd_postgres_password`.
4. **Imagens** buildadas no nó (ou num registry e referenciadas via env):
   ```bash
   docker build -t hdd-api:latest    --target api    backend
   docker build -t hdd-worker:latest --target worker backend
   docker build -t hdd-frontend:latest                frontend
   ```
5. **deploy.env** preenchido a partir de `deploy.env.example`.

## Deploy

`docker stack deploy` **não** lê `.env` — exporte as variáveis antes:

```bash
set -a && . ./deploy.env && set +a
docker stack deploy -c stack.yaml hdd
docker stack services hdd          # aguardar REPLICAS 1/1
docker service logs -f hdd_caddy   # acompanhar emissão do certificado
```

## Verificação

```bash
curl -sS https://$HDD_DOMAIN/healthz       # {"status":"ok"}  (TLS válido)
curl -sS https://$HDD_DOMAIN/              # painel (HTML)
```

OAuth: registre o callback `https://$HDD_DOMAIN/auth/callback` no GitHub App.
`HDD_PANEL_BASE_URL`/`HDD_CORS_ORIGINS` já são `https://$HDD_DOMAIN` (stack.yaml);
o `--proxy-headers` do uvicorn faz o redirect OAuth usar https atrás do Caddy.

## Credenciais do worker (decisão do operador: via .env)

O worker invoca `claude -p` (conta de assinatura) e `gh` (PR rascunho). Os
tokens vêm do `deploy.env`: `CLAUDE_CODE_OAUTH_TOKEN` e `HDD_GH_TOKEN`.
> ⚠️ Risco D-032/D-052: automação contínua na conta de assinatura. O provider
> já passa `--disallowedTools` (descoberta da PoC). Endurecimento futuro: spawn
> do sandbox (`sandbox/Dockerfile`) via socket Docker — fora do MVP por exigir
> privilégio root-no-host.

## Escala e teto de quota

`HDD_WORKER_REPLICAS` escala o worker. O teto global de `claude -p` concorrentes
é garantido pela **quota lease** no Postgres (Story 5.2) — não pela contagem de
réplicas. Sem slot, o worker aguarda.

## Operação

```bash
docker stack ps hdd                       # tarefas e estado
docker service update --image hdd-api:novo hdd_api   # rollout de nova versão
docker stack rm hdd                       # derruba (volumes e secrets ficam)
```

Volumes `pgdata`/`caddy_data` persistem entre deploys. Backup do Postgres:
ver `docs/runbooks/backup-restore.md` (Story 5.5).
