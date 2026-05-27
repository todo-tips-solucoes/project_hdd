---
title: "Addendum — HORSE DRIVEN DEVELOPMENT (HDD) v2 — Pipeline Autónomo Assíncrono BMAD + OpenClaw + WhatsApp Interrupt"
status: final
version: 2
created: 2026-05-20
updated: 2026-05-20
supersedes: "addendum.md v1 (2026-05-20)"
note: "v2 reconciliado com brief.md (autoritativo). Detalhe técnico mais profundo em brief addendum.md."
---

# Addendum

> Profundidade que pertence a documentos downstream (arquitetura, solution design, UX) ou que ganhou lugar mas não cabe no PRD principal: alternativas rejeitadas, opções consideradas, mecanismos/transporte, personas profundas, dados de sizing. **Audit/override fica no `.decision-log.md`, não aqui.**

---

## A1. Alternativas consideradas para a camada de orquestração

| Opção | Vantagem | Razão de rejeição (esta fase) |
|---|---|---|
| **OpenClaw + bmad-method** *(escolhida)* | Plugin BMAD oficial; gateway com sessões/memória/canais; já alinhado com o método | — |
| LangGraph + custom adapter | Maturidade, comunidade Python ampla | Sem plugin BMAD; reimplementar fluxos seria custoso |
| CrewAI / AutoGen | Multi-agent nativo; bom para POCs | Não modelam fases BMAD; integração de canais é ad-hoc |
| Claude Agent SDK / Computer Use puro | Controlo fino, ergonomia Anthropic | Necessitaria construir gateway, sessions, plugin layer do zero |
| Custom Python orchestrator | Liberdade total | Custo de manutenção alto; não reusa BMAD CLI tooling |

Decisão registada em `.decision-log.md` (D-006 implícito; aprofundar se trocar de stack).

---

## A2. Esboço de arquitetura técnica v2 (não-vinculativo — input para `bmad-create-architecture`)

> Reconciliado com brief addendum §3. **Brief addendum tem detalhe técnico mais profundo** — consultar `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/addendum.md`.

### A2.1 Camadas Modo Colaborativo (local — Claude Code)
1. **Claude Code** com Opus 4.7 1M tokens (sessões interactivas)
2. **BMAD v6.7.1** em `/var/lib/projeto_hdd/_bmad`
3. **Skills BMAD** em `.claude/skills/bmad-*` (canónicas para Claude Code)
4. **Workspace** = repositório local; `_bmad-output/` para artefactos

### A2.2 Camadas Modo Autónomo (VPS própria)
1. **VPS** do `operador` — Linux, SSH key-only, firewall mínimo (porta webhook + 22)
2. **Worker** rodando em **Node ou Python** (escolha em arquitetura — OQ-G). Executa loop de stories.
3. **State store** — **Redis ou SQLite local** (OQ-B) para `current_story_id`, `story_status`, `paused_for_interrupt`, `last_interrupt_at`, `interrupt_pending_id`, `retry_count`, `current_workflow`, `current_phase`.
4. **Audit logger** — JSONL estruturado em `_bmad-output/audit/<project>/<date>.jsonl` (uma linha por evento).
5. **WhatsApp adapter** — módulo que fala com o **sistema proprietário do `operador`** via REST API interna (OQ-E para library: Baileys / whatsapp-web.js / direta).
6. **E-mail adapter** — SMTP genérico ou serviço transacional (OQ-F: Resend / Postmark / SES).
7. **Webhook listener** — endpoint HTTP que recebe mensagens entrantes do WhatsApp e injecta no contexto do agente.
8. **BMAD invoker** — dispara skills BMAD via API local. **OQ-H:** confirmar se BMAD permite invocação programática directa ou requer um CLI-wrapper.
9. **Gateway OpenClaw** + **plugin `ErwanLorteau/BMAD_Openclaw`** (a instalar).

### A2.3 Topologia de sub-agentes no Modo Autónomo
- BMad Master (orquestrador) → `scrum_master` (sprint plan) → loop por story: `dev` → `reviewer` (`bmad-code-review` custom para detetar P1) → `qa` (`bmad-testarch-*`)
- Cada sub-agente em **contexto isolado**.

### A2.4 Diagrama lógico (esboço — produzir formal em arquitetura)

```
┌─────────── MODO COLABORATIVO (local) ───────────┐
│  operador ↔ Claude Code (Opus 4.7 1M)          │
│       │                                          │
│       └─ skills BMAD: brief → prd → arch →      │
│          epics → readiness-check                 │
└──────────────────────┬───────────────────────────┘
                       │ F-READY (gate)
                       ▼
┌─────────── MODO AUTÓNOMO (VPS) ─────────────────┐
│  Worker (Node/Python) ── BMad Master            │
│     │       │                                    │
│     │       ├─ scrum_master → dev → reviewer    │
│     │       │     (loop por story)              │
│     │       │       │                            │
│     │       │       ▼ detecta gap                │
│     │       │   P1 trigger                       │
│     │       │       │                            │
│     │       └───────┘                            │
│     │                                            │
│     ├─ State store (Redis|SQLite)               │
│     ├─ Audit JSONL                              │
│     ├─ WhatsApp adapter ──→ webhook listener    │
│     │                            │               │
│     │                            ▼               │
│     │              [sistema WhatsApp proprietário]
│     │                            │               │
│     │   resposta ←───────────────┘               │
│     │                                            │
│     └─ E-mail adapter (fallback S3)             │
└──────────────────────────────────────────────────┘
```

