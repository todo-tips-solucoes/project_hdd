# Prompt de continuação — HDD v2 · Story 6.1 (Produtor da fila de trabalho)

> Cole este conteúdo (ou aponte para este arquivo) ao iniciar uma **sessão limpa**.
> Estado em: 2026-06-01, após Epic 5 (enviado) + retrospectiva + planejamento do Epic 6.
> Alvo desta sessão: **Story 6.1** — o 1º dos 3 fios de integração que destravam o end-to-end.

---

## Quem é você e o que é este projeto

Retoma a implementação do **HORSE DRIVEN DEVELOPMENT (HDD) v2** — orquestração autônoma de
desenvolvimento de software com auditoria. `project_name=projeto_hdd`. Dir `/var/lib/projeto_hdd`.
Comunicação e documentos em **português**. **Leia primeiro a memória `project-hdd-v2-reboot`.**

Fontes de verdade: PRD `_bmad-output/planning-artifacts/prds/prd-hdd-v2.md` · Arquitetura
`architecture.md` · Épicos `epics.md` (Epic 6 ao final) · **Retro** `_bmad-output/
implementation-artifacts/epic-5-retro-2026-06-01.md` (origem do Epic 6).

## Onde estamos (2026-06-01)

Epics 1–5 **completos e enviados** (`origin/main` em `24acfb2`, CI verde). A infra de produção
existe (Docker Swarm + Caddy + worker loop + lease + LGPD + backups). **Mas a plataforma ainda
NÃO roda uma feature ponta a ponta** — a retrospectiva revelou 3 fios de integração soltos, que
viraram o **Epic 6 (Integração & Caminho até Produção, 5 histórias)**:

- **6.1 (ESTA): produtor da fila** — nada alimenta `app.work_queue`; o worker consome de uma fila vazia.
- 6.2: resume pós-gate (aprovação no painel não retoma a onda do checkpoint LangGraph).
- 6.3: verify real (o nó `verify` é placeholder `True` → vai direto ao gate).
- 6.4: deploy real Hetzner + smoke E2E + D-032. 6.5: backups R2 em produção.

Sequência: 6.1 → 6.2 → 6.3 destravam o end-to-end local; depois 6.4/6.5.

## Story 6.1 — escopo e AC (de `epics.md`)

**Como** operador, **quero** que iniciar uma feature enfileire trabalho para o worker, **para que**
o control plane efetivamente dispare ondas.

- **Given** a CLI `hdd start <task>` e/ou um endpoint da API
- **When** o operador inicia uma feature
- **Then** um item é enfileirado em `app.work_queue` com payload `{task, thread_id}` (thread_id = id da onda)
- **And** o worker o consome (claim SKIP LOCKED), adquire lease e executa a onda correspondente
- **And** a sessão/onda criada e o item da fila referenciam o mesmo `thread_id`

## O que já existe (não recrie — conecte)

- **`backend/src/hdd/cli/main.py` → comando `start`** (linhas ~29–38): cria sessão + onda
  (`Repository.create_session` → `set_session_state(RUNNING)` → `create_wave(sid)` devolve `wid`),
  **mas NÃO enfileira**. Falta exatamente isto.
- **`backend/src/hdd/adapters/db/queue.py` → `WorkQueue.enqueue(payload: str) -> str`**: já insere
  em `app.work_queue` (status `pending`). `payload` é texto (JSON).
- **`backend/src/hdd/worker/runner.py`**: o worker já lê o payload como JSON `{"task", "thread_id"}`
  (`thread_id` default = work_id) e chama `orchestrator.run_wave(thread_id, task)`. **Portanto o
  produtor DEVE gravar `thread_id = wid`** (o id da onda) para o checkpoint LangGraph casar com a onda.
- **`backend/src/hdd/worker/loop.py`**: `WorkerLoop` já faz claim→lease→run→release (Story 5.2).

## Trabalho mínimo da 6.1

1. No `start` da CLI: após criar a onda, `await WorkQueue(sm).enqueue(json.dumps({"task": task,
   "thread_id": wid}))`. Ecoar o `work_id` enfileirado.
2. **Teste de integração** (Postgres real, sem quota): `start` enfileira 1 item `pending` com payload
   correto; `WorkQueue.claim()` o devolve; o payload decodifica para `{task, thread_id=wid}`.
   (NÃO rodar o worker real aqui — isso invoca `claude -p` e custa quota; teste só o enfileiramento.)
3. **Opcional (parte "API" do AC):** endpoint `POST /api/features {task}` que faz o mesmo (cria
   sessão+onda+enqueue) e devolve `{session_id, wave_id, work_id}`. **Não existe ainda** — se fizer,
   atualize o OpenAPI (`uv run python scripts/export_openapi.py openapi.json`) e os tipos do frontend
   (`cd frontend && npm run typegen`) para o CI de drift passar. Se preferir, deixe a API para depois
   e entregue só a CLI (o AC aceita "CLI e/ou API").

## ⚠️ Subtileza a decidir (flag para o operador)

O orquestrador roda sobre o **checkpoint LangGraph** (schema `langgraph`), enquanto `app.waves` tem
sua própria coluna `state` (FSM da onda em `domain/wave.py`). Hoje rodar a onda **não sincroniza**
`app.waves.state`. Decidir o source-of-truth / sincronização provavelmente cabe à **6.2** (resume +
transições), mas confirme o recorte com o operador antes de expandir o escopo da 6.1.

## Stack e regras fixas (não viole)

Python 3.13+/uv · hexagonal (`domain ← contracts ← adapters/application ← api/cli/worker`,
boundaries por import-linter; `api`/`cli`/`worker` são entrypoints) · PostgreSQL 17 + SQLAlchemy 2
async + psycopg3 · LangGraph + checkpoint-postgres · snake_case · UUIDv7 · Conventional Commits.
**Tooling sempre verde antes de commitar:** `ruff` · `mypy --strict` · `lint-imports` · `pytest`.
`claude -p` no worker SEMPRE com `--disallowedTools` (descoberta da PoC) — mas a 6.1 não invoca claude.

## Como rodar

```bash
export PATH="$HOME/.local/bin:$PATH"
docker compose up -d postgres                 # Postgres 17 + pgvector, host 5433
cd backend && uv sync
uv run alembic upgrade head                   # migrations até 0009
uv run ruff check . && uv run mypy && uv run lint-imports
uv run pytest                                 # unit
uv run pytest -m integration --ignore=tests/test_poc.py   # integração (precisa Postgres)
uv run hdd start "minha feature"              # comando alvo da 6.1
```

Gotchas: host tem Python 3.8 (use uv); Postgres em **5433**; `curl`/`wget` bloqueados (use httpx/uv
run python); `claude -p` custa quota — mantenha fora do CI e dos testes de 6.1.

## Git & finalização

Branch `main`, remote `origin` (`origin/main` em `24acfb2`). Token `gh` já tem escopo `workflow`.
Conventional Commits; **não comite** `.claude/settings.local.json`. Finalização exige **revisão
humana** + resumo (memória `feedback-hdd-mandatory-review`); nunca auto-aprovar no M0. Lentes:
performance · segurança · best practices. Verificação adversarial real onde agrega valor.
