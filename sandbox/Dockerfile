# Imagem do Execution Plane — roda `claude -p` isolado (Story 2.3).
# Mínima: Node (para o Claude Code CLI) + git. Usuário não-root.
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (motor do driver subscription).
RUN npm install -g @anthropic-ai/claude-code || true

# Usuário não-root dedicado.
RUN useradd --uid 10001 --create-home sandbox
USER 10001:10001
WORKDIR /workspace

# Sem credenciais embutidas: a autenticação da conta é montada em runtime,
# escopada, e o egress é filtrado por allowlist (rede com proxy) — nunca a
# imagem carrega segredos de produção.