**Topologia de sub-agentes (do v1, mantida):**
- `analista` (opcional), `pm`, `arquiteto`, `ux` (opcional), `scrum_master`, `dev` (1..N), `qa`
- Cada sub-agente herda o workspace mas tem **contexto isolado** por workflow.

---

## A3. Modelo de interrupts e finalizações — v2 (reconciliado com brief)

> **Atenção:** o modelo CP-1..7 do v1 foi **substituído** (D-024). Agora há dois modelos distintos:

### A3.1 Finalizações planeadas (D-019) — exigem revisão humana + Resumo 3-tier

| ID | Evento | Artefacto | Canal | Comportamento |
|---|---|---|---|---|
| F-PRD | Fim de `bmad-prd` | `prd.md` final | WhatsApp (Tier-A) + ficheiro | Pausa em `paused-awaiting-review` |
| F-ARQ | Fim de `bmad-create-architecture` | `architecture.md` + ADRs | WhatsApp + ficheiro | Pausa |
| F-EPICS | Fim de `bmad-create-epics-and-stories` | `epics.md` | WhatsApp + ficheiro | Pausa |
| F-READY | Fim de `bmad-check-implementation-readiness` | gate result | WhatsApp + ficheiro | **Gate de transição para Modo Autónomo** |
| F-STORY | Fim de uma story (Dev→Review→QA verde) | PR ou diff | WhatsApp (auto-thread por story) | Pausa para review final OU auto-merge se NFR-S4 não aplicar |
| F-RELEASE | Fim do projecto (todas as stories) | release notes + tag | WhatsApp + e-mail | Pausa para release final do operador |

### A3.2 Interrupts (eventos não-planeados, durante Modo Autónomo) — não exigem Resumo

| Trigger | Condição | Ação | Comportamento em timeout |
|---|---|---|---|
| **P1** | Gap PRD/Arq↔Código | Worker pausa → WhatsApp com contexto | Aguarda indefinidamente; S1 dispara se sem progresso > 30min |
| **S1** | Watchdog timeout (default 30min) | Worker pausa → WhatsApp "travado em [story X]" | Aguarda |
| **S2** | 5 falhas reincidentes na mesma tentativa | Worker pausa → WhatsApp com erro + diff | Aguarda |
| **S3** | 3 mensagens sem confirmação WhatsApp em 10min | **Fallback automático e-mail; pipeline NÃO pára** | N/A (não é pausa) |

**Política geral (revisada):** fail-safe é pausar **em interrupts P1/S1/S2** e em **finalizações planeadas**, mas **NÃO** em S3 — S3 troca canal e continua. (Brief P-3: pipeline deve continuar quando o canal falha, porque a falha do canal não é sinal de erro do trabalho.)

---

## A4. Personas estendidas

### Persona primária — "O Operador"
- **Quem:** desenvolvedor sénior solo ou tech-lead de equipa ≤ 5 (perfil = `operador`, skill level `intermediate` em BMAD)
- **Contexto:** quer libertar tempo de planeamento mecânico e execução repetitiva; mantém-se autoridade em todas as decisões estratégicas
- **Necessidades:** ver progresso a qualquer momento (`bmad_get_state`); intervir cirurgicamente em checkpoints; rollback se desvio detectado; cost cap para não levar surpresas na fatura LLM
- **Frustrações actuais:** ciclo PRD→backlog→sprint→PR consome semanas; troca de contexto entre fases é cara; informalidade gera decisões perdidas
- **Métrica de sucesso pessoal:** tempo de input→primeiro artefacto válido (`< 1h`); tempo total do ciclo (`< 5 dias para MVP simples`)

### Persona secundária — "O Revisor convidado"
- **Quem:** stakeholder não-técnico ou par técnico que entra apenas nos CP críticos
- **Contexto:** recebe um link/resumo via Slack ou e-mail
- **Necessidades:** sumário humano-legível em ≤ 1 página; comandos simples (`approve`, `reject`, `request_changes` com nota livre)
- **Frustrações:** Não quer instalar nada nem ler 50 páginas de Markdown

### Persona terciária *(futura, M2+)* — "A Equipa"
- Múltiplos operadores partilhando o mesmo gateway; multi-tenancy de workspaces; permissions; cost split per projeto
- **Out of scope no MVP** (`[ASSUMPTION]`, validar)

