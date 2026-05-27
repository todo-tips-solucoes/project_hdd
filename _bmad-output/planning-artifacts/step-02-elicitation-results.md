---
title: "Step 02 — Elicitation Results · HDD Architecture"
workflow: bmad-create-architecture
step: 2
date: 2026-05-20
techniques: [pre-mortem, party-mode]
party_perspectives: [Arquiteto, SRE, Security, PM]
status: pending-synthesis-approval
---

# Step 02 — Elicitation Results

> Trilha permanente das 5 análises produzidas no Step 02 (Project Context Analysis). Mantida no workspace para referência downstream.

## A — Advanced Elicitation: Pre-mortem (10 causas de morte)

Imaginando Outubro 2026 com o projeto morto, retroagindo:

1. **WhatsApp banido pela Meta** (ALTA × CRÍTICO) — número flagged; S3 stuck em e-mail; latência colapsa P-3.
2. **Gap detector noisy or silent** (ALTA × ALTO) — fadiga vs drift acumulado.
3. **Bug de idempotência destrói trabalho** (MÉDIA × CRÍTICO) — crash + replay duplicado.
4. **Janela LLM esgota em pico** (ALTA × MÉDIO) — M3 inalcançável.
5. **State store inconsistente após response tardia** (MÉDIA × ALTO) — P1 + S1 conflitantes.
6. **VPS down sem heartbeat externo** (BAIXA × ALTO) — silêncio noturno.
7. **Definição de superfície sensível insuficiente** (MÉDIA × CRÍTICO se publicar).
8. **Resumo 3-tier vira ruído; approve automático** (MÉDIA × MÉDIO).
9. **Bimodal handoff perde contexto implícito** (MÉDIA × ALTO).
10. **paulotodo muda piloto a meio** (MÉDIA × MÉDIO).

**10 obrigações arquiteturais derivadas (O-A..O-J)** — ver detalhes na conversa.

## P — Party Mode: 4 perspectivas

### Arquiteto (7 findings + 8 OQ recommendations)
1. Envelope de contexto no handoff Colab→Auton precisa de `context-bundle.json` imutável + hash.
2. State machine de interrupts não-mutualmente-exclusivos — modelar FSM com queue.
3. LLM é não-idempotente por natureza — hash check antes de commit.
4. Sincronização local↔VPS subestimada — planning artefacts read-only no VPS; Git unidireccional.
5. Gap detector pluggable (interface separada).
6. Rollback via branch delete, não git revert.
7. WhatsApp ban é trust failure, não disponibilidade — health-check de sessão separado de S3.

**OQ-A→H:** ask-the-agent / SQLite / N=5 com backoff / branches por story / sistema REST proprietário / Resend / Node / CLI-wrapper.

### SRE (7 findings + 5 métricas + 5 runbook entries)
1. State store sem estratégia de backup off-host — `rclone` automático.
2. Interrupt sem deadline — 2º watchdog TTL 4h re-escala via e-mail.
3. S3 sem TTL próprio — força pausa após 24h sem resposta de e-mail.
4. Ban WhatsApp ≠ S3 — health-check de sessão dispara modo e-mail forçado.
5. Alertas Max 20x em 50%/70%/80%, não só 80%.
6. Rollback de upgrade BMAD: tag + staging em pasta separada.
7. Audit JSONL rotação diária + gzip + sync S3.

**Métricas v1:** worker-alive, interrupts-pendentes, window-pct, retry-count, interrupt-response-latency.
**Runbook:** crash worker / state store corrupto / ban WhatsApp / Max 20x esgotada / interrupt sem resposta 4h+.

### Security (8 findings + 5 insecure defaults a banir)

**Threat model:** o pipeline é o próprio adversário acidental; trust boundaries entre Claude Code, VPS, WhatsApp REST, GitHub, audit log, código gerado.

1. **CRÍTICO** Webhook WhatsApp sem auth de origem — HMAC-SHA256 + sender_jid allowlist.
2. **CRÍTICO** Sandbox Dev agent sem escape model especificado — uid dedicado + chroot/Docker `--network none`.
3. **ALTO** GitHub PAT escopo excessivo — fine-grained 1 repo + sem admin.
4. **ALTO** Audit log mutável — hash chain `prev_hash` por linha + `O_APPEND` syscall.
5. **ALTO** Supply chain BMAD_Openclaw + Baileys — pin de versões com hash integrity.
6. **MÉDIO** Label `human-review-required` ≠ gate — branch protection com required reviews.
7. **MÉDIO** Anthropic API key como env var plana — utilizador não-privilegiado + systemd EnvironmentFile 0600.
8. **BAIXO** Webhook sem rate-limit/auth — allowlist IP + HMAC token + rate-limit nginx.

