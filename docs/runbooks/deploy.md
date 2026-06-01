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
- **Migrations (Story 6.12):** um serviço **`migrate`** one-shot roda `alembic upgrade
  head` uma única vez e sai; `api`/`worker` dependem dele. No **compose** isso é
  garantido por `depends_on: migrate: condition: service_completed_successfully`. No
  **Swarm** o `depends_on` é ignorado — o `migrate` corre com `restart_policy: none` e
  api/worker reconectam (restart on-failure) até o schema existir; se preferir ordem
  determinística, rode a migration antes do deploy:
  `docker run --rm --network hdd_backend -v ./secrets:/run/secrets:ro hdd-api:latest alembic upgrade head`.
  Tirar a migration do `command` da api elimina a corrida quando a api escala &gt; 1 réplica.

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
   docker build -t hdd-api:latest      --target api    backend
   docker build -t hdd-worker:latest   --target worker backend
   docker build -t hdd-frontend:latest                 frontend
   docker build -t hdd-sandbox:latest                  sandbox   # Story 6.3/6.9
   ```
   > A imagem `hdd-sandbox` precisa existir NO NÓ (o worker faz `docker run` dela
   > no daemon do host). Se usar registry, garanta que o daemon a puxe.
5. **deploy.env** preenchido a partir de `deploy.env.example`. Para o E2E real
   (Story 6.4) preencha também: `HDD_REPO_URL`, `HDD_REPO_SLUG`, `HDD_WORKSPACE_ROOT`,
   `HDD_DOCKER_GID` (`getent group docker | cut -d: -f3`).
6. **Workspaces (Story 6.9):** `mkdir -p /var/lib/hdd-workspaces` no host (o worker
   clona aqui e o sandbox de verify monta o MESMO path via o daemon — por isso é um
   caminho do host bind-montado no worker; ver ADR 0004).

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

## Credenciais do worker e da API (decisão do operador: via .env)

O worker invoca `claude -p` (conta de assinatura) e `gh` (abre o PR rascunho);
a **API** invoca `gh` para **mergear** o PR ao aprovar o gate (Story 6.8/ADR 0003).
Os tokens vêm do `deploy.env`: `CLAUDE_CODE_OAUTH_TOKEN` e `HDD_GH_TOKEN` (este
último vai para worker e api).
> ⚠️ Risco D-032/D-052: automação contínua na conta de assinatura. O provider
> já passa `--disallowedTools` (descoberta da PoC).
> ⚠️ **Segurança (ADR 0003):** a API (internet-facing) ganha `gh`+`GH_TOKEN` para
> mergear → use um token de **escopo mínimo** (só o repo-alvo).

## Verify no sandbox a partir do worker (Story 6.9 / ADR 0004)

O nó `verify` faz `docker run` da imagem `hdd-sandbox` (`--network none`, sem
credenciais). Em produção isso exige que o worker fale com o daemon do host:
- o `stack.yaml` monta `/var/run/docker.sock` no worker e o `Dockerfile` traz o
  CLI `docker`;
- `HDD_DOCKER_GID` (gid do grupo `docker` no host) dá ao uid 10001 acesso ao
  socket sem rodar como root;
- `HDD_WORKSPACE_ROOT` é um caminho do **host** bind-montado no worker no mesmo
  path (o mount do sandbox é resolvido pelo daemon do host — ver ADR 0004).
> ⚠️ **Segurança:** o socket do Docker é **root-equivalente no host**. Maior
> exposição do MVP; aceita para o dogfood single-operator (ADR 0004 lista as
> mitigações e a evolução: socket-proxy / runtime rootless).

## Alternativa: deploy via `docker compose` (host com ingress próprio)

Se o host **já tem um reverse-proxy** (ex.: Traefik a ocupar 80/443) ou não se
quer iniciar Swarm, use **`compose.prod.yaml`** — a aplicação é a mesma (lê
`/run/secrets/hdd_*` igual). Diferenças vs `stack.yaml`: secrets como **ficheiros**
(`./secrets/`, gitignored), `restart:` em vez de `deploy:`, **sem Caddy** (o ingress
fica ao Traefik via labels). Validado por um smoke E2E real (2026-06-01).

```bash
mkdir -p secrets && chmod 700 secrets   # criar os ficheiros hdd_* (ver secrets.md)
mkdir -p /var/lib/hdd-workspaces && chmod 777 /var/lib/hdd-workspaces  # worker uid 10001 escreve aqui
docker compose --env-file deploy.env -f compose.prod.yaml up -d   # migrate roda 1x; api/worker esperam-no
```

> ⚠️ **Gotchas do compose (descobertos no smoke):**
> 1. **Perms dos secrets:** o Swarm monta secrets `0444`, mas o compose **preserva
>    o modo do ficheiro** — se forem `600/root`, o uid 10001 não os lê (boot falha
>    com *permission denied*). Torne-os legíveis pelo container (`chmod 644`, ou use
>    a long-syntax com `uid:`/`mode:`).
> 2. **git auth no contêiner:** ter `GH_TOKEN` no env não basta para `git clone`/
>    `push` de repos privados — é preciso `gh auth setup-git` (o `docker-entrypoint.sh`
>    já o faz). Sem isto: *could not read Username for github.com*.

### Ingress via Traefik existente + OAuth (validado em produção 2026-06-01)

O `compose.prod.yaml` já traz labels Traefik (entrypoints `web`/`websecure`,
certresolver `leresolver`). Passos:

1. **DNS** de `$HDD_DOMAIN` → IP do host (Traefik emite o cert por HTTP-challenge).
2. **GitHub OAuth App** (https://github.com/settings/developers):
   - Homepage `https://$HDD_DOMAIN` · Callback `https://$HDD_DOMAIN/auth/callback`
   - `HDD_GITHUB_CLIENT_ID` (env, `deploy.env`) + secret `hdd_github_client_secret`.
   - `HDD_GITHUB_ALLOWLIST` = logins autorizados (só estes aprovam gates; fail-closed).
3. Subir e **conectar o Traefik à rede do HDD** (senão não alcança os contêineres):
   ```bash
   docker compose --env-file deploy.env -f compose.prod.yaml up -d
   docker network connect hdd_edge traefik
   ```
4. Verificar: `https://$HDD_DOMAIN/healthz` (api, TLS) · `https://$HDD_DOMAIN/` (painel)
   · `GET /auth/login` → 302 ao GitHub com o `client_id`/callback corretos.

Routing: `api` responde a `/api,/auth,/webhooks,/healthz,/readyz,/metrics,/docs`
(prioridade 100); o resto do hostname vai ao `frontend` (painel, prioridade 1).

> ⚠️ O painel **ainda não tem UI para INICIAR feature** (Story 6.10): a `POST
> /api/features` existe (6.1) mas sem botão. Inicie via CLI (`docker compose exec
> api hdd start "..."`) até a 6.10; a aprovação de gates JÁ é pelo painel.

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
