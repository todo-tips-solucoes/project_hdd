---
title: "Implementation Readiness Assessment — HDD"
project: projeto_hdd
project_name_official: "HORSE DRIVEN DEVELOPMENT (HDD)"
phase: "Solução → Implementação (gate de transição BMAD)"
date: 2026-05-22
facilitator: bmad-check-implementation-readiness (Opus 4.7 1M)
operator: paulotodo
language: pt-PT
stepsCompleted: [step-01-document-discovery, step-02-prd-analysis, step-03-epic-coverage-validation, step-04-ux-alignment, step-05-epic-quality-review, step-06-final-assessment]
finalized: 2026-05-22
finalization_status: ready-for-operator-review
verdict: READY-WITH-CONDITIONS
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/addendum.md"
  - "_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/.decision-log.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/bmad-prd-summary-v2.md"
  - "_bmad-output/planning-artifacts/bmad-architecture-summary.md"
  - "_bmad-output/planning-artifacts/bmad-epics-summary.md"
  - "_bmad-output/planning-artifacts/whatsapp-templates-utility.md"
ux_status: "N/A — HDD v1 sem UI (NFR-O5)"
prior_workflows_status:
  bmad-prd-v2: "final · approved · D-030"
  bmad-create-architecture: "complete · DRB APPROVE-WITH-CONDITIONS · D-040"
  bmad-create-epics-and-stories: "complete · approved · D-045 + D-046 (Cenário B)"
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-22
**Project:** projeto_hdd (HORSE DRIVEN DEVELOPMENT)
**Verdict (em progresso):** TBD via Step 06

---

## Step 01 — Document Discovery

### Documentos canónicos identificados

| Tipo | Path | Tamanho | Status |
|---|---|---|---|
| PRD v2 | `prds/prd-projeto_hdd-2026-05-20/prd.md` | 40KB · 443 linhas | ✅ Single canonical (final · D-030) |
| PRD addendum | `prds/prd-projeto_hdd-2026-05-20/addendum.md` | 14KB | ✅ Companion |
| Architecture | `architecture.md` | 123KB · 2378 linhas | ✅ Single canonical (DRB APPROVE-WITH-CONDITIONS · D-040) |
| Epics & Stories | `epics.md` | 112KB · ~2000 linhas | ✅ Single canonical (approved · D-045) |
| Decision Log | `prds/.../.decision-log.md` | 41KB · D-001..D-046 | ✅ Imutável após D-040; D-045/046 appended |
| UX Design | — | — | **N/A — HDD v1 sem UI (NFR-O5)** |

### Supplementary inputs (synthesis trail)

- 3× Resumos finalização 3-tier obrigatórios D-019: PRD v2, Architecture, Epics
- `whatsapp-templates-utility.md` — 6 templates UTILITY designed
- `review-rubric.md` — PRD review rubric
- 9× `step-*-elicitation-*.md` — synthesis trail completo `bmad-create-architecture`
- `finalization-summary-templates.md` — Templates Tier-A/B/C

### Issues identificados

#### 🟢 Critical issues (duplicados / missing required)

**Zero**. Sem duplicados whole vs sharded; sem documentos required em falta. UX `N/A` é constraint de design, não missing artifact (PRD NFR-O5 + Architecture Step 04 `Frontend Architecture: N/A no v1`).

#### 🟡 Minor housekeeping (não-bloqueante)

- `prds/.../bmad-prd-summary.md` (v1) está superseded por `bmad-prd-summary-v2.md` post D-021..D-030 reconciliation. Pode ser arquivado ou marcado `[DEPRECATED]`. Não bloqueia readiness check.
- 9 `step-*-elicitation-*.md` files são preservados como synthesis trail — não causam confusão (não são candidate canónico para nenhum tipo de documento).

### Confirmações

- ✅ **PRD canónico** = `prd.md` v2 (post D-021 brief reconciliation)
- ✅ **Architecture canónico** = `architecture.md` (8 steps · 186 AOs)
- ✅ **Epics canónico** = `epics.md` (7 epics · 50 stories · StorySpec completo)
- ✅ **UX status** = N/A (explicit no scope v1)
- ✅ **Sem duplicados** a resolver
- ✅ **Workflows prévios todos approved** (D-030 PRD · D-040 Architecture DRB · D-045 Epics)

---

## Step 02 — PRD Analysis

> PRD v2 carregado completamente (`prds/prd-projeto_hdd-2026-05-20/prd.md`, 443 linhas + addendum 14KB). Extracção formal validada contra Requirements Inventory já consolidado em `epics.md` (workflow `bmad-create-epics-and-stories`).

### Functional Requirements (PRD §7)

Organizados em **9 features F1-F9** com numeração FR-NNN explícita.

**F1 — Pipeline bimodal orquestrado pelo BMad Master (FR-001..FR-006, 6)**
- FR-001 Modo Colaborativo no Claude Code interactivo + BMAD v6.7.1 instalado
- FR-002 Modo Autónomo em worker Bun nativo VPS própria (D-043 update sobre v1 OpenClaw)
- FR-003 Transição Colab→Auton requer sucesso `bmad-check-implementation-readiness` *(este workflow)*
- FR-004 BMad Master coordena Dev/Review/QA com contexto isolado
- FR-005 Sub-agentes invocam `bmad_save_artifact` + `bmad_complete_workflow`
- FR-006 Worker permite invocação programática skills BMAD (CLI-wrapper)

