---
title: "Step 07 — Elicitation Results · HDD Validation"
workflow: bmad-create-architecture
step: 7
date: 2026-05-22
techniques: [devils-advocate-readiness-challenge, party-mode-ai-safety-auditor]
status: pending-synthesis-approval
---

# Step 07 — Elicitation Results

## A — Devil's Advocate: Challenge "READY WITH MINOR GAPS"

12 challenges sérios contra o verdict optimista. Honest re-assessment:

**Verdicts honestos:**
- **Verdadeiro:** 144 AOs cognitive load (futurepaulotodo provou autor violou próprias AOs); AO-86 SPoF sub-mitigado; schemas formais não testados; Bun runtime exotic bug risk; Sprint 0 prereqs adiciona 1-2 semanas
- **Parcialmente verdadeiro:** 9 rondas elicitation/16 perspectivas (últimas 2-3 adicionaram valor real); meta-dogfood circular dependency (mitigável)
- **Discutível:** "simpler alternative test" (operador escolheu OpenClaw+BMAD, decisão explícita)

**4 AOs derivadas (AO-151..AO-154):**

| # | Obrigação |
|---|---|
| **AO-151** | Cost realistic model em `docs/cost-model.md`: 2-3M tokens/mês baseline; break-even Max 20x vs API pay-per-token; reavalia mensal |
| **AO-152** | Reviewer "warning mode" durante primeira semana — todas issues como WARN; threshold REJECTED só após Day 7 + baseline FP observed |
| **AO-153** | Sprint 0 inclui rehearsal de Plan B switches: (a) Bun→Node migration 1×; (b) Anthropic Max 20x → API switch 1× |
| **AO-154** | Primeira story do piloto = feature isolada do HDD que NÃO modifica worker em execução. Evita meta-dogfood cognitive contamination |

**Re-verdict tentativo:** "READY WITH MAJOR RISKS" (intermediate entre MINOR GAPS e NOT READY).

---

## P — AI Safety Auditor Final Pass

Identificou **9 failure modes específicos** ao HDD não cobertos por outras 16 perspectivas. **3 são CRITICAL blockers M1.**

### Critical Blockers (must resolve Sprint 0)

**FM-1: Prompt Injection via Webhook clihelper (texto livre)**
- Vector: operador copia texto suspeito → Haiku parser pode classificar erroneamente como `p1_approve` se confidence ≥0.7
- Composição razoável (parser NLP + texto livre) torna-se vulnerabilidade
- **AO-155:** Acções irreversíveis (approve-merge, force-rollback, skip-gate) exigem two-step: Quick Reply inicial + código numérico 4 dígitos único por sessão gerado pelo worker. Texto livre nunca autoriza acções irreversíveis.

**FM-4: Dev Agent Self-Modification via Path Traversal**
- Vector: LLM gera `path: "../../src/adapters/llm/anthropic.adapter.ts"`; apply-diff escreve **fora** do sandbox no próprio worker
- AO-18 não cobre porque a escrita acontece fora do container (no step apply-diff antes do commit)
- **AO-158:** Path resolve + `startsWith(targetRoot)` assertion antes de qualquer `writeFile` LLM-generated. Falha = abort + P1 imediato.

**FM-6: clihelper Bearer Token Leak via Audit JSONL**
- Vector: `Authorization: Bearer <token>` aparece em error log 401 → escrito ao audit JSONL → sync R2 EU
- Se R2 bucket `public-read` por engano (comum em setups iniciais) → token exposto
- **AO-160:** Audit-redactor middleware filtra `Authorization`/`X-Api-Key`/`^Bearer\s` antes de append JSONL. R2 bucket `publicAccessBlock=true` validado no deploy script.

### High-priority failure modes (não bloqueiam M1 mas blockers ao primeiro sprint)

**FM-2: Audit JSONL Hash Chain Race Condition**
- Dev Story-A + Reviewer Story-B em paralelo → `seq` counter lido por ambos como N antes de write
- `O_APPEND` é atómico por syscall, não pela sequência read-compute-write
- **AO-156:** Audit logger serializado via Bun worker thread único OR `bun:sqlite` como buffer primário com flush async para JSONL — `BEGIN IMMEDIATE` passa a cobrir seq+hash