**Banir desde já:** worker como root / PAT `repo` completo / JSONL sem teste de redaction / sandbox adiado sem critério / WhatsApp webhook sem HMAC.

### PM (3 princípios honrados + 7 findings scope + 5 recs tácticas)

**3 princípios:** P-1 ✅ honrado · P-2 ✅ honrado · P-3 ✅ honrado.

1. **VALUE-KILLER** FR-064/065 downgrade automático multi-modelo — cortar v1; flat Sonnet no worker.
2. **OVER-SCOPED** FR-043 rollback parcial — v1.1; v1 = git reset manual.
3. **UNDER-SCOPED** FR-010 gap detector (arq-Q2) — fechar com "agente pergunta directamente" ANTES de fechar arquitetura.
4. **OVER-SCOPED** FR-075 diff side-by-side de resumos — v1.1; v1 = git log.
5. **MISALIGNED** FR-072/073 parser resposta WhatsApp rígido — NLP-tolerante ou quick replies.
6. **UNDER-SCOPED** Sem heartbeat proactivo — adicionar FR-085 (heartbeat configurável default 4h).
7. **OVER-SCOPED** Meta-dogfood (D-018) — separar workspace do piloto do workspace do pipeline para evitar auto-corrupção.

**Recs:** fechar arq-Q2 primeiro · NLP-tolerant parser desde dia 1 · workspace isolation do piloto · cortar multi-modelo · heartbeat antes do M1.

---

## Synthesis — convergências, tensões, resoluções

### Convergências fortes (≥ 3 perspectivas concordam)

| # | Tópico | Convergência | Acção arquitetural |
|---|---|---|---|
| C1 | **WhatsApp integridade webhook** (revisto após override Cloud API D-031) | Pre-mortem, Arq, SRE, Security todos flagram | `X-Hub-Signature-256` nativa Meta (HMAC-SHA256 com app secret) + `wa_id` sender allowlist + rate-limit listener + quality rating tracking |
| C2 | **Idempotência LLM-aware** | Pre-mortem, Arq todos requerem | Hash do artefacto gerado + idempotency keys + commit state ANTES de side-effect |
| C3 | **Gap detector simples ("ask the agent")** | Arq, PM, pre-mortem alinham | Implementar como pergunta directa ao agente com structured boolean output; threshold ajustável; histórico de hit rate |
| C4 | **Observability operacional do telemóvel** | Pre-mortem, SRE, PM | Heartbeat externo (Healthchecks.io) + heartbeat proactivo ao operador (FR-085 novo) |
| C5 | **Sandbox Dev agent especificado** | Security CRÍTICO + pre-mortem | uid dedicado + chroot/Docker `--network none` durante geração; rede mínima reabre em CI |
| C6 | **Audit JSONL append-only com hash chain** | Security + SRE | `prev_hash` por linha + `O_APPEND` syscall + rotação diária + sync remoto |
| C7 | **Branch-per-story** | Arq, PM compatível | Cada story numa branch `story/<id>`; rollback = delete-branch |
| C8 | **Backup off-host do state store** | SRE + pre-mortem | `rclone` ou equivalente para S3/R2 a cada checkpoint |

### Tensões resolvidas

| # | Tensão | Resolução proposta |
|---|---|---|
| T1 | PM quer cortar multi-modelo FR-064/065 ↔ pre-mortem quer pacing | **Cortar selection-multi-modelo do v1**, **manter pacing** (estimativa de consumo + alertas 50/70/80%). Flat Sonnet no worker; Opus só em sessões Colab |
| T2 | PM quer meta-dogfood com workspace separado ↔ D-018 já fechou piloto | **Manter D-018** (piloto = projeto_hdd) mas **arquitetura mandata workspace isolation**: o worker corre em `/var/lib/projeto_hdd/runs/<run-id>/` (não no root do projeto). Auto-corrupção mitigada |
| T3 | PM quer FR-043 (rollback parcial automático) para v1.1 ↔ Arq quer branches sempre | **Branches por story sempre no v1** (cheap, dá rollback manual livre); **rollback engine automático para v1.1** |
| T4 | PM diz parser WhatsApp rígido falha ↔ Security exige verificação de origem | **Compatíveis**: HMAC + sender allowlist (Security) + **LLM-based parsing** de texto livre (PM). Operador escreve "ok", "muda X", "não"; LLM mapeia para `approve / request_changes / reject` |

