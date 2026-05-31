# Prompt de continuação — HDD v2 · Epic 5 (Produção & Conformidade)

> Cole este conteúdo (ou aponte para este arquivo) ao iniciar uma **sessão limpa**.
> Estado em: 2026-05-31, após Epic 4. Próximo alvo: **Epic 5 (0/6 histórias)**.

---

## Quem é você e o que é este projeto

Você retoma a implementação do **HORSE DRIVEN DEVELOPMENT (HDD) v2** — plataforma de
**orquestração autônoma de desenvolvimento de software** com auditoria. `project_name`
= `projeto_hdd`. Diretório: `/var/lib/projeto_hdd`. Comunicação e documentos em
**português**.

**Leia primeiro a memória `project-hdd-v2-reboot`** (contexto completo do reboot e das
decisões). Fontes de verdade, ler antes de codar:

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-hdd-v2.md`
- **Arquitetura:** `_bmad-output/planning-artifacts/architecture.md` (Addendum R-1…R-15)
- **Épicos e histórias:** `_bmad-output/planning-artifacts/epics.md` (Epic 5 nas linhas ~485–566)
- **Gate de fundação:** `docs/decisions/0001-gate-fundacao-poc.md`

## Stack e regras fixas (não viole)

- **Python 3.13+** (uv instalou 3.14). Gestão **uv**. **Backend hexagonal** em
  `backend/src/hdd/`: `domain ← contracts ← adapters/application ← api/cli`. Boundaries
  **enforçados por import-linter** (`api`/`cli` são entrypoints e podem importar tudo).
- **LLM = só Claude**, driver `subscription` via `claude -p` headless (conta Max 20x,
  janela 1M). Driver `api` é stub. Troca por config (RF-12).
- **Persistência:** PostgreSQL 17 + pgvector. SQLAlchemy 2 async + **psycopg3**. Alembic.
- **Orquestração:** LangGraph 1.2.2 + langgraph-checkpoint-postgres 3.1.0.
- **Frontend:** Next.js 16 + Tailwind v4 + shadcn-style + Framer Motion + TanStack Query.
- **Deploy-alvo:** Docker Swarm + Caddy (TLS) em VPS Hetzner.
- **Patterns:** snake_case ponta a ponta; contract-first (OpenAPI→TS); UUIDv7; RFC 9457;
  Conventional Commits.

## ⚠️ Descoberta crítica (não esqueça)

`claude -p` **NÃO é LLM puro — é agente Claude Code completo** (Write/Edit/Bash + contexto
+ memória). Mitigação obrigatória no worker: `--disallowedTools Write Edit MultiEdit
NotebookEdit Bash WebFetch` + sandbox Docker isolado (Story 2.3) + capability broker
determinístico (Story 2.4). **Nunca invoque `claude -p` no worker sem disallowed-tools +
sandbox.**

## O que já está PRONTO (Epics 1–4, 25/31)

- **E1 Fundação (5/5):** scaffold hexagonal; PoC GO (LangGraph+`claude -p`+checkpoint);
  schemas `app`/`langgraph` + role `app_rw`; contratos das 6 portas; abstração de provider.
- **E2 Execução autônoma segura (9/9):** FSMs Sessão/Onda; fila Postgres SKIP LOCKED +
  **quota lease global** (`adapters/db/quota.py`, counter `app.quota_counter` com
  `FOR UPDATE`); sandbox endurecido (`sandbox/Dockerfile`); capability broker; gate store
  (PIN/timeout); orquestrador LangGraph (plan→execute→verify→correct→gate); retry;
  GitHubVcs (PR rascunho); CLI Typer (`hdd start/status/gates/approve/reject`).
- **E3 Rastreabilidade (6/6):** audit sink hash-chain + role + trigger; catálogo de
  eventos; âncora WORM; **memória pgvector + pseudonimização PII** (`adapters/memory/`);
  observabilidade (Prometheus/health/OTel).
- **E4 Operação remota (5/5):** app FastAPI `backend/src/hdd/api/` (OAuth GitHub, sessão
  httpOnly, allowlist fail-closed; SSE `/api/events/stream`; snapshot `/api/waves`; fila
  de gates aprovada no painel via `GateStore.resolve_authenticated`; `ClihelperNotifier`
  leaky-bucket persistente; webhook `/webhooks/n8n` HMAC+idempotency); painel **Next.js 16**
  em `frontend/`. OpenAPI snapshot em `backend/openapi.json`.

Tudo **ruff + mypy --strict + import-linter + pytest verdes** (64 unit + 26 integração).
**7 migrations** Alembic. `next build` verde.

## Alavancas que o Epic 5 já tem (não recrie — estenda)

- **CI inicial:** `.github/workflows/ci.yml` já roda ruff, mypy --strict, import-linter,
  pytest unit + job de integração (Postgres pgvector service). **Falta** estender (5.3).
- **Quota lease global:** `adapters/db/quota.py` (`QuotaLease.acquire/release`) e o counter
  já existem. **Falta** o *loop do worker* que consome a fila, adquire lease, roda a onda e
  libera — e robustez a crash de worker (hoje o counter é inteiro simples, sem TTL/reaper:
  um worker que morre **vaza um slot**). Avalie leases com `worker_id` + `expires_at` +
  reconciliação. (5.2)
- **Secrets:** `config/settings.py` já lê de `/run/secrets` quando o diretório existe
  (`Settings(_secrets_dir=...)`). **Falta** o `stack.yaml` declarar os secrets e garantir
  naming dos arquivos = nome do campo pydantic (`pg_dsn`, `session_secret`,
  `github_client_secret`, `clihelper_token`, `webhook_hmac_secret`). Confirme se o
  `env_prefix="HDD_"` interfere no naming dos arquivos de secret. (5.4)
- **PII já pseudonimizada** na memória (3.4) e **audit hash-chain** imutável: o
  crypto-shredding (5.6) deve mirar o store de PII, **nunca** os eventos de auditoria
  (que já não contêm plaintext). Mantenha esse invariante.
- **Infra dev:** `compose.yaml` (Postgres 17+pgvector, host **5433**). Produção usará
  `stack.yaml` (Swarm) — ainda não existe.

## Epic 5 — histórias (ACs resumidos)

- **5.1 Empacotamento + Caddy/TLS + stack Swarm.** Dockerfiles **multi-stage** (backend
  Python/uv→runtime slim com uvicorn; worker; frontend Next.js `output:'standalone'`) +
  `stack.yaml` (postgres, api, worker, frontend, **caddy** com HTTPS automático).
  *AC:* deploy no Swarm sobe os serviços, Caddy provê TLS ao Painel/API/webhook, e o
  control plane funciona **com 1 nó**.
- **5.2 Quota lease global entre workers.** *AC:* N workers (Swarm) executando respeitam o
  **teto global** de `claude -p` concorrentes (não só config local); sem lease, aguardam.
- **5.3 CI completo.** *AC:* em PR rodam ruff, mypy/pyright, pytest (unit+integração),
  import-linter, **check de openapi-drift**, **build Docker** e **scan de deps**; falha em
  qualquer um bloqueia merge. (Estender o `ci.yml` + job de frontend: lint/typegen-drift/
  `next build`.)
- **5.4 Secrets + configuração.** *AC:* Docker Swarm secrets; `pydantic-settings` lê de
  `/run/secrets`; nada sensível em env plaintext ou repo; **segredos não aparecem em
  logs/audit** (verificar redaction do structlog).
- **5.5 Backups WAL/PITR → R2.** *AC:* WAL archiving + base backup para **Cloudflare R2**
  (S3-compatível; pgBackRest ou wal-g); restauração point-in-time testada; procedimento em
  `docs/runbooks/`.
- **5.6 Conformidade LGPD.** *AC:* **crypto-shredding** sobre dados pseudonimizados — pedido
  de exclusão descarta a chave `pgcrypto` do titular (dado irrecuperável) **sem quebrar a
  hash-chain**; políticas de retenção + **nota de transferência internacional** (Hetzner UE
  + Anthropic US) documentadas.

## Como rodar (ambiente)

```bash
export PATH="$HOME/.local/bin:$PATH"            # uv
docker compose up -d postgres                    # Postgres 17 + pgvector, host 5433
cd backend
uv sync
uv run alembic upgrade head                      # 7 migrations
uv run ruff check . && uv run mypy && uv run lint-imports
uv run pytest                                    # UNIT (rápido)
uv run pytest -m integration tests/integration/  # INTEGRAÇÃO (precisa Postgres)
uv run pytest -m integration tests/test_poc.py   # PoC do gate (CUSTA QUOTA — opt-in)
uv run hdd --help                                # CLI do operador
uv run uvicorn hdd.api.app:app --port 8000       # API do painel
uv run python scripts/export_openapi.py openapi.json  # regenera contrato OpenAPI
cd ../frontend && npm install && cp .env.example .env.local && npm run dev  # painel :3000
```

Gotchas: host tem Python 3.8 (use uv); Postgres em **5433** (não 5432); `claude` CLI
2.1.158 já autenticado na conta; `/run/secrets` não existe em dev (settings trata); `curl`/
`wget` bloqueados no ambiente (use `httpx`/`uv run python` para smoke tests). DSN default:
`postgresql://hdd:hdd_dev@localhost:5433/hdd`.

