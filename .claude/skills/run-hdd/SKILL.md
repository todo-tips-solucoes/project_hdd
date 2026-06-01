---
name: run-hdd
description: Sobe e dirige o painel HDD (backend FastAPI + frontend Next.js + Postgres) para verificar mudanças de ponta a ponta. Use quando pedirem para rodar/verificar o app HDD, ver um componente do painel (ondas, gates, iniciar feature) funcionando, ou smoke-testar um endpoint autenticado da API. NÃO é a suíte de testes — é o app real, dirigido como um operador.
---

# Rodar e verificar o painel HDD

Receita verificada (2026-06-01) para subir a stack local e **dirigir** o app — não
só lançar. Foi extraída da verificação da Story 6.10 (formulário "Iniciar feature").

> ⚠️ **PRODUÇÃO RODA NESTA MESMA MÁQUINA** (containers `projeto_hdd-*` via
> `compose.prod.yaml`). O `compose.yaml` de dev e o de produção compartilham o nome
> de projeto Compose padrão (`projeto_hdd`, do diretório). Rodar `docker compose up`
> **sem `-p`** recria o Postgres de produção na rede de dev e derruba a API/worker
> (`failed to resolve host 'postgres'` → 500 em todo o painel). **Sempre** use o
> projeto isolado **`-p hdd_dev`** nos comandos abaixo. Nunca rode `docker compose`
> de dev sem `-p hdd_dev`, e nunca toque em containers/volumes `projeto_hdd-*` /
> `projeto_hdd_hdd_pgdata` (esses são de produção).

A stack tem três peças: **Postgres** (compose), **backend FastAPI** (`uvicorn`) e
**frontend Next.js** (`next dev`). O painel fica atrás de **GitHub OAuth**; em dev
contornamos forjando o cookie de sessão (o `session_secret` de dev é conhecido e o
`require_user` só exige `session["user"]` presente — a allowlist só é checada no
callback OAuth real).

Os scripts auxiliares estão em `scripts/` ao lado deste arquivo:
- `gen_cookie.py` — forja o cookie de sessão Starlette (dev) → `cookie.txt`
- `smoke.py` — smoke HTTP do endpoint autenticado (sem browser)
- `drive.mjs` — Playwright: autentica via cookie, screenshota e exercita a UI

Defina `WORK=/tmp/hdd-run` (ou outro dir de trabalho) e `SKILL=<caminho desta pasta>`.

## 1. Postgres + migrations

```bash
cd <repo>                       # /var/lib/projeto_hdd
docker compose -p hdd_dev up -d postgres     # -p hdd_dev → container hdd_dev-postgres-1, isolado da prod
# aguarda healthy:
for i in $(seq 1 30); do [ "$(docker inspect -f '{{.State.Health.Status}}' hdd_dev-postgres-1)" = healthy ] && break; sleep 2; done
cd backend && uv sync --quiet
uv run alembic upgrade head     # idempotente; o volume hdd_dev_pgdata persiste entre runs
```

O `-p hdd_dev` cria recursos próprios (`hdd_dev-postgres-1`, rede `hdd_dev_default`,
volume `hdd_dev_pgdata`) totalmente separados dos de produção (`projeto_hdd-*`). A
porta publicada continua `5433`, então o DSN dev (`localhost:5433`) não muda.

As tabelas de domínio vivem em schemas dedicados (`app`, `audit`, `lgpd`, `memory`),
não em `public` — `\dt` em `public` só mostra checkpoints do LangGraph; não se assuste.

## 2. Backend (uvicorn)

A factory é `hdd.api.app:create_app`. Os defaults de `Settings` já apontam para o
Postgres do compose (`localhost:5433`), CORS `localhost:3000` e o `session_secret` de dev.

```bash
cd backend
uv run uvicorn --factory hdd.api.app:create_app --host 127.0.0.1 --port 8000 > $WORK/backend.log 2>&1 &
```

