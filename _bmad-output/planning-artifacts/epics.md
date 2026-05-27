---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
finalized: 2026-05-22
finalization_status: ready-for-operator-review
drb_dependent_blockers_referenced: [AO-86, AO-155+164, AO-158+165, AO-160+166, AO-185]
fr_coverage:
  total_frs: 56
  story_covered: 53
  process_marker: [FR-003]
  design_constraint_no_story: [FR-017, FR-028, FR-034, FR-083]
  resolved_via_followup_ac: [FR-005]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/addendum.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/bmad-architecture-summary.md"
  - "_bmad-output/planning-artifacts/whatsapp-templates-utility.md"
  - "_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/brief.md"
project: projeto_hdd
project_name_official: "HORSE DRIVEN DEVELOPMENT (HDD)"
phase: Solução (BMAD 3)
language: pt-PT
created: 2026-05-22
facilitator: bmad-create-epics-and-stories (Opus 4.7 1M)
---

# HORSE DRIVEN DEVELOPMENT (HDD) — Epic Breakdown

## Overview

Este documento decompõe os requisitos do PRD v2 e da Architecture (186 AOs, DRB
APPROVE-WITH-CONDITIONS) em **epics** e **stories** implementáveis. Sem UX Design
spec — HDD v1 não tem UI (NFR-O5: observability via JSONL + WhatsApp + Resumos
3-tier). As stories devem alinhar com o `StorySpec` schema definido em
`architecture.md` Step 06 e popular o DAG `story_deps` consumido pelo
`bmad-sprint-planning`.

> **Convenções:** `[ASSUMPTION]` (inferência razoável a validar) · `[OPEN]`
> (questão aberta).
>
> **AO refs:** AO-N refere Architectural Obligation N (1..186; AO-25 dispensada).
> Trail completo em `architecture.md`.

---

## Requirements Inventory

### Functional Requirements

> **Nota de extracção.** O PRD §7 organiza requisitos em 9 features (F1-F9). A
> contagem agregada do PRD ("87 FRs") soma identificadores numerados, sub-bullets
> e os 4 watchdog triggers da regra de interrupt + 6 templates UTILITY. Mantenho
> abaixo a numeração exacta do PRD (FR-NNN) por feature, anotando duplicações.

#### F1 — Pipeline bimodal orquestrado pelo BMad Master

- **FR-001** Modo Colaborativo corre no Claude Code interactivo localmente com BMAD v6.7.1 (manifest em `_bmad/_config/manifest.yaml`).
- **FR-002** Modo Autónomo corre em **worker Bun nativo em VPS própria** (D-035 + D-043). Plugin `BMAD_Openclaw` arquitetonicamente diferido para v1.1+. BMAD invocado via **CLI-wrapper** (D-04.12 OQ-H).
- **FR-003** A transição Colab→Auton requer **sucesso explícito de `bmad-check-implementation-readiness`** (gate dur).
- **FR-004** O BMad Master (no worker) coordena sub-agentes Dev/Review/QA com **contexto isolado por workflow**.
- **FR-005** Cada sub-agente invoca `bmad_save_artifact` ao concluir um passo e `bmad_complete_workflow` ao concluir um workflow.
- **FR-006** O worker permite invocação programática das skills BMAD (CLI-wrapper validado Sprint 0 Day 1 — Plan B Claude Code headless OR re-implement subset).

#### F2 — Regra de Interrupt (1 primário + 3 watchdogs)

- **FR-010** O `bmad-code-review` customizado deteta gap PRD/Arq↔Código (Trigger **P1**).
- **FR-011** O worker mantém **watchdog timer** por story; default 30 min sem progresso dispara **S1**.
- **FR-012** O worker mantém **contador de retries** por falha; default 5 retries consecutivas dispara **S2**.
- **FR-013** O webhook listener faz **timeout-poll** confirmação leitura/resposta no WhatsApp; 3 mensagens em 10 min sem confirmação dispara **S3**.
- **FR-014** Em P1/S1/S2: worker pausa, grava state (`paused_for_interrupt=true`), envia contexto, **aguarda resposta**.
- **FR-015** Em S3: worker **NÃO pausa**; muda canal para e-mail e prossegue.
- **FR-016** Toda mensagem (entrante/saída) regista no audit log JSONL com timestamp, trigger-id, story-id, payload.
- **FR-017** Outros gatilhos (custo estimado de stack, conflito entre artefactos) ficam para **v1.1**.

#### F3 — Canal WhatsApp (via clihelper) + fallback e-mail

- **FR-020** Sistema **NÃO fala directamente com a Meta Cloud API**. Usa **app proprietário operador `clihelper.example.com`** (D-033). HDD = HTTP client simples.
- **FR-021** WhatsApp adapter faz `POST` aos endpoints `api-oficial-mensagem-template/` e `api-oficial-mensagem-template-sem-variavel/`.
- **FR-022** Header obrigatório `Authorization: <token>` (assumir Bearer até clarificação operador).
- **FR-023** Payload conforme schema clihelper: `{number, name, language("pt_BR"), openTicket, queueId, template[]}` com buttons `quick_reply` (`index`, `payload`).
- **FR-024** Webhook listener inbound recebe callbacks; parseia resposta livre (NLP via Haiku 4.5) + Quick Reply payloads exactos (`p1_continuar_assim`, `fin_aprovar`, …) sem NLP.
- **FR-025** **Rate-limit obrigatório: 1 req/s** via leaky bucket queue no adapter.
- **FR-026** **6 templates UTILITY** desenhados pelo HDD, criados pelo operador no clihelper UI: `hdd_interrupt_p1`, `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_summary_finalization` (Tier-A), `hdd_heartbeat`, `hdd_release_final`. **M1 mínimo viável: 3 aprovados** (P1 + summary + heartbeat).
- **FR-027** Retry: 429 → backoff expo base 2s, max 5 retries, max delay 60s; 5xx → backoff + circuit breaker após 5 falhas/1min. Cada attempt no JSONL.
- **FR-028** **Custo WhatsApp = $0** do ponto de vista HDD (absorvido pela infra operador).
- **FR-029** Fallback e-mail (Trigger S3) usa **Resend** (default).
- **FR-030a** Idempotência: `idempotency_key = SHA-256(run_id || story_id || template_name || seq_local)` registado no state store **antes** do POST (commit-state-before-side-effect, AO-3/AO-39). Re-envios devolvem resultado anterior sem nova chamada.

#### F4 — Worker autónomo em VPS

- **FR-030b** O worker corre em **VPS própria** do operador (Bun, não Node — D-035).
- **FR-031** O worker tem ponto de entrada `hdd-worker` com subcomandos `start <project>`, `pause`, `resume`, `status`, `logs`.
- **FR-032** O worker sobrevive a restart do processo (crash recovery via state store).
- **FR-033** O worker tem **BMAD invoker** via **CLI-wrapper** (Sprint 0 Day 1 BLOCKER validation).
- **FR-034** O worker executa **único projeto por vez** (sem multi-tenancy no v1).

#### F5 — State store + idempotência

- **FR-040** State store persiste mínimo: `current_story_id`, `story_status`, `paused_for_interrupt`, `last_interrupt_at`, `interrupt_pending_id`, `retry_count`, `current_workflow`, `current_phase`.
- **FR-041** Cada **story** é **idempotente** — re-execução pós-crash não duplica side-effects.
- **FR-042** Tecnologia: **bun:sqlite + Drizzle ORM** (decidido em arquitetura, D-035).
- **FR-043** Sistema permite **rollback parcial** — política a definir; AO-43 diferido v1.1+.
- **FR-044** **Audit log JSONL**: 1 linha/evento em `_bmad-output/audit/<project>/<date>.jsonl` com hash chain SHA-256 e RFC 3161 `.tsr` token diário.

#### F6 — Gates de qualidade nos handoffs

- **FR-050** Cada handoff é **gate explícito** — não passa silenciosamente:
  - PRD→Arquitetura: `bmad-check-implementation-readiness` fechado
  - Story→Dev: critérios de aceitação completos
  - Dev→Review: suite de testes verde
  - Review→QA: PRD/arquitetura consistentes com implementação
- **FR-051** Falha de gate é evento auditado no JSONL.
- **FR-052** Em falha de gate, worker produz **diagnóstico estruturado** (qual critério, com que evidência) antes de pausar.

#### F7 — Gestão de janela LLM (Claude Max 20x)

- **FR-060** Sistema usa Anthropic dual-mode. Budget **híbrido** (D-050): janela Max 20x (planejamento + fallback) + USD metered (implementação via API), single-provider (D-017).
- **FR-061** Em 80% da janela diária, notifica via WhatsApp.
- **FR-062** Em atingimento do limite, worker **pausa** automaticamente. Flag `--hard-stop` termina sem retomar (CI).
- **FR-063** Sistema reporta consumo por sub-agente e workflow em % da janela.
- **FR-064** Sub-agentes usam modelos da mesma família: Opus 4.7 (Arquiteto/PM/críticas), Sonnet 4.6 (Dev/Review/QA via **API pay-per-token, default** — D-050; Max 20x como overflow), Haiku 4.5 (gap-detector/NLP via Anthropic SDK direct).
- **FR-065** Quando o cost cap USD da impl. atinge limite **ou** a janela de fallback esgota, oferecer (a) overflow para Max 20x se houver janela, ou (b) downgrade Sonnet→Haiku conforme role + budget cap (D-050).

#### F8 — Resumo de Finalização (3-tier)

- **FR-070** Toda finalização gera Resumo 3-tier em Markdown (template em `finalization-summary-templates.md`).
- **FR-071** Tier-A (≤200 palavras) via canal primário **WhatsApp** (template `hdd_summary_finalization`); Tier-B link `_bmad-output/<phase>/<workflow-id>-summary.md`; Tier-C audit-only.
- **FR-072** Workflow pausa em `paused-awaiting-review` até resposta.
- **FR-073** Respostas aceites: `approve`, `request_changes <nota>`, `reject <razão>`.
- **FR-074** Resumo permanente em `_bmad-output/<phase>/<workflow-id>-summary.md`, committed em git.
- **FR-075** Diff side-by-side com resumo anterior do mesmo projeto (git diff v1; semântico v1.1+).
- **FR-076** Mecânica (botões? CLI? parsing) — Quick Reply payloads `fin_aprovar` / `fin_pedir_mudancas` / `fin_rejeitar`.

#### F9 — Bootstrap, configuração e operação

- **FR-080** Bootstrap documenta: clone repo HDD no VPS, `bun install`, `.env` + systemd unit, validar `bmad-cli` non-interactive smoke test, registar webhook n8n callback, configurar Resend (S3), Litestream + rclone setup, `systemctl start hdd-worker`.
- **FR-081** Verificação pré-requisitos no start: BMAD v6.7.1 instalado, `bmad-cli` non-interactive funcional, número WhatsApp ativo no clihelper, Resend configurado, credenciais Anthropic Max 20x válidas, n8n webhook forwarded para `/callback`.
- **FR-082** **Fail closed** se credenciais essenciais em falta — sem modo "degradado" silencioso.
- **FR-083** Overrides locais em `_bmad/custom/` (gitignored personal; committable team) sobrevivem re-instalação.
- **FR-084** `hdd-worker logs` produz tail do JSONL com formatação humana opcional.

---

### NonFunctional Requirements

#### NFR-S — Segurança

- **NFR-S1** Segredos em vault externo (env vars / 1Password CLI / equivalente) — **nunca** plain-text no workspace ou VPS.
- **NFR-S2** Logs JSONL aplicam **redaction automática** de tokens/secrets antes de escrever (multi-pattern, AO-160+166).
- **NFR-S3** Sandbox do Dev agent impede acesso fora do workspace (`Bun.spawn docker --network=none`, AO-47).
- **NFR-S4** PRs em repos públicos requerem **revisão humana obrigatória** em **superfícies sensíveis**: (a) handlers de rede HTTP/RPC/WebSocket; (b) auth/sessões; (c) processos privilegiados; (d) integrações com credenciais externas; (e) migrações de dados. Reviewer/QA marca PR com label `human-review-required`.
- **NFR-S5** WhatsApp via **clihelper proprietário** sobre Meta Cloud API (D-033) elimina risco de ban de stack não-oficial. Riscos residuais: (a) endpoint clihelper indisponível → fallback Resend; (b) rate-limit 1 req/s → leaky bucket; (c) quality rating monitorizado operador; (d) dependência app operador → Telegram v1.1+ se necessário.
- **NFR-S6** VPS com SSH key-only auth, firewall mínimo (porta webhook + 22), updates automáticos.

#### NFR-R — Confiabilidade

- **NFR-R1** Crash do worker não resulta em perda de state — recovery via state store + último `bmad_save_artifact`.
- **NFR-R2** Falhas transitórias de rede: retry exponencial (base 2s, max 5 retries, max delay 60s).
- **NFR-R3** Concurrent stories no mesmo projeto são **serializadas** (worker single-stream).
- **NFR-R4** **Idempotência por story** (FR-041) é gate; nenhum side-effect sem idempotency key registada.
- **NFR-R5** Pipeline **NÃO pára** em falha de canal primário (S3); apenas troca para fallback.

#### NFR-O — Observabilidade

- **NFR-O1** `hdd-worker status` devolve estado em ≤ 2s.
- **NFR-O2** Consumo de janela LLM consultável a qualquer momento.
- **NFR-O3** Audit log JSONL é fonte primária; tail-able em tempo real.
- **NFR-O4** Métrica visível: **"interrupts pendentes"**.
- **NFR-O5** Observabilidade v1 = WhatsApp + JSONL + Resumos 3-tier. **Sem dashboard gráfico** (v1.1+).

#### NFR-P — Performance

- **NFR-P1** Cold start do worker ≤ 30s.
- **NFR-P2** Latência interrupt-event → mensagem WhatsApp entregue ≤ 10s.
- **NFR-P3** Sem requisitos de throughput agressivos no v1.

#### NFR-M — Manutenibilidade

- **NFR-M1** Versão BMAD pinada em `_bmad/_config/manifest.yaml` (v6.7.1); upgrade só via `npx bmad-method install` deliberado.
- **NFR-M2** Overrides em `_bmad/custom/` sobrevivem re-instalação.
- **NFR-M3** Plugin BMAD_Openclaw versão pinada (quando reactivado em v1.1+).

#### NFR-U — Usabilidade

- **NFR-U1** `operador` responde a interrupts pelo **telemóvel** (WhatsApp).
- **NFR-U2** Mensagens WhatsApp em português (`pt-PT` / `pt_BR` no clihelper template language code).
- **NFR-U3** Tier-A do Resumo ≤ 200 palavras (decisão em 30s no telemóvel).
- **NFR-U4** Comandos `hdd-worker start/pause/resume/status/logs` com `--help` claro.

#### NFR-C — Compliance & IP

- **NFR-C1** *v1:* sem requisito de auditoria de licenças do código gerado.
- **NFR-C2** *v1.1+:* antes de qualquer publicação externa, suite de auditoria IP/licenças (SBOM, scan copyleft, attribution).

---

### Additional Requirements

> Extraídos do `architecture.md` (8 steps, 186 AOs, 5 schemas formais, Sprint 0
> actionable checklist). Não duplicam FR/NFR — adicionam constraints técnicos e
> setup obrigatório que **moldam stories foundational** do Sprint 1.

#### A. Starter scaffold (Step 03)

- **AR-001** Greenfield **Bun base scaffold** (não usar starter Node/Express). Bun 1.3+ via `curl -fsSL https://bun.sh/install | bash`.
- **AR-002** Estrutura inicial obrigatória: `src/{core, ports, adapters, lib, db, bootstrap.ts, main.ts}`. Hexagonal arch enforcement via Biome max-lines + ESLint custom rule.
- **AR-003** **Implica Story foundational "repo-scaffold"** em Epic 1 (S01 do Sprint Planner Step 06 round 2).

