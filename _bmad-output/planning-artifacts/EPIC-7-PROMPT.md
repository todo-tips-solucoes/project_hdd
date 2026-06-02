# Prompt de continuação — HDD v2 · Planejamento do Epic 7

> Cole este conteúdo (ou aponte para este arquivo) ao iniciar uma **sessão limpa**.
> Estado em: **2026-06-02**, com Epics 1–6 concluídos, deployados em produção e verificados.
> **Objetivo desta sessão: PLANEJAR o Epic 7 — não implementar.** O backlog planejado
> (Epics 1–6, 31 + stories emergentes) terminou; o Epic 7 ainda **não tem escopo**: a
> primeira tarefa é **decidir a direção** com o operador e só então formalizar épico+histórias.

---

## Quem você é e o que é este projeto

Você retoma o **HORSE DRIVEN DEVELOPMENT (HDD) v2** — plataforma de **orquestração autônoma
de desenvolvimento de software** com auditoria. `project_name` = `projeto_hdd`. Diretório:
`/var/lib/projeto_hdd`. Comunicação e documentos em **português**.

**Leia primeiro as memórias do projeto** (carregadas via `MEMORY.md`): em especial
`project-hdd-v2-reboot` (contexto do reboot Python), `project-hdd-vision` (visão + fases
M0/M1/M2), `project-hdd-externalisation-thesis` (a tese: o produto não é autonomia, é
externalização de memória de contexto) e `project-hdd-prod-on-dev-machine` (⚠️ produção
roda nesta máquina — ver "Ambiente" abaixo).

