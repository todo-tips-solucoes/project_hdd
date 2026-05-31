---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-hdd-v2.md
workflowType: 'architecture'
project_name: 'projeto_hdd'
user_name: 'paulotodo'
date: '2026-05-31'
lastStep: 8
status: 'complete'
completedAt: '2026-05-31'
---

# Documento de Decisões de Arquitetura — HORSE DRIVEN DEVELOPMENT (HDD) v2

_Este documento é construído colaborativamente, passo a passo. As seções são acrescentadas conforme avançamos em cada decisão arquitetural em conjunto._

> **Modo de trabalho deste workflow:** condução autônoma, 2 ciclos de Advanced Elicitation + Party Mode por step, então Continue. Lentes obrigatórias em toda decisão: **performance · segurança · best practices**. Capacidade-alvo de execução (inclui o próprio MVP, dogfood): **Claude Code Max 20x, janela 1M tokens**.

## Project Context Analysis

### Requirements Overview

**Functional Requirements (13):**
- **Orquestração** — RF-01 orquestrador spec-driven/BMad; RF-02 tool routing entre modelos Claude; RF-11 execução autônoma com controle de sessão; RF-12 abstração de provider (`subscription`↔`api`).
- **Controle/Governança** — RF-03 autonomia total + verificação automática; RF-03b 6 gates humanos fechados; RF-04 auditoria total; RF-05 memória de contexto.
- **Interfaces** — RF-06 CLI; RF-07 Painel Web; RF-08 canal WhatsApp.
- **Integração/Extensão** — RF-09 GitHub/CI; RF-10 módulos BMad.

**Non-Functional Requirements:**
- **Segurança zero-trust** — cada agente é principal; least-privilege, credenciais separadas, sandbox por agente, validação de I/O, inventário, governança antes de criticidade.
- **LGPD/GDPR** — coleta mínima, pseudonimização, direitos do titular, retenção/descarte seguro.
- **Escalabilidade** — serviços isolados em Docker Swarm; tool routing por complexidade; planner–executor + decomposição hierárquica; monitoramento de custos/quota.
- **Manutenibilidade/Testabilidade** — Python; testes unit + integração real (não só mock); observabilidade (logs estruturados, métricas, traces; Prometheus).

**Scale & Complexity:**
- Primary domain: backend/full-stack.
- Complexity level: **high** (multi-agente autônomo + auditoria + zero-trust + multi-canal + compliance), mitigado por multi-tenancy fora de escopo v1.
- Estimated architectural components: ~6 camadas (Interface, Orquestrador, Módulos de agentes, Integração, Armazenamento/Memória, Segurança/Governança).

### Technical Constraints & Dependencies
- Stack fixada: **Python** (principal), **PostgreSQL**, **Docker Swarm** em VPS **Hetzner**.
- LLM: **só Claude**. Motor MVP = **conta de assinatura via `claude -p` headless** (Max 20x, 1M tokens); API só na escala, por troca de config (abstração de provider).
- Dependências externas: GitHub + CI/CD, Prometheus/Grafana, **clihelper** (outbound WhatsApp, ~1 req/s), **n8n** (inbound aggregator, trust boundary).
- Orçamento: **≤ US$ 200/mês** (MVP = custo fixo assinatura + VPS, não por token).
- Riscos abertos: ToS/limites de janela da conta para automação contínua (**D-032**, validar no Sprint 0); confiabilidade de `claude -p --resume` headless.

### Architectural Drivers Emergentes (síntese dos 2 ciclos A+P)
Propriedades que a arquitetura DEVE garantir, extraídas da elicitação:

1. **Separação Control Plane / Execution Plane.**
   - *Control Plane* (Python, stateful no Postgres): orquestrador, FSM de sessão/ondas, gate manager (RF-03b), audit writer, scheduler quota-aware. Deve funcionar com 1 nó (Swarm só escala execução, nunca é pré-requisito de corretude).
   - *Execution Plane* (stateless, descartável): workers que invocam `claude -p` em sandbox; reconstruíveis a partir do estado durável.
