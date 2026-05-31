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

# --- api --------------------------------------------------------------------
FROM runtime-base AS api
COPY --from=builder --chown=10001:10001 /app /app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"
# Migrations + uvicorn (--proxy-headers: OAuth/HTTPS atrás do Caddy).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn hdd.api.app:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]

# --- worker -----------------------------------------------------------------
# Precisa do Claude Code CLI (Node) e de git+gh (GitHubVcs abre PR rascunho).
FROM node:22-bookworm-slim AS nodejs

FROM runtime-base AS worker
ARG GH_VERSION=2.63.2
# Node 22 (copiado da imagem oficial) + git + gh CLI.
COPY --from=nodejs /usr/local/bin/node /usr/local/bin/node
COPY --from=nodejs /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl \
 && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" \
      | tar -xz -C /tmp \
 && mv "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh \
 && rm -rf "/tmp/gh_${GH_VERSION}_linux_amd64" \
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