**F2 — Regra de Interrupt (FR-010..FR-017, 8)**
- FR-010 P1 — gap PRD/Arq↔Código detector no `bmad-code-review`
- FR-011 S1 — watchdog timer 30 min default
- FR-012 S2 — contador retries 5 consecutivas
- FR-013 S3 — timeout-poll WhatsApp 3msg/10min
- FR-014 P1/S1/S2 pausa + grava state + aguarda
- FR-015 S3 NÃO pausa; troca canal e segue
- FR-016 Toda mensagem auditada no JSONL
- FR-017 Outros gatilhos → v1.1+

**F3 — Canal WhatsApp (clihelper) + fallback (FR-020..FR-030a, 11)**
- FR-020 Não fala directamente com Meta Cloud API — usa clihelper proprietário
- FR-021 POST endpoints template / template-sem-variavel
- FR-022 Header Authorization (Bearer)
- FR-023 Payload schema clihelper completo
- FR-024 Webhook listener inbound + Quick Reply + NLP Haiku
- FR-025 Rate-limit 1 req/s leaky bucket
- FR-026 6 templates UTILITY (3 mínimo M1)
- FR-027 Retry 429/5xx + circuit breaker
- FR-028 Custo WhatsApp = $0 lado HDD
- FR-029 Fallback Resend
- FR-030a Idempotency key SHA-256 pré-POST

**F4 — Worker autónomo VPS (FR-030b..FR-034, 5)**
- FR-030b Worker em VPS própria (Bun)
- FR-031 Subcomandos `start/pause/resume/status/logs`
- FR-032 Sobrevive a restart (crash recovery via state store)
- FR-033 BMAD invoker via CLI-wrapper (Sprint 0 Day 1 validation)
- FR-034 Single-project v1

**F5 — State store + idempotência (FR-040..FR-044, 5)**
- FR-040 State store schema mínimo
- FR-041 Idempotência por story = gate
- FR-042 bun:sqlite + Drizzle
- FR-043 Rollback parcial (AO-43 stub v1)
- FR-044 Audit log JSONL hash chain + RFC 3161

**F6 — Gates de qualidade nos handoffs (FR-050..FR-052, 3)**
- FR-050 4 handoff gates explícitos
- FR-051 Falha gate auditada
- FR-052 Diagnóstico estruturado em falha

**F7 — Gestão de janela LLM Max 20x (FR-060..FR-065, 6)**
- FR-060 Budget = janela Max 20x (não USD)
- FR-061 Notificação 80% janela
- FR-062 Pause em exhausted + `--hard-stop`
- FR-063 Telemetry consumo por sub-agente
- FR-064 Opus/Sonnet/Haiku selection (hybrid D-044)
- FR-065 Downgrade automático

**F8 — Resumo de Finalização 3-tier (FR-070..FR-076, 7)**
- FR-070 Resumo 3-tier automático em finalização
- FR-071 Tier-A WhatsApp + Tier-B link + Tier-C audit
- FR-072 Pause em `paused-awaiting-review`
- FR-073 Respostas `approve / request_changes / reject`
- FR-074 Resumo permanente committed git
- FR-075 Diff side-by-side
- FR-076 Mecânica Quick Reply payloads

**F9 — Bootstrap, configuração, operação (FR-080..FR-084, 5)**
- FR-080 Bootstrap doc + systemd setup
- FR-081 Verificação pré-requisitos no start
- FR-082 Fail closed em credenciais missing
- FR-083 Overrides `_bmad/custom/`
- FR-084 `hdd-worker logs` tail JSONL

**Total FRs:** **56** (`6+8+11+5+5+3+6+7+5`)

### Non-Functional Requirements (PRD §8)

Organizados em **7 categorias** com numeração NFR-XN.

**NFR-S — Segurança (6):** vault secrets · redaction multi-pattern · sandbox docker --network=none · revisão humana superfícies sensíveis · clihelper risks mitigated · SSH key-only + firewall mínimo

**NFR-R — Confiabilidade (5):** crash recovery via state store · retry exp 2s/5/60s · concurrent stories serializadas · idempotência por story gate · pipeline não pára em S3

**NFR-O — Observabilidade (5):** `status` ≤2s · consumo janela consultável · JSONL fonte primária tail-able · métrica "interrupts pendentes" · sem dashboard gráfico v1

**NFR-P — Performance (3):** cold start ≤30s · latência interrupt→WhatsApp ≤10s · sem throughput agressivos

**NFR-M — Manutenibilidade (3):** BMAD pinned v6.7.1 · overrides `_bmad/custom/` · BMAD_Openclaw versão pinada (v1.1+ se reactivado)

**NFR-U — Usabilidade (4):** WhatsApp telemóvel · mensagens PT · Tier-A ≤200 palavras · `--help` claro

**NFR-C — Compliance (2):** v1 N/A · v1.1+ SBOM + IP/licenças audit

**Total NFRs:** **28**

### Additional Requirements / Constraints

- **3 princípios não-negociáveis P-1/P-2/P-3** (§3.1) — gates de release
- **5 marcos M0-Q4-2026** (§3.3) com counter-métricas
- **6 não-objetivos N-1..N-6** explícitos (§3.4)
- **Roadmap v1 / v1.1 / Vision 3 anos** (§5.3)
- **9 pré-requisitos** (§9.1) — 4 ✅ + 5 ⚠️ a validar + 1 ❌ (BMAD_Openclaw plugin substituído por D-043)
- **10 riscos R-1..R-10** com probabilidade/impacto/mitigação (§10)
- **11 open questions** OQ-A..H + O-2/O-9/O-10 (§11) — todas fechadas em workflows downstream (Architecture + Epics)
- **14 assumptions** A-01..A-14 (§14) com índice de estado