## Git

Branch `main`, remote `origin` = `github.com/todo-tips-solucoes/project_hdd.git`. **Tudo do
Epic 4 já foi enviado** (`origin/main` em `e76bed1`). Tag `legacy/bun-whatsapp-v1` preserva
a v1. Comite por história/grupo com Conventional Commits; **não comite**
`.claude/settings.local.json`. **Atenção (5.3):** mexer em `.github/workflows/*` exige
`gh auth refresh -s workflow` **antes** do push (o token default não tem o escopo).

## Modo de trabalho do operador

- **Autônomo**, dogfooding. Planejamento: 2 ciclos de Advanced Elicitation + Party Mode/step.
- **Autonomia total dos agentes**, humano só nos 6 gates RF-03b.
- Toda decisão sob as lentes **performance · segurança · best practices**.
- Verificação adversarial real (subagentes) onde agrega valor.
- Tooling sempre verde antes de commitar (ruff/mypy/import-linter/pytest).
- Finalização exige revisão humana (memória `feedback-hdd-mandatory-review`).

## Sugestão de retomada (confirmar ordem com o operador)

Ordem proposta, do mais barato/desbloqueador ao mais infra-pesado:

1. **5.3 CI completo** — estende `ci.yml` (openapi-drift, job de frontend, build Docker,
   scan de deps). Barato e protege o resto.