2. **Estado durável + idempotência.** FSM de sessão, ondas e gates pendentes persistidos; reentrega (WhatsApp/n8n) e `--resume` não podem perder nem duplicar efeitos. Fila de trabalho **Postgres-backed** (`FOR UPDATE SKIP LOCKED`) — sem broker novo.
3. **Identidade no nível de ferramentas (limitação do driver `subscription`).** Todos os agentes compartilham UMA conta Claude → "credenciais separadas por agente" aplica-se a **GitHub tokens por escopo e roles de DB por agente**, não ao LLM. Limitação documentada; resolvida ao migrar para `api`.
4. **Memória externa como robustez, não só qualidade.** `--resume` é premissa frágil; o contexto deve ser reconstruível a partir do banco (RF-05). Memória semântica via **pgvector** (mantém Postgres como base única).
5. **Auditoria à prova de adulteração.** Esquema `audit` **append-only + hash-chain + carimbo temporal**, exportável ao auditor. Separado do esquema `memory` (consultável), por terem requisitos conflitantes (imutabilidade vs. leitura/embeddings).
6. **Aprovação de gate autenticada.** Convite de gate carrega **PIN/token de uso único**, validado no inbound; não confiar apenas no número remetente do WhatsApp (n8n é trust boundary).
7. **Quota-aware scheduling.** Como o MVP roda na mesma conta 20x que o uso humano, o scheduler deve respeitar quota/janela: throttle, enfileiramento e teto de paralelismo de sessões; não encher a janela de 1M (memória externa + prompt caching).
8. **Observabilidade desde o dia 1.** Sistema autônomo sem observabilidade é incontrolável: logs estruturados + métricas (saúde de sessão, convocações de gate, consumo de quota) desde o início; Prometheus/Grafana logo a seguir.

### Cross-Cutting Concerns Identified
Auditoria/rastreabilidade · Segurança & governança (agente = principal, identidade no nível de ferramentas) · Controle de sessão (resume, quota/janela) · Abstração de provider (`subscription`↔`api`) · Observabilidade · Gates humanos assíncronos autenticados (WhatsApp/Painel).

## Starter Template Evaluation

### Primary Technology Domain
Backend/full-stack poliglota — **não há um único starter monolítico**. A foundation é um **monorepo** com control plane Python + painel Next.js, mais workers de execução em sandbox. Versões verificadas via web em 2026-05-31.

### Starter Options Considered

**Motor de orquestração (decisão central):**
- **LangGraph + `langgraph-checkpoint-postgres` (PostgresSaver)** — agent systems como state machines com checkpointing durável em Postgres (pause/resume, time-travel, checkpoint compartilhado entre workers, sobrevive a crash/redeploy). Líder de produção (34.5M downloads/mês). **Escolhido.**
- *CrewAI* — role-based, prototipagem rápida, mas **sem checkpointing** para workflows longos e ~3× overhead de tokens; inadequado ao controle de sessão durável (RF-11). Rejeitado.
- *Orquestrador custom* — controle total, zero overhead, mas reconstrói durabilidade battle-tested; risco/desperdício no MVP. **Diferido** (mantido atrás da porta `Orchestrator`).

**Nuance arquitetural:** os nós do grafo LangGraph **não chamam a API LLM diretamente** — delegam à porta `LLMProvider`, que no driver `subscription` invoca `claude -p` headless em sandbox. LangGraph é usado como **FSM durável do control plane**, não como caller de LLM. Uso fora do padrão → **PoC obrigatória no Sprint 0**.

### Selected Foundation (monorepo)

**Backend / Control Plane (Python):**
- Python **3.13**; gestão com **uv** (Astral, binário Rust, lockfile, 10–100× pip).
- **FastAPI 0.136.x** — API interna, endpoints do painel, webhook inbound (n8n).
- **Typer** (vendoriza Click) — CLI (RF-06).
- **SQLAlchemy 2.x (async)** + **psycopg3** (driver único, padronizado) + **Alembic** (migrations) + **pgvector** (memória semântica RF-05).
- **LangGraph** + **langgraph-checkpoint-postgres 3.1.0** — orquestração durável (RF-01, RF-11).
- **Arquitetura hexagonal (Ports & Adapters)**: portas `Orchestrator`, `LLMProvider` (`SubscriptionAdapter`/`ApiAdapter`), `Notifier` (WhatsApp/clihelper), `Vcs` (GitHub), `AuditSink`, `Memory`.

**Execution Plane:**
- Workers que invocam `claude -p` em **container Docker efêmero** (rede restrita, FS limitado ao workspace; identidade por ferramenta injetada por env). Stateless/descartáveis.

**Frontend / Painel Web (RF-07):**
- **Next.js 16** (App Router) + TypeScript + **Tailwind** + **shadcn/ui** + **Framer Motion** (conforme PRD / uiuxpromasskill / 21st Dev). Projeto separado no monorepo.

**Infra:**
- **PostgreSQL** (com pgvector) — base única; 4 schemas: `app`, `audit`, `memory`, `langgraph`.
- **Docker** + **Docker Swarm** (Hetzner). Swarm escala execução; nunca é pré-requisito de corretude do control plane.

**Comandos de inicialização (primeira história de implementação):**
```bash
# Backend (control plane)
uv init backend && cd backend
uv add fastapi "uvicorn[standard]" typer "sqlalchemy[asyncio]" psycopg[binary] \
       alembic pgvector langgraph langgraph-checkpoint-postgres pydantic-settings
# Painel
npx create-next-app@latest frontend --typescript --tailwind --app --eslint
cd frontend && npx shadcn@latest init && npm i framer-motion
```