### PRD Completeness Assessment

| Dimensão | Estado |
|---|---|
| Vision & Context (§1) | ✅ Tese clara · 2 modos colaborativo/autónomo bem definidos |
| Problema & Oportunidade (§2) | ✅ Quantificado · operador-anchored |
| Objetivos & Métricas (§3) | ✅ 3 princípios + 5 marcos + 6 não-objetivos |
| Personas (§4) | ✅ Primária `paulotodo` + secundária diferida v1.1+ |
| Escopo (§5) | ✅ Inclui/Não-inclui explícitos + D-043 clarification post-architecture |
| User Journeys (§6) | ✅ UJ-1..UJ-4 cobertos |
| Features (§7) | ✅ 9 features F1-F9 com 56 FRs numerados |
| NFRs (§8) | ✅ 7 categorias com 28 NFRs |
| Pré-requisitos & Pressupostos (§9) | ✅ Validados ou marcados ⚠️ |
| Riscos (§10) | ✅ 10 riscos rated |
| Open Questions (§11) | ✅ Todas fechadas em workflows downstream (D-031..D-046) |
| Próximos Workflows (§12) | ✅ Sequência documented |
| Glossário (§13) | ✅ 24 termos |
| Index Assumptions (§14) | ✅ A-01..A-14 com status tracking |

**Reconciliação brief autoritativo (D-021):** PRD v2 reconciliou com brief autoritativo descoberto post-PRD-v1. Memória `feedback-bmad-prd-discover-brief` registada para evitar repetição.

**Updates post-architecture:**
- §5 `🔔 D-043` clarification — OpenClaw → worker Bun nativo + CLI-wrapper
- §7.1 FR-002 + §7.4 FR-033 + §7.9 FR-080/FR-081 updated com D-043

**PRD verdict (initial — pre coverage validation):** **COMPLETO** para readiness check.

---

## Step 03 — Epic Coverage Validation

> `epics.md` carregado completamente (~2000 linhas, 50 stories). FR Coverage
> Map interna validada FR-a-FR contra PRD §7. Cada FR rastreado ao **epic
> primário + story_id específica** (não apenas epic).

### Coverage Matrix completa (56 FRs)

