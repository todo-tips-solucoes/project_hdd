---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-hdd-v2.md
  - _bmad-output/planning-artifacts/architecture.md
status: 'complete'
completedAt: '2026-05-31'
totalEpics: 5
totalStories: 31
---

# projeto_hdd - Epic Breakdown

## Overview

Este documento decompõe os requisitos do PRD (`prd-hdd-v2.md`) e as decisões da Arquitetura (`architecture.md`) do HORSE DRIVEN DEVELOPMENT (HDD) v2 em histórias implementáveis. Não há documento UX dedicado — os requisitos do Painel derivam de RF-07 e da arquitetura (Next.js 16 + shadcn/ui + Framer Motion + SSE + TanStack Query/Zustand).

## Requirements Inventory

### Functional Requirements

- **RF-01** — Orquestrador de agentes spec-driven (BMad): redige requisitos, decompõe tarefas, gera código, executa testes, revisa; conduz em ondas (planner–executor) via LangGraph.
- **RF-02** — Tool routing entre modelos Claude por complexidade; no driver `subscription` é best-effort (`--model`) com fallback "modelo único da conta"; viabilidade validada na PoC Sprint 0.
- **RF-03** — Autonomia total dos agentes por padrão; verificação primária automática (agente verificador + testes/linters/scanners); sem gate humano de finalização.
- **RF-03b** — Gates de decisão humana (lista fechada de 6): merge/deploy, dados destrutivos, gasto/credenciais, infra sensível, decisão de produto, escalada por falha. Enforcement **determinístico via capability broker** (não auto-classificação do LLM); aprovação no **Painel autenticado**; timeout configurável.
- **RF-04** — Registro de decisões e auditoria: toda decisão/chamada/falha/tempo gravados; trilha append-only + hash-chain + âncora WORM; visualização no Painel.
- **RF-05** — Memória de contexto: injeção de contexto relevante (pgvector); reconstrução de contexto a partir do banco (robustez do resume).
- **RF-06** — CLI (Typer): iniciar projetos/features, recuperar estados, abrir sessão, gerir logs.
- **RF-07** — Painel Web (Next.js 16): observar execução em tempo real (SSE), pausar/retomar, **aprovar gates**, exibir ondas/decisões/modelo/custo/métricas.
- **RF-08** — Canal WhatsApp: resumos narrativos + **notificações de gate (deep link)**; recebe respostas de baixo risco; **não aprova gates de alto impacto**; inbound via n8n (HMAC + idempotency, conteúdo não-confiável).
- **RF-09** — Integração GitHub + CI/CD: branches, PRs, pipelines, merge mediante gate; tokens de privilégio mínimo; branch protection.
- **RF-10** — Módulos de extensão: **porta no MVP** (`contracts/ports.py`); registry + gate de avaliação de risco **pós-MVP**.
- **RF-11** — Execução autônoma com controle de sessão: persiste `session_id`, retoma após pausa/limite, checkpoint, respeita limites da conta; pausa por quota suspende e retoma (não aborta).
- **RF-12** — Abstração de provider: drivers `subscription` (claude -p, MVP) ↔ `api` (escala), troca por config; domínio não referencia o mecanismo.

### NonFunctional Requirements