**Trade-offs registrados:**
- psycopg3 único (vs. asyncpg mais rápido) — escolha por menor superfície/segurança; carga baixa justifica.
- LangGraph traz ecossistema LangChain — uso restrito a `langgraph`+checkpoint, pin de versão, scan de deps (NFR 6.1).
- *checkpoint* (LangGraph, podável) **≠** *auditoria* (`audit`, append-only hash-chain) — camadas distintas.

**Validação Sprint 0 (gate de fundação):** grafo LangGraph mínimo → nó executa `claude -p` via `LLMProvider` → checkpoint Postgres → kill do processo → **resume** recupera estado e conclui. Confirma RF-11 + premissa de `--resume` headless + risco D-032.

**Note:** A inicialização do monorepo com os comandos acima deve ser a **primeira história de implementação**.

## Core Architectural Decisions

### Decision Priority Analysis
- **Críticas (bloqueiam implementação):** modelagem dos 4 schemas; máquina de estados da Onda + gates via `interrupt()`; porta `LLMProvider` + sandbox de execução; auth do painel; webhook inbound seguro.
- **Importantes (moldam a arquitetura):** observabilidade (3 pilares); rate limiting (inbound + outbound persistente); reverse proxy/TLS; backups/PITR; roles de DB por schema.
- **Diferidas (pós-MVP):** HA do control plane (hoje SPOF aceito); driver `api`; âncora pública periódica do hash-chain; índice HNSW do pgvector sob volume.

### Data Architecture
- **PostgreSQL** base única, **4 schemas**: `app` (sessões, ondas, gates, fila), `audit` (append-only + hash-chain + timestamp), `memory` (pgvector), `langgraph` (checkpoints do PostgresSaver, via `.setup()` em migration controlada).
- **Modelagem:** SQLAlchemy 2.x declarative async; **Pydantic v2** para validação na borda (DTOs separados dos modelos ORM — sem acoplar SQLModel). `pydantic-settings` para config.
- **Validação drop-at-ingress:** schema Pydantic mínimo no webhook inbound (n8n é trust boundary upstream).
- **Migrations:** Alembic (app/audit/memory); tabelas do LangGraph criadas por migration que chama `.setup()`.
- **Auditoria à prova de adulteração:** cada registro encadeia o hash do anterior; **role `audit_append` sem UPDATE/DELETE** + trigger que rejeita mutação (defesa em profundidade).
- **Caching:** **sem Redis no MVP** (Postgres como base única). Prompt caching da Anthropic no nível LLM; fila de trabalho via `SELECT … FOR UPDATE SKIP LOCKED`; cache de leitura do painel via TanStack Query no cliente.

### Authentication & Security
- **Auth do painel:** **GitHub OAuth** (SSO, sem gestão de senhas), sessão httpOnly. Single-operator no MVP.
- **Autorização interna (zero-trust):** cada componente autentica; **least-privilege via roles de DB por schema** (`app_rw`, `audit_append`, `memory_rw`); identidade no nível de ferramentas (GitHub token escopado por onda).
- **Secrets:** **Docker Swarm secrets** montados em `/run/secrets`, lidos por `pydantic-settings`; nunca em repo nem em env plaintext.
- **Sandbox de execução:** container efêmero, **egress allowlist (só Anthropic + GitHub)**, FS limitado ao workspace, sem credenciais de produção; input sempre validado antes de tocar a shell (anti command-injection).
- **Gate autenticado (RF-03b):** convite carrega **PIN single-use com expiração**; validado no inbound; não confiar só no número remetente.
- **Webhook inbound:** verificação **HMAC** + **idempotency key** (reentrega n8n/clihelper não duplica efeito).
- **Cripto:** TLS em trânsito (reverse proxy); `pgcrypto` para eventuais campos com PII; políticas de retenção/descarte (LGPD).

### API & Communication Patterns
- **API:** REST com **FastAPI** (OpenAPI automático); endpoints do painel + comandos (pausar/retomar/responder gate) + webhook inbound.
- **Control ↔ Execution:** fila durável Postgres (`SKIP LOCKED`); workers consomem e invocam `claude -p` em sandbox.
- **Tempo real (painel):** **SSE** (Server-Sent Events) para stream de ondas/decisões/telemetria; comandos via REST. SSE configurado **no-buffering** no proxy.
- **Erros:** **hierarquia de exceções de domínio tipadas** (recuperável vs. fatal) + handler central FastAPI; política explícita de retry/escalada (N loops → gate 6).
- **Rate limiting:** inbound via **slowapi**; outbound WhatsApp via **leaky-bucket persistente** (estado no Postgres, ≤1 req/s do clihelper, sobrevive a restart).
- **Gates humanos:** implementados com **`interrupt()` do LangGraph** (suspende o grafo, persiste no checkpoint, retoma na resposta) — encaixe nativo do RF-03b.