2. **5.4 Secrets** — declara o contrato de secrets (necessário por 5.1); valida naming
   `/run/secrets` vs `env_prefix`; redaction de logs.
3. **5.1 Empacotamento + Caddy/Swarm** — Dockerfiles multi-stage + `stack.yaml`.
4. **5.2 Worker loop + robustez do lease** (TTL/reaper para slots vazados).
5. **5.6 LGPD crypto-shredding** (pgcrypto + chave por titular, sem tocar a hash-chain).
6. **5.5 Backups WAL/PITR → R2** (pgBackRest/wal-g + runbook + restore de teste).

### Decisões a confirmar com o operador ANTES de codar 5.1/5.5

- **Domínio + VPS Hetzner disponíveis agora?** Caddy precisa de domínio/DNS apontando.
  Alternativa: produzir artefatos deployáveis + dry-run local (Swarm em 1 nó), deploy depois.
- **`claude -p` autenticado DENTRO do contêiner** (maior risco; valida D-032/D-052): como
  montar as credenciais de assinatura no worker container? Confirmar abordagem (secret com
  `~/.claude` creds) ou rodar o worker fora de contêiner no MVP.
- **Cloudflare R2:** bucket + credenciais (S3) para 5.5.
- **5.6:** quais campos viram crypto-shredded (escopo do titular) e a fonte legal/retenção.