- **NFR-SEG-1** — Zero-trust: cada ação autenticada/autorizada; gateways no nível de infraestrutura.
- **NFR-SEG-2** — Privilégio mínimo + identidade no nível de ferramentas (GitHub tokens escopados, roles de DB por schema); "cada agente como principal" é aspiracional até driver `api`.
- **NFR-SEG-3** — Isolamento de papéis: ingestão de conteúdo não-confiável separada do papel com token de escrita (containers/uids distintos).
- **NFR-SEG-4** — Sandbox de execução: uid não-root, egress allowlist (Anthropic + repos da org), FS read-only fora do workspace, sem credenciais de produção.
- **NFR-SEG-5** — Capability broker determinístico para ações destrutivas (gates 1–4 impostos por regra antes do efeito).
- **NFR-SEG-6** — Validação de entrada (Pydantic na borda) + criptografia em trânsito/repouso; proibido SQL por string e `shell=True`.
- **NFR-SEG-7** — Auditoria à prova de adulteração: append-only + hash-chain (SHA-256) + role sem UPDATE/DELETE + trigger + âncora WORM (R2 object-lock).
- **NFR-SEG-8** — Monitoramento contínuo + inventário de agentes; governança definida antes da criticidade.
- **NFR-LGPD-1** — Coleta mínima + pseudonimização (pgcrypto); PII nunca em claro no audit.
- **NFR-LGPD-2** — Direitos do titular (acesso/correção/exclusão) via **crypto-shredding** sobre dados imutáveis; política para embeddings.
- **NFR-LGPD-3** — Retenção/descarte seguro; avaliar transferência internacional (Hetzner UE + Anthropic US).
- **NFR-ESC-1** — Arquitetura modular; serviços isolados; control plane funciona com 1 nó (Swarm só escala execução).
- **NFR-ESC-2** — Containerização Docker Swarm (escala, atualização, tolerância a falhas).
- **NFR-ESC-3** — **Quota lease global persistente no Postgres** (teto de concorrência de `claude -p` enforçado, não só configurado); monitoramento de custos/quota.
- **NFR-MANT-1** — Python 3.13; arquitetura hexagonal com import-linter; contract-first (OpenAPI → tipos TS).
- **NFR-MANT-2** — Testes unitários (mock) + integração real (opt-in); linters/scanners antes de merge.
- **NFR-MANT-3** — Observabilidade (3 pilares): structlog (JSON + correlation_id) → prometheus-client (RED + métricas de negócio) → OpenTelemetry → Grafana; healthcheck.

### Additional Requirements

_(da Arquitetura — impactam implementação)_

- **AR-1 (Starter)** — Scaffold do **monorepo** é a base: `uv init backend` + `create-next-app frontend` + `shadcn init` (Epic 1). Comandos exatos no `architecture.md` §Starter.
- **AR-2 (GATE DE FUNDAÇÃO — Sprint 0, PRIMEIRA história, BLOQUEANTE)** — PoC LangGraph + `claude -p` + checkpoint Postgres provando os **5 critérios**: (1) idempotência de nó que fez commit sob kill→resume; (2) contexto reconstruído do banco (não depender de `--resume` para correção); (3) `interrupt()` retoma sem repetir efeitos; (4) viabilidade de `--model` no subscription; (5) comportamento sob exaustão de quota + ToS/limites (D-032). **Nenhuma execução autônoma antes deste gate passar.**
- **AR-3 (Dados)** — 4 schemas Postgres (`app`/`audit`/`memory`/`langgraph`) + roles (`app_rw`/`audit_append`/`memory_rw`) + trigger anti-mutação do audit; Alembic (schemas via `op.execute`; tabelas LangGraph via `.setup()`).
- **AR-4 (Portas hexagonais)** — `contracts/ports.py` (`Orchestrator`/`LLMProvider`/`Vcs`/`Notifier`/`AuditSink`/`Memory`) + DTOs Pydantic + `events.py` (envelope + catálogo + schema_version); import-linter no CI.
- **AR-5 (Provider)** — `adapters/llm/{subscription,api}`; contrato de invocação `claude -p` (`--output-format json`, mapeamento exit-code→erro, credenciais por env não-logadas).
- **AR-6 (Sessão/Onda)** — FSMs especificadas (Sessão: CREATED→RUNNING→AWAITING_GATE/PAUSED_QUOTA→DONE/FAILED/ABORTED; Onda: PLANNED→EXECUTING→VERIFYING→CORRECTING[≤N]→AWAITING_GATE→MERGED/ESCALATED/FAILED); `session_id` no state do grafo; checkpoint+domínio na mesma transação (AsyncPostgresSaver).
- **AR-7 (Gates)** — Capability broker + gate manager (`interrupt()`, PIN single-use ligado a gate_id, rate-limit, timeout); aprovação no Painel (GitHub OAuth).
- **AR-8 (Execução)** — Fila Postgres `SKIP LOCKED`; workers consomem lease de quota antes de invocar; sandbox `sandbox/Dockerfile`; intent-log + reconciliador (saga) para efeitos parciais.
- **AR-9 (Notifier)** — clihelper outbound (leaky-bucket persistente ≤1 req/s) + n8n inbound (HMAC + idempotency).
- **AR-10 (Auditoria)** — hash-chain writer + publicação periódica de head-hash assinado em R2 WORM.
- **AR-11 (Observabilidade)** — structlog/prometheus/OTel; métricas de saúde de sessão, convocações de gate, consumo de quota; endpoint healthcheck/metrics.
- **AR-12 (Infra/CI)** — Caddy (TLS auto), Docker Swarm (`stack.yaml`) + `compose.yaml` dev; GitHub Actions (ruff, mypy/pyright, pytest, import-linter, openapi-drift, build, scan); secrets via Docker Swarm secrets; backups WAL/PITR → R2.
- **AR-13 (Erros/retry)** — Taxonomia (`TransientError`/`QuotaExhausted`/`DomainError`/`FatalError`) + política de N por classe; unidade = passagem EXECUTING→VERIFYING.