### Frontend Architecture
- **Next.js 16** (App Router); **Server Components** por padrão, Client onde interativo; streaming SSR + code splitting.
- **Estado:** **TanStack Query** (server state; `staleTime: Infinity` + `setQueryData` alimentado por SSE) + **Zustand** (UI state leve).
- **UI:** **Tailwind + shadcn/ui + Framer Motion** (PRD/uiuxpromasskill/21st Dev). Tempo real via **EventSource (SSE)**.
- **Auth:** sessão GitHub OAuth compartilhada com o backend.

### Infrastructure & Deployment
- **Hosting:** VPS **Hetzner**, **Docker Swarm**. Workers de execução como serviços Swarm escaláveis (replicas); control plane single (HA diferido).
- **Reverse proxy / TLS:** **Caddy** (HTTPS automático zero-config, Caddyfile mínimo) — serviços públicos são poucos e estáveis (painel/API/webhook). *Traefik* registrado como upgrade se a topologia Swarm ficar dinâmica.
- **CI/CD:** **GitHub Actions** — `ruff` (lint+format), `mypy`/`pyright` (tipos), `pytest` (unit + integração real), build Docker multi-stage, scan de deps (NFR 6.1).
- **Observabilidade (3 pilares, progressiva):** `structlog` (logs JSON + request-id) → **prometheus-client** (RED metrics + métricas de negócio: saúde de sessão, convocações de gate, consumo de quota) → **OpenTelemetry** (traces) → **Grafana** (+ Loki/Tempo). Healthcheck endpoint.
- **Backups:** **WAL archiving + base backup → object storage (R2)**, PITR.
- **Config:** `pydantic-settings` (`/run/secrets` + env não-sensível).

### Decision Impact Analysis
- **Sequência de implementação:** (1) scaffold monorepo + Docker/Postgres; (2) schemas + migrations + roles; (3) portas hexagonais (`LLMProvider`/`Orchestrator`/`AuditSink`/`Notifier`/`Vcs`/`Memory`); (4) PoC LangGraph + `claude -p` + checkpoint/resume (gate de fundação); (5) gate manager via `interrupt()` + PIN; (6) integração GitHub/CI + sandbox; (7) painel + SSE; (8) observabilidade.
- **Dependências cruzadas:** auth GitHub OAuth reutiliza a credencial GitHub da integração VCS; gates dependem do checkpoint LangGraph; auditoria depende de roles/triggers de DB; quota-aware scheduler depende das métricas de observabilidade.

## Implementation Patterns & Consistency Rules

> **Princípio-mestre:** todo pattern abaixo é **enforçado por ferramenta** (lint, schema, CI gate), nunca apenas documentado — convenção "soft" sofre rot mesmo com um único autor. Onde houver pattern sem enforcement mecânico, é dívida a fechar.

### Naming Patterns
- **DB:** `snake_case`; tabelas no **plural** (`sessions`, `waves`, `gates`, `audit_events`, `memories`). PK `id` **UUIDv7** (ordenável temporalmente). FK `<entidade>_id`. Índices `ix_<tabela>_<colunas>`. Timestamps `created_at`/`updated_at` **timezone-aware UTC**.
- **API REST:** recursos no plural, lowercase (`/sessions`, `/waves/{id}`). Path param `{id}`. Query e **payload JSON em `snake_case`** (sem mapeamento camel↔snake). Headers custom `X-Hdd-*`.
- **Python:** PEP 8 — módulos/funções/vars `snake_case`, classes `PascalCase`, constantes `UPPER_SNAKE`. **Type hints obrigatórios** (mypy strict).
- **Frontend (TS):** componentes `PascalCase` (arquivo e símbolo), hooks `useX`, utils `camelCase`. Campos vindos da API permanecem `snake_case` (eslint não força camelCase em DTOs de API).

### Structure Patterns
- **Backend (hexagonal):** `domain/` (entidades + lógica pura, sem I/O) · `contracts/` (Protocols das portas + DTOs Pydantic — fonte de verdade) · `adapters/` (`llm/`, `vcs/`, `notifier/`, `audit/`, `memory/`, `db/`) · `application/` (casos de uso / orquestração) · `api/` (routers FastAPI) · `cli/` (Typer) · `config/`.
- **Testes:** **separados** — `tests/unit/` (mock, prova construção) e `tests/integration/` (real, opt-in, prova comportamento). Não co-localizar.
- **Frontend:** organização **por feature** (`features/<feature>/{components,hooks,api}`); UI base shadcn em `components/ui/`.
- **Migrations:** `migrations/NNNN_descricao.py`, **append-only** (nunca editar após merge).