## Artefatos de planejamento (fonte de verdade — leia antes de planejar)

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-hdd-v2.md` (ver §9 Roadmap e §10 Questões em Aberto)
- **Arquitetura:** `_bmad-output/planning-artifacts/architecture.md` (validada adversarialmente; Addendum R-1…R-15)
- **Épicos e histórias:** `_bmad-output/planning-artifacts/epics.md` (Epics 1–6 definidos)
- **Retrospectivas:** `_bmad-output/implementation-artifacts/epic-5-retro-2026-06-01.md` e
  `epic-6-retro-2026-06-01.md` (action items, dívida e lições — leia ambas)
- **ADRs:** `docs/decisions/0001…0004` (gate de fundação, execução no host cwd, merge no resume, verify via socket)

## O que está PRONTO (Epics 1–6 — em produção)

- **Epic 1 (Fundação, 5/5):** scaffold hexagonal; PoC GO (LangGraph + `claude -p` + checkpoint); schemas + roles; contratos das 6 portas; abstração de provider.
- **Epic 2 (Execução Autônoma Segura, 9/9):** FSMs Sessão/Onda; fila Postgres SKIP LOCKED + quota lease; sandbox endurecido; capability broker; gate manager (PIN); orquestrador LangGraph (plan→execute→verify→correct→gate); retry/escalada; GitHubVcs; CLI Typer.
- **Epic 3 (Rastreabilidade, 6/6):** audit hash-chain + WORM; catálogo de eventos; memória pgvector + pseudonimização PII; observabilidade (Prometheus/OTel) + Grafana.
- **Epic 4 (Operação Remota, 5/5):** API FastAPI — OAuth GitHub + sessão httpOnly + allowlist; SSE `/api/events/stream` + snapshot `/api/waves` + tipos TS do OpenAPI; fila de gates aprovada no painel; notifier clihelper (leaky-bucket); webhook inbound n8n (HMAC). Painel Next.js 16.
- **Epic 5 (Produção & Conformidade, 6/6):** Dockerfiles + Caddy/TLS + stack Swarm; quota lease global; CI completo; secrets; backups WAL/PITR; LGPD crypto-shredding.
- **Epic 6 (Integração & Caminho até Produção, 6.1–6.12):** produto roda **ponta a ponta em produção** (`hdd.todo-tips.com`, Traefik). Produtor da fila; resume pós-gate; verify real no sandbox; deploy Hetzner + smoke E2E; backups R2; workspace por onda; PR rascunho; merge real; UI de iniciar feature; hardening do stream SSE; **migration em serviço one-shot dedicado**.

**Verificado em 2026-06-02:** deploy real validado server-side (`/api/waves` 200, `/api/events/stream`
200 emitindo) e no navegador (login + dashboard com ondas + card "Iniciar feature"). Tooling
verde (ruff, mypy --strict, import-linter, ~98 unit + integração).

## Stack e decisões fixas (NÃO reabrir sem motivo)

- **Runtime:** Python 3.13+ (uv). **Backend hexagonal** em `backend/src/hdd/` com boundaries
  enforçados por **import-linter** (domain ← contracts ← adapters/application ← api/cli).
- **LLM = só Claude**, driver `subscription` via `claude -p` headless (conta Max 20x). Driver
  `api` é stub para a fase de escala (RF-12: troca por config).
- **Persistência:** PostgreSQL + pgvector; SQLAlchemy 2 async + psycopg3; Alembic.
- **Orquestração:** LangGraph + langgraph-checkpoint-postgres.
- **Frontend:** Next.js 16 + Tailwind v4 + TanStack Query + SSE.
- **Deploy:** `compose.prod.yaml` (Docker Compose, Traefik) **ativo em produção**; `stack.yaml`
  (Swarm) mantido como referência. Patterns: snake_case e2e; contract-first (OpenAPI→TS); UUIDv7;
  RFC 9457; Conventional Commits.

## ⚠️ Invariantes críticas (não esqueça)

1. **`claude -p` é um agente Claude Code completo** (ferramentas + contexto), não um LLM puro.
   Nunca invoque para o worker sem `--disallowedTools Write Edit MultiEdit NotebookEdit Bash WebFetch`
   + sandbox Docker isolado (Stories 2.3/2.4).
2. **Produção roda NESTA máquina** (`projeto_hdd-*` via `compose.prod.yaml`). **Qualquer `docker
   compose` de dev DEVE usar `-p hdd_dev`** — sem isso colide com a produção e a derruba
   (incidente real 2026-06-01). A skill `run-hdd` já isola; use-a para subir/verificar o app.
3. **D-032 (ToS/limites da conta de assinatura)** segue como risco aberto — qualquer escala de
   paralelismo da automação contínua sob a conta Max deve ser validada (ver §10 do PRD).
4. **Fluxo git obrigatório:** branch → commit → PR → merge `--rebase` na `main`. Nunca push direto.
   Não comite `.claude/settings.local.json`.

## Direções candidatas para o Epic 7 (DECIDIR com o operador antes de planejar)

O roadmap-fonte (§9 do PRD) aponta a fase 7 como **"Documentação e Escala"**, mas há várias
direções legítimas — apresente-as ao operador e deixe-o escolher (ou combinar):

1. **Escala — driver `api` + multi-tenant (RF-12).** Migrar de `subscription` para o driver `api`
   metered (D-051: cap inicial ~$30/m), tool routing real por modelo (RF-02: Haiku/Sonnet/Opus),
   multi-tenant. Mitiga D-032. É a virada de "MVP single-op" para "produto escalável".
2. **Registry de módulos + gate de risco (RF-10).** Habilitar módulos BMad comunitários/proprietários
   com o gate de avaliação de risco pré-implantação exigido pela RNF 6.1. Desbloqueia extensibilidade.
3. **Documentação & Escala (fase 7 do roadmap).** Docs de segurança/conformidade, treinamento,
   plano de expansão — fechar o pacote para uso/operação por terceiros.
4. **Produção 24/7 / operabilidade.** Fechar dívidas abertas (retro Epic 6: item 6 base legal ROPA
   — não-código; item 7 worker multi-arch — baixa), alertas acionáveis, runbooks, testes de carga
   do worker, SLOs. Endurecer antes de expandir.
5. **Dogfooding real (meta-tese).** Usar o HDD para construir features reais de um projeto-alvo —
   o piloto previsto é o próprio `projeto_hdd` (meta-dogfood). Valida o produto na prática e expõe
   gaps reais que viram o backlog do Epic 7.

> Recomendação para abrir a discussão: a escolha depende do objetivo do operador agora —
> **(a)** provar valor usando o produto (→ 5), **(b)** torná-lo robusto para operação contínua
> (→ 4), ou **(c)** prepará-lo para escala/terceiros (→ 1/2/3). Não decida sozinho; elicie.

## Questões em aberto (do PRD §10 + retros)

- ToS/limites da conta de assinatura (D-032) — quantas sessões paralelas a conta Max tolera.
- Controle de sessão headless — `claude -p --resume` preserva contexto após pausa por limite?
- Customização do BMad — quais módulos reaproveitar vs. sob medida.
- Dívida técnica aberta (retro Epic 6): base legal de transferência internacional no ROPA
  (Hetzner UE + Anthropic US — não-código); imagem do worker amd64-only.

## Como rodar o ambiente

```bash
export PATH="$HOME/.local/bin:$PATH"                 # uv
# ⚠️ DEV isolado da produção — SEMPRE -p hdd_dev (ver invariante 2):
docker compose -p hdd_dev up -d postgres             # Postgres dev na porta 5433
cd backend && uv sync && uv run alembic upgrade head
uv run ruff check . && uv run mypy && uv run lint-imports && uv run pytest
# Para subir/dirigir o app inteiro e verificar no navegador, use a skill: run-hdd
```

Produção: `docker compose -f compose.prod.yaml --env-file deploy.env up -d` (o serviço `migrate`
roda a migration uma vez; api/worker esperam-no). Domínio: `hdd.todo-tips.com`.

## Git

Branch `main`, remote `origin` = `github.com/todo-tips-solucoes/project_hdd.git`. `main` em dia
(Epics 1–6 mergeados e deployados). Tag `legacy/bun-whatsapp-v1` preserva a v1.

## Modo de trabalho preferido do operador (paulotodo)

- **Autônomo**, exercitando o que se constrói. Para planejamento: 2 ciclos de Advanced Elicitation
  + Party Mode por step.
- **Autonomia total dos agentes**, humano só nos 6 gates RF-03b.
- Toda decisão sob as lentes **performance · segurança · best practices**.
- Verificação adversarial real (subagentes) onde agrega valor.
- Tooling sempre verde antes de commitar.

## Sugestão de retomada (qual skill rodar)

1. **Primeiro, decida a direção do Epic 7 com o operador** — apresente as 5 candidatas acima e
   elicie o objetivo (provar valor / robustez / escala). Se quiser estruturar a ideação, use
   **`bmad-brainstorming`**; se em dúvida sobre o próximo passo, **`bmad-help`**.
2. **Depois de fixada a direção**, formalize com **`bmad-create-epics-and-stories`** (o Epic 7 será
   adicionado a `epics.md`), ou — se a direção exigir revisão de requisitos/arquitetura — rode
   **`bmad-prd`** (update) e/ou **`bmad-create-architecture`** antes.
3. Para histórias individuais prontas para dev: **`bmad-create-story`**; implementação:
   **`bmad-dev-story`** ou **`bmad-quick-dev`**.

> Não comece a implementar o Epic 7 nesta sessão de planejamento. Saída esperada: direção decidida +
> Epic 7 (objetivo, escopo, histórias) registrado em `epics.md`, pronto para uma sessão de execução.