---

## A5. Métricas detalhadas e instrumentação

Cada métrica do PRD principal precisa de instrumentação. Esboço:

| Métrica | Como medir | Onde guardar |
|---|---|---|
| Cycle time PRD→MVP funcional | Timestamp `bmad_init_project` → primeiro release tag | `bmad_get_state` + git |
| % de fases concluídas sem intervenção humana fora dos CP definidos | Contador de pausas não-CP por workflow | log do gateway |
| Custo médio LLM por feature implementada | Token usage por sub-agente × preço provider | log próprio + plugin de billing |
| Taxa de auto-merge em CP-6 (sem retrabalho) | PRs com green-on-first-try / total | git/CI |
| Time-to-rollback em desvios detectados | Trigger de reject → state restaurado | decision-log + git |

**Não-objetivos / counter-metrics:**
- *Não* queremos maximizar autonomia se isso aumentar rework (= métrica auxiliar: % de rollbacks pós-CP)
- *Não* queremos minimizar tempo se isso degradar qualidade de testes (= métrica auxiliar: coverage final)

---

## A6. Catálogo de plugins recomendados (referência do `.docx`)

### Canais
- **Slack** — `docs.openclaw.ai/channels/slack` — Socket Mode ou Webhook; app token + bot token + signing secret
- **E-mail** — Apple Mail + AppleScript (`lobster.shahine.com/guides/email-notifications/`) **ou** AgentMail / Nylas API (preferível para deploy não-macOS)
- **Discord / WhatsApp / Telegram / Microsoft Teams** — opcionais conforme onde os revisores vivem

### Execução
- **Codex Computer Use / Codex harness** — manipulação de ficheiros, exec de comandos, sandbox
- **Diff & code review** — para abrir PRs, aplicar patches, revisar mudanças
- **CI runners** — GitHub Actions / GitLab CI integration

### BMAD
- Skills core (`bmad-prd`, `bmad-architecture`, `bmad-epics-stories`, `bmad-sprint-planning`, `bmad-dev-story`, `bmad-code-review`)
- Extensões já instaladas em `projeto_hdd`: `tea` (test arch), `bmb` (builder), `automator`, `cis`, `wds`

---

## A7. Riscos e mitigações (overflow do PRD principal)

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-1 | Sub-agente entra em loop / consome budget | Média | Alto | Cost cap + max-steps + early-stop heurístico |
| R-2 | Código gerado introduz vulnerabilidade | Média | Alto | QA gate com SAST + revisão humana obrigatória em endpoints expostos |
| R-3 | Drift entre BMAD upstream e instalação local | Alta | Médio | Pin de versão em `_bmad/_config/manifest.yaml`; upgrade trimestral planeado |
| R-4 | Slack/e-mail timeout sem resposta | Alta | Baixo | Fallback para pausa + notificação multi-canal escalada |
| R-5 | Token leak em logs do gateway | Baixa | Crítico | Secrets em vault externo; redact em logs |
| R-6 | Perda de workspace se disco falha | Baixa | Crítico | Backup automático para drive remoto (M1+) |
| R-7 | Lock-in de provider LLM | Alta | Médio | Abstracção via OpenClaw provider plugins; testar com ≥ 2 providers no M1 |
| R-8 | Compliance de IP em código gerado | Média | Médio (Alto se publicar) | Não-objetivo no M0 (dogfood); auditoria de licenças no M1 antes de qualquer release público |

---

## A8. Glossário

- **BMAD** — Breakthrough Method of AI-Driven Development; metodologia spec-driven em 4 fases (Análise, Planejamento, Solução, Implementação).
- **HDD / HORSE DRIVEN DEVELOPMENT** — Nome oficial da plataforma (D-016). Alinhado com `project_name=projeto_hdd`.
- **BIMED** — Codinome obsoleto do documento de origem, substituído por HDD.
- **OpenClaw** — Framework de orquestração de agentes IA com plugin model (gateway + sessions + plugins).
- **BMad Master** — Agente top-level configurado no OpenClaw que coordena sub-agentes BMAD.
- **YOLO mode** — Modo autónomo (sub-agente percorre passos sem parar).
- **Workflow** — Sequência canónica de passos BMAD com artefactos esperados (ex.: `bmad-prd`).
- **Decision log** — Ficheiro `.decision-log.md` com trilha de decisões por workflow.
- **Checkpoint (CP)** — Ponto onde o pipeline pausa e aguarda input humano.

---

## A9. Referências externas (do `.docx`)

1. GitHub — ErwanLorteau/BMAD_Openclaw — https://github.com/ErwanLorteau/BMAD_Openclaw
2. BMAD Method — Getting Started — https://docs.bmad-method.org/tutorials/getting-started/
3. OpenClaw Slack — https://docs.openclaw.ai/channels/slack
4. OpenClaw Email Notifications (Lobster playbook) — https://lobster.shahine.com/guides/email-notifications/