### UX Design Requirements

_Não há documento UX dedicado. Requisitos do Painel (RF-07) tratados na arquitetura: Next.js 16 App Router, shadcn/ui + Tailwind, Framer Motion, tempo real via SSE/EventSource, estado com TanStack Query (server) + Zustand (UI), auth GitHub OAuth. Views mínimas: dashboard de ondas, detalhe de onda/decisões, fila de gates pendentes (aprovar/rejeitar)._

### FR Coverage Map

- **RF-01** Orquestrador → Epic 2
- **RF-02** Tool routing → Epic 1 (validação) · Epic 2 (uso)
- **RF-03** Autonomia + verificação automática → Epic 2
- **RF-03b** Gates + broker → Epic 2 (broker, gates, aprovação via CLI) · Epic 4 (canal Painel/WhatsApp)
- **RF-04** Auditoria → Epic 3
- **RF-05** Memória de contexto → Epic 1 (reconstrução núcleo) · Epic 3 (semântica pgvector)
- **RF-06** CLI → Epic 2
- **RF-07** Painel Web → Epic 4
- **RF-08** Canal WhatsApp → Epic 4
- **RF-09** GitHub/CI → Epic 2 (branch/PR) · Epic 5 (pipeline CI completo)
- **RF-10** Módulos (porta) → Epic 1 (porta); mecanismo pós-MVP
- **RF-11** Controle de sessão → Epic 1 (núcleo) · Epic 2 (uso)
- **RF-12** Abstração de provider → Epic 1
- **NFR-SEG** 1–8 → Epic 2 (3,4,5,6 execução) · Epic 3 (7 auditoria) · Epic 5 (1,2,8 governança/prod)
- **NFR-LGPD** 1–3 → Epic 3 (1 pseudonimização) · Epic 5 (2,3 direitos/retenção)
- **NFR-ESC** 1–3 → Epic 2 (3 quota mínima) · Epic 5 (1,2,3 Swarm + lease global)
- **NFR-MANT** 1–3 → Epic 1 (1 hexagonal/contract-first) · todos (2 testes) · Epic 3 (3 observabilidade)
- **AR-1..AR-13** → Epic 1 (1,2,3,4,5) · Epic 2 (6,7,8,13) · Epic 3 (10,11) · Epic 4 (9) · Epic 5 (12)

## Epic List

### Epic 1: Fundação & Gate de Prova de Conceito
O operador tem um monorepo funcional e a **prova executável** de que o motor do produto funciona: um grafo LangGraph orquestrando `claude -p` headless com checkpoint Postgres durável, passando os 5 critérios do gate de fundação. Risk boundary — se falhar, a arquitetura muda antes de qualquer investimento maior.
**FRs cobertos:** RF-11 (núcleo), RF-12, RF-02 (validação), RF-10 (porta) · **AR:** 1,2,3,4,5 · **NFR:** MANT-1.

