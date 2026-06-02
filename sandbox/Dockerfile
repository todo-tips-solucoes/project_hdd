# Imagem do Execution Plane — roda `claude -p` isolado (Story 2.3) e a suíte de
# testes do alvo no nó `verify` (Story 6.3). Node (Claude Code CLI) + git +
# Python/pytest (verify de alvos Python: calibração 7.4 e o futuro meta-dogfood).
FROM node:22-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git ca-certificates python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (motor do driver subscription).
RUN npm install -g @anthropic-ai/claude-code || true

# pytest no PATH para o nó `verify` rodar a suíte do alvo (Story 7.4). O sandbox
# roda --network none → sem pip em runtime; o toolchain de teste vai na imagem.
# --break-system-packages: imagem efêmera, instala no Python do sistema (PEP 668).
RUN pip3 install --no-cache-dir --break-system-packages pytest

# Usuário não-root dedicado.
RUN useradd --uid 10001 --create-home sandbox
USER 10001:10001
WORKDIR /workspace

# Sem credenciais embutidas: a autenticação da conta é montada em runtime,
# escopada, e o egress é filtrado por allowlist (rede com proxy) — nunca a
# imagem carrega segredos de produção.
