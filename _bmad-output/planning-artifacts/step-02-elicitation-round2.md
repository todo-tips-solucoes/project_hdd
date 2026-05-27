---
title: "Step 02 — Elicitation Round 2 · HDD Architecture"
workflow: bmad-create-architecture
step: 2
round: 2
date: 2026-05-20
techniques: [constraint-mapping, critical-decision-method, party-mode-round-2]
party_perspectives_round_2: [UX-revisor, FinOps, Compliance, DataEngineer]
status: pending-synthesis-approval
---

# Step 02 Round 2 — Elicitation Results

## A.1 — Constraint Mapping

**18 constraints catalogadas** (CT-1..CT-18) — Hard interna, Hard externa (plataformas), Soft externa, Soft antecipada. Insight chave:

> **Dois orçamentos paralelos não-fungíveis** — janela LLM Anthropic Max 20x (tempo) + USD operacional (Meta + Resend + VPS + R2). Otimizar um não otimiza o outro. *Arquitetura deve instrumentar ambos separadamente.*

Detalhe completo na conversa.

## A.2 — Critical Decision Method (CDM)

Audit das 6 decisões críticas (D-016..D-019, D-024, D-031). **3 áreas de risco invisível identificadas:**

- **D-017 vulnerabilidade média-prazo** → AO-24 (plan B LLM Bedrock/OpenAI)
- **D-018 auto-corrupção meta-dogfood** → AO-18 reforçado com chaos test
- **D-031 latency Meta subestimada** → AO-25 (pre-rolagem Meta paralela à arquitetura)

## P — Party Mode Round 2: 4 perspectivas

### UX (Revisor) — templates Meta concretos + 7 findings

Templates propostos com copy exacto:
- `hdd_interrupt_p1` — header emoji-status; Quick Replies `[Continuar assim] [Mudar rumo] [Ver detalhes]`
- `hdd_summary_finalization` — Tier-A com decisões formato "X (não Y)"; Quick Replies `[✅ Aprovar] [⚠️ Rever] [🛑 Bloquear]`
- `hdd_heartbeat` — pipeline + story + janela LLM; Quick Replies `[OK, continuar] [Pausar] [Snooze 2h]`