### Epic 2: Execução Autônoma Segura de uma Onda (CLI → PR)
O operador pede uma feature pela CLI e o sistema executa **autonomamente** uma onda completa — planeja, implementa, testa, verifica e abre PR — dentro de um **sandbox endurecido** com **capability broker** e **gates RF-03b** (aprovados via CLI no MVP). Entrega o coração do produto: desenvolvimento autônomo seguro.
**FRs cobertos:** RF-01, RF-03, RF-03b (broker/gates/CLI), RF-06, RF-09 (branch/PR) · **AR:** 6,7,8,13 · **NFR:** SEG-3,4,5,6, ESC-3 (mínima), MANT-2.

### Epic 3: Rastreabilidade — Auditoria, Memória & Observabilidade
O operador pode responder "por que cada decisão?" com uma trilha de auditoria à prova de adulteração (hash-chain + âncora WORM), conta com memória de contexto semântica que melhora as ondas, e tem observabilidade para operar (métricas de sessão/gate/quota).
**FRs cobertos:** RF-04, RF-05 (semântica) · **AR:** 10,11 · **NFR:** SEG-7, LGPD-1 (pseudonimização), MANT-3.

### Epic 4: Operação Remota — Painel Web & WhatsApp
O operador observa ondas/decisões/custo em tempo real e **aprova gates de qualquer lugar**: Painel Web autenticado (decisão) + WhatsApp (notificação assíncrona). Materializa a tese de externalização de contexto (silence > noise).
**FRs cobertos:** RF-07, RF-08, RF-03b (canal Painel/WhatsApp) · **AR:** 9 · **NFR:** SEG-6 (HMAC/ingress).

### Epic 5: Produção 24/7 & Conformidade
O sistema roda continuamente na Hetzner: Docker Swarm + Caddy/TLS, CI completo, backups WAL/PITR, **quota lease global** enforçado entre workers, e conformidade LGPD (direitos do titular via crypto-shredding, retenção, transferência internacional).
**FRs cobertos:** RF-09 (CI completo) · **AR:** 12 · **NFR:** ESC-1,2,3, LGPD-2,3, SEG-1,2,8.

---

## Epic 1: Fundação & Gate de Prova de Conceito

Provar que o motor do produto funciona antes de qualquer investimento maior, e estabelecer a base do monorepo.

### Story 1.1: PoC de Fundação — LangGraph + `claude -p` + checkpoint durável (GATE bloqueante)

As a operador,
I want uma prova executável de que um grafo LangGraph consegue orquestrar `claude -p` headless com checkpoint Postgres durável e resume confiável,
So that eu tenha um go/no-go sobre a arquitetura antes de construir o resto.

**Acceptance Criteria:**

**Given** um scaffold mínimo (uv backend, Postgres+pgvector via `compose.yaml`, grafo LangGraph mínimo, adapter `claude -p` mínimo)
**When** o grafo executa um nó que invoca `claude -p` e faz um commit, e o processo é morto no meio
**Then** o resume reconstrói o estado do checkpoint Postgres **sem duplicar o commit** (idempotência de nó)
**And** o contexto é reconstruído a partir do banco, **sem depender de `--resume` para correção** (apenas como otimização de custo)

**Given** um nó que chama `interrupt()` (gate)
**When** o grafo é retomado com `Command(resume=...)`
**Then** o nó retoma **sem repetir efeitos** anteriores ao interrupt (nó puro até o ponto de interrupt)

**Given** o driver `subscription`
**When** se tenta selecionar modelo via `--model`
**Then** documenta-se se o Claude Code honra a seleção; caso não, o fallback "modelo único da conta" é provado funcional

