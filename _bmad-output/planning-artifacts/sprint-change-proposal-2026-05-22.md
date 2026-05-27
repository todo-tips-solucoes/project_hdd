---
title: "Sprint Change Proposal — Apply Readiness C-1 + C-2 · HDD"
project: projeto_hdd
project_name_official: "HORSE DRIVEN DEVELOPMENT (HDD)"
workflow: bmad-correct-course
workflow_id: course-correction-2026-05-22
date: 2026-05-22
operator: paulotodo
language: pt-PT
scope: minor
trigger: "Readiness check D-047/D-048 identificou C-1 (Major forward dep) + C-2 (Minor blocked_by texto livre)"
mode: Batch
status: ready-to-apply
---

# Sprint Change Proposal — Aplicação Readiness Conditions C-1 + C-2

## 1. Issue Summary

### Problem Statement

`bmad-check-implementation-readiness` (workflow-id `readiness-projeto_hdd-2026-05-22`)
identificou na sua Step 05 Epic Quality Review **1 Major + 1 Minor finding**
remediable que bloqueiam Sprint 1 E3/E4 work se deferred:

- **C-1 (Major):** Stories 3.5 (NLP Haiku classifier em E3) e 4.1 (P1 gap detector em E4) **forward-depend** em Story 6.a.1 (`AnthropicAdapter` dual-mode em E6.a). Cross-epic forward dependency viola princípio "Epic N+1 cannot be required for Epic N to function".
- **C-2 (Minor):** Story 7.b.3 `blocked_by: [1.b.5, "all of E1.b"]` contém texto livre. Sprint Planner DAG parser pode falhar.

### Discovery context

Identificado via análise automatizada (Python regex sobre `blocked_by` fields)
durante `bmad-check-implementation-readiness` Step 05. Party Mode #2 (AI Safety
+ PM + Test Engineer + Worker) **não apanhou** este cross-epic forward —
ilustra Lesson L-1 do readiness report: automated DAG checks complementar
peer-review.

### Evidence

```python
# Detected via auto-scan:
Story 3.5 (epic E3) blocked_by 6.a.1 (epic E6.a)  # E3 < E6.a → forward
Story 4.1 (epic E4) blocked_by 6.a.1 (epic E6.a)  # E4 < E6.a → forward
Story 7.b.3 blocked_by ["1.b.5", "all of E1.b"]   # parser-unfriendly
```

### Root cause

**Story 6.a.1** (`AnthropicAdapter` dual-mode) entrega **2 capabilities
distintas** que deveriam ser stories separadas:

- **Part-A** (foundational adapter): `LLMPort` interface + `AnthropicSDKAdapter`
  Haiku + `ClaudeCliAdapter` Sonnet base wiring + branded session IDs.
  **Consumido por:** E3 Story 3.5 (NLP classifier) + E4 Story 4.1 (gap detector).
- **Part-B** (E6.a-specific): `LLMDispatcher` service + cache strategy
  (`cache_control: ephemeral`) + role-based selection (Dev/Reviewer/QA →
  Sonnet; classifier/gap-detector → Haiku).
  **Consumido por:** apenas E6.a (telemetry consumer).

