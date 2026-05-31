# syntax=docker/dockerfile:1
# Imagem do Painel Next.js 16 (Story 5.1) — build "standalone".
#
# Same-origin em produção: atrás do Caddy, painel e API vivem no mesmo domínio,
# então NEXT_PUBLIC_API_BASE="" (URLs relativas → o cookie de sessão httpOnly é
# enviado). Sobrescreva o ARG só se servir a API em outro host.
#
# Build:
#   docker build -t hdd-frontend:latest frontend

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE=""
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --gid 10001 nodejs && useradd --uid 10001 --gid 10001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