**Given** a janela de uso da conta (Max 20x) sob carga
**When** a quota se esgota no meio de uma operação com efeito externo parcial
**Then** o comportamento (pausa/erro/limite) é observado e registrado, validando o risco D-032
**And** o resultado do gate (go/no-go) é documentado em `docs/decisions/` — **nenhuma execução autônoma (Epic 2+) inicia sem go**

### Story 1.2: Scaffold definitivo do monorepo (estrutura hexagonal)

As a desenvolvedor,
I want o monorepo estruturado conforme a arquitetura (backend hexagonal + frontend Next.js),
So that todas as histórias seguintes tenham um esqueleto consistente.

**Acceptance Criteria:**

**Given** os comandos de inicialização do `architecture.md`
**When** o scaffold é criado
**Then** existem `backend/src/hdd/{domain,contracts,application,adapters,api,cli,config,observability}` e `frontend/` (Next.js 16 + Tailwind + shadcn)
**And** `ruff`, `mypy`/`pyright` e `pytest` rodam localmente sem erro num "hello world"

### Story 1.3: Schemas base (`app`, `langgraph`) + roles + Alembic

As a desenvolvedor,
I want os schemas necessários à sessão/onda/checkpoint com migrations versionadas,
So that o estado durável tenha base relacional com least-privilege.

**Acceptance Criteria:**

**Given** Alembic configurado
**When** a migration inicial roda
**Then** os schemas `app` e `langgraph` existem, com roles `app_rw` e a tabela do PostgresSaver criada via `.setup()`
**And** migrations são append-only (`NNNN_descricao`)

### Story 1.4: Contratos das portas hexagonais + import-linter

As a desenvolvedor,
I want as portas (`Orchestrator`/`LLMProvider`/`Vcs`/`Notifier`/`AuditSink`/`Memory`), DTOs e envelope de eventos definidos como fonte de verdade,
So that os adapters sigam contratos estáveis e os boundaries sejam enforçados.

**Acceptance Criteria:**

**Given** `contracts/{ports.py,dtos.py,events.py}`
**When** o import-linter roda no CI
**Then** a regra de dependência hexagonal (`domain` não importa `adapters`) passa
**And** o envelope de evento e o catálogo inicial estão definidos com `schema_version`

### Story 1.5: Abstração de provider (`subscription` ↔ `api`) + contrato `claude -p`

As a operador,
I want trocar entre conta de assinatura e API por configuração,
So that eu use a conta no MVP e migre para API ao escalar sem mudar arquitetura.

**Acceptance Criteria:**

**Given** a porta `LLMProvider` com adapters `SubscriptionAdapter` e `ApiAdapter`
**When** a config seleciona o driver
**Then** o domínio não referencia o mecanismo; trocar driver é só config
**And** o `SubscriptionAdapter` invoca `claude -p --output-format json`, mapeia exit-code→classe de erro e injeta credenciais por env **sem logá-las**

---

## Epic 2: Execução Autônoma Segura de uma Onda (CLI → PR)

O operador pede uma feature pela CLI e o sistema executa uma onda completa, autônoma e isolada, até abrir um PR.

### Story 2.1: FSMs de Sessão e Onda + persistência

As a operador,
I want o ciclo de vida de sessões e ondas modelado e persistido,
So that o sistema saiba retomar e auditar onde está.

**Acceptance Criteria:**

**Given** as FSMs do `architecture.md` (R-10)
**When** uma sessão/onda transita de estado
**Then** o estado é persistido no schema `app` e a transição é registrável
**And** transições ilegais são rejeitadas

### Story 2.2: Fila de trabalho Postgres + worker + lease de quota mínimo

As a operador,
I want o trabalho distribuído por uma fila durável com teto de concorrência,
So that os workers executem sem exceder a quota da conta.

**Acceptance Criteria:**

**Given** a fila Postgres (`FOR UPDATE SKIP LOCKED`)
**When** um worker puxa trabalho
**Then** ele adquire um lease de quota antes de invocar `claude -p`; sem lease disponível, aguarda
**And** o trabalho não é processado por dois workers simultaneamente