**FM-3: Token Budget Bypass via Tool_Use Multi-Turn**
- LLMAdapter regista usage do evento final mas pode falhar acumular cada `message_delta` intermédio de tool_use streams
- **AO-157:** Audit `LLMAdapter.stream()` para somar `input_tokens + output_tokens` em cada `message_delta` event com `usage`, não só `message_stop`. Test multi-turn tool_use que verifica ledger == soma de todos os turns

**FM-5: Reviewer Threshold Drift (Mesa-Optimization)**
- Após 10-15 stories, context-bundle acumula exemplos de outputs Dev que passaram, sem rejeições
- Reviewer calibra-se para "estilo Dev típico"; AO-91 mede branch coverage não assertion quality
- **AO-159:** A cada 5 stories, injectar 2-3 exemplos canónicos de rejeições passadas (audit JSONL `REVIEW_FAILED`) como "negative exemplars" no context-bundle do Reviewer

**FM-7: Context-Bundle Stale — Implicit Decisions Lost**
- TTL 6 semanas refresca bundle; micro-convenções emergentes (não em ADR) perdem-se
- **AO-161:** Cada story extrai "padrões novos detectados" → `docs/decisions/micro-conventions.md`; sempre incluído no refresh independente do TTL

**FM-8: Litestream Lag + JSONL Divergence**
- SQLite `DONE` mas audit JSONL `STORY_COMPLETED` ainda em buffer; crash perde JSONL mas SQLite tem state via Litestream restore
- **AO-162:** Boot cross-check — para cada story `DONE` em SQLite, verificar `STORY_COMPLETED` no JSONL; discrepância → `NEEDS_REVIEW` + P1. JSONL fsync síncrono antes do FSM `BEGIN IMMEDIATE` final.

**FM-9: Story DAG Depth via Injected Sub-Stories**
- Código gerado em CI (rede mínima reaberta) pode POST novos stories ao Master Hono → bypass do DAG `story_deps`
- **AO-163:** CI usa network namespace separado sem rota para Master Hono socket; `max_stories_per_sprint=50` hard limit no orchestrator

### Overall AI Safety Verdict

> "HDD está bem arquitectado para single-operator agentic — AOs 1-154 cobrem com profundidade impressionante. Riscos residuais não são lacunas de negligência mas **pontos de composição** onde decisões razoáveis interagem mal: audit JSONL fora da SQLite tx boundary (FM-2/8); apply-diff fora do sandbox (FM-4); canal de controlo com estrutura TBD (FM-1). FM-4 e FM-1 são **blockers absolutos** para M1. Sistema deployável com segurança aceitável se AOs 155, 158, 160, 162 implementados; restantes (156, 157, 159, 161, 163) high-priority não-blocker."

### 9 AOs derivadas (AO-155..AO-163)

| # | Obrigação | Severity |
|---|---|---|
| **AO-155** | Two-step confirmation para acções irreversíveis (Quick Reply + código 4 dígitos sessão) | BLOCKER M1 |
| **AO-156** | Audit logger serializado (worker thread único OR SQLite buffer) | High |
| **AO-157** | LLMAdapter acumula usage em cada `message_delta` tool_use | High |
| **AO-158** | Path resolve + startsWith assertion antes de writeFile LLM-generated | BLOCKER M1 |
| **AO-159** | Reviewer context-bundle inclui 2-3 rejeições passadas como negative exemplars a cada 5 stories | High |
| **AO-160** | Audit-redactor middleware + R2 publicAccessBlock validado | BLOCKER M1 |
| **AO-161** | `docs/decisions/micro-conventions.md` sempre no refresh do bundle | High |
| **AO-162** | Boot cross-check SQLite `DONE` vs JSONL `STORY_COMPLETED`; fsync síncrono | High |
| **AO-163** | CI network namespace isolado + `max_stories_per_sprint=50` hard limit | High |

---

## Synthesis — Verdict final