#### B. Stack constraints (D-035 + D-043 + D-044 + D-050)

- **AR-010** Runtime **Bun 1.3+** (não Node). `bun build --compile` no deploy (não `bun run` interpreted — viola NFR-P1).
- **AR-011** HTTP server **Hono** (não Express).
- **AR-012** CLI **Commander.js**.
- **AR-013** State store **bun:sqlite + Drizzle ORM** (WAL mode, `busy_timeout=5000`, `synchronous=NORMAL`). Migrations via `drizzle-kit generate`, aplicadas no boot com `BEGIN EXCLUSIVE` (idempotente).
- **AR-014** Backup **Litestream supervisor** (1 systemd unit; `retention=24h`, `snapshot-interval=24h`) → R2 EU. **rclone secundário** (dump diário gzipped).
- **AR-015** Sandbox **`Bun.spawn('docker', ['run', '--rm', '--network=none', ...])`** (não dockerode). Docker image **pre-pulled** no deploy.
- **AR-016** Logger **pino** + custom audit JSONL hash chain SHA-256 (2 streams).
- **AR-017** Tests **`bun test` + fast-check property-based**. Stryker post-CI. Pyramid: branch ≥85%, line ≥80%. CI <60s.
- **AR-018** Lint **Biome + typescript-eslint** (4 regras async-safety mandatory: `no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`).
- **AR-019** Secrets via **systemd EnvironmentFile=/etc/hdd/secrets.env** (perm `0600`, user `hdd-worker`, `ConditionPathExists`) + envalid/Zod no boot.
- **AR-020** Process supervision **systemd Type=simple + HTTP `/healthz`** (Bun **não suporta `sd_notify` nativo** — gotcha). Healthchecks.io polling + WhatsApp heartbeat combinados.

#### C. Patterns obrigatórios (Step 05)

- **AR-030** **`Result<T,E>` via `neverthrow@^8`** (não home-rolled; não throw). 11-itens throw whitelist em `docs/conventions/errors.md`. ESLint custom rule `no-restricted-syntax: ThrowStatement` salvo whitelist.
- **AR-031** **`src/lib/result.ts`** com helpers `pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient`.
- **AR-032** **3 ports temporais/processo** em `src/ports/`: `ClockPort`, `SpawnPort`, `NotifyPort`. Adapters em `src/adapters/<name>/<name>.adapter.ts`. Constructor injection via factory functions.
- **AR-033** **4 branded types mínimos** em `src/lib/branded.ts`: `RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey`.
- **AR-034** **Zod apenas em boundaries externos** (webhook payload, env vars, persisted unknown sources). Não em paths Drizzle já tipou.
- **AR-035** **FSM** como enum + transition table em domain (`src/core/fsm.ts`).
- **AR-036** **Domain events tagged union** em `src/core/events.ts`.
- **AR-037** **Boot/shutdown order explícito** em `src/bootstrap.ts`.
- **AR-038** **Adapter owns retry+CB** (não core); core recebe `Result` final. Tabela retry policies por adapter (WhatsApp/Anthropic/Resend/GitHub/Docker/BMAD CLI).
- **AR-039** **AsyncLocalStorage wrapped em `withRunContext()`** para correlation IDs cross-cutting.
- **AR-040** **`core/services/`** introduzido (application services orquestram ports sem importar adapters; Dep Graph Rigour Step 06).

#### D. 5 Schemas formais (Step 06 — ports contracts)

- **AR-050** `DevOutput` — output do `bmad-dev-story` sub-agent (a serializar em port).
- **AR-051** `ReviewOutput` — output do `bmad-code-review` sub-agent.
- **AR-052** `QAOutput` — output do `bmad-testarch-*` sub-agent.
- **AR-053** `SprintPlanOutput` — output do `bmad-sprint-planning`.
- **AR-054** `StorySpec` — schema de cada story (este workflow popula directamente). Campos: `story_id`, `title`, `type`, `epic`, `sprint`, `status`, `blocked_by[]`, `unblocker`, `files_created[]`, `files_modified[]`, `ao_subset[]` (4-8 AOs), `acceptance_criteria[]` (machine-checkable: binary | property | coverage), `estimated_tokens.dev_core + dev_with_retry`.

#### E. Audit & timestamping (Step 04 + Step 06)

- **AR-060** JSONL append-only com `prev_hash` chain SHA-256. `O_APPEND` garante atomicidade de linha.
- **AR-061** **RFC 3161 `.tsr` (timestamp token)** armazenado junto JSONL diário.
- **AR-062** Rotation: `maxSize=100MB` OU `maxAge=24h`. TTL retention 90 dias local, 1 ano remoto.
- **AR-063** **Redaction multi-pattern** (AO-160+166) — multi-pattern incluindo tokens Anthropic, Bearer, Authorization headers, `wa_id`, números telefone, payload bodies verbose do n8n.

#### F. Sprint 0 BLOCKERS (DRB conditions — must close antes Sprint 1)