### Story 2.3: Sandbox de execução endurecido

As a operador,
I want que o `claude -p` rode isolado,
So that conteúdo não-confiável não comprometa o host nem exfiltre dados.

**Acceptance Criteria:**

**Given** `sandbox/Dockerfile`
**When** uma tarefa executa
**Then** o container roda com **uid não-root**, **egress allowlist** (Anthropic + repos da org), **FS read-only fora do workspace** e sem credenciais de produção
**And** uma tentativa de egress fora da allowlist é bloqueada (teste)

### Story 2.4: Capability broker determinístico

As a operador,
I want que ações destrutivas sejam interceptadas por regra antes do efeito,
So that um gate de segurança não dependa do juízo do LLM.

**Acceptance Criteria:**

**Given** o broker no Control Plane
**When** o agente tenta uma ação destrutiva (rm fora do workspace, DROP/DELETE em massa, force-push, rotação de secret)
**Then** o broker classifica por regra e **força suspensão (gate) antes do efeito**
**And** ações não-destrutivas passam sem fricção (autonomia preservada)

### Story 2.5: Gate manager (`interrupt()` + PIN) com aprovação via CLI

As a operador,
I want aprovar/rejeitar gates pelo terminal,
So that eu mantenha controle nos pontos críticos sem depender do Painel.

**Acceptance Criteria:**

**Given** um gate RF-03b disparado
**When** o gate manager o cria
**Then** a onda suspende via `interrupt()`, com PIN single-use ligado ao `gate_id`, rate-limit e timeout configurável
**And** a aprovação pela CLI retoma a onda; rejeição/timeout deixa a ação pendente (gates 1–4 nunca auto-aprovam)

### Story 2.6: Pipeline de uma onda (planejar → implementar → testar → verificar)

As a operador,
I want que a onda implemente a feature e se autoverifique,
So that eu receba trabalho pronto sem intervir.

**Acceptance Criteria:**

**Given** uma feature solicitada
**When** a onda executa
**Then** ela planeja, implementa código + testes (via `claude -p` no sandbox) e passa por verificação automática (testes/linters/scanners)
**And** falhas de verificação geram loop de correção (não merge)

### Story 2.7: Taxonomia de erros + retry/N + escalada

As a operador,
I want política de erro previsível,
So that o sistema saiba quando reintentar, pausar ou me chamar.

**Acceptance Criteria:**

**Given** a taxonomia (`Transient`/`QuotaExhausted`/`Domain`/`Fatal`) do `architecture.md` (R-12)
**When** ocorre um erro
**Then** `Transient` reintenta com backoff (≤N_transient); `QuotaExhausted` pausa e retoma; `Domain` faz loop de correção (≤N_correction) e ao esgotar dispara gate 6; `Fatal` aborta e dispara gate 6
**And** a unidade de tentativa é uma passagem `EXECUTING→VERIFYING`

### Story 2.8: Integração GitHub — branch, commit, PR

As a operador,
I want que a onda validada vire um PR,
So that eu revise e o merge fique sob gate.

**Acceptance Criteria:**

**Given** uma onda verificada
**When** ela finaliza
**Then** o adapter `Vcs` cria branch, commita e abre PR (rascunho) com token escopado
**And** o merge em branch protegida é gate RF-03b.1 (branch protection ativa)

### Story 2.9: CLI do operador

As a operador,
I want comandos para iniciar/observar/responder,
So that eu opere o sistema do terminal.

**Acceptance Criteria:**

**Given** a CLI (Typer)
**When** executo comandos
**Then** consigo iniciar uma feature, ver estado de sessões/ondas, ver gates pendentes e aprová-los/rejeitá-los
**And** os comandos respeitam a porta `Orchestrator` (sem acoplar implementação)

---

## Epic 3: Rastreabilidade — Auditoria, Memória & Observabilidade

Dar ao operador rastreabilidade total, memória que melhora as ondas e observabilidade operacional.