### Format Patterns
- **Sucesso:** resposta **direta** (sem wrapper `{data}`).
- **Erro:** **RFC 9457 Problem Details** (`type`, `title`, `status`, `detail`, `instance`, + extensões).
- **Datas:** **ISO 8601 UTC** (string). Booleans `true/false`. IDs **UUIDv7**.
- **Contract-first:** OpenAPI gerado pelo FastAPI → **tipos TS via `openapi-typescript`** (zero drift backend↔frontend).

### Communication Patterns
- **Eventos / auditoria:** nome `dominio.acao` no passado (`wave.started`, `gate.requested`, `gate.approved`, `session.resumed`). Envelope: `{event_id (UUIDv7), type, schema_version, occurred_at, correlation_id, actor, payload}`. Eventos **versionados** por `schema_version`.
- **Correlação:** `correlation_id` (sessão) + `wave_id` propagados via **contextvars** em todo log/trace/audit.
- **Estado (frontend):** atualizações **imutáveis** (Zustand); actions `verbNoun`; server state só em TanStack Query.
- **Logs:** `structlog` **JSON**; sempre com `correlation_id`, `component`, `event`; níveis padrão (`debug/info/warning/error`).

### Process Patterns
- **Erros:** hierarquia `HddError` → `DomainError` (recuperável → loop de correção) / `FatalError` (→ escalada gate RF-03b.6). Retry com **backoff exponencial + jitter**, N configurável.
- **Idempotência:** toda operação com efeito externo carrega **idempotency key** (deduplicação no ingress).
- **Validação:** na **borda** (Pydantic), sempre; nunca confiar em input sem validar no ingress. Proibido SQL por string e `shell=True`.
- **Loading (frontend):** estados do TanStack Query; skeletons; sem spinners globais.

### Enforcement Guidelines
**Todos os agentes DEVEM** (verificado no CI, bloqueante):
- Passar `ruff` (lint+format), `mypy --strict`/`pyright`, `pytest` (unit + integração) — backend; `eslint`+`prettier`+`tsc` — frontend.
- Usar os DTOs/Protocols de `contracts/` (não inventar formas de payload).
- Regenerar tipos TS do OpenAPI quando a API muda (check de drift no CI).
- Commits no padrão **Conventional Commits**, assinados.
- **Anti-patterns proibidos (lint/review):** SQL por string, `shell=True`, `UPDATE`/`DELETE` em `audit`, payload camelCase, datas não-ISO, segredo em código, contrato divergente do `contracts/`.

## Project Structure & Boundaries

### Complete Project Directory Structure
```
projeto_hdd/
├── README.md
├── compose.yaml                  # dev local (Postgres+pgvector, backend, frontend)
├── stack.yaml                    # produção: Docker Swarm (services + secrets)
├── Caddyfile                     # reverse proxy + TLS automático
├── .github/workflows/ci.yml      # ruff, mypy/pyright, pytest, import-linter, build, scan, openapi-drift
├── docs/
│   ├── decisions/                # ADRs curtos
│   └── runbooks/
├── backend/
│   ├── pyproject.toml            # uv; deps + config ruff/mypy/import-linter
│   ├── uv.lock
│   ├── Dockerfile                # multi-stage
│   ├── alembic.ini
│   ├── migrations/               # NNNN_*.py (append-only; schemas via op.execute)
│   ├── src/hdd/
│   │   ├── main.py               # entrypoint FastAPI
│   │   ├── cli.py                # Typer (RF-06)
│   │   ├── config/               # pydantic-settings (/run/secrets)
│   │   ├── domain/               # entidades + lógica pura (NÃO importa adapters)
│   │   │   ├── session.py        # FSM de sessão (RF-11)
│   │   │   ├── wave.py           # unidade de trabalho (Onda)
│   │   │   ├── gate.py           # gates RF-03b
│   │   │   └── errors.py         # HddError/DomainError/FatalError
│   │   ├── contracts/            # fonte de verdade (contract-first)
│   │   │   ├── ports.py          # Protocols: Orchestrator, LLMProvider, Vcs, Notifier, AuditSink, Memory
│   │   │   ├── dtos.py           # DTOs Pydantic v2
│   │   │   └── events.py         # envelope + schemas de evento versionados
│   │   ├── application/          # casos de uso / orquestração
│   │   │   ├── orchestrator.py   # grafo LangGraph (interrupt() p/ gates)
│   │   │   ├── scheduler.py      # quota-aware (Max 20x/1M)
│   │   │   └── gate_manager.py   # PIN single-use + timeout
│   │   ├── adapters/
│   │   │   ├── llm/              # subscription (claude -p) | api (RF-12)
│   │   │   ├── vcs/              # github (token escopado)
│   │   │   ├── notifier/         # clihelper (outbound, leaky-bucket) | n8n (inbound, HMAC)
│   │   │   ├── audit/            # hash-chain writer (schema audit)
│   │   │   ├── memory/           # pgvector (schema memory)
│   │   │   └── db/               # SQLAlchemy async, sessão, repositórios
│   │   ├── api/                  # routers: sessions, waves, gates, webhook, sse, auth(oauth)
│   │   └── observability/        # structlog, otel, prometheus
│   └── tests/{unit,integration}/
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── Dockerfile
│   ├── src/
│   │   ├── app/                  # App Router: dashboard, waves/[id], gates
│   │   ├── components/ui/        # shadcn/ui
│   │   ├── features/<feature>/{components,hooks,api}
│   │   ├── lib/                  # api-client, sse, auth, query-client
│   │   └── types/                # gerados do OpenAPI (openapi-typescript)
│   └── tests/
├── sandbox/
│   └── Dockerfile                # imagem mínima do executor: Claude Code + git (egress allowlist)
└── scripts/                      # operacionais (backup WAL, deploy)
```