Health: `GET /healthz` → `{"status":"ok"}`. Routers do painel sob `/api` (ex.: `POST /api/features`); auth em `/auth/*`.

## 3. Smoke do endpoint (sem browser)

```bash
cd backend && uv run python $SKILL/scripts/smoke.py
```

Esperado: `401` sem cookie, `200` em `/auth/me` com cookie, `201` em `POST /api/features`
com cookie (retorna `session_id`/`wave_id`/`work_id`). Use isto sozinho para validar
qualquer endpoint autenticado sem subir o frontend.

## 4. Frontend (next dev) + driver Playwright

```bash
cd frontend
NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev > $WORK/frontend.log 2>&1 &
# Playwright (uma vez por máquina):
mkdir -p $WORK && cd $WORK && npm init -y >/dev/null && npm i playwright
npx playwright install chromium
npx playwright install-deps chromium      # libs de sistema (libgbm.so.1 etc) — precisa root
# dirigir:
cd backend && uv run python $SKILL/scripts/gen_cookie.py     # grava $WORK/cookie.txt
PW_BASE=$WORK node $SKILL/scripts/drive.mjs                   # screenshots em $WORK/*.png
```

`drive.mjs` abre o dashboard autenticado, screenshota o formulário, submete uma feature
e captura a mensagem de sucesso. **Olhe os screenshots** (`01-dashboard.png`,
`02-submitted.png`) — frame em branco = falha de render.

## Limpeza

```bash
kill <pid do uvicorn> <pid do next dev>     # pkill -f se autotermina; prefira kill por PID
docker compose -p hdd_dev down -v           # derruba SÓ o ambiente dev isolado (container + volume)
```

`down -v` aqui é seguro **porque** o projeto é `hdd_dev` — atinge apenas
`hdd_dev_pgdata`, nunca o volume de produção `projeto_hdd_hdd_pgdata`. Sem `-p hdd_dev`,
`down -v` apagaria o banco de PRODUÇÃO: jamais omita o `-p`.

## Gotchas (custaram tempo — não repita)

- **`curl`/`wget` são bloqueados** pelo hook do context-mode. Faça HTTP em Python (`httpx`,
  já no venv do backend) ou Node `fetch`, não shell.
- **Playwright é CommonJS**: `import pkg from "playwright"; const { chromium } = pkg;` —
  named import quebra. `drive.mjs` resolve via `createRequire` + `PW_BASE`.
- **`waitUntil: "networkidle"` nunca resolve** com `next dev` (o websocket do HMR mantém
  rede ativa). Use `"domcontentloaded"` + `waitForSelector`.
- **`libgbm.so.1: cannot open shared object file`** → `npx playwright install-deps chromium`.
- **Cookie de sessão**: ignora a porta (host `localhost` cobre 3000 e 8000); `SameSite=Lax`
  funciona porque 3000→8000 é same-site. Setar via `context.addCookies` com `httpOnly:true`
  (`document.cookie` não serve, é httpOnly). `req()` no frontend usa `credentials:"include"`.
- **Migrations idempotentes**: se `alembic current` já está em head e o volume persistiu, o
  `upgrade` não recria nada — é esperado.
- **Colisão dev/prod no Compose** (incidente real, 2026-06-01): `docker compose up -d postgres`
  sem `-p` usa o projeto `projeto_hdd` (nome do diretório) — o MESMO da produção que roda
  nesta máquina. Recriou o Postgres de prod na rede de dev → API/worker com
  `failed to resolve host 'postgres'`, 500 no painel inteiro e worker em crash loop.
  Correção foi `docker compose -f compose.prod.yaml --env-file deploy.env up -d postgres`.
  Por isso TODO comando compose de dev leva `-p hdd_dev`.

Se algum passo aqui falhar por mecânica não relacionada à mudança que você verifica,
atualize esta skill em vez de redescobrir.