**Pre-Step 07 (Step 06 incorporated):** 144 AOs activas
**+4 AOs (Devil's Advocate challenge):** AO-151..AO-154
**+9 AOs (AI Safety Auditor):** AO-155..AO-163
**Total: 157 AOs activas** (AO-1..AO-163; AO-25 dispensada)

**BLOCKERS finais antes M1 (consolidados):**

| # | BLOCKER | Origem | Owner |
|---|---|---|---|
| 1 | AO-86 webhook clihelper schema | brief + Sprint Planner | Operador |
| 2 | AO-155 two-step confirmation acções irreversíveis | AI Safety FM-1 | Implementação Sprint 0 |
| 3 | AO-158 path traversal sanitization no apply-diff | AI Safety FM-4 | Implementação Sprint 0 |
| 4 | AO-160 audit-redactor + R2 publicAccessBlock | AI Safety FM-6 | Implementação Sprint 0 |
| 5-13 | Implementation prerequisites (8 docs/conventions, schemas, fixtures, epics, etc.) | Step 06 | Implementação Sprint 0 |

### Final Architecture Readiness Assessment

**Overall Status:** **NOT READY → CONDITIONALLY READY com Sprint 0 prereqs**

Razão por strict reading do protocol Step 07:
> "choose NOT READY when any Critical Gap is open"

3 novos Critical Gaps (FM-1, FM-4, FM-6) descobertos pelo AI Safety Auditor que outras 16 perspectivas não detectaram. Estes são **gaps arquiteturais reais**, não meros implementation prerequisites — afectam **safety properties** do sistema.

Honest re-categorização:
- **Arquitetura interna:** READY (146 AOs bem fundadas; layering coerente; schemas formais)
- **Safety posture:** CONDITIONALLY READY pending 3 BLOCKERS Sprint 0 (AO-155, AO-158, AO-160)
- **Operacional:** CONDITIONALLY READY pending AO-86 (operator-dependent SPoF)

**Confidence Level:** HIGH na arquitetura; **MEDIUM na safety posture até AO-155/158/160 implementadas**; MEDIUM-HIGH no operational pending pré-work do operador.

### Key Strengths (revistas honestamente)

1. **Depth of elicitation** — 10 rondas + 17 perspectivas (após AI Safety) → cobertura excepcional; **mas marginal returns clearly diminishing** nas últimas 2 rondas
2. **Composition risk awareness** — AI Safety pass capturou interação entre decisões razoáveis (FM-2, FM-4, FM-8) que análises por-decisão isoladas não viram
3. **Plan Bs documentados** — runtime, LLM, channel + agora Sprint 0 rehearsal (AO-153)
4. **Schemas formais** + agora **safety properties** explícitas
5. **Externalisation thesis** preservada — produto não é autonomy mas memory externalisation

### Realistic implementation timeline

```
Sprint 0 (1-2 semanas):
  Operator parallel:
    - AO-86 webhook schema (CRITICAL SPoF)
    - WABA templates + VPS + R2 + GitHub PAT + Anthropic ToS check
  Implementation parallel:
    - AO-155 two-step confirmation (BLOCKER)
    - AO-158 path traversal sanitization (BLOCKER)
    - AO-160 audit-redactor + R2 publicAccessBlock (BLOCKER)
    - AO-153 Plan B rehearsals (Bun→Node + Anthropic→API)
    - 8 docs/conventions files + 8 runbooks + ADR seeds
    - 5 test fixtures
    - bunfig.toml thresholds
    - epics decomposition via bmad-create-epics-and-stories
    - Drizzle schema final
    - .env.example

Sprint 1 (4 semanas) — M1 critical path:
  Week 1: foundational (S01-S07 do Sprint Planner)
  Week 2: adapters + bootstrap + Hono server
  Week 3: Story Executor + Sub-Agent Spawner + first stories
  Week 4: 6-10 stories + interrupts + S3 test + release tag

Total realistic: 5-6 semanas (brief promised "até 1 mês" — 1-2 weeks slip tolerável)
```

---

> **Estado:** synthesis pronta. 13 novas AOs (AO-151..AO-163). Verdict: **CONDITIONALLY READY com 4 BLOCKERS Sprint 0**. A incorporar Step 07 no `architecture.md`.