### Architectural Boundaries
- **API:** FastAPI expõe painel + comandos + webhook inbound; auth GitHub OAuth; SSE para telemetria. Único ponto público (atrás do Caddy).
- **Control ↔ Execution:** fila Postgres (`SKIP LOCKED`); workers puxam trabalho e invocam `claude -p` no **sandbox** (processo/container isolado). Sem chamadas diretas síncronas.
- **Dependência hexagonal (enforçada por import-linter):** `domain` → (nada) ; `contracts` → `domain` ; `adapters` → `contracts`+`domain` ; `application` → `contracts`+`domain` ; `api`/`cli` → `application`. Adapters nunca são importados pelo domínio.
- **Dados:** 4 schemas (`app`/`audit`/`memory`/`langgraph`) com roles próprias; acesso só via `adapters/db` (repos).
- **Frontend ↔ Backend:** REST + SSE; tipos TS gerados do OpenAPI (zero drift).
- **Externos:** Anthropic (via `claude -p` no sandbox), GitHub (vcs + oauth), clihelper (outbound WhatsApp), n8n (inbound).

### Requirements → Structure Mapping
| RF | Local |
|---|---|
| RF-01, RF-11 orquestração/sessão | `application/orchestrator.py`, `domain/{session,wave}.py` |
| RF-02 tool routing | `application/scheduler.py`, `adapters/llm/` |
| RF-03, RF-03b gates | `application/gate_manager.py`, `domain/gate.py`, `api/gates` |
| RF-04 auditoria | `adapters/audit/`, schema `audit` |
| RF-05 memória | `adapters/memory/`, schema `memory` (pgvector) |
| RF-06 CLI | `cli.py` |
| RF-07 painel | `frontend/` |
| RF-08 WhatsApp | `adapters/notifier/`, `api/webhook` |
| RF-09 GitHub/CI | `adapters/vcs/`, `.github/workflows/` |
| RF-10 módulos | extensão via `contracts/ports.py` (futuro) |
| RF-12 provider | `adapters/llm/{subscription,api}` |

### Cross-Cutting Concerns → Local
Auditoria → `adapters/audit` + schema `audit` · Observabilidade → `observability/` (contextvars `correlation_id`) · Segurança/identidade → roles de DB + `config/` (secrets) + `sandbox/` · Provider abstraction → `adapters/llm` atrás de `LLMProvider`.

### Data Flow (resumo)
CLI/Painel/WhatsApp → `api` → `application` (orquestrador LangGraph) → fila Postgres → worker → `claude -p` (sandbox) → resultado → verificação automática → checkpoint + `audit` + métricas → (gate? `interrupt()` → Notifier → humano → resume) → PR via `vcs` → CI.

## Architecture Validation Results

> Validação executada por **dois revisores adversariais independentes** (segurança/AI-Safety+pentester; arquiteto cético de coerência/cobertura), lendo PRD + arquitetura. Veredito inicial de ambos: **NOT READY** — falhas de *composição* e de *especificação comportamental*, não de decisão estrutural. Os achados críticos foram **resolvidos** no Addendum abaixo; o que resta é validação **empírica** (Sprint 0).

### Coherence / Coverage / Readiness (resumo)
- **Coerência estrutural:** sólida — Control/Execution Plane, 4 schemas, hash-chain, leaky-bucket persistente, hexagonal+import-linter, trade-offs conscientes.
- **Cobertura:** boa para RF-01/04/05/06/07/09/12; lacunas em RF-02 (model routing no subscription), RF-10 (módulos), NFR sandbox-até-avaliação + monitor de comportamento, LGPD exclusão.
- **Prontidão:** bloqueada por FSMs vazias, contrato de durabilidade `claude -p`↔LangGraph e taxonomia de erros — todos resolvidos no Addendum.