- **AR-070** **AO-86 / DRB-C4** — Operador submete 3 templates Meta antes Day 7 (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`). Operator action; bloqueia M1.
- **AR-071** **AO-155+164** — Two-step confirmation em acções irreversíveis (deploy, branch delete, etc.). Story foundational early.
- **AR-072** **AO-158+165** — Path traversal sanitization no `apply-diff` antes de Dev sub-agent activate. Story foundational.
- **AR-073** **AO-160+166** — Audit redaction multi-pattern antes de audit JSONL active. Story foundational.
- **AR-074** **AO-185** — `ANTHROPIC_API_KEY` configurada para Haiku SDK direct (gap-detector / NLP / narrative). Operator setup.
- **AR-075** **D-04.18 / AO-86** — Webhook schema inbound clihelper pendente; stub `z.unknown()` permitido até operador partilhar payload real. Feature flag `mock-webhook` para fixtures Sprint 0.
- **AR-076** **8 Pentest Tasks PT-1..PT-8** verificáveis antes M1 (lista em `architecture.md` Step 07).
- **AR-077** **Sprint 0 Day 1 validation** — `bmad-cli` non-interactive smoke test. Se falhar, escalate Plan B (Claude Code headless OR re-implement subset BMAD em TS) 4-6h.
- **AR-078** **Plan B Node 4-6h rehearsal** documented + AO-153 rehearsal required (caso Bun release block).

#### G. LLM hybrid cost-optimal (D-044, revisto D-050)

- **AR-090** **[D-050]** Implementação (Dev/Review/QA) **Sonnet via API pay-per-token por default** (ToS-safe). Max 20x (`claude --print --resume`, cache 75%) = planejamento + overflow/fallback configurável quando cost cap USD atinge limite.
- **AR-091** **Haiku 4.5** via Anthropic SDK direct (R$5-25/m). Usar para gap-detector / NLP webhook parsing / narrative compaction.
- **AR-092** Smoke tests 5/5 validados 2026-05-22.
- **AR-093** `cache_control: ephemeral` em prompts longos.

#### H. Topologia inbound/outbound

- **AR-100** **Outbound:** HDD worker → `POST https://api.example.com/principal/apis/mensagem/...` → clihelper backend → Meta Cloud API → telemóvel `operador`. **Rate-limit 1 req/s.**
- **AR-101** **Inbound:** telemóvel → Meta Cloud API → **n8n.example.com** (aggregator filter + forward) → HDD `POST /callback` (Hono) com Zod minimal schema **drop-at-ingress**. n8n = trust boundary upstream.

#### I. Bootstrap & runbooks (Step 04)

- **AR-110** **8 Runbooks must-have** em `docs/runbooks/`: `secret-rotation.md`, `ban-Anthropic-emergency.md`, `litestream-restore.md`, `hash-chain-corruption.md`, `whatsapp-template-rejection.md`, `clihelper-endpoint-down.md`, `vps-disk-full.md`, `manual-rollback.md` (lista exacta em `architecture.md` Step 04 D-04.24).
- **AR-111** **CI GitHub Actions** + `bun build --compile` + Docker pre-pull + Renovate dependency updates.
- **AR-112** **SSH deploy** `authorized_keys` com `command="/opt/hdd/scripts/deploy.sh"` restriction (impede shell livre). Script regista commit SHA no JSONL.

---

### UX Design Requirements

**N/A — sem UI v1.** NFR-O5 declara observability via JSONL + WhatsApp + Resumos
3-tier. Dashboard gráfico diferido v1.1+ (eventual Grafana ou similar). Não há
componentes visuais a criar, design tokens, accessibility audit ou flows
interactivos no scope deste workflow.

---

### FR Coverage Map

> Mapeia cada FR a um (e apenas um) epic primário. Gates que atravessam epics
> (ex: FR-050) repetem-se onde o handoff é aplicado.

| FR | Epic primário | Nota |
|---|---|---|
| FR-001 | E2 | Modo Colaborativo prereq + worker hosts Auton |
| FR-002 | E2 | Worker Bun nativo (D-043) |
| FR-003 | E2 | Gate `bmad-check-implementation-readiness` |
| FR-004 | E2 | Sub-agentes Dev/Review/QA com contexto isolado |
| FR-005 | E2 | `bmad_save_artifact` + `bmad_complete_workflow` |
| FR-006 | E2 | CLI-wrapper Sprint 0 Day 1 validation |
| FR-010 | E4 | Trigger P1 — gap detector no `bmad-code-review` |
| FR-011 | E4 | Trigger S1 — watchdog timer |
| FR-012 | E4 | Trigger S2 — contador retries |
| FR-013 | E4 | Trigger S3 — timeout-poll WhatsApp |
| FR-014 | E4 | P1/S1/S2 pausa + grava state + aguarda |
| FR-015 | E4 | S3 não pausa; troca canal e segue |
| FR-016 | E4 | Mensagens registadas no audit JSONL |
| FR-017 | E4 | v1.1+ deferral marker |
| FR-020 | E3 | Não usar Meta directa; clihelper proprietário |
| FR-021 | E3 | Endpoints `api-oficial-mensagem-template{,-sem-variavel}` |
| FR-022 | E3 | Auth Bearer token |
| FR-023 | E3 | Payload schema clihelper |
| FR-024 | E3 | Webhook listener inbound + Quick Reply parsing |
| FR-025 | E3 | Rate-limit 1 req/s leaky bucket |
| FR-026 | E3 | 6 templates UTILITY (3 mínimo M1) |
| FR-027 | E3 | Retry 429/5xx + circuit breaker |
| FR-028 | E3 | Custo WhatsApp = $0 do lado HDD |
| FR-029 | E3 | Resend fallback (S3 sink) |
| FR-030a | **E1.a** + E3 (consumer) | Idempotency key SHA-256 — geração foundational em E1.a; consumida pre-POST em E3 |
| FR-030b | E2 | Worker em VPS própria (Bun) |
| FR-031 | E2 | Subcomandos `start/pause/resume/status/logs` |
| FR-032 | E5 | Crash recovery via state store (recovery boot) |
| FR-033 | E2 | BMAD invoker via CLI-wrapper |
| FR-034 | E2 | Single-project v1 |
| FR-040 | **E1.a** (schema) + E5 (consumer) | State store schema mínimo — base em E1.a; recovery markers em E5 |
| FR-041 | **E1.a** (key gen + commit-before-side-effect helpers) + E5 (drills) | Idempotência por story — invariante foundational em E1.a; observable via drills em E5 |
| FR-042 | E1.a | bun:sqlite + Drizzle (foundational schema) |
| FR-043 | E5 | Rollback parcial — stub v1; AO-43 auto-rollback diferido v1.1+ |
| FR-044 | E1.a | Audit log JSONL foundational (hash chain + RFC 3161) |
| FR-050 | E2 + E4 | Gates explícitos (Story→Dev, Dev→Review em E2; Review→QA em E4) |
| FR-051 | E2 | Falha gate auditada |
| FR-052 | E4 | Diagnóstico estruturado em falha de gate |
| FR-060 | E6.a | Budget = janela Max 20x |
| FR-061 | E6.a | Notificação 80% janela |
| FR-062 | E6.b | `--hard-stop` flag CI mode (pause em exhausted é hardcoded em E6.a) |
| FR-063 | E6.a | Telemetry consumo por sub-agente |
| FR-064 | E6.a | Opus/Sonnet/Haiku selection (D-044/D-050 — impl. Sonnet API default; Max 20x fallback; Haiku light) |
| FR-065 | E6.b | Downgrade automático em paused-window-exhausted |
| FR-070 | **E7.a (entregue em E1.a)** | Resumo 3-tier Tier-B/C gerado automaticamente. Tier-A em E7.b |
| FR-071 | E7.a (Tier-B/C) + E7.b (Tier-A WhatsApp) | Split: Tier-B link committed + Tier-C audit em E7.a; Tier-A WhatsApp em E7.b |
| FR-072 | E7.a | Pause em `paused-awaiting-review` (mecanismo CLI) |
| FR-073 | E7.a (CLI) + E7.b (Quick Reply WhatsApp) | Respostas via `hdd-worker review …` em E7.a; `fin_*` Quick Reply em E7.b |
| FR-074 | E7.a | Resumo permanente committed em git |
| FR-075 | E7.a | Diff side-by-side (git diff v1) |
| FR-076 | E7.b | Quick Reply payloads `fin_*` do contrato `interrupt-commands.ts` em E1.a |
| FR-080 | E1 | Bootstrap doc + systemd unit |
| FR-081 | E1 | Verificação pré-requisitos no start |
| FR-082 | E1 | Fail closed em credenciais missing |
| FR-083 | E1 | Overrides `_bmad/custom/` |
| FR-084 | E1 | `hdd-worker logs` tail JSONL |

**Cobertura NFR (alto-nível):**

| Categoria | Epics |
|---|---|
| NFR-S Segurança (S1-S6) | E1 (vault/redaction/sandbox/SSH) + E3 (rate-limit/clihelper risk) |
| NFR-R Confiabilidade (R1-R5) | E5 (crash recovery + idempotência) + E3 (S3 pipeline não pára) |
| NFR-O Observabilidade (O1-O5) | E1 (JSONL foundational) + E7 (Resumos) + E2 (`hdd-worker status`) |
| NFR-P Performance (P1-P3) | E1 (cold start `bun build --compile`) + E3 (latência ≤10s) |
| NFR-M Manutenibilidade (M1-M3) | E1 (pin BMAD + overrides) |
| NFR-U Usabilidade (U1-U4) | E3 (WhatsApp PT) + E7 (Tier-A ≤200 palavras) + E2 (`--help`) |
| NFR-C Compliance (C1-C2) | v1: N/A · v1.1+: epic dedicado (deferred) |

**Cobertura Additional Requirements (AR-001..AR-112):**

| Grupo AR | Epics |
|---|---|
| A. Starter scaffold (AR-001..003) | E1 |
| B. Stack constraints (AR-010..020) | E1 (foundational) + adapters específicos em E3/E6 |
| C. Patterns Result/ports/branded/FSM/events (AR-030..040) | E1 (foundational) + aplicação per-feature |
| D. 5 Schemas formais (AR-050..054) | E1 (ports + StorySpec) + E2 (Dev/Review/QA outputs) + E4 (Sprint Plan output) |
| E. Audit JSONL hash chain + RFC 3161 (AR-060..063) | E1 |
| F. Sprint 0 BLOCKERS (AR-070..078) | E1 (safety + DRB conditions) |
| G. LLM hybrid (AR-090..093) | E6 |
| H. Topologia inbound/outbound (AR-100..101) | E3 |
| I. Runbooks + CI + SSH deploy (AR-110..112) | E1 |

---

## Epic List

### Epic 1: Fundações & Safety Gates (Sprint 0)

**Goal:** Entregar o ambiente HDD reproduzível e seguro — repo scaffold Bun
greenfield, ports/core/lib, db schema base **incluindo idempotency tables**,
audit JSONL com hash chain + RFC 3161, **gerador Resumo 3-tier Tier-B/C**
(antes de WhatsApp template aprovado), **contratos shared `interrupt-commands.ts`
+ `fsm.ts`** (resolvem acoplamento E3↔E4), 3 Sprint 0 BLOCKERS de safety
(path traversal, two-step confirmation, redaction multi-pattern), bootstrap
systemd + secrets, runbooks must-have, CI GitHub Actions — antes de qualquer
feature work. Encerrado o epic, `operador` consegue correr `bun test` verde,
deploy via SSH restricted, e o `bmad-cli` non-interactive está validado (ou
Plan B activado).

> **Split em 3 sub-milestones com Resumo Tier-B entre cada** (Pre-Mortem PM-1):
> - **E1.a — Runtime Scaffold & Core Contracts:** Bun base scaffold + ports + Result lib + branded types + FSM + interrupt-commands shared + db schema base + **idempotency keys & commit-state-before-side-effect helpers (AO-3/AO-39)** + audit JSONL foundational + **Resumo 3-tier Tier-B/C gerador (E7.a antecipado)**
> - **E1.b — Safety BLOCKERS:** path traversal sanitization (AO-158+165) + two-step confirmation (AO-155+164) + redaction multi-pattern (AO-160+166) + 8 Pentest Tasks PT-1..PT-8 verificáveis. **CI budget per safety story: ΔCI ≤10s benchmark before/after** (PM-6); falha = no merge.
> - **E1.c — Bootstrap & Operations:** systemd unit + secrets management + Litestream + rclone + CI GitHub Actions + Renovate + SSH restricted deploy + 8 runbooks must-have + `bmad-cli` smoke test final

**FRs covered:** FR-030a (idempotency key infra), FR-041 (key generation + commit-before-side-effect — recovery boot fica em E5), FR-042, FR-044, FR-070, FR-071 (Tier-B/C only; Tier-A em E7.b), FR-072, FR-073, FR-074, FR-075, FR-080, FR-081, FR-082, FR-083, FR-084
**NFRs covered:** NFR-S1..S6 (parcial — vault/redaction/sandbox/SSH), NFR-O3, NFR-O5 (Resumos parcial), NFR-P1, NFR-M1, NFR-M2
**ARs covered:** AR-001..003, AR-010..040, AR-050..054 (5 schemas formais — DevOutput/ReviewOutput/QAOutput/SprintPlanOutput/StorySpec), AR-060..063, AR-070..078, AR-110..112
**Type:** foundational (Sprint 0)
**Standalone:** Sim — entrega ambiente operacional independente de features posteriores. Cada sub-milestone (E1.a/b/c) gera Resumo Tier-B committed.
**Implementation notes:**
- DRB Sprint 0 hard prereq.
- **AO-86 escalation gate (Day 7):** se schema webhook clihelper não recebido até Day 7, escalate para mock fixtures + feature flag `webhook-mock=true` e flagar `[OPEN]` no `bmad-check-implementation-readiness`. Não bloquear Sprint 1.
- **Pre-conditions Day 1:** validar `bmad-cli` non-interactive (Plan B = Claude Code headless OR re-implement subset 4-6h); operador submete 3 templates Meta para aprovação Meta (1-3 dias por template).
- **Capacity assumption `[ASSUMPTION]`:** ~10 stories em 2 semanas (operator solo + worker autónomo provisional). Se E1.a+b+c > 12 stories, Sprint 0 estende-se para 3 semanas. M1 deadline (1 mês) ainda viável se Sprint 1 = 4 semanas.
- Pode ser pre-validado por `bmad-check-implementation-readiness` no fim.

---

### Epic 2: Worker Autónomo & Pipeline Bimodal

**Goal:** Entregar o `hdd-worker` operacional — CLI Commander com subcomandos
`start/pause/resume/status/logs`, lifecycle bootstrap + graceful shutdown,
BMAD invoker via CLI-wrapper que dispara `bmad-sprint-planning` → loop story
(`bmad-dev-story` → `bmad-code-review` → `bmad-testarch-*`), gates Story→Dev e
Dev→Review explícitos com diagnóstico estruturado em falha. Encerrado o epic,
operador pode disparar uma run end-to-end (sem WhatsApp ainda — só observability
via JSONL + status).

**FRs covered:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-030b, FR-031, FR-033, FR-034, FR-050 (Story→Dev + Dev→Review), FR-051
**NFRs covered:** NFR-O1 (`hdd-worker status` ≤2s), NFR-R3 (single-stream), NFR-U4 (`--help` claro)
**ARs covered:** AR-050..052 (DevOutput, ReviewOutput, QAOutput schemas em ports), AR-077 (CLI-wrapper smoke test)
**Type:** feature (Sprint 1 critical path)
**Standalone:** Sim — worker corre mesmo sem WhatsApp activo (em interrupt, fica `paused_for_interrupt=true` no state store, aguardando até E3+E4 estarem live).
**Implementation notes:** Depende de E1 (scaffold + ports + sandbox). Bloqueia E4 (interrupts precisam de worker que pausa). `bmad-cli` validation pre-condition (E1 Day 1).

---

### Epic 3: Canal WhatsApp (clihelper) + Fallback E-mail

**Goal:** Entregar o adapter outbound clihelper (POST templates com rate-limit
1 req/s leaky bucket, retry 429/5xx + circuit breaker, **idempotency key
SHA-256 consumida da infra E1.a**), o webhook listener inbound `POST /callback`
(Hono + Zod minimal schema drop-at-ingress, **parsing Quick Reply payloads do
contrato shared `core/domain/interrupt-commands.ts` definido em E1.a** + NLP
livre via Haiku), 6 templates UTILITY desenhados (3 mínimo aprovados M1), e o
adapter Resend como fallback S3 (pipeline não pára). Encerrado o epic,
operador pode receber e responder mensagens HDD no telemóvel.

**FRs covered:** FR-020..030a (consumer; key generation foundational em E1.a; sem FR-030b — esse é E2)
**NFRs covered:** NFR-S2 (redaction nos logs WhatsApp), NFR-S5 (clihelper risks mitigated), NFR-R5 (S3 não pára pipeline), NFR-P2 (latência ≤10s), NFR-U1 (telemóvel), NFR-U2 (PT)
**ARs covered:** AR-100, AR-101 (topologia inbound/outbound + n8n aggregator)
**Type:** feature (Sprint 1)
**Standalone:** Sim — adapters HTTP + listener + Resend formam unidade entregável; consumível por E4 ou directo via API interna.
**Implementation notes:**
- Depende de E1.a (Zod boundary + `OutboundNotifyPort` + retry policies + idempotency key infra + `interrupt-commands.ts` contrato).
- Bloqueia E4 + E7.b (Tier-A WhatsApp).
- **6 templates UTILITY** — operador submete a Meta em paralelo Sprint 0; 3 mínimo (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`) antes Day 7 (AO-86 escalation gate em E1.c).
- **v1.1+ futureproofing nota:** alternative channels (Telegram, Signal) reutilizam os mesmos `OutboundNotifyPort` + `InboundCommandPort` definidos em E1.a; novo adapter sem refactor E3.

---

### Epic 4: Regra de Interrupt (P1 + S1/S2/S3 Watchdogs)

**Goal:** Entregar a Regra de Interrupt como sistema integrado — Trigger P1
gap detector no `bmad-code-review` customizado (heurística + agent
self-check), watchdog timer S1 (30 min default), contador retries S2 (5
consecutivas), timeout-poll S3 (3 mensagens / 10 min sem confirmação WhatsApp
→ Resend fallback), state pause `paused_for_interrupt=true`, diagnóstico
estruturado em falha de gate Review→QA. Encerrado o epic, worker pausa
inteligentemente e contacta `operador` quando preciso — e troca canal sem
parar quando o WhatsApp falha.

**FRs covered:** FR-010..017, FR-050 (Review→QA gate), FR-052
**NFRs covered:** NFR-O4 ("interrupts pendentes" métrica)
**ARs covered:** AR-080..091 (parcial — Haiku gap-detector NLP via SDK direct)
**Type:** feature (Sprint 1)
**Standalone:** Sim — comportamento de interrupt + watchdogs é unidade coerente; consome E2 (worker pause API) + E3 (canal).
**Implementation notes:** Depende de E2 (worker hooks) + E3 (canal outbound + S3 fallback wiring). Bloqueia ramp de stories em produção (sem interrupts, worker corre em silêncio até crash).

---

### Epic 5: Crash Recovery & Rollback Stub por Story

**Goal:** Entregar **recovery boot** que detecta in-flight stories (state
`paused_for_interrupt` ou row órfã) e retoma do último ponto seguro,
**crash drill test suite** que simula kill -9 em pontos sensíveis (entre
state.commit e side-effect, durante POST WhatsApp, entre dois retries),
state store completo (`current_story_id`, status, retry counts, flags,
in-flight markers), e **rollback parcial stub v1** que detecta cenário e
emite Trigger P1 ao operador em vez de auto-rollback. Encerrado o epic,
o operador tem confiança documentada de que crash em qualquer ponto não
produz side-effects duplicados nem perdidos.

> **Nota Pre-Mortem PM-2:** Idempotency keys + commit-state-before-side-effect
> helpers foram **movidos para E1.a** (foundational). E5 fica reduzido a
> recovery boot + crash drills + rollback stub.

**FRs covered:** FR-032 (crash recovery completo), FR-040 (state store consumer; schema base em E1.a), FR-041 (recovery side; key generation em E1.a), FR-043 (stub v1)
**NFRs covered:** NFR-R1, NFR-R2, NFR-R3, NFR-R4 (observable via drills)
**ARs covered:** AR-013 (Drizzle migrations adicionais para recovery markers — sem modificar baseline E1.a)
**Type:** feature (Sprint 1)
**Standalone:** Sim — entrega garantia transversal observable via crash drills.
**Implementation notes:**
- Depende de E1.a (db schema base + Drizzle + audit JSONL + idempotency keys).
- Adiciona migrations adicionais sem modificar baseline.
- **Rollback parcial é stub v1 `[ASSUMPTION]`:** detecta cenário (resposta WhatsApp invalida stories feitas) e emite Trigger P1 ao operador em vez de auto-rollback. AO-43 (automated rollback) diferido v1.1+.
- **Crash drill suite** = AC machine-checkable: 4 cenários `kill -9` em pontos identificados; pós-restart `bun test:crash` valida no duplicates, no losses.

---

### Epic 6: Gestão de Janela LLM (Max 20x + Hybrid)

**Goal:** Entregar o adapter Anthropic dual-mode (`claude --print` Max 20x para
heavy / Anthropic SDK direct Haiku para light), telemetry de consumo de
janela por sub-agente e workflow, notificação WhatsApp em 80% da janela,
pause automática + `--hard-stop` flag em window-exhausted, e prompt cache
strategy (`cache_control: ephemeral` em prompts longos). Encerrado o epic,
operador opera com budget híbrido (D-050: impl. API metered sob cost cap +
Max 20x para planejamento/overflow) e observability completo (tokens + USD + % janela).

> **Split em 2 sub-milestones** (Pre-Mortem PM-3 — demo M1 não pode bater
> window-exhausted silenciosamente):
> - **E6.a — Telemetry & 80% Notify (Sprint 1 must-have):** adapter Anthropic dual-mode + tracking % janela por sub-agente/workflow + notificação WhatsApp em 80% + pause automática hardcoded em window-exhausted (sem downgrade ainda). **Cumpre observability mínimo para demo M1 não falhar silenciosamente.**
> - **E6.b — Downgrade & Hard-Stop (Sprint 2):** downgrade automático Opus→Sonnet→Haiku em paused-window-exhausted + flag `--hard-stop` CI mode + Plan B emergency runbook (`docs/runbooks/ban-Anthropic-emergency.md`).

**FRs covered (E6.a):** FR-060, FR-061, FR-063 (telemetry), FR-064 (selection D-044/D-050 — impl. Sonnet via API default, Max 20x overflow; Haiku na light)
**FRs covered (E6.b):** FR-062 (`--hard-stop`), FR-065 (downgrade automático)
**NFRs covered:** NFR-O2 (consumo consultável)
**ARs covered:** AR-090..093 (hybrid cost-optimal D-044 revisto D-050), AR-091 (Haiku SDK)
**Type:** feature (E6.a Sprint 1 must-have; E6.b Sprint 2)
**Standalone:** Sim — E6.a entrega valor sem E6.b; downgrade pode chegar depois.
**Implementation notes:**
- Depende de E1.a (ports + adapter pattern).
- Hooks em E2 (worker chama Anthropic via este adapter) + E4 (Haiku gap-detector NLP).
- `[ASSUMPTION]` instrumentação de % janela é AO-151 — necessita validar API Anthropic devolve usage metrics suficientes; Plan B = estimate via tokens proxy (input+output count).
- **E6.a foundational dentro de Sprint 1** — sem isto, demo M1 com 4+ stories cumulativas pode bater janela silenciosamente.

---

### Epic 7: Resumo Finalização 3-tier + Governance

**Goal:** Entregar o sistema de Resumo 3-tier automático em toda finalização
(workflow / story / sprint / release) — Tier-A ≤200 palavras via WhatsApp
template `hdd_summary_finalization`, Tier-B briefing committed em
`_bmad-output/<phase>/<workflow-id>-summary.md`, Tier-C full audit-only com
inputs/outputs/decisions/diff. Parsing de Quick Reply (`fin_aprovar` /
`fin_pedir_mudancas` / `fin_rejeitar`) injecta resposta no state e
desbloqueia ou repete fase. Encerrado o epic, **D-019 (revisão obrigatória)
é mecanicamente enforced desde Day 1 do Sprint 0** (via E7.a antecipado em E1.a).

> **Split em 2 sub-milestones** (Pre-Mortem PM-4 — D-019 não pode esperar pelo
> último epic):
> - **E7.a — Tier-B/C Generator (entregue em E1.a, antes deste epic):** gerador Markdown Tier-B + Tier-C completo, commit automático em `_bmad-output/<phase>/<workflow-id>-summary.md` ao concluir qualquer workflow. **Não usa WhatsApp** (template ainda pode estar pending Meta). D-019 enforced via leitura humana de Tier-B + aprovação CLI (`hdd-worker review approve|request-changes|reject`).
> - **E7.b — Tier-A WhatsApp Delivery (este epic):** quando template `hdd_summary_finalization` aprovado por Meta + E3 ready, gerador Tier-A ≤200 palavras + envio via WhatsApp + parsing Quick Reply `fin_*` + diff side-by-side com resumo anterior + 8 Pentest Tasks PT-1..PT-8 verificáveis pré-M1.

**FRs covered (E7.a, entregue em E1.a):** FR-070 (Tier-B/C), FR-071 (Tier-B link + Tier-C audit; Tier-A em E7.b), FR-072, FR-073 (via CLI), FR-074, FR-075
**FRs covered (E7.b, este epic):** FR-070 completo (Tier-A), FR-071 (Tier-A WhatsApp), FR-073 (Quick Reply WhatsApp), FR-076 (Quick Reply payloads `fin_*` do contrato `interrupt-commands.ts`)
**NFRs covered:** NFR-O5 (Resumos = um dos 3 canais observability), NFR-U3 (Tier-A ≤200 palavras)
**ARs covered:** AR-076 (8 Pentest Tasks verificáveis pré-M1 — gate antes do epic close)
**Type:** feature (E7.a inline em E1.a; E7.b Sprint 1)
**Standalone:** Sim — E7.a sozinho cumpre D-019 mínimo via leitura humana. E7.b adiciona Tier-A WhatsApp quando E3 ready.
**Implementation notes:**
- E7.a depende apenas de E1.a (audit JSONL + Tier-B/C templates Markdown). Sem dependência de E3.
- E7.b depende de E3 (canal WhatsApp para Tier-A) + template `hdd_summary_finalization` aprovado por Meta.
- Hook obrigatório em E1..E7 conclusão (cada epic invoca o resumer no fim).
- **Pentest Tasks PT-1..PT-8** funcionam como gate antes de assinar M1 (executados em E7.b close, não E7.a).

---

### Dependências entre epics (high-level DAG, post Pre-Mortem)

```
E1.a (Runtime Scaffold + Core Contracts + Idempotency Keys + E7.a Tier-B/C)
 ├─→ E1.b (Safety BLOCKERS) ─→ E1.c (Bootstrap + Ops)
 │                              │
 │                              └─→ Sprint 0 close (Resumo Tier-B via E7.a)
 │
 ├─→ E2 (Worker)
 │    ├─→ E4 (Interrupt — needs worker pause API + interrupt-commands.ts)
 │    └─→ E6.a (Telemetry janela — Sprint 1 must-have)
 │         └─→ E6.b (Downgrade + Hard-Stop — Sprint 2)
 ├─→ E3 (WhatsApp + Resend; consume idempotency keys + interrupt-commands.ts)
 │    ├─→ E4 (Interrupt — needs canal)
 │    └─→ E7.b (Resumo Tier-A via WhatsApp)
 └─→ E5 (Crash Recovery + Drills + Rollback Stub — needs db schema + JSONL base)

E4 + E5 + E6.a + E7.b entregáveis em paralelo após E2+E3 prontos.
```

**Critical path para M1:** E1.a → E1.b → E1.c → E2 → E3 → E4 → E7.b (Resumo Release final).
E5, E6.a paralelos no Sprint 1. E6.b + v1.1+ items deferred.

### Nota para Step 03 — StorySpec schema extension

> Pre-Mortem Party Mode (Devil's Advocate) levantou rastreabilidade FR→Story
> em epics agrupados por afinidade. Resolução adoptada:
>
> **Adicionar campo `pri_feature: F1..F9`** ao `StorySpec` schema (estende
> AR-054). Cada story aponta a F-ID PRD primária além do epic. Preserva
> reporting per-PRD-feature sem inflar epics.

### Sub-milestones formais e ordering recomendado Sprint 0 + Sprint 1

| Sprint | Sub-milestones | Capacity assumption | Resumo entre? |
|---|---|---|---|
| **Sprint 0** (2-3 sem) | E1.a → E1.b → E1.c | ~10 stories / 2 sem (`[ASSUMPTION]`) | Tier-B per sub |
| **Sprint 1** (4 sem) | E2 + E3 paralelo → E4 + E5 + E6.a + E7.b paralelos | provisional; calibrate after Sprint 0 baseline | Tier-A per story complete (when E7.b live) |
| **Sprint 2+** | E6.b + v1.1+ items | — | continue |

---

## Stories por Epic

> **Story numbering convention:** `Story <epic>.<sub-milestone>.<seq>` para
> epics split (e.g. `Story 1.a.5`); `Story <epic>.<seq>` para epics monolíticos
> (e.g. `Story 4.3`).
>
> **StorySpec schema (estende AR-054):**
> - `story_id` · `title` · `type` · `epic` · `sprint` · `pri_feature` (F1..F9 ou `foundational`)
> - `blocked_by[]` · `unblocker` (opcional)
> - `files_created[]` · `files_modified[]`
> - `ao_subset[]` (4-8 AOs)
> - `acceptance_criteria[]` (machine-checkable: `binary` | `property` | `coverage`)
> - `estimated_tokens.dev_core` + `estimated_tokens.dev_with_retry`
>
> **Token baseline** `[ASSUMPTION AO-114]`: 64K dev_core / 96K dev_with_retry per
> story foundational; 48K/72K per feature story; calibrate Sprint 1 baseline.
>
> **Dependency versions (não duplicar nas stories):** para versões pinned de
> Bun, Drizzle, neverthrow, Hono, Commander, pino, fast-check, Biome,
> typescript-eslint, Litestream, etc., consultar `architecture.md` Step 03
> *Starter Template Evaluation* (`_bmad-output/planning-artifacts/architecture.md`
> linha 331+). Stories que tocam ports/lib/db herdam essas decisões via
> AO refs no `ao_subset[]`.

---

## Epic 1.a: Runtime Scaffold & Core Contracts (Sprint 0)

> Entrega o esqueleto operacional: Bun + ports + Result + branded types + FSM
> + interrupt-commands + db schema + idempotency keys + audit JSONL + Tier-B/C
> Resumo + bootstrap order. 9 stories.

### Story 1.a.1: Bun base scaffold + linting + test runner

As a `operador`,
I want a Bun 1.3+ project scaffold com Biome, typescript-eslint async-safety rules e `bun test` configurado,
So that toda story subsequente pode compilar, lintar e testar em ambiente reproduzível.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: `foundational`
- blocked_by: []
- files_created: `package.json`, `bunfig.toml`, `biome.json`, `tsconfig.json`, `.eslintrc.json`, `src/main.ts` (stub), `README.md`
- files_modified: —
- ao_subset: [AR-001, AR-002, AR-010, AR-017, AR-018]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** repo HDD vazio sem `package.json`
**When** executo `bun install` + `bun run lint` + `bun test`
**Then** todos os comandos retornam exit 0
**And** Biome aplica `max-lines: 200` em `src/**`
**And** ESLint enforça 4 regras async-safety: `no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await` (binary AC)
**And** `bun --version` ≥ 1.3.0 (property AC)
**And** CI baseline benchmark <10s wall-clock para `bun test` vazio (binary AC)

### Story 1.a.2: Result<T,E> + branded types + lib helpers

As a `BMAD invoker` (futuro consumer),
I want `src/lib/result.ts` com `neverthrow@^8` Result type + helpers + 4 branded types,
So that toda função no core devolve `Result<T,E>` em vez de throw, e identifiers críticos têm type safety nominal.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: `foundational`
- blocked_by: [1.a.1]
- files_created: `src/lib/result.ts`, `src/lib/branded.ts`, `tests/lib/result.test.ts`, `tests/lib/branded.test.ts`, `docs/conventions/errors.md`
- files_modified: `.eslintrc.json` (custom rule `no-restricted-syntax: ThrowStatement` + 11-itens whitelist)
- ao_subset: [AR-030, AR-031, AR-033, AO-66 throw whitelist]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** ESLint rule activa + whitelist em `docs/conventions/errors.md`
**When** corro `bun run lint` num ficheiro que tem `throw` fora da whitelist
**Then** lint falha com mensagem clara apontando whitelist (binary AC)

**Given** Result helpers `pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient` implementados
**When** corro `bun test tests/lib/result.test.ts` com fast-check
**Then** ≥85% branch coverage atingido (coverage AC)
**And** property test: `pipe(ok(x), fn1, fn2) === fn2(fn1(x))` para fast-check arbitraries (property AC)

**Given** 4 branded types: `RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey`
**When** atribuo `string` literal a variável `RunId` sem `as RunId`
**Then** typescript compile erro (binary AC)

### Story 1.a.3: 3 ports temporais — Clock, Spawn, Notify

As a `core service`,
I want `ClockPort`, `SpawnPort`, `NotifyPort` definidos como TypeScript interfaces em `src/ports/`,
So that core pode ser testado sem dependências de tempo real, processos ou efeitos externos.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: `foundational`
- blocked_by: [1.a.2]
- files_created: `src/ports/clock.port.ts`, `src/ports/spawn.port.ts`, `src/ports/notify.port.ts`, `src/adapters/clock/system-clock.adapter.ts`, `src/adapters/clock/test-clock.adapter.ts`, `tests/ports/contracts.test.ts`
- files_modified: —
- ao_subset: [AR-032, AR-038, D-04.3']
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** `ClockPort` interface
**When** importo `import type { ClockPort } from 'src/ports/clock.port'` num core service
**Then** o serviço **não** importa qualquer ficheiro de `src/adapters/` (binary AC — Dep Graph Rigour)

**Given** `TestClock` adapter
**When** core service usa `ClockPort` em test mode
**Then** `clock.advance(60_000)` avança time determinístico sem `setTimeout` real (property AC)

**Given** `SpawnPort.spawn(cmd, args, opts): ResultAsync<SpawnResult, SpawnError>`
**When** core invoca spawn que excede timeout
**Then** retorna `err({kind: 'Transient', cause: TimeoutError})` (binary AC)

### Story 1.a.4: Domain — FSM + interrupt-commands tagged union

As a `worker` e `WhatsApp listener`,
I want `src/core/fsm.ts` com FSM enum + transition table e `src/core/domain/interrupt-commands.ts` com tagged union dos Quick Reply payloads,
So that estado do worker é único source-of-truth e o canal WhatsApp / regra de interrupt partilham o mesmo contrato sem coupling circular.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: `foundational`
- blocked_by: [1.a.2]
- files_created: `src/core/fsm.ts`, `src/core/domain/interrupt-commands.ts`, `src/core/events.ts`, `tests/core/fsm.test.ts`, `tests/core/interrupt-commands.test.ts`
- files_modified: —
- ao_subset: [AR-035, AR-036, D-04.17, D-04.19, Party Mode Senior Eng — resolve E3↔E4 coupling]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** FSM com estados `idle`, `running`, `paused_for_interrupt`, `paused_awaiting_review`, `paused_window_exhausted`, `failed`
**When** chamo `fsm.transition('idle', 'StartRun')`
**Then** retorna `ok({to: 'running'})` (binary AC)
**And** transição inválida (`idle` → `failed` sem evento) retorna `err({kind: 'IllegalTransition'})` (binary AC)
**And** property test: para todo estado S, transition table é total ou explicitamente unreachable (property AC)

**Given** `interrupt-commands.ts` tagged union com `P1Continuar`, `P1Pausar`, `FinAprovar`, `FinPedirMudancas`, `FinRejeitar`
**When** parser recebe payload `"p1_continuar_assim"`
**Then** retorna `ok({kind: 'P1Continuar'})` (binary AC)
**And** payload desconhecido retorna `err({kind: 'UnknownCommand', received: <raw>})` (binary AC)

### Story 1.a.5: db schema base + Drizzle + idempotency keys table

As a `state store consumer`,
I want db schema com tables `runs`, `stories`, `idempotency_keys`, `audit_events` + Drizzle migrations + WAL + idempotency key generation helper,
So that toda side-effect é precedida de commit-state-before-side-effect (AO-3/AO-39) e crash entre commit e side-effect é recuperável.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: F5 + F3 (idempotency consumer)
- blocked_by: [1.a.2, 1.a.3]
- files_created: `src/db/schema.ts`, `src/db/migrations/001_init.sql`, `src/db/connection.ts`, `src/services/idempotency.service.ts`, `tests/db/schema.test.ts`, `tests/services/idempotency.test.ts`, `drizzle.config.ts`
- files_modified: `package.json` (add `drizzle-orm`, `drizzle-kit`)
- ao_subset: [AR-013, AR-040, FR-030a, FR-041 invariant side, AO-3, AO-39, Pre-Mortem PM-2]
- estimated_tokens: { dev_core: 72K, dev_with_retry: 108K }

**Acceptance Criteria:**

**Given** db vazio + migrations aplicadas
**When** corro `bun run db:migrate`
**Then** PRAGMA `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL` activos (binary AC)
**And** migrations correm em `BEGIN EXCLUSIVE` transaction (binary AC)

**Given** `idempotency.service.generate({runId, storyId, templateName, seqLocal})`
**When** invoco com mesmos parâmetros 2×
**Then** retorna o mesmo `IdempotencyKey` (SHA-256 hex) (property AC)

**Given** `idempotency.service.commitBeforeSideEffect(key, payload)`
**When** crash simulado entre commit e side-effect, depois recovery boot
**Then** key existe no db; re-tentativa da side-effect detecta key e retorna resultado prévio sem nova execução (binary AC — provado por crash drill em E5)

### Story 1.a.6: Audit JSONL adapter com hash chain + RFC 3161 stub

As a `audit consumer` (worker, services),
I want `src/adapters/audit/jsonl-hash-chain.adapter.ts` que append eventos com `prev_hash` chain SHA-256 + RFC 3161 `.tsr` daily stub,
So that toda decisão, side-effect e interrupt fica trail-able e tamper-evident.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: foundational + F5
- blocked_by: [1.a.2, 1.a.5]
- files_created: `src/adapters/audit/jsonl-hash-chain.adapter.ts`, `src/ports/audit.port.ts`, `tests/adapters/audit.test.ts`, `docs/audit-format.md`
- files_modified: `src/db/schema.ts` (add `audit_chain_state` table for last hash)
- ao_subset: [FR-044, AR-060, AR-061, AR-062, NFR-O3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** audit adapter inicializado com path `_bmad-output/audit/<project>/<date>.jsonl`
**When** chamo `audit.append({kind: 'StoryStarted', ...})`
**Then** linha JSON aparece com `O_APPEND` syscall (1 line atomically) (binary AC)
**And** linha contém `prev_hash` = SHA-256 da linha anterior (ou `genesis` se primeira) (property AC)

**Given** ficheiro JSONL com 100 linhas
**When** corre `bun run audit:verify <date>`
**Then** verifica chain integrity e retorna `ok({verified: 100})` (binary AC)
**And** linha 50 manualmente corrompida → retorna `err({kind: 'ChainBreak', atLine: 50})` (binary AC)

**Given** RFC 3161 stub
**When** rotation diária ocorre
**Then** ficheiro `.tsr` daily produzido em `_bmad-output/audit/<project>/<date>.tsr` `[ASSUMPTION]` TSA call mockado v1; TSA real v1.1+ (binary AC)

### Story 1.a.7: Bootstrap order + env validation Zod

As a `worker process`,
I want `src/bootstrap.ts` com boot order explícito (load env → validate Zod → connect db → run migrations → init adapters → start FSM) e shutdown handler graceful,
So that fail-closed em credenciais missing + sem state corruption em SIGTERM.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: F9
- blocked_by: [1.a.5, 1.a.6]
- files_created: `src/bootstrap.ts`, `src/lib/env.ts` (Zod schema), `src/lib/shutdown.ts`, `tests/bootstrap.test.ts`
- files_modified: `src/main.ts`
- ao_subset: [FR-081, FR-082, AR-019, AR-037, D-04.16, D-04.5']
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** env var `ANTHROPIC_API_KEY` ausente
**When** worker arranca via `bun run start`
**Then** processo exit code 1 com mensagem "ANTHROPIC_API_KEY required" no stderr em <500ms (binary AC)
**And** zero linhas escritas no audit log (no partial init) (binary AC)

**Given** worker rodando
**When** envio SIGTERM
**Then** dentro de 5s: stop accepting work → flush pending audit events → close db connection → exit 0 (property AC)

### Story 1.a.8: Resumo 3-tier Tier-B/C gerador + CLI review

As a `operador`,
I want um gerador automático de Resumos 3-tier (Tier-B briefing + Tier-C full) committed em git ao concluir qualquer workflow, e um CLI `hdd-worker review approve|request-changes <note>|reject <reason>` para parsing de aprovação textual,
So that D-019 (revisão obrigatória) está enforced desde Day 1 do Sprint 0, antes do template WhatsApp `hdd_summary_finalization` estar aprovado.

**StorySpec:**
- type: `foundational` · epic: E1.a (E7.a antecipado) · sprint: 0 · pri_feature: F8
- blocked_by: [1.a.6, 1.a.7]
- files_created: `src/services/summary-generator.service.ts`, `src/cli/review.command.ts`, `templates/summary-tier-b.md`, `templates/summary-tier-c.md`, `tests/services/summary.test.ts`
- files_modified: `src/cli/hdd-worker.ts` (register `review` subcommand)
- ao_subset: [FR-070, FR-071 partial (Tier-B/C), FR-072, FR-073, FR-074, FR-075, Pre-Mortem PM-4]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** workflow conclui (e.g. Sprint 0 close)
**When** worker chama `summaryGenerator.finalize(workflowId, inputs, outputs)`
**Then** ficheiro `_bmad-output/<phase>/<workflowId>-summary.md` committed em git com 3 sections (Tier-A placeholder, Tier-B briefing ≤715 palavras, Tier-C full) (binary AC)
**And** FSM transita para `paused_awaiting_review` (binary AC)

**Given** worker em `paused_awaiting_review`
**When** corro `hdd-worker review approve <workflowId>`
**Then** state injecta `approved=true`, FSM transita para próximo passo (binary AC)
**And** `request-changes "fix XYZ"` regista nota no audit + state injecta `request_changes` + FSM retorna ao step anterior (binary AC)
**And** `reject "razão"` regista no audit + FSM `failed` (binary AC)

**Given** workflow anterior do mesmo projeto existe
**When** `summaryGenerator.finalize` é chamado
**Then** Tier-C inclui diff side-by-side via `git diff` (binary AC)

### Story 1.a.9: AsyncLocalStorage withRunContext + correlation IDs

As a `cross-cutting logger` e `audit adapter`,
I want um `withRunContext(runId, fn)` baseado em AsyncLocalStorage que propaga `runId` + `storyId` + `traceId` automaticamente a todo log e audit event sem passar como argumento,
So that observability tem correlation IDs sem poluir signatures de funções.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: foundational
- blocked_by: [1.a.6]
- files_created: `src/lib/run-context.ts`, `tests/lib/run-context.test.ts`
- files_modified: `src/adapters/audit/jsonl-hash-chain.adapter.ts` (auto-inject context)
- ao_subset: [AR-039, D-04.4']
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** `withRunContext({runId: 'r1', storyId: 's1'}, async () => audit.append(event))`
**When** event chega ao JSONL
**Then** linha contém `runId: "r1"` + `storyId: "s1"` sem ter sido passados explicitamente (binary AC)

**Given** 2 chamadas concorrentes com runIds diferentes
**When** ambas escrevem audit no mesmo tick
**Then** cada uma preserva o seu contexto isolado (property AC)

### Story 1.a.10: LLMPort + AnthropicAdapter foundational (API SDK Sonnet+Haiku + Max 20x CLI fallback)

As a `core service` (intent-classifier, gap-detector, dispatcher),
I want `LLMPort` interface + `AnthropicSDKAdapter` (Sonnet+Haiku via API — caminho default da implementação, D-050) + `ClaudeCliAdapter` (Sonnet via `claude --print` Max 20x — planejamento + overflow/fallback) com `RunId` e `SessionId` branded types,
So that E3 (NLP classifier) e E4 (gap detector) podem invocar LLM via porta única sem importar adapters; dispatcher de E6.a consome esta foundation.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: F7 + foundational
- blocked_by: [1.a.2, 1.a.3]
- files_created: `src/ports/llm.port.ts`, `src/adapters/llm/claude-cli.adapter.ts`, `src/adapters/llm/anthropic-sdk.adapter.ts`, `src/lib/llm-session-id.ts`, `tests/adapters/llm-foundational.test.ts`
- files_modified: `src/lib/branded.ts` (add `SessionId` branded type)
- ao_subset: [AR-032, AR-090, AR-091, AR-093, D-050, project-hdd-cost-optimal-llm memory, Pre-Mortem L-2]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** `LLMPort` interface define `invoke({role, prompt, sessionId?}): ResultAsync<LLMResult, LLMError>`
**When** importo `import type { LLMPort } from 'src/ports/llm.port'` num core service
**Then** o serviço **não** importa qualquer ficheiro de `src/adapters/` (binary AC — Dep Graph Rigour)

**Given** `AnthropicSDKAdapter` configurado com `ANTHROPIC_API_KEY` válido
**When** chamo `adapter.invoke({role: 'classifier', model: 'claude-haiku-4-5', prompt: 'test'})` **e** `adapter.invoke({role: 'dev', model: 'claude-sonnet-4-6', prompt: 'test'})` (D-050: SDK serve light Haiku **e** impl. Sonnet)
**Then** ambos retornam `ok({content, tokens: {input, output, cache_read_input_tokens?}})` (binary AC)
**And** error 401 retorna `err({kind: 'Unauthorized'})` (binary AC)

**Given** `ClaudeCliAdapter` (caminho de planejamento + overflow/fallback, D-050) invoca `claude --print --model claude-sonnet-4-6 --resume <sessionId>?`
**When** session reuse cenário (mesma sessionId 2×)
**Then** segunda invocação tem `cache_read_input_tokens > 0` (property AC — 75% economy target per D-044)

**Given** Test adapter (`TestLLMAdapter`)
**When** core service usa `LLMPort` em test mode
**Then** retorna fixture pre-defined sem network call (binary AC — testabilidade foundational)

**Given** branded type `SessionId`
**When** atribuo `string` literal a variável `SessionId` sem `as SessionId`
**Then** typescript compile erro (binary AC)

---

## Epic 1.b: Safety BLOCKERS (Sprint 0)

> 3 DRB-mandated safety stories + sandbox + Pentest Tasks. **CI budget per
> story: ΔCI ≤10s** (Pre-Mortem PM-6). 5 stories.

### Story 1.b.1: Path traversal sanitization no apply-diff

As a `Dev sub-agent`,
I want `apply-diff` que valida paths absolutos contra workspace boundary antes de qualquer write,
So that LLM-generated diff não consegue escrever fora do workspace (AO-158+165 DRB BLOCKER).

**StorySpec:**
- type: `foundational` · epic: E1.b · sprint: 0 · pri_feature: foundational (safety)
- blocked_by: [1.a.3, 1.a.6]
- files_created: `src/services/apply-diff.service.ts`, `src/lib/path-sanitize.ts`, `tests/services/apply-diff.security.test.ts`
- files_modified: —
- ao_subset: [AO-158, AO-165, AR-072, NFR-S3, Pentest PT-2]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 84K }

**Acceptance Criteria:**

**Given** workspace boundary `/var/lib/projeto_hdd`
**When** diff contém path `../../etc/passwd` ou `/etc/passwd` ou symlink-traversal `/var/lib/projeto_hdd/link → /etc`
**Then** retorna `err({kind: 'PathTraversal', attempted: <path>})` e audit event `SecurityViolation` (binary AC)

**Given** Pentest PT-2 suite com 15 payloads (relative, absolute, encoded, symlink, null byte)
**When** corro `bun test:security tests/services/apply-diff.security.test.ts`
**Then** 15/15 payloads rejected (coverage AC)
**And** ΔCI vs baseline ≤10s (binary AC — benchmark before/after)

### Story 1.b.2: Two-step confirmation acções irreversíveis

As a `operador`,
I want que toda acção irreversível (deploy, branch delete, force push, schema drop) exija 2-step confirmation via WhatsApp Quick Reply OU CLI `--i-really-mean-it`,
So that LLM-driven worker não pode executar destrutiva sem aprovação humana explícita (AO-155+164 DRB BLOCKER).

**StorySpec:**
- type: `foundational` · epic: E1.b · sprint: 0 · pri_feature: foundational (safety)
- blocked_by: [1.a.4, 1.a.6, 1.a.8]
- files_created: `src/services/confirmation-gate.service.ts`, `src/lib/irreversible-action-catalog.ts`, `tests/services/confirmation-gate.test.ts`
- files_modified: `src/core/domain/interrupt-commands.ts` (add `IrrevConfirmYes`, `IrrevConfirmNo` variants)
- ao_subset: [AO-155, AO-164, AR-071]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** catálogo `irreversibleActions = ['deploy', 'branch-delete', 'force-push', 'schema-drop', 'audit-purge']`
**When** worker tenta `deploy` sem confirmation
**Then** retorna `err({kind: 'ConfirmationRequired', action: 'deploy'})` + audit event + FSM `paused_for_interrupt` aguardando Quick Reply `IrrevConfirmYes` (binary AC)

**Given** worker em `paused_for_interrupt` aguardando confirmation de `deploy`
**When** chega `IrrevConfirmNo` payload
**Then** action abortada + audit event `IrreversibleActionAborted` + FSM retoma sem executar (binary AC)

**Given** CLI flag `--i-really-mean-it`
**When** operador corre `hdd-worker deploy --i-really-mean-it`
**Then** bypass WhatsApp 2-step (CLI já é human-driven) (binary AC)
**And** ΔCI ≤10s (binary AC)

### Story 1.b.3: Audit redaction multi-pattern

As a `audit adapter`,
I want um filter de redaction multi-pattern (Anthropic API key, Bearer tokens, Authorization headers, `wa_id`, números telefone, payloads verbose n8n) aplicado antes de write no JSONL,
So that audit não fica com secrets em plain-text mesmo se LLM-generated code log direct (AO-160+166 DRB BLOCKER).

**StorySpec:**
- type: `foundational` · epic: E1.b · sprint: 0 · pri_feature: foundational (safety)
- blocked_by: [1.a.6]
- files_created: `src/lib/redaction.ts`, `tests/lib/redaction.security.test.ts`, `scripts/verify-redaction.ts`
- files_modified: `src/adapters/audit/jsonl-hash-chain.adapter.ts` (apply redaction pre-write), `.github/workflows/ci.yml` (add `truffleHog` step)
- ao_subset: [AO-160, AO-166, NFR-S2, AR-063, Pentest PT-3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 84K }

**Acceptance Criteria:**

**Given** event payload contém `Authorization: Bearer sk-ant-api03-xxx...`
**When** audit append corre
**Then** linha JSONL escrita contém `Authorization: Bearer ***REDACTED***` (binary AC)
**And** 9 patterns testados em fixtures: anthropic-key, bearer-token, basic-auth, wa_id 55*, phone-pt, phone-br, generic-secret, env-var-leak, n8n-verbose-body (coverage AC ≥9/9)

**Given** CI step `scripts/verify-redaction.ts`
**When** corre em fixture com secrets injectadas + scan truffleHog em log directory
**Then** ambos exit 0 (binary AC)
**And** ΔCI ≤10s (binary AC)

### Story 1.b.4: Sandbox Bun.spawn docker --network=none

As a `Dev sub-agent`,
I want execução de LLM-generated code dentro de `Bun.spawn('docker', ['run', '--rm', '--network=none', ...])` com user não-privilegiado e image pre-pulled,
So that LLM-generated code não consegue exfiltrar dados nem aceder host filesystem fora do mount declarado.

**StorySpec:**
- type: `foundational` · epic: E1.b · sprint: 0 · pri_feature: foundational (safety)
- blocked_by: [1.a.3]
- files_created: `src/adapters/sandbox/docker-spawn.adapter.ts`, `src/ports/sandbox.port.ts`, `docker/sandbox/Dockerfile`, `scripts/prepull-sandbox-image.sh`, `tests/adapters/sandbox.security.test.ts`
- files_modified: `src/bootstrap.ts` (verify image pre-pulled at boot), `.github/workflows/ci.yml` (pre-pull step)
- ao_subset: [AR-015, NFR-S3, AO-47, Pentest PT-1]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** sandbox executa script que tenta `curl https://example.com`
**When** spawn completa
**Then** exit code ≠ 0 com network unreachable (binary AC — `--network=none` enforced)

**Given** sandbox image não pre-pulled
**When** worker arranca
**Then** boot fails com `err({kind: 'SandboxImageMissing'})` em <500ms (binary AC — fail closed)

**Given** Pentest PT-1 escape attempts (volume mount, capabilities, host pid namespace)
**When** suite corre
**Then** 0/N escapes succeed (coverage AC)

### Story 1.b.5: 8 Pentest Tasks PT-1..PT-8 test suite

As a `operador`,
I want um `bun test:security` que executa PT-1..PT-8 (sandbox escape, path traversal, redaction, SSRF, prompt injection rebuff, audit tamper, secret extraction, rate-limit bypass),
So that ao assinar M1 tenho assurance verificável que os 8 vectors mais relevantes estão fechados.

**StorySpec:**
- type: `foundational` · epic: E1.b · sprint: 0 · pri_feature: foundational (safety)
- blocked_by: [1.b.1, 1.b.2, 1.b.3, 1.b.4]
- files_created: `tests/security/pt-1-sandbox.test.ts`, `tests/security/pt-2-path-traversal.test.ts`, `tests/security/pt-3-redaction.test.ts`, `tests/security/pt-4-ssrf.test.ts`, `tests/security/pt-5-prompt-injection.test.ts`, `tests/security/pt-6-audit-tamper.test.ts`, `tests/security/pt-7-secret-extract.test.ts`, `tests/security/pt-8-ratelimit-bypass.test.ts`, `scripts/pentest-report.ts`
- files_modified: `.github/workflows/ci.yml` (add security suite job)
- ao_subset: [AR-076, AO-86 escalation gate Day 7 check]
- estimated_tokens: { dev_core: 80K, dev_with_retry: 120K }

**Acceptance Criteria:**

**Given** suite security
**When** corro `bun test:security`
**Then** 8/8 PT tasks pass (coverage AC)
**And** report gerado em `_bmad-output/security/pentest-report-<date>.md` (binary AC)

**Given** Day 7 do Sprint 0
**When** corro `bun run check:webhook-schema`
**Then** se schema clihelper inbound real recebido → script confirma + remove `webhook-mock` feature flag
**And** se schema ainda não recebido → script regista `[OPEN]` em `bmad-check-implementation-readiness` + mantém `webhook-mock=true` (binary AC — escalation gate Pre-Mortem PM-5)

---

## Epic 1.c: Bootstrap & Operations (Sprint 0)

> systemd + secrets + Litestream + CI + SSH + runbooks + `bmad-cli` smoke
> test final. 7 stories.

### Story 1.c.1: systemd unit Type=simple + /healthz endpoint

As a `operador` (operations),
I want systemd unit `hdd-worker.service` (Type=simple) + Hono `/healthz` endpoint pollável por Healthchecks.io,
So that worker é supervisionado sem `sd_notify` (Bun gotcha) e operador é notificado em flap.

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9
- blocked_by: [1.a.7]
- files_created: `systemd/hdd-worker.service`, `systemd/hdd-worker.env.example`, `src/cli/healthz.handler.ts`, `tests/cli/healthz.test.ts`, `docs/runbooks/systemd-deploy.md`
- files_modified: `src/cli/hdd-worker.ts` (start mounts Hono `/healthz`)
- ao_subset: [AR-020, NFR-P1, project-hdd-bun-sd-notify-gotcha memory]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** systemd unit installed
**When** `systemctl start hdd-worker`
**Then** unit active em <30s (NFR-P1 binary AC)
**And** `curl http://localhost:8080/healthz` retorna `{status: "ok", uptime: <s>}` 200 (binary AC)

**Given** worker em deadlock simulado
**When** Healthchecks.io poll timeout 60s
**Then** alerta dispara via WhatsApp `hdd_heartbeat` template (binary AC — depende de E3 stub; M1 mínimo)

### Story 1.c.2: Secrets management EnvironmentFile

As a `operador` (operations),
I want secrets em `/etc/hdd/secrets.env` (perm 0600, user `hdd-worker`, ConditionPathExists no systemd) + validação envalid/Zod no boot,
So that segredos nunca aparecem em workspace nem ficam acessíveis a outro user na VPS.

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9
- blocked_by: [1.a.7, 1.c.1]
- files_created: `scripts/install-secrets.sh`, `docs/runbooks/secret-rotation.md`, `tests/lib/env-secrets.test.ts`
- files_modified: `systemd/hdd-worker.service` (add `EnvironmentFile=/etc/hdd/secrets.env` + `ConditionPathExists`), `src/lib/env.ts` (Zod schema)
- ao_subset: [NFR-S1, AR-019, D-04.6']
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** ficheiro `/etc/hdd/secrets.env` perm `0644` (mal configurado)
**When** systemd tenta iniciar
**Then** unit fails com `ConditionPathExists` ou explicit boot check rejeita perm laxa (binary AC)

**Given** secrets contém `ANTHROPIC_API_KEY=...` valido + `CLIHELPER_TOKEN=...`
**When** worker arranca
**Then** `env.ts` Zod schema valida e expõe typed object (binary AC)
**And** zero linha de log/audit contém valor do secret (depende de redaction Story 1.b.3) (binary AC)

### Story 1.c.3: Litestream supervisor + R2 EU + rclone

As a `operador` (operations),
I want Litestream streaming WAL → Cloudflare R2 EU + rclone secundário (dump diário gzipped) + runbook de restore,
So that crash de VPS ou disk failure não perde state nem audit.

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9 + F5
- blocked_by: [1.a.5, 1.c.2]
- files_created: `systemd/litestream.service` (supervisor), `litestream.yml`, `scripts/rclone-daily-backup.sh`, `docs/runbooks/litestream-restore.md`, `tests/integration/backup-restore.test.sh`
- files_modified: `systemd/hdd-worker.service` (depend on litestream.service)
- ao_subset: [AR-014, D-04.21, project-hdd-stack-v2-bun memory]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** db `data.db` em WAL mode + Litestream activo
**When** simulo crash worker + restore em VPS limpa
**Then** db restaurado com ≤24h de retention loss (D-04.21) (binary AC)

**Given** R2 EU bucket `hdd-backup`
**When** rclone daily corre via cron
**Then** dump `data-<date>.db.gz` aparece no bucket secundário (binary AC)

### Story 1.c.4: CI GitHub Actions + bun build --compile + Renovate

As a `operador`,
I want GitHub Actions workflow que corre lint + test (incl. security suite) + `bun build --compile` + Docker pre-pull em <60s, com Renovate config para dependency updates,
So that toda push valida invariantes antes de merge e dependências ficam actualizadas com PR automático.

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9
- blocked_by: [1.b.5]
- files_created: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `renovate.json`, `scripts/measure-ci-time.sh`
- files_modified: —
- ao_subset: [AR-017, AR-111, D-04.11', NFR-P1]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** push em branch
**When** CI corre
**Then** total wall-clock <60s (binary AC AR-017)
**And** jobs: lint, test, test:security, build:compile, prepull:sandbox-image (binary AC)

**Given** `bun build --compile --outfile=dist/hdd-worker src/main.ts`
**When** binário corre em VPS limpa sem Bun instalado
**Then** worker arranca em <30s (NFR-P1 binary AC)

### Story 1.c.5: SSH restricted deploy

As a `operador`,
I want SSH `authorized_keys` com `command="/opt/hdd/scripts/deploy.sh"` restriction + script regista commit SHA no audit JSONL,
So that operador faz deploy via `ssh hdd-worker@vps deploy` sem expor shell livre.

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9
- blocked_by: [1.a.6, 1.c.4]
- files_created: `scripts/deploy.sh`, `scripts/install-authorized-keys.sh`, `docs/runbooks/ssh-deploy.md`, `tests/integration/deploy.test.sh`
- files_modified: —
- ao_subset: [NFR-S6, AR-112, D-04.25]
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** SSH key restricted
**When** operador conecta via `ssh hdd-worker@vps`
**Then** shell livre rejected; apenas `deploy.sh` executado (binary AC)

**Given** `ssh hdd-worker@vps deploy abc1234`
**When** deploy completa
**Then** audit event `DeployCompleted` com `commitSha: 'abc1234'` (binary AC)

### Story 1.c.6: 8 Runbooks must-have

As a `operador` (futuro 1 ano depois ou colaborador eventual),
I want 8 runbooks em `docs/runbooks/`: `secret-rotation`, `ban-Anthropic-emergency`, `litestream-restore`, `hash-chain-corruption`, `whatsapp-template-rejection`, `clihelper-endpoint-down`, `vps-disk-full`, `manual-rollback`,
So that incident response não depende de memória dum único humano (Future operador lesson).

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F9
- blocked_by: [1.c.2, 1.c.3]
- files_created: 8× `docs/runbooks/<name>.md`, `docs/runbooks/index.md`
- files_modified: —
- ao_subset: [AR-110, D-04.24, feedback-hdd-soft-convention-rot memory]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** todos os 8 runbooks committed
**When** scan automático `scripts/runbook-completeness.sh`
**Then** cada runbook tem secções: Symptom · Diagnostic · Recovery Steps · Verification · Post-mortem template (binary AC ≥5/5 sections per runbook)

### Story 1.c.7: bmad-cli smoke test + Plan B fork docs

As a `operador` (Sprint 0 Day 1 ou final close),
I want um smoke test que verifica `bmad-cli` non-interactive funciona end-to-end OU activa Plan B (Claude Code headless / re-implement subset),
So that Sprint 0 close confirma o invariante operacional crítico do worker (sem isto, E2 BMAD invoker é impossível).

**StorySpec:**
- type: `foundational` · epic: E1.c · sprint: 0 · pri_feature: F4 + foundational
- blocked_by: []  *(Day 1 — corre primeiro)*
- files_created: `scripts/smoke-bmad-cli.sh`, `docs/decisions/bmad-cli-vs-plan-b.md`, `tests/integration/bmad-cli.test.sh`
- files_modified: —
- ao_subset: [AR-077, AR-078, FR-006, FR-081, project-hdd-openclaw-substituted-by-bun memory]
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** BMAD v6.7.1 instalado
**When** corro `bash scripts/smoke-bmad-cli.sh`
**Then** invoca `bmad-help` non-interactive + captura stdout + exit 0 em <30s (binary AC)

**Given** smoke test falha
**When** corre `docs/decisions/bmad-cli-vs-plan-b.md`
**Then** documento decide entre: (a) Claude Code headless 4-6h, (b) re-implement subset BMAD em TS 4-6h, (c) defer worker autonomous, manter Modo Colaborativo extended (binary AC — decisão registada antes de continuar)

---

## Epic 2: Worker Autónomo & Pipeline Bimodal (Sprint 1)

> CLI `hdd-worker` + BMAD invoker + sub-agent contexts + gates Story→Dev e
> Dev→Review + lifecycle subcommands. 7 stories.

### Story 2.1: hdd-worker CLI Commander scaffold

As a `operador`,
I want `hdd-worker` CLI Commander com subcomandos `start <project>`, `pause`, `resume`, `status`, `logs`, `review approve|request-changes|reject`,
So that opero o worker via terminal sem invocar TypeScript directamente.

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F4
- blocked_by: [1.a.7, 1.a.8, 1.c.7]
- files_created: `src/cli/hdd-worker.ts`, `src/cli/start.command.ts`, `src/cli/status.command.ts`, `src/cli/logs.command.ts`, `tests/cli/commands.test.ts`
- files_modified: `package.json` (bin entry), `src/main.ts`
- ao_subset: [FR-031, NFR-U4]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** binário compilado
**When** corro `hdd-worker --help`
**Then** lista todos subcomandos com `--help` claro (binary AC NFR-U4)

**Given** worker corrido com `hdd-worker start projeto_hdd`
**When** corro `hdd-worker status` noutro terminal
**Then** retorna estado em ≤2s (NFR-O1 binary AC)

### Story 2.2: BMAD invoker port + CLI-wrapper adapter

As a `worker core`,
I want `BmadInvokerPort` com adapter `cli-wrapper.adapter.ts` que dispara skills BMAD non-interactive e parseia output,
So that worker pode invocar `bmad-sprint-planning`, `bmad-dev-story`, `bmad-code-review` etc. programaticamente.

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F1 + F4
- blocked_by: [1.a.3, 1.c.7, 2.1]
- files_created: `src/ports/bmad-invoker.port.ts`, `src/adapters/bmad/cli-wrapper.adapter.ts`, `tests/adapters/bmad-invoker.test.ts`
- files_modified: —
- ao_subset: [FR-002, FR-006, FR-033, AR-077]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** BMAD smoke test passou (1.c.7)
**When** invoker chama `invoker.run('bmad-help')`
**Then** retorna `ok({stdout, stderr, exitCode: 0})` em <30s (binary AC)

**Given** invoker chama skill que produz JSON output
**When** parser corre
**Then** retorna `ok<SkillOutput>` com schema validado por Zod (binary AC)
**And** schema validation falha → `err({kind: 'BmadOutputMalformed'})` (binary AC)

**Given** sub-agent completou um passo intermédio (e.g. Dev produziu diff)
**When** invoker recebe output
**Then** wrapper invoca `bmad_save_artifact` lifecycle hook automaticamente (binary AC — **FR-005 enforcement**)

**Given** sub-agent completou um workflow (e.g. story end-to-end)
**When** invoker recebe terminal output
**Then** wrapper invoca `bmad_complete_workflow` lifecycle hook + state transition (binary AC — **FR-005 enforcement**)

### Story 2.3: Sub-agent context isolation per workflow

As a `worker core`,
I want que cada sub-agente (Dev / Review / QA) corra em contexto isolado com seu próprio `RunContext` (runId, storyId, traceId) + workdir limitado + audit subsystem dedicado,
So that artefactos cruzados entre sub-agentes não contaminam state.

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F1
- blocked_by: [1.a.9, 2.2]
- files_created: `src/services/sub-agent-runner.service.ts`, `src/lib/workdir-mount.ts`, `tests/services/sub-agent-runner.test.ts`
- files_modified: —
- ao_subset: [FR-004, AR-039, NFR-R3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** sub-agent Dev corre em contexto A; sub-agent Review corre em contexto B
**When** ambos audit `append` no mesmo tick
**Then** linhas JSONL têm `runId` e `subAgent` distintos (property AC)

**Given** sub-agent Dev escreve em `workdir A`
**When** sub-agent Review tenta ler `workdir A`
**Then** apenas via API explícita `handoffArtifact(from, to, paths)` (binary AC — não direct fs access)

**Given** Dev sub-agent retorna diff com path `../etc/passwd` ou absolute path fora do workdir
**When** sub-agent-runner aplica o diff
**Then** `apply-diff.service` (Story 1.b.1) é invocado e rejeita com `err({kind: 'PathTraversal'})` (binary AC — **wiring enforcement Pre-Mortem Party Mode #2 AI Safety**)
**And** Dev sub-agent **nunca** escreve directamente no filesystem (binary AC — todo write passa por `apply-diff.service`)

### Story 2.4: Gate Story→Dev — AC validation

As a `Worker`,
I want um gate antes de dispatching `bmad-dev-story` que valida AC completos (≥1 Given/When/Then, files_created definido, ao_subset não vazio) na story spec,
So that Dev não arranca em story mal-formed (FR-050 part 1).

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F6
- blocked_by: [2.2]
- files_created: `src/services/gates/story-to-dev.gate.ts`, `src/lib/story-spec-validator.ts`, `tests/gates/story-to-dev.test.ts`
- files_modified: `src/core/fsm.ts` (add gate state)
- ao_subset: [FR-050, FR-051, FR-052, AR-054]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** story com `acceptance_criteria: []` (vazio)
**When** gate corre
**Then** retorna `err({kind: 'GateFailure', gate: 'Story→Dev', reason: 'no AC defined', evidence: <story_id>})` (binary AC)
**And** audit event `GateFailed` registado (binary AC FR-051)
**And** diagnostic estruturado em `_bmad-output/diagnostics/<story_id>-gate-fail.md` (binary AC FR-052)

### Story 2.5: Gate Dev→Review — test suite verde

As a `Worker`,
I want um gate após `bmad-dev-story` que valida (a) `bun test` exit 0 (b) `bun run lint` exit 0 (c) `files_created` correspondem ao declarado,
So that Review não recebe diff broken nem code com lint errors (FR-050 part 2).

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F6
- blocked_by: [2.4]
- files_created: `src/services/gates/dev-to-review.gate.ts`, `tests/gates/dev-to-review.test.ts`
- files_modified: —
- ao_subset: [FR-050, FR-051, FR-052]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** Dev completou story
**When** gate corre `bun test` que falha
**Then** retorna `err({kind: 'GateFailure', gate: 'Dev→Review', reason: 'tests red'})` + audit + diagnostic + retry counter incremented (binary AC)

**Given** retry counter atinge 5 (FR-012 — vai trigger S2 em E4)
**When** gate falha 5ª vez
**Then** retorna `err({kind: 'RetryExhausted'})` para upstream FSM (binary AC — wiring para S2)

### Story 2.6: Worker lifecycle start/pause/resume

As a `operador`,
I want `hdd-worker start`, `pause`, `resume` que persiste state em db e sobrevive crash,
So that posso parar overnight e continuar manhã sem perder progresso.

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F4
- blocked_by: [1.a.4, 1.a.5, 2.1]
- files_created: `src/services/worker-lifecycle.service.ts`, `src/cli/pause.command.ts`, `src/cli/resume.command.ts`, `tests/services/lifecycle.test.ts`
- files_modified: `src/cli/hdd-worker.ts`
- ao_subset: [FR-031, FR-032 partial, FR-040, NFR-R3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** worker correndo story #3
**When** corro `hdd-worker pause`
**Then** FSM transita `running → paused_for_interrupt` + audit event + responde em ≤2s (binary AC)

**Given** worker pausado
**When** corro `hdd-worker resume`
**Then** carrega state do db + FSM retoma de onde parou (binary AC)

**Given** worker correndo
**When** simulo `kill -9` + restart manual
**Then** boot recovery detecta in-flight story + FSM em estado consistente (binary AC — E5 entrega recovery boot completo)

**Given** worker dispara acção catalogada como `irreversibleActions` (deploy, branch-delete, force-push, schema-drop, audit-purge)
**When** lifecycle service intercepta a chamada
**Then** **antes** de executar consulta `confirmation-gate.service.requireTwoStep(action)` (Story 1.b.2) e bloqueia até `IrrevConfirmYes` Quick Reply OU CLI flag `--i-really-mean-it` (binary AC — **wiring enforcement Pre-Mortem Party Mode #2 AI Safety**)
**And** test: tentar `deploy` via lifecycle sem confirmation devolve `err({kind: 'ConfirmationRequired'})` (binary AC)

### Story 2.7: DevOutput / ReviewOutput / QAOutput schemas concretos

As a `BMAD invoker`,
I want schemas Zod concretos para `DevOutput`, `ReviewOutput`, `QAOutput` em `src/ports/sub-agent-outputs.port.ts`,
So that parsing de output dos sub-agents é type-safe e BMAD CLI deviations são detectadas em runtime.

**StorySpec:**
- type: `feature` · epic: E2 · sprint: 1 · pri_feature: F1
- blocked_by: [2.2]
- files_created: `src/ports/sub-agent-outputs.port.ts`, `tests/ports/sub-agent-schemas.test.ts`
- files_modified: `src/adapters/bmad/cli-wrapper.adapter.ts` (use schemas)
- ao_subset: [AR-050, AR-051, AR-052]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** schema `DevOutput` definido conforme Architecture Step 06
**When** Dev sub-agent retorna JSON com campo extra inesperado
**Then** Zod `strict` mode rejeita com `err({kind: 'SchemaDrift', field: <field>})` (binary AC)

**Given** schema `ReviewOutput` exige `verdict: 'pass' | 'fail-gap' | 'fail-bug'`
**When** sub-agent retorna `verdict: 'unsure'`
**Then** schema rejeita (binary AC)

---

## Epic 3: Canal WhatsApp (clihelper) + Fallback E-mail (Sprint 1)

> Adapter outbound + leaky bucket + 6 templates + listener inbound + NLP
> Haiku + Resend fallback. 6 stories.

### Story 3.1: OutboundNotifyPort + clihelper adapter

As a `worker`,
I want `OutboundNotifyPort` interface + `clihelper.adapter.ts` que faz POST aos endpoints com `Authorization` header + payload schema clihelper,
So that worker tem porta única para enviar mensagens, com adapter swappable (Telegram, Signal v1.1+).

**StorySpec:**
- type: `feature` · epic: E3 · sprint: 1 · pri_feature: F3
- blocked_by: [1.a.3, 1.a.5]
- files_created: `src/ports/outbound-notify.port.ts`, `src/adapters/whatsapp/clihelper.adapter.ts`, `src/adapters/whatsapp/payload-schema.ts`, `tests/adapters/clihelper.test.ts`
- files_modified: —
- ao_subset: [FR-020, FR-021, FR-022, FR-023, AR-100]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** adapter configurado com `CLIHELPER_BASE_URL` + token
**When** chamo `notify.sendTemplate({template: 'hdd_interrupt_p1', vars: {...}, queueId})`
**Then** POST ao endpoint com Authorization header + payload Zod-validated (binary AC)
**And** dry-run mode (`NOTIFY_DRY_RUN=true`) loga sem POST real (binary AC — útil pre-template-approval)

### Story 3.2: Leaky bucket 1 req/s + retry + circuit breaker

As a `clihelper adapter`,
I want um leaky bucket queue interno que enforce 1 req/s + retry exponencial (base 2s, max 5, max delay 60s) em 429/5xx + circuit breaker (5 falhas / 1min),
So that não excedemos rate-limit e falhas transitórias não cascateiam para FSM.

**StorySpec:**
- type: `feature` · epic: E3 · sprint: 1 · pri_feature: F3
- blocked_by: [3.1]
- files_created: `src/lib/leaky-bucket.ts`, `src/lib/retry-policy.ts`, `src/lib/circuit-breaker.ts`, `tests/lib/leaky-bucket.test.ts`, `tests/lib/retry.property.test.ts`
- files_modified: `src/adapters/whatsapp/clihelper.adapter.ts` (wrap with bucket+retry+CB)
- ao_subset: [FR-025, FR-027, AR-038, D-04.7]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** 10 sends enfileirados em 1s
**When** bucket processa
**Then** primeiro send em t=0; último em t≥9s (property AC)

**Given** clihelper responde 429 com `Retry-After: 5s`
**When** adapter recebe
**Then** retry após 5s (binary AC)

**Given** 5 falhas consecutivas em 1 min
**When** chega 6º request
**Then** circuit breaker open → retorna `err({kind: 'CircuitOpen', resetAt: <date>})` sem POST (binary AC)

### Story 3.3: 6 templates UTILITY — design + register tracking

As a `operador` (operations),
I want especificação e tracking de submissão dos 6 templates UTILITY (`hdd_interrupt_p1`, `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_summary_finalization`, `hdd_heartbeat`, `hdd_release_final`),
So that operador submete a Meta no clihelper UI e M1 mínimo (3 aprovados) é trackable.

**StorySpec:**
- type: `docs` · epic: E3 · sprint: 0 ou Sprint 1 inicio (template approval lead time 1-3 dias) · pri_feature: F3
- blocked_by: []
- files_created: `_bmad-output/planning-artifacts/whatsapp-templates-utility.md` (já existe — refinar), `src/lib/template-catalog.ts`, `scripts/template-submission-status.ts`
- files_modified: —
- ao_subset: [FR-026, AR-070]
- estimated_tokens: { dev_core: 40K, dev_with_retry: 48K }

**Acceptance Criteria:**

**Given** spec de 6 templates em `whatsapp-templates-utility.md`
**When** operador submete a Meta via clihelper
**Then** `scripts/template-submission-status.ts` lê catálogo e produz checklist com estado por template (binary AC — manual tracking, sem API)

**Given** Day 7 do Sprint 0
**When** 3 templates mínimos aprovados (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`)
**Then** M1 minimum viable threshold met (binary AC — gate para E7.b start)

### Story 3.4: InboundCommandPort + Hono /callback + Quick Reply parsing

As a `operador`,
I want endpoint `POST /callback` (Hono) que recebe callbacks do app operador, valida Zod minimal schema **drop-at-ingress**, parseia Quick Reply payloads contra `interrupt-commands.ts` contract,
So that respostas no telemóvel chegam ao worker como events tipados.

**StorySpec:**
- type: `feature` · epic: E3 · sprint: 1 · pri_feature: F3
- blocked_by: [1.a.4]
- files_created: `src/ports/inbound-command.port.ts`, `src/adapters/whatsapp/callback-listener.adapter.ts`, `src/adapters/whatsapp/callback-schema.ts`, `tests/adapters/callback-listener.test.ts`, `tests/adapters/callback.security.test.ts`
- files_modified: `src/cli/start.command.ts` (mount listener)
- ao_subset: [FR-024, AR-101, project-hdd-n8n-topology memory, AO-86 with mock flag]
- estimated_tokens: { dev_core: 72K, dev_with_retry: 108K }

**Acceptance Criteria:**

**Given** `webhook-mock=true` flag (Day 7 escalation if schema not received)
**When** POST `/callback` chega com payload de fixture
**Then** stub schema `z.unknown()` permitido + audit warning `[OPEN AO-86]` (binary AC)

**Given** payload contém Quick Reply `payload: "p1_continuar_assim"` + `wa_id` operador (allowlist)
**When** parser corre
**Then** retorna `ok({kind: 'P1Continuar', wa_id, runId, storyId})` (binary AC)

**Given** payload de `wa_id` não-allowlisted
**When** chega ao listener
**Then** drop-at-ingress retorna 200 (não 401 para não vazar info) + audit event `UnauthorizedInbound` (binary AC — defense in depth)

**Given** payload inbound contém `Authorization: Bearer <token>` ou `wa_id: 5511...` raw
**When** listener invoca `audit.append({kind: 'InboundCallback', payload})`
**Then** linha JSONL escrita já contém valores redacted via filter Story 1.b.3 (binary AC — **wiring enforcement Pre-Mortem Party Mode #2 AI Safety**; redaction layer é **pre-write**, nunca pós-write)
**And** test fixture com 3 secrets injectados produz 0 occurrences raw no JSONL (coverage AC 3/3)

### Story 3.5: NLP fallback livre via Haiku SDK

As a `inbound listener`,
I want um parser NLP via Anthropic SDK Haiku 4.5 que classifica resposta livre do operador em intent (`approve`, `request-changes`, `reject`, `p1-continuar`, `p1-pausar`, `unknown`),
So that operador pode responder em texto livre PT-PT no telemóvel e o worker entende.

**StorySpec:**
- type: `feature` · epic: E3 · sprint: 1 · pri_feature: F3 + F7
- blocked_by: [3.4, 1.a.10]
- files_created: `src/services/intent-classifier.service.ts`, `src/services/intent-prompts.ts`, `tests/services/intent-classifier.test.ts` (com fixtures PT-PT)
- files_modified: `src/adapters/whatsapp/callback-listener.adapter.ts` (fallback to NLP se Quick Reply ausente)
- ao_subset: [FR-024 parte NLP, AR-091, project-hdd-cost-optimal-llm memory]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** fixture com 30 frases PT-PT (`"sim, avanca"`, `"não, espera"`, `"rejeita esta"`, etc.)
**When** classifier corre via Haiku
**Then** **≥27/30** correctly classified (coverage AC; threshold absoluto fixado per PM2-3 Q1; calibrate Sprint 1)
**And** Haiku token consumption logged + estimated cost <R$0.01/parse (property AC)

**Given** resposta ambígua (`"talvez"`, `"depois decido"`)
**When** classifier corre
**Then** retorna `intent: 'unknown'` + worker mantém `paused_awaiting_review` (binary AC — fail safe)

### Story 3.6: ResendAdapter fallback S3

As a `worker`,
I want `ResendAdapter` (e-mail via Resend SDK) + activation logic que troca canal em Trigger S3 (3 mensagens / 10 min sem confirmação WhatsApp),
So that pipeline não pára em falha clihelper — muda canal e segue.

**StorySpec:**
- type: `feature` · epic: E3 · sprint: 1 · pri_feature: F3
- blocked_by: [3.1]
- files_created: `src/adapters/email/resend.adapter.ts`, `src/services/channel-fallback.service.ts`, `tests/services/channel-fallback.test.ts`, `templates/email/interrupt-*.html`
- files_modified: `src/ports/outbound-notify.port.ts` (already defined; resend implements same port)
- ao_subset: [FR-029, FR-015, AR-100 fallback, NFR-R5]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** worker enviou 3 mensagens WhatsApp em 10 min sem confirmation
**When** S3 timer expira
**Then** channel-fallback troca `OutboundNotifyPort` para Resend (binary AC)
**And** pipeline **NÃO pausa** (FSM continua `running`) (binary AC FR-015)
**And** próximas mensagens vão por e-mail até action explícita operador (binary AC)

**Given** Resend retorna 4xx
**When** adapter recebe
**Then** retorna `err({kind: 'Permanent'})` + audit event `FallbackChannelDown` + WhatsApp `hdd_heartbeat` (best-effort) (binary AC)

---

## Epic 4: Regra de Interrupt (P1 + S1/S2/S3) (Sprint 1)

> Trigger P1 gap detector + S1 watchdog + S2 contador retries + S3 timeout
> WhatsApp + gate Review→QA. 5 stories.

### Story 4.1: Trigger P1 — gap detector no bmad-code-review

As a `Reviewer sub-agent`,
I want que `bmad-code-review` customizado classifique gaps PRD/Arq↔Código via heurística textual + agent self-check (`"isto está coberto pelo PRD?"`),
So that worker pausa e contacta operador em ambiguidade real (não em falsos positivos triviais).

**StorySpec:**
- type: `feature` · epic: E4 · sprint: 1 · pri_feature: F2 (P1)
- blocked_by: [3.1, 3.5, 1.a.10]
- files_created: `src/services/gap-detector.service.ts`, `src/services/gap-prompts.ts`, `tests/services/gap-detector.test.ts` (fixtures de PRD + diff), `docs/conventions/p1-heuristics.md`
- files_modified: `src/services/sub-agent-runner.service.ts` (post-review hook)
- ao_subset: [FR-010, AR-091, OQ-A in PRD]
- estimated_tokens: { dev_core: 72K, dev_with_retry: 108K }

**Acceptance Criteria:**

**Given** fixture: diff `auth.ts` adiciona OAuth GitHub + PRD não menciona GitHub
**When** gap detector corre via Haiku self-check + heurística
**Then** retorna `verdict: 'fail-gap', evidence: "PRD §3.2 only specifies Google OAuth"` (binary AC)

**Given** fixture: diff refactor interno sem touch produto
**When** gap detector corre
**Then** retorna `verdict: 'pass'` (binary AC — não trigger P1 trivial)

**Given** detector classifies gap
**When** worker recebe
**Then** FSM transita `running → paused_for_interrupt` + envia `hdd_interrupt_p1` via E3 + state snapshot (binary AC FR-014)

### Story 4.2: Trigger S1 — watchdog timer

As a `worker`,
I want um watchdog timer por story (default 30 min, configurável) que dispara S1 quando não há `progress event` na audit chain,
So that worker travado em silêncio é detectado e operador notificado.

**StorySpec:**
- type: `feature` · epic: E4 · sprint: 1 · pri_feature: F2 (S1)
- blocked_by: [1.a.3, 1.a.6, 3.1]
- files_created: `src/services/watchdog.service.ts`, `tests/services/watchdog.test.ts`
- files_modified: `src/services/sub-agent-runner.service.ts` (emit progress events)
- ao_subset: [FR-011, FR-014, AR-039]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** watchdog config `timeoutMs: 1800000` (30 min) + worker running story
**When** 30 min sem progress event no audit
**Then** dispara S1 → envia `hdd_interrupt_s1` via E3 + FSM `paused_for_interrupt` (binary AC)

**Given** TestClock + watchdog
**When** `clock.advance(29 * 60 * 1000)` sem progress
**Then** S1 não dispara (property AC — boundary)

**Given** progress event chega
**When** watchdog recebe
**Then** timer reset (property AC)

### Story 4.3: Trigger S2 — contador retries

As a `worker`,
I want um contador de retries por failure mode (test failure, lint failure, gap recurrent) que dispara S2 em 5 consecutivas sem progresso real,
So that loop infinito de tentativa LLM é cortado.

**StorySpec:**
- type: `feature` · epic: E4 · sprint: 1 · pri_feature: F2 (S2)
- blocked_by: [2.5, 3.1]
- files_created: `src/services/retry-counter.service.ts`, `tests/services/retry-counter.test.ts`
- files_modified: `src/services/gates/dev-to-review.gate.ts` (increment counter on fail)
- ao_subset: [FR-012, FR-014, OQ-C in PRD]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** retry counter = 0 + Dev→Review gate fail 5×
**When** 5ª falha registada
**Then** dispara S2 → envia `hdd_interrupt_s2` com último erro + diff da última tentativa (binary AC)

**Given** retry counter = 3 + Dev produz diff diferente + gate pass
**When** próxima story arranca
**Then** counter reset para 0 (binary AC — progress real)

### Story 4.4: Trigger S3 — timeout-poll WhatsApp → Resend

As a `worker`,
I want timeout-poll que envia até 3 mensagens em 10 min e dispara S3 se nenhuma confirmação chegar, activando channel fallback,
So that endpoint clihelper indisponível não pára o pipeline.

**StorySpec:**
- type: `feature` · epic: E4 · sprint: 1 · pri_feature: F2 (S3) + F3
- blocked_by: [3.4, 3.6]
- files_created: `src/services/whatsapp-confirmation-poll.service.ts`, `tests/services/s3-trigger.test.ts`
- files_modified: `src/services/channel-fallback.service.ts` (wire poll → fallback)
- ao_subset: [FR-013, FR-015, NFR-R5]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** worker envia mensagem WhatsApp em t=0; sem callback até t=200s
**When** poll dispara 2ª em t=200s + 3ª em t=400s sem callback
**Then** em t≥600s S3 dispara → channel-fallback activa Resend (binary AC)
**And** pipeline **NÃO pausa** (FSM `running`) (binary AC FR-015)

**Given** WhatsApp callback chega em t=150s
**When** poll recebe confirmação
**Then** S3 timer cancelled + audit `ConfirmationReceived` (binary AC)

### Story 4.5: Gate Review→QA — PRD/Arq consistency check

As a `Worker`,
I want gate após Review que valida consistência PRD/Arq vs implementação (Reviewer verdict + gap detector verdict + AOs aplicados batem com `ao_subset` da story),
So that QA não recebe story que tem gap PRD por resolver.

**StorySpec:**
- type: `feature` · epic: E4 · sprint: 1 · pri_feature: F6 (Review→QA)
- blocked_by: [4.1]
- files_created: `src/services/gates/review-to-qa.gate.ts`, `tests/gates/review-to-qa.test.ts`
- files_modified: —
- ao_subset: [FR-050, FR-052]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** Reviewer verdict `fail-gap` ou gap detector positivo
**When** gate corre
**Then** retorna `err({kind: 'GateFailure', gate: 'Review→QA', reason: 'PRD gap unresolved'})` + dispara P1 via E4.1 (binary AC)

**Given** verdict `pass` + ao_subset coverage validated
**When** gate corre
**Then** retorna `ok({proceed: 'QA'})` + audit `GatePassed` (binary AC)

---

## Epic 5: Crash Recovery & Rollback Stub (Sprint 1)

> Recovery boot + crash drills + rollback stub. 3 stories (foundational
> idempotency keys ficou em E1.a — Pre-Mortem PM-2).

### Story 5.1: Recovery boot — detector in-flight + resume

As a `worker`,
I want que ao boot, o worker detecte stories in-flight (row em `runs` com `status=running` mas processo morto) e retome do último checkpoint seguro,
So that crash de VPS / kill -9 / network blip não perde progresso de story.

**StorySpec:**
- type: `feature` · epic: E5 · sprint: 1 · pri_feature: F5
- blocked_by: [1.a.5, 1.a.7, 2.6]
- files_created: `src/services/recovery-boot.service.ts`, `tests/services/recovery-boot.test.ts`
- files_modified: `src/bootstrap.ts` (call recovery before FSM start)
- ao_subset: [FR-032, NFR-R1, NFR-R4]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** db tem story `s1` em `status=running` + `last_audit_event=StoryStarted`
**When** worker boot corre
**Then** recovery service identifica `s1` como in-flight + transita FSM para state correspondente ao último audit event seguro (binary AC)

**Given** story tinha `status=running` + último event `IdempotencyKeyCommitted` (key existe) mas `side-effect` event não registado
**When** recovery corre
**Then** worker re-tenta side-effect (idempotency dedupe) sem duplicar (binary AC — commit-before-side-effect invariante)

### Story 5.2: Crash drill test suite

As a `operador`,
I want suite `bun test:crash` que executa 4 cenários de `kill -9` em pontos identificados (entre commit/side-effect, durante POST WhatsApp, entre retries, em audit append) e valida no duplicates + no losses pós-restart,
So that tenho assurance documentada de idempotência por story.

**StorySpec:**
- type: `feature` · epic: E5 · sprint: 1 · pri_feature: F5
- blocked_by: [5.1]
- files_created: `tests/crash/scenario-1-commit-before-effect.test.ts`, `tests/crash/scenario-2-during-post.test.ts`, `tests/crash/scenario-3-between-retries.test.ts`, `tests/crash/scenario-4-audit-append.test.ts`, `scripts/crash-drill.sh`
- files_modified: —
- ao_subset: [FR-041, NFR-R1, NFR-R2, NFR-R4, Pre-Mortem PM-2]
- estimated_tokens: { dev_core: 72K, dev_with_retry: 108K }

**Acceptance Criteria:**

**Given** scenario 1: worker commit idempotency key → kill -9 → restart
**When** drill corre
**Then** side-effect ocorre exactly-once pós-restart (binary AC)

**Given** scenario 2: kill -9 durante POST WhatsApp
**When** drill corre
**Then** pós-restart: 0 mensagens duplicadas; status final `delivered` se POST atingiu clihelper (binary AC)

**Given** all 4 scenarios
**When** `bun test:crash`
**Then** 4/4 pass (coverage AC)

### Story 5.3: Rollback parcial stub v1

As a `Worker`,
I want detector de cenário "resposta WhatsApp invalida stories já feitas" que emite Trigger P1 (não auto-rollback) com contexto das stories afectadas,
So that operador toma decisão consciente (AO-43 auto-rollback diferido v1.1+).

**StorySpec:**
- type: `feature` · epic: E5 · sprint: 1 · pri_feature: F5
- blocked_by: [4.1]
- files_created: `src/services/rollback-stub.service.ts`, `tests/services/rollback-stub.test.ts`, `docs/decisions/rollback-deferred.md`
- files_modified: —
- ao_subset: [FR-043, AO-43 deferred]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** operador responde "afinal OAuth deve ser só Google" e há 3 stories já completas que usaram GitHub
**When** rollback-stub detecta divergência via audit scan
**Then** emite Trigger P1 com `{kind: 'RollbackNeeded', affected_stories: ['s12','s13','s14'], original_response: '...'}` (binary AC)
**And** **não** executa auto-rollback (binary AC — v1.1+ deferred)

---

## Epic 6.a: Janela LLM Telemetry & 80% Notify (Sprint 1 must-have)

> Adapter Anthropic dual-mode + telemetry % janela + 80% notify + pause
> hardcoded em exhausted. Sem downgrade (E6.b Sprint 2). 3 stories.

### Story 6.a.1: LLM Dispatcher + cache strategy + role-based selection

As a `worker`,
I want `LLMDispatcher` service que decide adapter + modo de acesso por papel e fase (D-050): Dev/Reviewer/QA → `AnthropicSDKAdapter` Sonnet via API (default, ToS-safe); classifier/gap-detector → `AnthropicSDKAdapter` Haiku; roles de planejamento + overflow configurável → `ClaudeCliAdapter` Sonnet via Max 20x. Aplica `cache_control: ephemeral` em prompts longos + reusa `sessionId`/cache entre invocações,
So that worker usa modelo+modo certo por papel com custo controlado (cost cap USD + overflow Max 20x) e cache reuse.

**StorySpec:**
- type: `feature` · epic: E6.a · sprint: 1 · pri_feature: F7
- blocked_by: [1.a.10]
- files_created: `src/services/llm-dispatcher.service.ts`, `src/services/llm-role-policy.ts`, `tests/services/llm-dispatcher.test.ts`
- files_modified: —
- ao_subset: [FR-064, AR-093 (cache strategy specifically), D-050, project-hdd-cost-optimal-llm memory]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** request `{role: 'dev', prompt: longo + history, sessionId}`
**When** dispatcher decide
**Then** invoca `AnthropicSDKAdapter.invoke({model: 'claude-sonnet-4-6', ...})` (binary AC — API default, ToS-safe per D-050)

**Given** request `{role: 'classifier', prompt: 'classify intent'}`
**When** dispatcher decide
**Then** invoca `AnthropicSDKAdapter.invoke({role: 'classifier', ...})` com `cache_control: ephemeral` no system prompt (binary AC)

**Given** sessionId reaproveitado entre invocações
**When** 2ª invocação corre
**Then** cache hit observable em token usage `cache_read_input_tokens > 0` (property AC — depende de Story 1.a.10 wiring; 75% economy target per D-044)

**Given** request com role desconhecido
**When** dispatcher recebe
**Then** retorna `err({kind: 'UnknownRole'})` + audit event (binary AC)

**Given** cost cap USD da implementação atingido (config) + janela Max 20x disponível
**When** dispatcher decide um role de implementação
**Then** faz overflow para `ClaudeCliAdapter` (Max 20x) + audit event (binary AC — D-050 fallback)

### Story 6.a.2: Telemetry % janela por sub-agente

As a `operador`,
I want telemetry que regista tokens in/out por sub-agente e workflow, computa estimate % de janela Max 20x consumida (5h window),
So that operador vê consumo em `hdd-worker status` e logs JSONL.

**StorySpec:**
- type: `feature` · epic: E6.a · sprint: 1 · pri_feature: F7
- blocked_by: [6.a.1, 2.3]
- files_created: `src/services/llm-telemetry.service.ts`, `src/lib/window-budget.ts`, `tests/services/llm-telemetry.test.ts`
- files_modified: `src/cli/status.command.ts` (display window %), `src/adapters/llm/*.adapter.ts` (emit token events)
- ao_subset: [FR-060, FR-063, NFR-O2, AO-151]
- estimated_tokens: { dev_core: 64K, dev_with_retry: 96K }

**Acceptance Criteria:**

**Given** worker consumiu 50M tokens em 3h da janela Max 20x
**When** corro `hdd-worker status`
**Then** output inclui `Window: 35% used · resets in 2h` (binary AC — `[ASSUMPTION]` API Anthropic devolve usage; Plan B = tokens proxy)

**Given** telemetry por sub-agente
**When** workflow conclui
**Then** Tier-C Resumo inclui breakdown `Dev: 60K · Reviewer: 40K · QA: 20K · classifier(Haiku): 5K` (binary AC)

### Story 6.a.3: 80% notification + pause hardcoded em exhausted

As a `operador`,
I want notificação WhatsApp em 80% da janela diária + pause automática em window-exhausted (sem downgrade ainda — E6.b),
So that demo M1 com 4+ stories cumulativas não bate janela silenciosamente.

**StorySpec:**
- type: `feature` · epic: E6.a · sprint: 1 · pri_feature: F7
- blocked_by: [6.a.2, 3.1]
- files_created: `src/services/window-guard.service.ts`, `tests/services/window-guard.test.ts`
- files_modified: `src/services/llm-telemetry.service.ts` (emit threshold events)
- ao_subset: [FR-061, FR-062 partial (pause hardcoded), Pre-Mortem PM-3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** consumo bate 80% da janela
**When** window-guard recebe threshold event
**Then** envia WhatsApp template heartbeat-variant com warning + audit event (binary AC — 1× per threshold, não spam)

**Given** consumo bate 100% (exhausted)
**When** window-guard detecta
**Then** FSM transita `running → paused_window_exhausted` + estima reset time + envia WhatsApp final (binary AC)

---

## Epic 6.b: Downgrade & Hard-Stop (Sprint 2)

> 2 stories.

### Story 6.b.1: Downgrade automático Sonnet→Haiku em exhausted

As a `Worker`,
I want que quando o cost cap USD da impl. atinge limite OU o overflow Max 20x esgota, dispatcher ofereça (a) overflow impl.→Max 20x se houver janela, ou (b) downgrade Sonnet→Haiku conforme role + budget cap config (D-050),
So that pipeline pode continuar degraded em vez de parar até reset/reabastecimento.

**StorySpec:**
- type: `feature` · epic: E6.b · sprint: 2 · pri_feature: F7
- blocked_by: [6.a.3]
- files_created: `src/services/llm-downgrade.service.ts`, `docs/decisions/downgrade-policy.md`, `tests/services/llm-downgrade.test.ts`
- files_modified: `src/services/llm-dispatcher.service.ts`
- ao_subset: [FR-065, AR-091]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** worker em `paused_window_exhausted` + budget config `downgrade.allow: true, max_cost_brl: 50`
**When** operador aprova downgrade via WhatsApp Quick Reply
**Then** dispatcher troca para Haiku para roles non-critical + pipeline retoma (binary AC)

**Given** budget config `downgrade.allow: false`
**When** exhausted
**Then** worker continua pausado até reset (binary AC — opt-in explícito)

### Story 6.b.2: --hard-stop flag CI mode + Plan B runbook

As a `CI / operador`,
I want flag `hdd-worker start --hard-stop` que em window-exhausted termina o processo com exit code não-zero em vez de pausar + runbook `ban-Anthropic-emergency.md`,
So that CI / cron jobs não ficam pendurados, e operador tem plan B documentado em ban Anthropic (ACCEPTED RISK D-032).

**StorySpec:**
- type: `feature` · epic: E6.b · sprint: 2 · pri_feature: F7
- blocked_by: [6.a.3]
- files_created: `docs/runbooks/ban-Anthropic-emergency.md`, `tests/cli/hard-stop.test.ts`
- files_modified: `src/cli/start.command.ts` (add `--hard-stop` flag), `src/services/window-guard.service.ts`
- ao_subset: [FR-062, D-032 ACCEPTED RISK, AR-110]
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** `hdd-worker start --hard-stop`
**When** window-exhausted
**Then** processo exit code 75 (EX_TEMPFAIL) + audit event `HardStopExit` (binary AC)

---

## Epic 7.b: Tier-A WhatsApp + Pentest Final (Sprint 1)

> Tier-A generator + WhatsApp envio + Quick Reply parsing + 8 Pentest Tasks
> sign-off pré-M1. 3 stories (Tier-B/C ficou em E1.a — Pre-Mortem PM-4).

### Story 7.b.1: Tier-A generator ≤200 palavras + WhatsApp envio

As a `operador`,
I want gerador Tier-A ≤200 palavras alimentado por Tier-B (resumir Tier-B → Tier-A via Haiku) + envio via template `hdd_summary_finalization` quando aprovado por Meta,
So that recebo Tier-A no telemóvel e decido em 30s.

**StorySpec:**
- type: `feature` · epic: E7.b · sprint: 1 (depende template approval) · pri_feature: F8
- blocked_by: [1.a.8, 3.1, 3.3]
- unblocker: "3 templates Meta aprovados (template approval lead time 1-3 dias; M1 mínimo via Story 3.3 + AO-86 escalation gate Day 7)"
- files_created: `src/services/tier-a-generator.service.ts`, `src/services/tier-a-prompts.ts`, `tests/services/tier-a.test.ts`
- files_modified: `src/services/summary-generator.service.ts` (chain Tier-B → Tier-A)
- ao_subset: [FR-070 Tier-A, FR-071 Tier-A WhatsApp, NFR-U3]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** Tier-B briefing 715 palavras
**When** Tier-A generator corre via Haiku
**Then** output ≤200 palavras (NFR-U3 binary AC) com keep: verdict + métricas + open items + aprovar-string

**Given** template `hdd_summary_finalization` aprovado Meta
**When** Tier-A entregue via E3 outbound
**Then** notificação no telemóvel em ≤10s (NFR-P2 binary AC)

### Story 7.b.2: Quick Reply fin_* parsing + state injection

As a `Worker`,
I want parser de Quick Reply payloads `fin_aprovar`, `fin_pedir_mudancas`, `fin_rejeitar` que injecta resposta no state e desbloqueia ou repete fase,
So that operador aprova workflow no telemóvel com 1 click sem digitar.

**StorySpec:**
- type: `feature` · epic: E7.b · sprint: 1 · pri_feature: F8
- blocked_by: [3.4, 7.b.1]
- files_created: `src/services/finalization-response-handler.service.ts`, `tests/services/finalization-handler.test.ts`
- files_modified: `src/core/domain/interrupt-commands.ts` (already has `FinAprovar`/`FinPedirMudancas`/`FinRejeitar`)
- ao_subset: [FR-073 WhatsApp, FR-076]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

**Acceptance Criteria:**

**Given** worker em `paused_awaiting_review` aguardando finalization response
**When** chega Quick Reply payload `fin_aprovar`
**Then** state injecta `approved=true` + FSM transita próximo workflow + audit `FinalizationApproved` (binary AC)

**Given** chega `fin_pedir_mudancas` com text livre
**When** handler corre
**Then** regista nota completa + FSM volta ao step anterior (binary AC)

### Story 7.b.3: 8 Pentest Tasks final sign-off pré-M1

As a `operador`,
I want execução final + sign-off documentado das 8 Pentest Tasks PT-1..PT-8 antes de marcar M1 done,
So that assino M1 com evidência verificável (gate AR-076 closed).

**StorySpec:**
- type: `feature` · epic: E7.b · sprint: 1 · pri_feature: foundational (safety gate)
- blocked_by: [1.b.1, 1.b.2, 1.b.3, 1.b.4, 1.b.5]
- files_created: `_bmad-output/security/pre-m1-pentest-signoff.md`, `scripts/m1-pentest-runner.sh`
- files_modified: —
- ao_subset: [AR-076, Pentest PT-1..PT-8]
- estimated_tokens: { dev_core: 40K, dev_with_retry: 56K }

**Acceptance Criteria:**

**Given** todos os PT-1..PT-8 testes em CI verde por ≥7 dias consecutivos
**When** corro `scripts/m1-pentest-runner.sh`
**Then** produz `pre-m1-pentest-signoff.md` com 8 sections + hash chain reference + operador assina (Quick Reply `fin_aprovar`) (binary AC)

**Given** qualquer PT regression em 7 dias
**When** runner corre
**Then** sign-off **rejeitado** com lista de regressions (binary AC — gate M1 fechado)

---

## Sumário quantitativo

| Sub-milestone | Stories | Total story tokens (dev_with_retry) |
|---|---|---|
| E1.a Runtime Scaffold & Core Contracts | **10** | **~872K** (+80K Story 1.a.10 via D-049 split) |
| E1.b Safety BLOCKERS | 5 | ~456K |
| E1.c Bootstrap & Operations | 7 | ~440K |
| **Sprint 0 total** | **22** | **~1.77M tokens** |
| E2 Worker | 7 | ~564K |
| E3 WhatsApp + Resend | 6 | ~528K |
| E4 Interrupts | 5 | ~428K |
| E5 Crash Recovery | 3 | ~276K |
| E6.a Janela telemetry | 3 | **~248K** (Story 6.a.1 reduzida −48K via D-049 split) |
| E7.b Tier-A + Pentest signoff | 3 | ~208K |
| **Sprint 1 total** | **27** | **~2.25M tokens** |
| E6.b Downgrade + hard-stop | 2 | ~136K |
| **Sprint 2 total** | **2** | **~136K tokens** |
| **GRAND TOTAL** | **51** | **~4.16M tokens** |

> **Cost ledger `[ASSUMPTION AO-114]`:** baseado em 64K/96K foundational e
> 48K/72K feature. ~4.1M tokens dev_with_retry. Em hybrid D-044 (Sonnet via Max
> 20x R$0 marginal + Haiku R$5-25/m), cost projection compatível com budget
> R$1000/m alvo memória. Calibrate Sprint 0 baseline.