**Findings principais:**
1. Rubber-stamp risk (Pre-mortem #8) — gate de tempo: `approve` em <20s gera "Confirma com *ok* ou pede Tier-B"
2. Heartbeat 4h pode ser ruído nocturno — `do_not_disturb_start/end` default 23h-8h; acumular fora desse horário
3. Ambiguidade parser NLP — quando confidence < 0.7, "Queres dizer [A] ou [B]?" com Quick Replies
4. Drift detector Tier-A↔B vira wall-of-text — mensagem curta `⚠️ ... ver: [link]`
5. Onboarding: 1ª ocorrência de cada tipo envia parágrafo explicativo extra; após 3× omite
6. Quick Reply expira 24h — após 20h re-envia template; após 48h activa S3
7. Mensagens S2 densas: corpo = `erro 1 linha + ficheiro:linha + última decisão`; diff em URL

**Anti-padrões:** "Confirmar:" duplicado; variáveis com stack trace; "Sim" sem verbo; Markdown estrutural; heartbeat sem dados.

### FinOps — orçamento dual + ~$4-8/mês USD

**Axis 1 (Janela Anthropic Max 20x):** 3-4 stories/dia em Opus exclusivo; **6-8 stories/dia com mix Opus+Sonnet+Haiku**.

| Sub-agente | Modelo | Razão |
|---|---|---|
| BMad Master / Arq / PM | Opus 4.7 | Decisões estruturais |
| Dev (bmad-dev-story) | Sonnet 4.6 | Geração código rotineira |
| Code Review / Gates | Sonnet 4.6 | Output previsível |
| Gap detector | Haiku 4.5 | Boolean trivial |
| Parser NLP respostas WA | Haiku 4.5 | Classificação simples |

**Axis 2 (USD):**

| Componente | $/mês (piloto) | Notas |
|---|---|---|
| WhatsApp Cloud API directa | $0–3 | service free; templates $0.0083 PT / $0.0125 BR |
| Resend e-mail | $0 | free tier 3000/mês |
| VPS Hetzner CX22 | $4,35 | 2 vCPU / 4 GB / 40 GB |
| R2 storage off-host | $0–0,50 | 10 GB free; ~450 MB/mês audit |
| **Total** | **$4–8/mês** | |

**Cost caps recomendados:** $15/mês hard-stop; alerta $10 (67%); 200 conversas WA/mês com alerta em 140; janela LLM alertas 50/70/80%.

**Tactics imediatas:**
1. **Routing Haiku primeiro** para gap detector + NLP parser (poupa 15-20% janela/story)
2. **Prompt caching Anthropic** no Dev agent (reduz tokens repetidos em ~60%)
3. Heartbeat default **8h** (não 4h) — corta WhatsApp templates pela metade
4. Audit JSONL `gzip` na origem antes do rclone
5. **Meta directa vs BSP — fechar OQ-E' em directa** ($10-25/mês fee BSP fixo + markup)

### Compliance — 8 findings; 2 CRÍTICOS

**Critical #1 — TTL retenção audit JSONL indefinido:** v1 puro single-user OK; v1.1+ com 2º operador = dado pessoal de terceiro sem base legal nem TTL. **Embutir TTL 90 dias desde o design inicial.**

**Critical #2 — Max 20x para automação headless está em zona cinzenta dos ToS Anthropic.** Plans consumer tipicamente proíbem "automated use at scale". Risco: suspensão sem aviso. **Acção obrigatória:** confirmar com Anthropic suporte/sales OU migrar para Anthropic API (pay-per-token). **Decisão D-032 antes do M1.**

**Outros findings:**
- **ALTO** Ausência DPA Meta + Anthropic — Meta DPA via ToS aceitos; Anthropic DPA via anthropic.com/legal — executar antes de v1.1+
- **ALTO** Audit log é tamper-evident não tamper-proof — submeter hash-root diário a serviço RFC 3161 (FreeTSA) ou commit GitHub público — eleva a near-evidence-grade
- **ALTO** NFR-C1 difere SBOM/licenças mas pipeline já gera/commita código — adicionar `license-checker`/`pip-licenses` no CI bloqueando GPL/AGPL — 10 min de config
- **MÉDIO** v1.1+ revisor convidado = decisão automatizada → disclosure GDPR Art 22/LGPD Art 20
- **MÉDIO** E.164 + tokens em VPS = breach notification scope se comprometida
- **BAIXO** rclone para S3 sem região explícita — configurar R2 EU/AWS eu-west-1

**Controlos a embutir no v1 (mesmo difere v1.1+):**
1. TTL `retention_days=90` no audit-logger
2. Timestamp externo RFC 3161 do hash-root diário
3. CI gate `license-checker --failOn GPL;AGPL;LGPL` no repo de produto
4. Template de disclosure LLM no onboarding (criar agora, usar v1.1+)
5. **D-032** sobre Max 20x — formalizar antes do M1

### Data Engineer — schema SQLite completo + 8 findings

**Schema proposto** (resumo, completo no `architecture.md`):
- `runs` (run_id PK, status FSM, context_bundle_hash AO-1, schema_version)
- `stories` (story_id PK, run_id FK, status, retry_count, **artefact_hash AO-3**, branch_name AO-6)
- `fsm_state` (single-row por run, fsm_current AO-2, paused_for_interrupt, last_user_message_at FR-027)
- `interrupts_pending` (P1/S1/S2/S3, response_intent)
- `idempotency_keys` (key composta SHA-256, side_effect, result_ref)
- `consumption_window_llm` (run, story, tokens, model)
- `consumption_whatsapp` (msg_id biz_opaque_callback_data, direction, template_name, status)
- `templates_meta` (approved_at, last_used_at, active)
- `schema_migrations` (version, applied_at)

**AO-3 idempotência LLM-aware design:**
> Normalizador semântico (strip whitespace, sort imports, format canónico) ANTES do SHA-256. Chave = `SHA-256(story_id||phase||artefact_hash_normalizado)`. Grava em `idempotency_keys` ANTES do side-effect (commit-state-before-side-effect).

**AO-14 audit JSONL format:**
```json
{"ts":"2026-...","seq":N,"run_id":"...","story_id":"...","type":"...","payload":{...},"prev_hash":"sha256:...","this_hash":"sha256:..."}
```
`this_hash = SHA-256(prev_hash || ts || seq || type || payload_canonical_json)`; `O_APPEND` syscall garante atomicidade; corrupção parcial recupera truncando no último seq íntegro.

**8 findings:**
1. SQLite **WAL mode desde dia 1** (`journal_mode=WAL`) — rclone não bloqueia writes
2. **Litestream vs rclone:** Litestream é streaming WAL frame-a-frame, RPO ~1s; manter rclone como dump diário portável secundário
3. `biz_opaque_callback_data` colisão por design — chave composta `SHA-256(run_id||story_id||template_name||seq_local)`
4. FSM persisted como tabela single-row; transitions = transaction `BEGIN IMMEDIATE` (atomic com audit JSONL append)
5. Rollback parcial: coluna `rolled_back_at`+`rollback_reason` em `stories`; tabela `rollback_log` para traceabilidade
6. Audit JSONL retenção: cron gzip + sync R2; **local 30d, remoto 1 ano**
7. **Schema evolution append-only desde início**: SQLite suporta `ADD COLUMN`; nunca `DROP`/`ALTER`; novas mudanças = nova tabela + comentário deprecated
8. `consumption_window_llm` materializar `runs.llm_tokens_total` via trigger SQLite (evita full scan em alerts)

**Backup & Recovery:** Litestream primário (RPO ≤1s, RTO 5-15s); cron diário `.dump|gzip` + rclone para R2 EU como fallback portável.

---

## Synthesis — novos AOs (AO-24..AO-44)

| # | Obrigação | Origem |
|---|---|---|
| **AO-24** | Plan B LLM documentado (runbook switch para Bedrock+Sonnet ou OpenAI; não implementar v1 mas escrever) | CDM D-017 |
| **AO-25** | **Pre-rolagem Meta:** WABA + número + display name + templates submetidos **em paralelo com arquitetura**, não depois | CDM D-031 |
| **AO-26** | Chaos test do worker durante piloto (kill -9 em `runs/<id>/`; verificar workspace pai intacto) | CDM D-018 |
| **AO-27** | Timestamp externo RFC 3161 (FreeTSA) do hash-root JSONL diário OU commit em GitHub público | Compliance #4 |
| **AO-28** | TTL `retention_days=90` no audit-logger embutido desde design v1 | Compliance #1 |
| **AO-29** | DPA Anthropic executado; SCCs/região EU explícita no R2 bucket | Compliance #3, #8 |
| **AO-30** | CI gate `license-checker --failOn GPL;AGPL;LGPL` no repo de produto gerado | Compliance #5 |
| **AO-31** | Template de disclosure LLM para onboarding revisor convidado v1.1+ — criar agora | Compliance #6 |
| **AO-32** | Quick Reply buttons em todos os templates Meta (3 opções: contexto-dependente) | UX templates |
| **AO-33** | Heartbeat `do_not_disturb_start/end` default 23h-8h; acumular fora desse horário | UX #2 |
| **AO-34** | Parser NLP com confidence threshold 0.7; abaixo disso clarificação com Quick Replies | UX #3 |
| **AO-35** | Onboarding: 1ª ocorrência de cada tipo envia parágrafo explicativo; após 3× omite | UX #5 |
| **AO-36** | Quick Reply lembrete em 20h; fallback S3 em 48h sem resposta | UX #6 |
| **AO-37** | SQLite `journal_mode=WAL` desde migração 001 | DE #1 |
| **AO-38** | **Litestream primário** (streaming WAL); rclone diário `.dump` secundário portável | DE #2 |
| **AO-39** | WhatsApp idempotency key composta: `SHA-256(run_id||story_id||template_name||seq_local)` | DE #3 |
| **AO-40** | FSM persisted como tabela single-row; transitions = `BEGIN IMMEDIATE` atomic com audit append | DE #4 |
| **AO-41** | Schema migrations versionadas append-only desde v1 (nunca DROP/ALTER) | DE #7 |
| **AO-42** | **Prompt caching Anthropic SDK** no Dev agent (`cache_control: ephemeral`) — reduz ~60% tokens repetidos | FinOps tactic #2 |
| **AO-43** | Routing Haiku 4.5 para gap detector + parser NLP (não Opus/Sonnet) | FinOps tactic #1 |
| **AO-44** | Dois contadores separados: `llm_window_pct_used` (reseta com janela) e `waba_conversations_month` (reseta mês); alertas independentes | FinOps #4 |

**Total: arquitetura agora opera com 44 Architectural Obligations (AO-1..AO-44).**

## Decisões pendentes do operador

### D-032 (CRÍTICO) — ToS Anthropic para automação headless
Compliance flagou: **Plans consumer (Max 20x) tipicamente proíbem "automated use at scale".** O HDD é precisamente automação headless. Risco: suspensão da conta sem aviso. Opções:
- **D-032-A:** Confirmar com Anthropic suporte/sales se Max 20x cobre o uso (recomendado primeiro passo, custo zero).
- **D-032-B:** Migrar para Anthropic API pay-per-token (ToS explícito permite automação) — perde-se vantagem de janela fixa; passa-se a $ por token. Implica recalibrar FinOps (FinOps actual assume Max 20x).
- **D-032-C:** Aceitar risco residual + manter Max 20x; documentar como `[ACCEPTED RISK]`.

### OQ-E' — Meta Cloud API directa vs BSP
- **Meta directa:** FinOps recomenda (sem markup, sem fee fixo BSP $10-25/mês), Compliance OK, UX OK. Default da synthesis.
- **BSP (Twilio/360dialog/...):** mais caro mas pode acelerar aprovação se Meta directa demorar; sub-decisão de risco.

### OQ-Backup — Litestream vs rclone primário
- Data Engineer recomenda **Litestream primário + rclone secundário portável**.
- Aceitar = `OQ-Backup` fechado.

---

> **Estado:** synthesis pronta; 1 decisão crítica + 2 sub-decisões a confirmar antes de incorporar AOs no `architecture.md`.
