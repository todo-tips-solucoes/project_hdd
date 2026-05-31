# Prompt de continuação — HDD v2 (sessão fresca)

> Cole o conteúdo abaixo (ou aponte para este arquivo) ao iniciar uma nova sessão.
> Estado em: 2026-05-31, após Epic 3. Checkpoint do operador.

---

## Quem é você e o que é este projeto

Você está retomando a implementação do **HORSE DRIVEN DEVELOPMENT (HDD) v2** — uma plataforma de **orquestração autônoma de desenvolvimento de software** com auditoria. O `project_name` é `projeto_hdd`. Diretório de trabalho: `/var/lib/projeto_hdd`. Idioma de comunicação e documentos: **português**.

Em 2026-05-31 o operador rejeitou a v1 (um bot WhatsApp em Bun) e reiniciou do zero a partir de um novo PRD. O código v1 está arquivado na tag git `legacy/bun-whatsapp-v1`. **Leia a memória `project-hdd-v2-reboot` primeiro** — ela tem o contexto completo do reboot e das decisões.

## Artefatos de planejamento (fonte de verdade — leia antes de codar)

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-hdd-v2.md`
- **Arquitetura:** `_bmad-output/planning-artifacts/architecture.md` (validada adversarialmente; ver Addendum R-1…R-15)
- **Épicos e histórias:** `_bmad-output/planning-artifacts/epics.md` (5 épicos, 31 histórias)
- **Veredito do gate de fundação:** `docs/decisions/0001-gate-fundacao-poc.md`

## Stack e decisões fixas

- **Runtime:** Python 3.13+ (o uv instalou 3.14 localmente). Gestão com **uv**.
- **Backend hexagonal** em `backend/src/hdd/`: `domain` ← `contracts` ← `adapters`/`application` ← `api`/`cli`. Boundaries **enforçados por import-linter** (não os viole).
- **LLM = só Claude**, driver `subscription` via `claude -p` headless (conta de assinatura Max 20x, 1M tokens). Driver `api` é stub para a fase de escala. Troca por config (RF-12).
- **Persistência:** PostgreSQL + pgvector. SQLAlchemy 2 async + **psycopg3** (driver único). Alembic.
- **Orquestração:** LangGraph (1.2.2) + langgraph-checkpoint-postgres (3.1.0).
- **Frontend (Epic 4):** Next.js 16 + Tailwind + shadcn/ui + Framer Motion + SSE + TanStack Query/Zustand.
- **Deploy (Epic 5):** Docker Swarm + Caddy (TLS) em VPS Hetzner.
- **Patterns:** snake_case end-to-end; contract-first (OpenAPI→tipos TS); UUIDv7; RFC 9457 erros; Conventional Commits.

## ⚠️ Descoberta crítica (não esqueça)

`claude -p` **NÃO é um LLM puro — é um agente Claude Code completo** (ferramentas Write/Edit/Bash + contexto do projeto + memória). Na PoC ele criou efeitos colaterais a partir do texto da tarefa. Mitigação aplicada no adapter (`--disallowedTools Write Edit MultiEdit NotebookEdit Bash WebFetch`) + sandbox Docker isolado (Story 2.3) + capability broker determinístico (Story 2.4). **Nunca invoque `claude -p` para o worker sem disallowed-tools + sandbox.**

## O que já está PRONTO (Epics 1–3, 20/31 histórias)

- **Epic 1 (Fundação, 5/5):** scaffold hexagonal; PoC de fundação GO (LangGraph+`claude -p`+checkpoint, 5 critérios em `tests/integration/test_*` via `hdd_poc`); schemas `app`/`langgraph` + role `app_rw`; contratos das 6 portas; abstração de provider.
- **Epic 2 (Execução Autônoma Segura, 9/9):** FSMs de Sessão/Onda + persistência; fila Postgres SKIP LOCKED + quota lease global; sandbox endurecido; capability broker; gate manager (PIN/timeout); orquestrador LangGraph da onda (plan→execute→verify→correct→gate); retry policy; GitHubVcs (PR rascunho); CLI Typer (`hdd start/status/gates/approve/reject`).
- **Epic 3 (Rastreabilidade, 6/6):** audit sink hash-chain + role + trigger; catálogo de eventos + emissão; âncora WORM assinada; memória pgvector + pseudonimização PII; observabilidade (Prometheus/health/OTel) + dashboard Grafana.

Tudo com **ruff + mypy --strict + import-linter + pytest verdes**. 6 migrations (schemas app/langgraph/audit/memory).

## O que FALTA

- **Epic 4 — Operação Remota (0/5):**
  - 4.1 Auth do Painel (GitHub OAuth) + sessão httpOnly
  - 4.2 Painel: dashboard de ondas em tempo real (SSE) + tipos TS do OpenAPI
  - 4.3 Painel: fila de gates (aprovar/rejeitar no canal autenticado)
  - 4.4 Notifier outbound (clihelper, leaky-bucket persistente ≤1 req/s) + resumos narrativos
  - 4.5 Webhook inbound (n8n, HMAC + idempotency) + notificação de gate com deep link
  - **Nota:** falta criar a app FastAPI em `backend/src/hdd/api/` (hoje só esqueleto). A aprovação de gate ocorre NO PAINEL (não no WhatsApp).
- **Epic 5 — Produção & Conformidade (0/6):**
  - 5.1 Dockerfiles multi-stage + Caddy/TLS + `stack.yaml` (Swarm)
  - 5.2 Quota lease global enforçado entre workers (counter já existe; falta o loop do worker)
  - 5.3 CI completo (GitHub Actions: ruff/mypy/pytest/import-linter/openapi-drift/scan)
  - 5.4 Secrets (Docker Swarm secrets) + config (já há `secrets_dir` em settings)
  - 5.5 Backups WAL/PITR → R2
  - 5.6 LGPD: crypto-shredding (direito à exclusão) + retenção + nota de transferência internacional

## Como rodar (ambiente)

```bash
export PATH="$HOME/.local/bin:$PATH"            # uv
docker compose up -d postgres                    # Postgres 17 + pgvector na porta host 5433
cd backend
uv sync                                          # instala Python 3.13+ e deps
uv run alembic upgrade head                      # aplica as 6 migrations
uv run ruff check . && uv run mypy && uv run lint-imports
uv run pytest                                    # testes UNIT (rápidos)
uv run pytest -m integration tests/integration/  # testes de INTEGRAÇÃO (precisam do Postgres)
uv run pytest -m integration tests/test_poc.py   # PoC do gate (CUSTA QUOTA — opt-in)
uv run hdd --help                                # CLI do operador
```

Gotchas do ambiente: host tem Python 3.8 (use uv); Postgres exposto em **5433** (não 5432); `claude` CLI 2.1.158 já autenticado na conta; `/run/secrets` não existe em dev (settings trata). DSN default: `postgresql://hdd:hdd_dev@localhost:5433/hdd`.

## Git

Branch `main`, remote `origin` = `github.com/todo-tips-solucoes/project_hdd.git`. **11 commits locais desde o reboot, ainda NÃO enviados** — o operador pode querer `git push origin main` (se houver `.github/workflows/*`, lembre `gh auth refresh -s workflow` antes). Tag `legacy/bun-whatsapp-v1` preserva a v1. Comite por história/grupo com Conventional Commits; não comite `.claude/settings.local.json`.

## Modo de trabalho preferido do operador

- **Autônomo**, exercitando o que vamos construir. Para planejamento: 2 ciclos de Advanced Elicitation + Party Mode por step.
- **Autonomia total dos agentes**, humano só nos 6 gates RF-03b.
- Toda decisão sob as lentes **performance · segurança · best practices**.
- Verificação adversarial real (subagentes) onde agrega valor.
- Tooling sempre verde antes de commitar (ruff/mypy/import-linter/pytest).

## Sugestão de retomada

Comece pelo **Epic 4, Story 4.1 + 4.2**: criar a app FastAPI (`api/`), GitHub OAuth, e o endpoint SSE do dashboard de ondas — depois o frontend Next.js. Confirme com o operador se quer o frontend Next.js real ou apenas a API + um painel mínimo primeiro.