### Story 3.1: Audit sink append-only + hash-chain

As a auditor,
I want uma trilha imutável e encadeada,
So that eu confie que o histórico não foi adulterado.

**Acceptance Criteria:**

**Given** o schema `audit` com role `audit_append`
**When** um evento é gravado
**Then** ele encadeia o hash (SHA-256) do anterior, com timestamp
**And** tentativas de `UPDATE`/`DELETE` são rejeitadas por trigger + permissão

### Story 3.2: Catálogo de eventos + emissão nas transições

As a auditor,
I want eventos versionados e consistentes,
So that o histórico seja interpretável e estável.

**Acceptance Criteria:**

**Given** o catálogo fechado em `contracts/events.py`
**When** uma transição de sessão/onda/gate ocorre
**Then** o evento correspondente é emitido com envelope completo (`event_id`, `type`, `schema_version`, `occurred_at`, `correlation_id`, `actor`, `payload`)
**And** payloads seguem o schema do tipo

### Story 3.3: Âncora WORM do head-hash

As a auditor,
I want uma âncora externa da cadeia,
So that nem um superusuário de DB possa reescrever o histórico sem detecção.

**Acceptance Criteria:**

**Given** a cadeia de auditoria
**When** o processo periódico roda
**Then** o head-hash assinado é publicado em R2 com object-lock (WORM)
**And** uma divergência entre a cadeia e a âncora é detectável

### Story 3.4: Memória semântica (pgvector) + pseudonimização

As a operador,
I want que decisões/contexto passados informem novas ondas,
So that o sistema melhore e não repita erros.

**Acceptance Criteria:**

**Given** o schema `memory` com pgvector
**When** uma onda conclui
**Then** trechos relevantes são embeddados e recuperáveis por similaridade
**And** PII é pseudonimizada (`pgcrypto`); nunca entra em claro no `audit`

### Story 3.5: Observabilidade — logs estruturados + métricas

As a operador,
I want logs e métricas desde o início,
So that eu consiga operar um sistema autônomo.

**Acceptance Criteria:**

**Given** `structlog` + `prometheus-client`
**When** o sistema opera
**Then** logs JSON carregam `correlation_id`/`component`/`event` e há endpoint `/metrics` com RED + métricas de negócio (saúde de sessão, convocações de gate, consumo de quota)
**And** há endpoint de healthcheck

### Story 3.6: Tracing distribuído + dashboards

As a operador,
I want traces e dashboards,
So that eu diagnostique latência e fluxo entre componentes.

**Acceptance Criteria:**

**Given** OpenTelemetry instrumentado
**When** uma onda executa
**Then** traces ligam API→orquestrador→worker→`claude -p`
**And** um dashboard Grafana exibe as métricas-chave

---

## Epic 4: Operação Remota — Painel Web & WhatsApp

Permitir observar e aprovar gates de qualquer lugar.

### Story 4.1: Autenticação do Painel (GitHub OAuth)

As a operador,
I want entrar no Painel com minha conta GitHub,
So that o acesso seja seguro sem gerir senhas.

**Acceptance Criteria:**

**Given** GitHub OAuth configurado
**When** acesso o Painel
**Then** autentico via OAuth com sessão httpOnly
**And** rotas do Painel exigem sessão válida

### Story 4.2: Painel — ondas em tempo real (SSE)

As a operador,
I want ver ondas/decisões/custo ao vivo,
So that eu acompanhe sem comandos.

**Acceptance Criteria:**

**Given** o stream SSE do backend
**When** abro o dashboard
**Then** vejo ondas, decisões, modelo e custo atualizando em tempo real (TanStack Query + EventSource)
**And** os tipos TS são gerados do OpenAPI (sem drift)

### Story 4.3: Painel — fila de gates (aprovar/rejeitar)

As a operador,
I want aprovar gates no canal autenticado,
So that o segredo de aprovação não trafegue por canal não-confiável.

**Acceptance Criteria:**