Pattern arquitetural correcto (per AR-032 + D-04.3'): foundational ports +
adapters em E1.a, dispatcher/services consumers em epics owners.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Impact | Detalhe |
|---|---|---|
| **E1.a** | 🟢 Add 1 story | Nova Story 1.a.10 `LLMPort + AnthropicAdapter foundational` (após 1.a.9) |
| **E3** | 🟢 Re-wire 1 story | Story 3.5 `blocked_by` `6.a.1 → 1.a.10` |
| **E4** | 🟢 Re-wire 1 story | Story 4.1 `blocked_by` `6.a.1 → 1.a.10` |
| **E6.a** | 🟢 Reduce 1 story scope | Story 6.a.1 reduzida (apenas Part-B dispatcher/cache/role-selection) |
| **E7.b** | 🟢 Expand 1 blocked_by | Story 7.b.3 `blocked_by` lista explícita |
| Others | — | Sem impact |

### Story count

- **Antes:** 50 stories
- **Após:** 51 stories (Sprint 0: 21+1=22 · Sprint 1: 27 · Sprint 2: 2)

### Token ledger impact

- **Antes:** Sprint 0 ~1.7M dev_with_retry
- **Após:** Sprint 0 ~1.78M (+80K para Story 1.a.10 nova; -80K em Story 6.a.1 reduzida ⇒ Sprint 1 ~2.22M)
- **Net:** ~ neutro (~4.1M total inalterado)

### Artifact conflicts

| Artefacto | Impact |
|---|---|
| PRD v2 | **Zero** — sem alterações de FRs |
| Architecture | **Zero** — alinhamento explícito com AR-032 (port + adapter pattern); decisão consistente com D-04.3' 3 ports |
| UX | **N/A** (sem UI) |
| Decision Log | +1 entrada D-049 (apply C-1+C-2 outcome) |
| `epics.md` | 5 edits (1 add story + 1 modify story + 2 re-wire blocked_by + 1 expand blocked_by) |
| Sub-milestone capacity | Sprint 0 sobe de 21→22 stories — **dentro do Cenário B Expected** (6-7 sty/sem × 3-4 sem = 18-28 capacity) ✓ |

### Technical impact

- **Code organization:** alinhado com pattern `src/ports/` + `src/adapters/`
- **No code dependencies broken** (workflow is pre-Sprint 0; nada implementado ainda)
- **Sprint Planner DAG validator** agora consegue parsear todos `blocked_by` fields

---

## 3. Recommended Approach

**Selected: Option 1 — Direct Adjustment** (Effort: Low · Risk: Low)

### Rationale

| Critério | Avaliação |
|---|---|
| Implementation effort | < 1 dia (5 edits mecânicos em `epics.md`) |
| Timeline impact | Zero — Sprint 0 capacity Cenário B confortavelmente absorve +1 story |
| Technical risk | Low — alinhamento com pattern arquitetural existente |
| Team morale | Positive — fix architectural cleanliness antes de implementation |
| Long-term sustainability | Positive — pattern consistency facilita L-2 lesson (adapter foundational vs role-specific) |
| Stakeholder expectations | Operator-requested fix; MVP intact |

### Alternatives rejected

- **Option 2 (Rollback):** N/A — nada implementado ainda
- **Option 3 (MVP Review):** N/A — MVP intact, sem scope change

---

## 4. Detailed Change Proposals

### Edit #1 — Add Story 1.a.10 (NEW) in E1.a

**Location:** `epics.md` Epic 1.a, após Story 1.a.9 e antes de `## Epic 1.b` header.

**Action:** ADD new story.

```markdown
### Story 1.a.10: LLMPort + AnthropicAdapter foundational (Haiku SDK + Sonnet CLI base wiring)

As a `core service` (intent-classifier, gap-detector, dispatcher),
I want `LLMPort` interface + `AnthropicSDKAdapter` (Haiku via SDK) + `ClaudeCliAdapter` (Sonnet via `claude --print` Max 20x) com `RunId` e `SessionId` branded types,
So that E3 (NLP classifier) e E4 (gap detector) podem invocar LLM via porta única sem importar adapters; dispatcher de E6.a consome esta foundation.

**StorySpec:**
- type: `foundational` · epic: E1.a · sprint: 0 · pri_feature: F7 + foundational
- blocked_by: [1.a.2, 1.a.3]
- files_created: `src/ports/llm.port.ts`, `src/adapters/llm/claude-cli.adapter.ts`, `src/adapters/llm/anthropic-sdk.adapter.ts`, `src/lib/llm-session-id.ts`, `tests/adapters/llm-foundational.test.ts`
- files_modified: `src/lib/branded.ts` (add `SessionId` branded type)
- ao_subset: [AR-032, AR-090, AR-091, AR-093, project-hdd-cost-optimal-llm memory, Pre-Mortem L-2]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

**Acceptance Criteria:**

**Given** `LLMPort` interface define `invoke({role, prompt, sessionId?}): ResultAsync<LLMResult, LLMError>`
**When** importo `import type { LLMPort } from 'src/ports/llm.port'` num core service
**Then** o serviço **não** importa qualquer ficheiro de `src/adapters/` (binary AC — Dep Graph Rigour)

**Given** `AnthropicSDKAdapter` configurado com `ANTHROPIC_API_KEY` válido
**When** chamo `adapter.invoke({role: 'classifier', prompt: 'test'})`
**Then** retorna `ok({content, tokens: {input, output, cache_read_input_tokens?}})` (binary AC)
**And** error 401 retorna `err({kind: 'Unauthorized'})` (binary AC)

**Given** `ClaudeCliAdapter` invoca `claude --print --model claude-sonnet-4-6 --resume <sessionId>?`
**When** session reuse cenário (mesma sessionId 2×)
**Then** segunda invocação tem `cache_read_input_tokens > 0` (property AC — 75% economy target per D-044)

**Given** Test adapter (`TestLLMAdapter`)
**When** core service usa `LLMPort` em test mode
**Then** retorna fixture pre-defined sem network call (binary AC — testabilidade foundational)

**Given** branded type `SessionId`
**When** atribuo `string` literal a variável `SessionId` sem `as SessionId`
**Then** typescript compile erro (binary AC)
```

### Edit #2 — Modify Story 6.a.1 (REDUCE scope)

**Location:** `epics.md` Epic 6.a, Story 6.a.1.

**Action:** REDUCE scope para apenas Part-B (dispatcher + cache + role selection).

**OLD title:** `AnthropicAdapter dual-mode + cache_control`

**NEW title:** `LLM Dispatcher + cache strategy + role-based selection`

**OLD blocked_by:** `[1.a.3]`
**NEW blocked_by:** `[1.a.10]`

**OLD files_created:** `src/ports/llm.port.ts`, `src/adapters/llm/claude-cli.adapter.ts`, `src/adapters/llm/anthropic-sdk.adapter.ts`, `src/services/llm-dispatcher.service.ts`, `tests/adapters/llm.test.ts`
**NEW files_created:** `src/services/llm-dispatcher.service.ts`, `src/services/llm-role-policy.ts`, `tests/services/llm-dispatcher.test.ts`

**OLD ao_subset:** `[FR-064, AR-090, AR-091, AR-093, project-hdd-cost-optimal-llm memory]`
**NEW ao_subset:** `[FR-064, AR-093 (cache strategy specifically), project-hdd-cost-optimal-llm memory]`

**OLD estimated_tokens:** `{ dev_core: 80K, dev_with_retry: 120K }`
**NEW estimated_tokens:** `{ dev_core: 48K, dev_with_retry: 72K }` *(reduzido porque port+adapter já em 1.a.10)*

**Story body (NEW Goal):**

> As a `worker`,
> I want `LLMDispatcher` service que decide qual adapter usar baseado em role
> (Dev/Reviewer/QA → ClaudeCliAdapter Sonnet via Max 20x R$0 marginal;
> classifier/gap-detector → AnthropicSDKAdapter Haiku) + aplica
> `cache_control: ephemeral` em prompts longos + reusa `sessionId` entre
> invocações da mesma sprint,
> So that worker usa modelo certo por papel com cost-optimal hybrid e cache
> reuse 75% economy.

**Acceptance Criteria reformulados:**

```markdown
**Given** request `{role: 'dev', prompt: longo + history, sessionId}`
**When** dispatcher decide
**Then** invoca `ClaudeCliAdapter.invoke({...})` (binary AC — Max 20x marginal R$0)

**Given** request `{role: 'classifier', prompt: 'classify intent'}`
**When** dispatcher decide
**Then** invoca `AnthropicSDKAdapter.invoke({role: 'classifier', ...})` com `cache_control: ephemeral` no system prompt (binary AC)

**Given** sessionId reaproveitado entre invocações
**When** 2ª invocação corre
**Then** cache hit observable (depende de Story 1.a.10 wiring) (property AC)

**Given** request com role desconhecido
**When** dispatcher recebe
**Then** retorna `err({kind: 'UnknownRole'})` + audit event (binary AC)
```

### Edit #3 — Re-wire Story 3.5 blocked_by

**Location:** `epics.md` Epic 3, Story 3.5.

**Action:** Edit `blocked_by` field.

**OLD:** `blocked_by: [3.4, 6.a.1]`
**NEW:** `blocked_by: [3.4, 1.a.10]`

**Rationale:** Story 3.5 consome `LLMPort` foundational (E1.a) directamente,
não precisa de `LLMDispatcher` (E6.a). Resolve forward dep.

### Edit #4 — Re-wire Story 4.1 blocked_by

**Location:** `epics.md` Epic 4, Story 4.1.

**Action:** Edit `blocked_by` field.

**OLD:** `blocked_by: [3.1, 3.5, 6.a.1]`
**NEW:** `blocked_by: [3.1, 3.5, 1.a.10]`

**Rationale:** Mesma razão de Edit #3.

### Edit #5 — Expand Story 7.b.3 blocked_by

**Location:** `epics.md` Epic 7.b, Story 7.b.3.

**Action:** Expand texto livre para lista explícita.

**OLD:** `blocked_by: [1.b.5, all of E1.b]`
**NEW:** `blocked_by: [1.b.1, 1.b.2, 1.b.3, 1.b.4, 1.b.5]`

**Rationale:** Sprint Planner DAG parser parsing legibility (C-2).

### Edits secundários auto-derivados

- **frontmatter `epics.md`:** atualizar `stepsCompleted` (não aplicável aqui) — *nenhuma alteração necessária*; o frontmatter `finalized: 2026-05-22` + `finalization_status: ready-for-operator-review` continua válido. O conteúdo é editado in-place.
- **Sumário quantitativo em `epics.md`:** atualizar contagem E1.a de 9 para 10 stories e Sprint 0 total de 21 para 22; E6.a token estimate de 296K para 248K (story reduzida −48K).
- **DAG dependências:** Story 1.a.10 inserido entre 1.a.3/1.a.6 cluster e Story 6.a.1 (dispatcher) consume 1.a.10.

---

## 5. Implementation Handoff

### Scope classification

🟢 **Minor** — Direct implementation by Developer (este agente):

- 5 edits mecânicos em `epics.md` (1 add + 1 modify + 3 re-wire blocked_by)
- 1 entrada nova no `prds/.../.decision-log.md` (D-049 outcome)
- 1 update no `bmad-readiness-summary.md` frontmatter (conditions_resolved)

### Deliverables

- ✅ `epics.md` actualizado com 51 stories (era 50)
- ✅ `sprint-change-proposal-2026-05-22.md` (este documento)
- ✅ Entrada D-049 no decision log
- ✅ `bmad-readiness-summary.md` marcado conditions_resolved

### Success criteria

- Re-run automated DAG cross-epic dependency check → zero forward deps
- All `blocked_by` fields are lists of valid story IDs (não texto livre)
- Story 1.a.10 conforme StorySpec schema completo (11 campos)
- Story 6.a.1 reduzida tem ACs reformulados Given/When/Then
- Sprint Planner pode parsear DAG sem ambiguidade

### Operator review requirement (D-019)

Esta change proposal é **mecanicamente apply-able** sem nova revisão D-019 — a
aprovação D-048 já cobriu intent. Mas o **outcome será** registado em D-049 +
flag em `bmad-readiness-summary.md` para fechar loop.

---

## 6. Verdict

**✅ APPROVED to apply (per D-048 operator pre-approval)**

Scope: 🟢 Minor · Effort: < 1 dia · Risk: Low · Confidence: High