#### F1 — Pipeline bimodal (6 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-001 | Modo Colaborativo CC + BMAD v6.7.1 | E2 → 2.2 (BMAD invoker) | ✅ Covered |
| FR-002 | Worker Bun nativo VPS (D-043) | E2 → 2.2 + 1.c.7 (smoke) | ✅ Covered |
| FR-003 | Transição Colab→Auton requer readiness check | **THIS WORKFLOW** (process) | 🟦 Process marker |
| FR-004 | Sub-agentes Dev/Review/QA contexto isolado | E2 → 2.3 (sub-agent-runner) | ✅ Covered |
| FR-005 | `bmad_save_artifact` + `bmad_complete_workflow` | E2 → 2.2 (post Party Mode #2 fix) | ✅ Covered |
| FR-006 | Invocação programática BMAD via CLI-wrapper | E1.c → 1.c.7 + E2 → 2.2 | ✅ Covered |

#### F2 — Regra de Interrupt (8 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-010 | P1 gap detector | E4 → 4.1 | ✅ Covered |
| FR-011 | S1 watchdog 30min | E4 → 4.2 | ✅ Covered |
| FR-012 | S2 contador 5 retries | E4 → 4.3 | ✅ Covered |
| FR-013 | S3 timeout-poll 3/10min | E4 → 4.4 | ✅ Covered |
| FR-014 | P1/S1/S2 pausa + state + aguarda | E4 → 4.1, 4.2, 4.3 | ✅ Covered |
| FR-015 | S3 não pausa; troca canal | E4 → 4.4 + E3 → 3.6 | ✅ Covered |
| FR-016 | Mensagens auditadas no JSONL | E1.a → 1.a.6 + E3 → 3.4 | ✅ Covered |
| FR-017 | Outros gatilhos → v1.1+ | — | 🟨 Deferral marker (not implementable v1) |

#### F3 — Canal WhatsApp + Fallback (11 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-020 | Não Meta direct; clihelper proprietário | E3 → 3.1 | ✅ Covered |
| FR-021 | Endpoints template/template-sem-variavel | E3 → 3.1 | ✅ Covered |
| FR-022 | Header Authorization Bearer | E3 → 3.1 | ✅ Covered |
| FR-023 | Payload schema clihelper | E3 → 3.1 | ✅ Covered |
| FR-024 | Webhook listener + Quick Reply + NLP | E3 → 3.4, 3.5 | ✅ Covered |
| FR-025 | Rate-limit 1 req/s | E3 → 3.2 | ✅ Covered |
| FR-026 | 6 templates UTILITY (3 mínimo M1) | E3 → 3.3 | ✅ Covered |
| FR-027 | Retry 429/5xx + CB | E3 → 3.2 | ✅ Covered |
| FR-028 | Custo $0 lado HDD | — | 🟨 Observational constraint (not implementable) |
| FR-029 | Fallback Resend | E3 → 3.6 | ✅ Covered |
| FR-030a | Idempotency key SHA-256 pré-POST | E1.a → 1.a.5 (gen) + E3 → 3.1/3.2 (consume) | ✅ Covered |

#### F4 — Worker autónomo VPS (5 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-030b | Worker em VPS própria (Bun) | E1.c → 1.c.1 (systemd) | ✅ Covered |
| FR-031 | Subcomandos start/pause/resume/status/logs | E2 → 2.1, 2.6 | ✅ Covered |
| FR-032 | Sobrevive a restart (recovery) | E5 → 5.1 | ✅ Covered |
| FR-033 | BMAD invoker via CLI-wrapper | E2 → 2.2 | ✅ Covered |
| FR-034 | Single-project v1 | — | 🟨 Design constraint (enforced by absence of multi-project code) |

#### F5 — State store + idempotência (5 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-040 | State store schema mínimo | E1.a → 1.a.5 (schema) + E2 → 2.6 (consume) | ✅ Covered |
| FR-041 | Idempotência = gate | E1.a → 1.a.5 (key gen + helpers) + E5 → 5.2 (drills) | ✅ Covered |
| FR-042 | bun:sqlite + Drizzle | E1.a → 1.a.5 | ✅ Covered |
| FR-043 | Rollback parcial stub v1 | E5 → 5.3 | ✅ Covered (stub; AO-43 auto-rollback v1.1+) |
| FR-044 | Audit log JSONL hash chain + RFC 3161 | E1.a → 1.a.6 | ✅ Covered |

#### F6 — Gates de qualidade (3 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-050 | 4 handoff gates explícitos | E2 → 2.4 (Story→Dev) + 2.5 (Dev→Review) + E4 → 4.5 (Review→QA) | ✅ Covered |
| FR-051 | Falha gate auditada | E2 → 2.4 | ✅ Covered |
| FR-052 | Diagnóstico estruturado em falha | E2 → 2.4 + E4 → 4.5 | ✅ Covered |

#### F7 — Janela LLM Max 20x (6 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-060 | Budget = janela Max 20x (não USD) | E6.a → 6.a.2 | ✅ Covered |
| FR-061 | Notificação 80% janela | E6.a → 6.a.3 | ✅ Covered |
| FR-062 | Pause exhausted + `--hard-stop` | E6.a → 6.a.3 (pause hardcoded) + E6.b → 6.b.2 (`--hard-stop`) | ✅ Covered |
| FR-063 | Telemetry consumo por sub-agente | E6.a → 6.a.2 | ✅ Covered |
| FR-064 | Opus/Sonnet/Haiku selection hybrid D-044 | E6.a → 6.a.1 | ✅ Covered |
| FR-065 | Downgrade automático | E6.b → 6.b.1 | ✅ Covered (Sprint 2) |

#### F8 — Resumo 3-tier (7 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-070 | Resumo 3-tier automático | E1.a → 1.a.8 (Tier-B/C antecipado) + E7.b → 7.b.1 (Tier-A) | ✅ Covered |
| FR-071 | Tier-A WhatsApp + Tier-B link + Tier-C audit | E1.a → 1.a.8 + E7.b → 7.b.1 | ✅ Covered |
| FR-072 | Pause em `paused-awaiting-review` | E1.a → 1.a.8 | ✅ Covered |
| FR-073 | Respostas `approve/request_changes/reject` | E1.a → 1.a.8 (CLI) + E7.b → 7.b.2 (Quick Reply) | ✅ Covered |
| FR-074 | Resumo committed git | E1.a → 1.a.8 | ✅ Covered |
| FR-075 | Diff side-by-side | E1.a → 1.a.8 | ✅ Covered |
| FR-076 | Quick Reply payloads `fin_*` | E7.b → 7.b.2 + E1.a → 1.a.4 (contract) | ✅ Covered |

#### F9 — Bootstrap & operação (5 FRs)

| FR | PRD Requirement | Epic + Story | Status |
|---|---|---|---|
| FR-080 | Bootstrap doc + systemd | E1.c → 1.c.1, 1.c.4 | ✅ Covered |
| FR-081 | Verificação pré-requisitos no start | E1.a → 1.a.7 + E1.c → 1.c.7 | ✅ Covered |
| FR-082 | Fail closed em credenciais missing | E1.a → 1.a.7 | ✅ Covered |
| FR-083 | Overrides `_bmad/custom/` | — | 🟨 BMAD installer native behavior (no story needed) |
| FR-084 | `hdd-worker logs` tail JSONL | E2 → 2.1 | ✅ Covered |

### Missing Requirements

#### Critical missing
**Zero.**

#### Categorization da "não-cobertura aparente"
4 FRs aparecem sem story dedicada mas têm rationale documented:

| FR | Categoria | Rationale |
|---|---|---|
| FR-003 | 🟦 **Process marker** | Gate de transição executado por **este workflow** (`bmad-check-implementation-readiness`); não é story interna do `epics.md`. |
| FR-017 | 🟨 **Deferral marker** | "Outros gatilhos → v1.1+" — explicitamente não-implementable v1; é statement de scope. |
| FR-028 | 🟨 **Observational constraint** | "Custo WhatsApp = $0 lado HDD" — emergent property da topologia clihelper, não code path. |
| FR-034 | 🟨 **Design constraint** | "Single-project v1" — enforced por ausência de multi-tenancy code, não feature implementável. |
| FR-083 | 🟨 **External behavior** | "Overrides `_bmad/custom/`" — comportamento nativo do BMAD installer já existente. |

### Coverage Statistics

- **Total PRD FRs:** 56
- **Story-level coverage (story_id explicit):** **51/56**
- **Process marker (covered by this workflow):** 1/56 (FR-003)
- **Design constraints / deferral / observational (não-implementable):** 4/56 (FR-017, FR-028, FR-034, FR-083)
- **Critical missing:** **0/56**
- **Effective coverage:** **100%** addressable
- **Wiring AOs derivadas** (PM2-1 ronda Party Mode #2): 3 ACs adicionados em Stories 2.3 (path traversal enforcement), 3.4 (redaction pre-write), 2.6 (two-step confirmation gate consult)

### Coverage verdict

**✅ COVERAGE FULL** — não há FRs com missing implementation path. Trail PRD §7 → `epics.md` FR Coverage Map → Story `ao_subset[]` complete and consistent.

---

## Step 04 — UX Alignment

### UX Document Status

**🟦 N/A — explicitamente fora de scope v1.**

Search patterns `*ux*.md` / `*ux*/index.md` → **0 ficheiros encontrados**.

### Assessment: UX/UI implied?

Avaliei se UX/UI está implícita apesar da ausência de documento dedicado. **Não está** — a ausência é **decisão de design consciente e documentada**:

| Evidência | Fonte | Conteúdo |
|---|---|---|
| PRD NFR-O5 | `prd.md` §8.3 | *"No v1: observabilidade via WhatsApp + JSONL + Resumos de Finalização. **Sem dashboard gráfico** (v1.1+)."* |
| PRD §5.2 Não inclui | `prd.md` §5.2 | *"Dashboard visual de monitorização (logs JSONL bastam)."* |
| PRD §5.2 Não inclui | `prd.md` §5.2 | *"Suporte multi-projeto simultâneo (um por vez)."* — sem multi-tenant UI implied |
| PRD N-6 não-objetivo | `prd.md` §3.4 | *"Dashboard visual de monitorização — logs JSONL + Resumos de Finalização + WhatsApp bastam."* |
| Architecture Step 04 | `architecture.md` linha 674-676 | *"**Frontend Architecture: N/A no v1.** Não há UI gráfica (NFR-O5: observability via JSONL + WhatsApp + Resumos)."* |
| Epics & Stories | `epics.md` UX Design Requirements section | *"N/A — sem UI v1. NFR-O5 declara observability via JSONL + WhatsApp + Resumos 3-tier. Dashboard gráfico diferido v1.1+."* |

### Interface real do HDD v1 (sem UI gráfica)

3 interfaces operacionais documentadas e implementadas em stories:

| Interface | Tipo | Stories |
|---|---|---|
| **CLI `hdd-worker`** | Terminal commands (Commander.js) | 2.1, 2.6, 6.b.2 |
| **WhatsApp templates + Quick Reply** | Messaging templates (Meta-aprovado) | 3.1-3.6, 4.1-4.4, 7.b.1, 7.b.2 |
| **JSONL audit + Resumos 3-tier Markdown** | File outputs (tail-able + git-committed) | 1.a.6, 1.a.8, 1.a.9, 7.b.1 |

### UX/PRD/Architecture Alignment (no UI)

| Dimensão | PRD | Architecture | Epics | Aligned? |
|---|---|---|---|---|
| Sem UI gráfica v1 | N-6, NFR-O5, §5.2 | Step 04 explicit | UX-DR section N/A | ✅ |
| WhatsApp como canal primário | P-3, §7.3 | clihelper integration | E3 + E4 | ✅ |
| CLI `hdd-worker` como controlo | FR-031, FR-084 | bootstrap design | E2 stories | ✅ |
| NFR-U usabilidade aplicável a WhatsApp PT + Tier-A ≤200 palavras + `--help` claro | §8.6 | Tier-A template spec | 1.a.8 + 7.b.1 + 2.1 | ✅ |
| Acessibility / responsive / design tokens | — (N/A no scope) | — | — | N/A |

### UX Alignment Issues

**Zero** — alinhamento é trivially consistent porque os 3 documentos canónicos
declaram explicitamente "sem UI v1" como decisão e enforced via NFR-O5.

### Warnings

**Zero.** A ausência de UX document **não constitui gap** — é decisão de
design consciente, documented + enforced. v1.1+ pode adicionar dashboard
local (Grafana ou similar), altura em que será necessário invocar
`bmad-create-ux-design` antes de prosseguir.

### UX Verdict

**✅ ALIGNED (N/A constraint validated)** — nenhum trabalho de UX adicional
requerido para readiness check.

---

## Step 05 — Epic Quality Review (autonomous)

> Auto-validação rigorosa contra `bmad-create-epics-and-stories` standards.
> 50 stories × 7 epics × 4 sub-milestones. Verificação automatizada complementa
> análise manual.

### A. User Value Focus (per epic)

| Epic | Title | Hover-test "what user can do?" | Status |
|---|---|---|---|
| E1.a | Runtime Scaffold & Core Contracts | "Operador tem ambiente Bun reproduzível com Resumo Tier-B gerable Day 4-5" | 🟡 **Borderline accepted** — DRB-mandated foundational; Pre-Mortem PM-1 split em sub-milestones com Resumo Tier-B per sub torna outcome observable Day 4-5/9-10/15-21 |
| E1.b | Safety BLOCKERS | "Operador tem assurance documentada que path traversal + redaction + 2-step gates fechados (PT-1..PT-8 verde)" | 🟡 **Borderline accepted** — DRB-mandated safety; outcome = PT suite green + sign-off documentável |
| E1.c | Bootstrap & Operations | "Operador faz `systemctl start hdd-worker` e tem serviço supervised + 8 runbooks + SSH deploy" | 🟡 **Borderline accepted** — entrega serviço operacional completo |
| E2 | Worker Autónomo & Pipeline Bimodal | "Operador dispara `hdd-worker start` e worker orquestra Dev/Review/QA até story complete ou pause" | ✅ Clear |
| E3 | Canal WhatsApp + Fallback | "Operador recebe templates no telemóvel + responde Quick Reply / texto; falha → e-mail" | ✅ Clear |
| E4 | Regra de Interrupt | "Worker pausa inteligentemente e contacta operador; troca canal sem parar em falha WhatsApp" | ✅ Clear |
| E5 | Crash Recovery & Rollback Stub | "Operador tem assurance documentada de idempotência via crash drill suite verde" | ✅ Clear |
| E6.a | Janela LLM Telemetry & 80% Notify | "Operador vê consumo % janela em `status`; recebe warning em 80%; demo M1 não bate exhausted silently" | ✅ Clear |
| E6.b | Downgrade & Hard-Stop | "Em window-exhausted, pipeline pode continuar degraded via downgrade Sonnet→Haiku; CI usa `--hard-stop`" | ✅ Clear |
| E7.b | Tier-A WhatsApp + Pentest Final | "Operador recebe Tier-A ≤200 palavras no telemóvel + 1-click approve; M1 sign-off com PT-1..PT-8 verde" | ✅ Clear |

**Borderline epics (E1.a/b/c) documented exception** — Pre-Mortem PM-1 fix:
quebrados em sub-milestones com Resumo Tier-B per sub. Não constitui violation
"technical-milestone epic" porque DRB explicit + outcome observable.

### B. Epic Independence

| Test | Resultado |
|---|---|
| E1 standalone (Sprint 0 completable sem features) | ✅ Sim — entrega ambiente operacional |
| E2 standalone (worker sem E3-E7) | ✅ Sim — pausa em interrupt fica `paused_for_interrupt` aguardando até E3+E4 live |
| E3 standalone (canal sem E4 interrupts) | ✅ Sim — adapters HTTP + listener + Resend = unidade |
| E5 standalone | ✅ Sim — recovery boot + drills independents |
| E6.a standalone | ✅ Sim — telemetry sem downgrade entrega valor |
| E7.b standalone (Tier-A sem outros workflows) | ✅ Sim — Tier-A funciona em isolado |

**Zero circular dependencies. Zero "Epic N+1 needed for Epic N to function".**

### C. Story Quality

| Métrica | Resultado |
|---|---|
| Stories total | 50 |
| Stories com StorySpec completo (11 campos) | 50/50 ✅ |
| Stories com ACs Given/When/Then | 50/50 ✅ |
| Stories com `ao_subset[]` 4-8 AOs | 50/50 ✅ |
| Stories com `estimated_tokens` (dev_core + dev_with_retry) | 50/50 ✅ |
| Stories com `pri_feature: F1..F9 \| foundational` | 50/50 ✅ |
| ACs tagged `binary \| property \| coverage` | 50/50 ✅ |
| Unique files declared in `files_created` | 83 distinct files |
| Files created by **multiple stories** (potential duplicate work) | **0** ✅ |

### D. Dependency Analysis (CRITICAL)

#### Within-Epic forward dependencies
**Zero** detected — cada `blocked_by[]` aponta apenas a stories anteriores.

#### Inter-Epic forward dependencies (auto-detected)

🟠 **Major Issue identificado:**

| Story | blocked_by | Análise |
|---|---|---|
| **Story 3.5** (NLP Haiku classifier em E3) | `6.a.1` | Aponta a story em E6.a. **Forward** porque E3 < E6.a no DAG. |
| **Story 4.1** (P1 gap detector em E4) | `6.a.1` | Mesmo issue. |

**Root cause:** Story 6.a.1 (`AnthropicAdapter` dual-mode) entrega **2 capabilities distintas**:
- Part-A: `LLMPort` interface + adapter Haiku via SDK (foundational adapter)
- Part-B: dispatcher logic + cache strategy + role-based selection (E6.a-specific)

E3 e E4 precisam apenas de Part-A.

**Remediation recomendada (não-bloqueante; pode ser aplicada em Sprint Planner ou via `bmad-correct-course`):**

**Opção 1 (preferred):** Split Story 6.a.1:
- **Move Part-A → E1.a** como Story **1.a.10** "LLMPort + AnthropicAdapter foundational (Haiku SDK + Sonnet CLI base wiring)"
- **Keep Part-B em E6.a** como Story 6.a.1 reduzida "Dispatcher logic + cache strategy + role selection"
- Remove forward dependencies 3.5/4.1 → 6.a.1; replace com 3.5/4.1 → 1.a.10

**Opção 2 (alternativa):** Documentar dependency cross-epic como conscious exception + reordenar Sprint 1 para E6.a antes de E3 finalizar. Less clean.

**Recommendation:** Opção 1 reduz Sprint 1 risk (adapter foundational antes de NLP/gap-detector consumers); aproveita Sprint 0 capacity excess se assumption Cenário B sair acima do esperado.

#### Texto livre em `blocked_by`
🟡 **Minor concern:** Story 7.b.3 declara `blocked_by: [1.b.5, all of E1.b]` em texto livre. Sprint Planner DAG parser pode falhar. **Remediation:** expandir para lista explícita `[1.b.1, 1.b.2, 1.b.3, 1.b.4, 1.b.5]`.

### E. Database/Entity Creation Timing

| Critério | Resultado |
|---|---|
| Story 1.a.5 cria tables base (`runs`, `stories`, `idempotency_keys`, `audit_events`) | ✅ Created **when first needed** (audit em 1.a.6 + recovery em 5.1 immediate consumers) |
| E5 adiciona migrations (recovery markers) | ✅ Adicional sem modificar baseline E1.a |
| E2/E3/E4/E6/E7 criam tables novas? | ❌ Nenhum |

**Progressive creation correctly enforced.**

### F. Starter Template Compliance

- Architecture Step 03 specifies **Bun base scaffold**
- Epic 1 Story 1 (1.a.1) = "Bun base scaffold + linting + test runner" ✅
- Inclui `bun install` + Biome + ESLint + `bun test` baseline + `package.json` + `tsconfig.json` ✅

### G. Greenfield Indicators

| Critério | Story |
|---|---|
| Initial project setup | 1.a.1 ✅ |
| Dev env configuration | 1.a.1 + 1.c.7 ✅ |
| CI/CD pipeline early | 1.c.4 ✅ |
| Sandbox/secret management foundational | 1.b.4 + 1.c.2 ✅ |
| Audit log foundational | 1.a.6 ✅ |
| Backup/restore strategy | 1.c.3 ✅ |

### H. Best Practices Compliance Checklist (per epic)

| Epic | User value | Independent | Story sizing | No fwd deps | DB timing | AC quality | FR trace |
|---|---|---|---|---|---|---|---|
| E1.a | 🟡 borderline accepted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| E1.b | 🟡 borderline accepted | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| E1.c | 🟡 borderline accepted | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| E2 | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| E3 | ✅ | ✅ | ✅ | 🟠 (3.5→6.a.1) | n/a | ✅ | ✅ |
| E4 | ✅ | ✅ | ✅ | 🟠 (4.1→6.a.1) | n/a | ✅ | ✅ |
| E5 | ✅ | ✅ | ✅ | ✅ | ✅ (incremental) | ✅ | ✅ |
| E6.a | ✅ | ✅ | ✅ | ✅ | n/a | 🟡 (PM2-3 Q1/Q2/Q3 follow-ups) | ✅ |
| E6.b | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |
| E7.b | ✅ | ✅ | ✅ | 🟡 (7.b.3 texto livre) | n/a | ✅ | ✅ |

### I. Findings consolidados por severidade

#### 🔴 Critical Violations
**Zero.**

#### 🟠 Major Issues (1)

**M-1.** Stories 3.5 (E3) + 4.1 (E4) **forward-depend** em Story 6.a.1 (E6.a).
**Remediation:** Opção 1 (preferred) — split Story 6.a.1 em Part-A (foundational, mover para E1.a como 1.a.10) + Part-B (dispatcher logic, manter E6.a). **Não bloqueia Sprint 0** mas deve ser fixed **antes de Sprint 1 começar E3/E4 work** — Sprint Planner ou `bmad-correct-course` pode aplicar.

#### 🟡 Minor Concerns (5)

**m-1.** Story 7.b.3 `blocked_by: [..., "all of E1.b"]` texto livre — Sprint Planner DAG parser pode falhar. **Remediation:** expandir para `[1.b.1, 1.b.2, 1.b.3, 1.b.4, 1.b.5]`.

**m-2.** Stories E1.a/b/c são borderline "technical-milestone" epics. **Aceito como exception** porque DRB-mandated foundational + Pre-Mortem PM-1 split em sub-milestones com Resumo Tier-B observable. Documented decision.

**m-3.** PM2-3 Q1 (Story 3.5 threshold absoluto) — **already fixed** em Step 04 do workflow `bmad-create-epics-and-stories`.

**m-4.** PM2-3 Q2 (Story 6.a.2 display string AC) — **calibrate Sprint 1 baseline** real. AC actualmente fragile vs format change.

**m-5.** PM2-3 Q3 (Story 6.a.2 `[ASSUMPTION]` API Anthropic usage metrics) — sem story dedicada para Plan B tokens-proxy. **Flag para Sprint 1 retrospective**: se API não devolve usage, criar new story.

### Step 05 Verdict

**✅ QUALITY ACCEPTABLE WITH 1 MAJOR + 5 MINOR FOLLOWUPS**

- Quality global é alta: 50 stories conformes, zero critical violations, zero duplicate file creation, zero circular deps, FR trace 100% addressable
- 1 Major Issue (forward dep 3.5/4.1 → 6.a.1) tem remediation clara e não bloqueia Sprint 0 — fix em Sprint Planner OU `bmad-correct-course` antes Sprint 1 E3/E4 start
- 5 Minor concerns são calibration-time issues, não-blockers

---

## Step 06 — Final Assessment

### Overall Readiness Status

# 🟡 **READY-WITH-CONDITIONS**

Confidence: **Medium-High**

Justificação:
- **Não é READY puro** porque existe 1 Major issue (forward dep cross-epic) que requer remediation
- **Não é NEEDS WORK / NOT READY** porque o Major não bloqueia Sprint 0 start, tem remediation < 1 dia, e nenhum critical violation foi encontrado
- **READY-WITH-CONDITIONS** captura accuradamente: artefactos completos + alinhados, com 1 fix técnico recomendado antes de Sprint 1 começar E3/E4 work

### Critical Issues Requiring Immediate Action

**Zero (0/56 FRs critical missing · 0 circular deps · 0 quality critical violations).**

### Conditions to Satisfy

#### C-1 (Major — pré Sprint 1 E3/E4 start, não-bloqueante Sprint 0)
**Split Story 6.a.1** em Part-A + Part-B:
- **Part-A** → mover para **E1.a como Story 1.a.10** "LLMPort + AnthropicAdapter foundational (Haiku SDK + Sonnet CLI base wiring)" — ports + adapters foundational consistent com pattern de outras adapters (Clock/Spawn/Notify/Audit)
- **Part-B** → manter em E6.a como Story 6.a.1 reduzida "Dispatcher logic + cache strategy + role selection"
- **Re-wire** `blocked_by` em Stories 3.5 e 4.1: `6.a.1` → `1.a.10`
- **Ferramenta:** `bmad-correct-course` (recomendado) OU manual edit em `epics.md` antes Sprint Planner

#### C-2 (Minor — pré Sprint Planner)
**Expandir Story 7.b.3 `blocked_by`** de `[1.b.5, "all of E1.b"]` para lista explícita `[1.b.1, 1.b.2, 1.b.3, 1.b.4, 1.b.5]` — Sprint Planner DAG parser legibility.

#### C-3 (Minor — Sprint 0 Day 1 hard prereq, DRB-mandated)
**4 Sprint 0 BLOCKERS** (já documentados em `epics.md` E1.a/b/c + Decision Log D-046):
1. Story **1.c.7** `bmad-cli` non-interactive smoke test (Day 1 first thing — bloqueia E2)
2. Operador: submeter **3 templates Meta** (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`) — aprovação 1-3 dias (AO-86 escalation gate Day 7)
3. Operador: configurar **`ANTHROPIC_API_KEY`** em `/etc/hdd/secrets.env` (AR-074 + AO-185)
4. AO-86 webhook schema inbound clihelper — esperar payload real; se Day 7 ausente → `webhook-mock=true` feature flag + `[OPEN]` flag persistente

#### C-4 (Minor — calibration durante Sprint 1, não-bloqueante)
- **Story 6.a.2** `[ASSUMPTION]` API Anthropic devolve usage metrics — validar Sprint 1 semana 1; se falso, criar story Plan B tokens-proxy
- **Story 6.a.2** display string AC (`"Window: 35% used"`) — refactor AC para comparar **valor numérico** subjacente, não format string
- **Capacity assumption Cenário B** (D-046) — registar pace observado em `_bmad-output/audit/<project>/capacity.log` semana 1 Sprint 0; recalibrate Sprint 1 estimates

### Recommended Next Steps

1. **Aplicar Condition C-1** (recomendado via `bmad-correct-course` antes de outros workflows) — `[ESTIMATE 30 min]`
2. **Aplicar Condition C-2** (minor edit em `epics.md` Story 7.b.3) — `[ESTIMATE 5 min]`
3. **Operador parallel actions (Sprint 0 Day 1 ou antes):**
   - Submeter 3 templates Meta ao clihelper UI (lead time 1-3 dias por template)
   - Configurar `ANTHROPIC_API_KEY` em `/etc/hdd/secrets.env` perm 0600
   - Solicitar schema callback inbound real à equipa clihelper (AO-86)
4. **Invocar `bmad-sprint-planning`** com `epics.md` + `architecture.md` como input — popula DAG real + assigna stories a sprints com capacity Cenário B Expected (D-046)
5. **Sprint 0 Day 1 imediato:** Story 1.c.7 `bmad-cli` smoke test (Plan B docs em `docs/decisions/bmad-cli-vs-plan-b.md` se falhar)
6. **Resumo Tier-B per sub-milestone E1.a/b/c** durante Sprint 0 — D-019 enforced via `summary-generator.service` antecipado em Story 1.a.8

### Risks acknowledged

- **R-1.** Sprint 0 deslizar — Cenário B Expected é median; pessimistic (Cenário C) deslizaria M1 1.5 mês
- **R-2.** Templates Meta rejeitados — aprovação 1-3 dias mas re-submissions possíveis; mitigação `webhook-mock` feature flag + 3 templates mínimos
- **R-3.** `bmad-cli` falhar smoke test — Plan B documented 4-6h (Claude Code headless ou re-implement subset BMAD em TS)
- **R-4.** Composition risks identified em architecture (17 found by AI Safety + Pentester) já absorvidos em AOs

### Final Note

Esta avaliação identificou **1 Major issue** (Condition C-1, remediation < 1 dia) e **5 Minor issues** (calibration-time, non-blocking). **Zero critical violations.** Trail completo PRD §7 (56 FRs) → `epics.md` (51 stories com story_id + 5 design constraints) → StorySpec `ao_subset[]` (186 AOs activas) é **100% addressable**.

**Recomendação:** aplicar Conditions C-1 + C-2 (≤45 min total), validar Sprint 0 Day 1 actions, e prosseguir para `bmad-sprint-planning` + Sprint 0 imediatamente. O projeto está em condições genuinamente boas para entrar em Modo Autónomo.

### Avaliação

| Dimensão | Score | Notas |
|---|---|---|
| Document completeness | 10/10 | 3 canónicos + 3 summaries + decision log 46 entries |
| PRD quality | 10/10 | 14 dimensões verdes; v2 reconciliada com brief |
| FR Coverage | 10/10 | 51/56 story-level + 5 não-implementable rationalized |
| UX Alignment | 10/10 | N/A constraint corroborated em 6 fontes |
| Epic quality | 8/10 | 50/50 StorySpec complete; 1 forward dep cross-epic remediable |
| Story acceptance criteria | 9/10 | Given/When/Then + tag binary/property/coverage; 5 calibration follow-ups Sprint 1 |
| Sprint 0 readiness | 9/10 | 4 BLOCKERS DRB-mandated documented + scheduled |
| Governance D-019 | 10/10 | Resumo Tier-B antecipado E1.a; enforced Day 1 via CLI review |
| **Overall** | **9.5/10** | **READY-WITH-CONDITIONS** |

---

**Date:** 2026-05-22
**Assessor:** bmad-check-implementation-readiness (Claude Opus 4.7 1M)
**Verdict:** 🟡 READY-WITH-CONDITIONS · Medium-High confidence

