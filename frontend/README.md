# HDD · Painel (frontend)

Painel web da operação remota do **HORSE DRIVEN DEVELOPMENT** (Epic 4). Next.js 16
(App Router) + Tailwind v4 + TanStack Query + Framer Motion + SSE. Componentes de UI
no estilo shadcn/ui copiados em `src/components/ui`.

## O que faz

- **Login GitHub OAuth** — a sessão httpOnly é emitida pela API; o painel é o canal
  autenticado onde os gates são aprovados.
- **Dashboard de ondas em tempo real** (`/`) — snapshot REST (`/api/waves`) + feed ao
  vivo via SSE (`/api/events/stream`).
- **Fila de gates** (`/gates`) — aprovar/rejeitar; detalhe em `/gates/[id]` (alvo do
  deep link das notificações do WhatsApp).

## Contrato (sem drift)

Os tipos TS saem do OpenAPI da API:

```bash
# na raiz do backend: uv run python scripts/export_openapi.py openapi.json
npm run typegen   # ../backend/openapi.json → src/lib/api-types.ts
```

## Rodar em dev

```bash
cp .env.example .env.local          # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install
npm run dev                          # http://localhost:3000
```

A API precisa estar de pé (mesmo "site" localhost → o cookie de sessão é enviado):

```bash
cd ../backend && uv run uvicorn hdd.api.app:app --port 8000
```

Para OAuth real, configure no backend `HDD_GITHUB_CLIENT_ID`,
`HDD_GITHUB_CLIENT_SECRET`, `HDD_GITHUB_ALLOWLIST` (logins permitidos) e
`HDD_PANEL_BASE_URL=http://localhost:3000`.