### Gap Analysis (achados)
**Críticos (segurança):** G-1 gate por auto-classificação do LLM · G-2 prompt injection→execução (GitHub na allowlist = exfiltração) · G-3 mono-identidade sob zero-trust declarado.
**Críticos (coerência):** C-1 FSMs Onda/Sessão sem estados · C-2 LangGraph-checkpoint vs `claude -p --resume` ortogonais → duplicação de efeitos · C-3 RF-02 model selection não verificada · C-4 taxonomia erro/retry/N não concreta.
**Importantes:** G-4 saga/quota parcial · G-5 PIN trafega por n8n não-confiável · G-6 hash-chain sem âncora externa · quota global não-enforçada (Swarm+SKIP LOCKED) · psycopg3 pool/transação do gate · RF-10 módulos sem mecanismo · LGPD exclusão vs audit imutável.
**Menores:** G-7 PII em embeddings · G-8 mecanismo de sandbox não-fixado · timeout de gate 5/6 · transferência internacional de dados.

### Resolutions — Architecture Addendum (decisões que fecham os críticos)

- **R-1 (G-1) Capability broker determinístico.** Toda ação com efeito externo destrutivo (rm fora do workspace, DROP/DELETE/TRUNCATE, push em branch protegida, rotação de secret, pagamento) passa por um **broker no Control Plane que classifica por REGRA (não por LLM)** e força `interrupt()` (gate RF-03b) **antes** do efeito. O worker **não tem shell livre**: efeitos privilegiados são *capabilities* mediadas, não comandos arbitrários. Redes de segurança independentes: **FS read-only fora do workspace por montagem** e **GitHub branch protection com required review**. → A fronteira de gate deixa de depender da auto-classificação do agente.
- **R-2 (G-2/G-3) Isolamento de papéis + egress por repositório.** Separar fisicamente (containers/uids/tokens distintos) o **papel de ingestão** (lê conteúdo não-confiável de repo/issue/WhatsApp, **sem token de escrita**) do **papel de execução** (detém token escopado). Conteúdo não-confiável nunca é concatenado ao prompt de sistema (delimitação forte). **Egress allowlist por org/repos do projeto**, não "GitHub inteiro". Proibido `--dangerously-skip-permissions` com rede.
- **R-3 (G-4) Intent-log + reconciliador (saga).** Cada efeito externo é registrado no `audit` (intent) **antes** de executado; no resume, um **reconciliador** detecta efeitos parciais e compensa/retoma. Operações multi-passo seguem padrão saga com compensação.
- **R-4 (G-5) Aprovação no canal autenticado.** A **decisão de gate ocorre no Painel (GitHub OAuth)**; o WhatsApp apenas **notifica** (deep link). PIN, quando usado, é ligado a `gate_id` + hash do payload, single-use atômico, com rate-limit. → O segredo de aprovação não depende do trust boundary n8n.
- **R-5 (G-6) Âncora WORM da auditoria.** Head-hash assinado publicado periodicamente em **R2 com object-lock (WORM)**; escrita de auditoria em processo com principal de SO distinto. A chain prova ordenação; a âncora + assinatura provam autenticidade.
- **R-6 (G-7/LGPD) PII e crypto-shredding.** PII nunca entra no `audit` em claro (só referência pseudonimizada via `pgcrypto`). "Direito à exclusão" sobre dados imutáveis = **crypto-shredding** (descarte da chave). Política específica para embeddings (`memory`).
- **R-7 (G-8) Mecanismo de sandbox fixado.** Container **uid não-root**, egress filtrado por proxy/firewall (allowlist), mounts read-only fora do workspace, sem credenciais de produção.
- **R-8 (RF-02) Model routing é best-effort no `subscription`.** Seleção via `--model` quando o Claude Code honrar; **fallback determinístico = "modelo único da conta"** e o scheduler vira no-op de modelo. **Validar na PoC do Sprint 0.** (PRD a ajustar.)
- **R-9 (RF-10) Módulos de extensão → pós-MVP.** No MVP fica apenas a **porta** `contracts/ports.py`; o registry + gate de avaliação de risco (NFR 6.1) é entregue pós-MVP. (PRD a ajustar para não prometer no escopo MVP.)
- **R-10 (C-1) FSMs especificadas:**
  - **Sessão:** `CREATED → RUNNING → {AWAITING_GATE ⇄ RUNNING} → {PAUSED_QUOTA → RUNNING} → DONE | FAILED | ABORTED`. Triggers: start, gate_requested, gate_resolved, quota_exhausted, quota_restored, complete, fatal_error, operator_abort.
  - **Onda:** `PLANNED → EXECUTING → VERIFYING → {CORRECTING → EXECUTING}[≤N] → {AWAITING_GATE → …} → MERGED | ESCALATED | FAILED`. Cada transição emite evento no `audit`.