**Given** gates pendentes
**When** abro a fila de gates no Painel
**Then** vejo o contexto de cada gate e posso aprovar/rejeitar
**And** a decisão retoma/encerra a onda correspondente, registrada no audit

### Story 4.4: Notifier outbound (clihelper) + resumos narrativos

As a operador,
I want receber resumos e avisos no WhatsApp,
So that eu externalize o acompanhamento (silence > noise).

**Acceptance Criteria:**

**Given** o adapter `Notifier` (clihelper)
**When** uma onda atinge um marco ou um gate
**Then** uma mensagem narrativa/notificação é enviada respeitando leaky-bucket persistente (≤1 req/s)
**And** o estado do bucket sobrevive a restart

### Story 4.5: Webhook inbound (n8n) + notificação de gate com deep link

As a operador,
I want ser notificado de gates com link para o Painel,
So that eu aja rápido sem aprovar pelo canal não-confiável.

**Acceptance Criteria:**

**Given** o webhook inbound
**When** chega uma mensagem do n8n
**Then** ela é validada (HMAC + idempotency key + schema mínimo) e conteúdo é tratado como não-confiável
**And** notificações de gate incluem deep link para o Painel (aprovação ocorre lá, não no WhatsApp)

---

## Epic 5: Produção 24/7 & Conformidade

Rodar continuamente na Hetzner com segurança, resiliência e conformidade.

### Story 5.1: Empacotamento + Caddy/TLS + stack Swarm

As a DevOps,
I want o sistema empacotado e exposto com TLS,
So that ele rode em produção na Hetzner.

**Acceptance Criteria:**

**Given** Dockerfiles multi-stage e `stack.yaml`
**When** faço deploy no Swarm
**Then** os serviços sobem e o Caddy provê HTTPS automático ao Painel/API/webhook
**And** o control plane funciona mesmo com 1 nó

### Story 5.2: Quota lease global enforçado entre workers

As a operador,
I want um teto global de concorrência de `claude -p`,
So that múltiplos workers não estourem os limites da conta.

**Acceptance Criteria:**

**Given** o lease de quota persistente no Postgres
**When** N workers (Swarm) tentam executar
**Then** o total de `claude -p` concorrentes respeita o teto global (não só config local)
**And** workers sem lease aguardam

### Story 5.3: CI completo

As a desenvolvedor,
I want pipeline de qualidade automatizado,
So that nenhum código viole padrões antes do merge.

**Acceptance Criteria:**

**Given** GitHub Actions
**When** um PR é aberto
**Then** rodam `ruff`, `mypy`/`pyright`, `pytest` (unit+integração), `import-linter`, check de openapi-drift, build Docker e scan de deps
**And** falha em qualquer um bloqueia o merge

### Story 5.4: Secrets + configuração

As a DevOps,
I want segredos fora do repositório,
So that credenciais não vazem.

**Acceptance Criteria:**

**Given** Docker Swarm secrets
**When** os serviços iniciam
**Then** `pydantic-settings` lê de `/run/secrets`; nada sensível em env plaintext ou repo
**And** segredos não aparecem em logs/audit

### Story 5.5: Backups WAL/PITR

As a DevOps,
I want backups com point-in-time recovery,
So that eu recupere o estado após falha.

**Acceptance Criteria:**

**Given** WAL archiving + base backup → R2
**When** simulo perda de dados
**Then** consigo restaurar para um ponto no tempo
**And** o procedimento está em `docs/runbooks/`

### Story 5.6: Conformidade LGPD

As a auditor,
I want direitos do titular atendidos apesar da auditoria imutável,
So that o sistema seja conforme.

**Acceptance Criteria:**

**Given** crypto-shredding sobre dados pseudonimizados
**When** há um pedido de exclusão
**Then** a chave `pgcrypto` correspondente é descartada (dado torna-se irrecuperável) sem quebrar a hash-chain
**And** políticas de retenção e a nota de transferência internacional (Hetzner UE + Anthropic US) estão documentadas
