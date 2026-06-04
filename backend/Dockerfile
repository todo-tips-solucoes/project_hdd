# syntax=docker/dockerfile:1
# Imagens do backend HDD (Story 5.1). Multi-stage com uv:
#   - builder : resolve o venv a partir do uv.lock (deps de produção)
#   - api     : runtime slim com uvicorn (API do painel) — enxuto, sem node/git
#   - worker  : runtime + Node/Claude Code CLI + git/gh (executa ondas e abre PRs)
#
# Build:
#   docker build -t hdd-api:latest    --target api    backend
#   docker build -t hdd-worker:latest --target worker backend
ARG PYTHON_VERSION=3.13

# --- builder ----------------------------------------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0
WORKDIR /app
# Camada de deps (cacheável): instala dependências antes de copiar o código.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# --- base de runtime (comum a api e worker) ---------------------------------
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime-base
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
RUN groupadd --gid 10001 hdd && useradd --uid 10001 --gid 10001 --create-home hdd
WORKDIR /app
# Entrypoint carrega tokens de /run/secrets para o ENV dos CLIs (claude/gh) sem
# expô-los via `docker inspect` (Story 6.4 hardening). Herdado por api e worker.
COPY docker-entrypoint.sh /usr/local/bin/hdd-entrypoint.sh
RUN chmod +x /usr/local/bin/hdd-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/hdd-entrypoint.sh"]

# --- api --------------------------------------------------------------------
FROM runtime-base AS api
# gh CLI: o resume na API faz `gh pr merge` ao aprovar o gate (Story 6.8/ADR 0003).
ARG GH_VERSION=2.63.2
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
      | tar -xz -C /tmp \
 && mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh \
 && rm -rf "/tmp/gh_${GH_VERSION}_linux_amd64" \
 && apt-get purge -y curl \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=10001:10001 /app /app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"
# Só o servidor (--proxy-headers: OAuth/HTTPS atrás do Caddy/Traefik). A migration
# NÃO é embutida aqui: roda no serviço one-shot `migrate` antes da api (Story 6.12),
# para não correr quando a api escala além de 1 réplica. Para migrar com esta mesma
# imagem: `docker run --rm hdd-api:latest alembic upgrade head`.
CMD ["sh", "-c", "exec uvicorn hdd.api.app:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

# --- worker -----------------------------------------------------------------
# Precisa do Claude Code CLI (Node), git+gh (GitHubVcs: PR/merge) e do CLI docker
# (Story 6.9: o nó `verify` faz `docker run` do sandbox via socket do host).
FROM node:22-bookworm-slim AS nodejs

FROM runtime-base AS worker
ARG GH_VERSION=2.63.2
ARG DOCKER_CLI_VERSION=27.3.1
# Node 22 (copiado da imagem oficial) + git + gh CLI + docker CLI (client only).
COPY --from=nodejs /usr/local/bin/node /usr/local/bin/node
COPY --from=nodejs /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl \
 && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
      | tar -xz -C /tmp \
 && mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh \
 && rm -rf "/tmp/gh_${GH_VERSION}_linux_amd64" \
 && curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_CLI_VERSION}.tgz" \
      | tar -xz -C /tmp docker/docker \
 && mv /tmp/docker/docker /usr/local/bin/docker \
 && rm -rf /tmp/docker \
 && npm install -g @anthropic-ai/claude-code \
 && apt-get purge -y curl \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder --chown=10001:10001 /app /app
USER 10001:10001
# Liveness: o loop atualiza /tmp/hdd-worker.alive a cada iteração e durante
# ondas longas; considera-se morto se o arquivo passar de 90s sem atualizar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os,sys,time; p='/tmp/hdd-worker.alive'; sys.exit(0 if os.path.exists(p) and time.time()-os.path.getmtime(p) < 90 else 1)"
CMD ["python", "-m", "hdd.worker"]

# --- meta-sandbox -----------------------------------------------------------
# Sandbox do nó `verify` para o META-DOGFOOD (Fase 2, Story 7.8): roda a suíte do
# PRÓPRIO projeto_hdd. Diferente de sandbox/Dockerfile (calibração, minimal), tem
# Python 3.13 + uv + as deps do backend INCLUINDO dev (pytest). SEM credenciais.
# O venv fica em /deps (fora de /workspace, onde o clone da onda é montado em
# runtime). O projeto NÃO é instalado (--no-install-project): o código vem do
# /workspace montado (pythonpath=src do pyproject). ⚠️ A imagem carrega as deps DA
# BUILD: uma onda que adicione dependência nova exige rebuild desta imagem.
#   docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend
FROM python:${PYTHON_VERSION}-slim-bookworm AS meta-sandbox
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    PATH="/deps/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
WORKDIR /deps
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project
# Node 22 + openapi-typescript PINADO (== devDep do frontend, 7.13.0) — permite o
# codegen regenerar os tipos TS do contrato (frontend/src/lib/api-types.ts) DENTRO
# do loop, fechando o gap de frontend (a regeneração do openapi.json já é Python).
# Versão pinada p/ saída byte-idêntica ao `npm run typegen` do CI; se o frontend
# bumpar openapi-typescript, atualize este pin.
COPY --from=nodejs /usr/local/bin/node /usr/local/bin/node
COPY --from=nodejs /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && npm install -g openapi-typescript@7.13.0 \
 && npm cache clean --force
RUN useradd --uid 10001 --create-home sandbox
USER 10001:10001
WORKDIR /workspace