- **R-11 (C-2) Contrato de durabilidade `claude -p` ↔ LangGraph.** Cada invocação de `claude -p` é **stateless por nó**: o contexto é **reconstruído do banco** (`memory`/estado da onda); `--resume` é **apenas otimização de custo de tokens, nunca portador de estado/correção**. O `session_id` vive **no state do grafo** (entra no checkpoint atomicamente). **Nós que chamam `interrupt()` são puros até o ponto de interrupt** (efeitos só depois). Checkpoint LangGraph e escrita de domínio ocorrem na **mesma transação**. PoC do Sprint 0 reforçada (ver abaixo).
- **R-12 (C-4) Taxonomia de erros + retry + quota lease global:**
  | Classe | Recuperável? | Conta p/ N? | Ação ao esgotar |
  |---|---|---|---|
  | `TransientError` (rede, 429, timeout curto) | sim (backoff+jitter) | N_transient=5 | marca FatalError |
  | `QuotaExhausted` | **não é erro → PAUSE** | não | retoma em quota_restored |
  | `DomainError` (teste/lint/verificação reprova) | sim (loop correção) | N_correction=3 | **gate RF-03b.6 (escalada)** |
  | `FatalError` (invariante violada, input irrecuperável) | não | — | aborta onda → gate 6 |
  Unidade de "tentativa" = uma passagem completa `EXECUTING→VERIFYING` da onda. **Teto de concorrência global** de `claude -p` enforçado por **lease/semáforo persistente no Postgres** (espelha o leaky-bucket do WhatsApp): cada worker (Swarm + SKIP LOCKED) adquire lease antes de invocar; sem lease, espera. → quota da conta única é enforçada, não apenas configurada.
- **R-13 (eventos) Catálogo + hash-chain.** Catálogo fechado de eventos com schema de payload por `type` em `contracts/events.py`; hash-chain = `SHA-256` sobre o envelope canonicalizado (JSON ordenado), com elo genesis fixo.
- **R-14 (contrato `claude -p`).** Invocação com `--output-format json`; mapeamento `exit-code/output → classe de erro`; credenciais injetadas por env **nunca logadas/auditadas**.
- **R-15 (psycopg3).** Usar **AsyncPostgresSaver**; limites de pool por componente; checkpoint do gate + estado de domínio na mesma transação (liga a R-11).

### PoC do Sprint 0 — critérios reforçados (gate de fundação)
Além de "kill → resume conclui", a PoC DEVE provar: (1) **idempotência de um nó que fez um commit** antes do kill (sem duplicar no resume); (2) reconstrução de contexto do banco sem depender de `--resume` para correção; (3) `interrupt()` retoma sem repetir efeitos (nó puro até interrupt); (4) **viabilidade real de `--model`** no driver subscription (R-8); (5) comportamento sob **exaustão de quota** no meio de efeito externo parcial (R-3) e limites/ToS da conta (D-032).

### Architecture Completeness Checklist
**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed (quota lease, prompt caching, pgvector)

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified (envelope; catálogo de payloads → entregável Sprint 0, R-13)
- [x] Process patterns documented (taxonomia de erros R-12)

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established (import-linter)
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment
**Overall Status:** **READY WITH MINOR GAPS** — as decisões estruturais e o Addendum (R-1…R-15) fecham todos os gaps *críticos* de especificação e segurança. Os itens remanescentes são **validações empíricas** que, por natureza, só fecham no Sprint 0 (PoC de durabilidade `claude -p`↔LangGraph; viabilidade de `--model` no subscription; ToS/limites da conta D-032) — não são decisões de papel pendentes.
**Confidence Level:** medium-high. Estrutura madura e verificada adversarialmente; o risco residual está concentrado e isolado na PoC de fundação.
**Key Strengths:** durabilidade/auditoria/idempotência sólidas; honestidade sobre limitações; enforcement mecânico de convenções; verificação adversarial real incorporada.
**Areas for Future Enhancement:** HA do control plane (hoje SPOF); driver `api`; registry de módulos (RF-10); monitor comportamental de agentes (NFR 6.1).

### Implementation Handoff
**Diretrizes para agentes:** seguir as decisões e o Addendum exatamente; usar `contracts/` como fonte de verdade; respeitar boundaries hexagonais; a **PoC de fundação (Sprint 0) é gate bloqueante** antes de qualquer execução autônoma.
**Primeira prioridade de implementação:** scaffold do monorepo (comandos da seção *Starter*) → schemas+roles+migrations → portas hexagonais → **PoC LangGraph+`claude -p`+checkpoint/resume com os 5 critérios reforçados**.
**Ajustes de PRD recomendados (coerência):** RF-02 como best-effort+validação (R-8); RF-10 fora do escopo MVP (R-9); gates com enforcement determinístico (R-1); zero-trust por agente declarado como **aspiracional até o driver `api`** (R-2/G-3); aprovação de gate no Painel autenticado (R-4); LGPD via crypto-shredding (R-6).