### Findings unaddressed em convergência mas a registar

- **Pre-mortem #8** Resumo 3-tier vira ruído — adicionar drift detector Tier-A vs Tier-B + agrupamento por epic (v1) + warning se `approve` sem ter aberto Tier-B (v1.1).
- **Pre-mortem #9** Decision-log carregado no worker — incluir no `context-bundle.json` (Arq #1).
- **Pre-mortem #10** Operador muda piloto — desacoplamento worker↔projeto via `bmad_init_project` em diretórios diferentes (já compatível com FR-001).

---

## Recomendações finais por OQ herdada do brief

| OQ | Recomendação consolidada | Confiança |
|---|---|---|
| **OQ-A** Gap detector | **Ask-the-agent** com structured boolean output; threshold ajustável; histórico de hit rate em métrica | ALTA (Arq + PM + pre-mortem) |
| **OQ-B** State store | **SQLite** (zero dep infra adicional, backup = copy do `.db`); Redis adiado v1.1 se concorrência subir | ALTA (Arq + SRE) |
| **OQ-C** Limite retries S2 | **N=5 com backoff exponencial** entre tentativas; tentativas do mesmo checkpoint (não de rede) | MÉDIA (Arq; calibrar piloto) |
| **OQ-D** Rollback | **Branches `story/<id>` sempre**; rollback = delete-branch; automação multi-story v1.1 | ALTA (Arq + PM) |
| **OQ-E** WhatsApp library | ~~Sistema proprietário REST~~ → **WhatsApp Cloud API oficial Meta** (default directa; Twilio/BSP como fallback se aprovação demorar) — D-031 override directo do operador | ALTA — decisão do operador |
| **OQ-F** E-mail provider | **Resend** (SDK moderno, delivery webhook nativo para confirmar S3 ativo) | ALTA (Arq + SRE) |
| **OQ-G** Worker runtime | **Node** (ecosistema BMAD_Openclaw + WhatsApp libs alinhado) | ALTA (Arq) |
| **OQ-H** BMAD invoker | **CLI-wrapper no v1** (isola de versões do plugin); invocação programática em v1.1 quando plugin estabilizar | ALTA (Arq) |

---

## Anexo — outputs raw das 4 perspectivas

Para auditoria. Tornado parte do trail de decisão.

### Arquiteto raw
*(transcrito acima)*

### SRE raw
*(transcrito acima)*

### Security raw
*(transcrito acima)*

### PM raw
*(transcrito acima)*

---

## Override 2026-05-20 — WhatsApp Cloud API oficial

Operador respondeu `y` à synthesis com correção: **WhatsApp será com API oficial Meta**, não sistema proprietário não-oficial. Brief addendum sugeria Baileys/whatsapp-web.js; PRD §11 OQ-E listava opções não-oficiais. **Override directo do operador supersedes.**

### Implicações reformuladas

**Riscos eliminados:**
- ~~R-1: ban Meta de stack não-oficial~~ — número certificado oficialmente.

**Novos constraints:**
- **Janela de 24h** para mensagens livres após resposta do operador; fora disso requer templates pré-aprovados pela Meta.
- **Templates obrigatórios:** `hdd_interrupt_p1`, `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_summary_finalization` (Tier-A), `hdd_heartbeat`, `hdd_release_final`.
- **Setup com pre-rolagem:** certificação do número (1-3 dias), display name aprovado, quality rating monitorizado.
- **Custo emerge:** pricing por conversa (~$0.005–0.08 conforme país); planear ceiling mensal além da janela LLM.
- **Webhook signature:** `X-Hub-Signature-256` (HMAC-SHA256 com app secret) — substitui HMAC custom.

**Pré-requisitos novos** (a adicionar ao PRD §9.1):
- Conta **WhatsApp Business** (WABA) criada e verificada.
- Número certificado pela Meta Business (não o número pessoal).
- App Meta criado no Meta for Developers com permissão `whatsapp_business_messaging`.
- Templates submetidos e aprovados antes do M1.

**Sub-decisão OQ-E':** Meta Cloud API directa (recomendado) vs Business Solution Provider (Twilio/360dialog/MessageBird/Infobip) — operador a confirmar; default = directa.

**Decisão logada:** D-031 no `.decision-log.md`.

---

> **Estado:** synthesis revista pronta. A incorporar no Project Context Analysis do `architecture.md`.
