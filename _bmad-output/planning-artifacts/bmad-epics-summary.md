---
title: "Resumo de Finalização — bmad-create-epics-and-stories · HDD"
workflow: bmad-create-epics-and-stories
workflow_id: epics-projeto_hdd-2026-05-22
project: projeto_hdd
project_name_official: "HORSE DRIVEN DEVELOPMENT (HDD)"
phase: Solução (BMAD 3)
date_started: 2026-05-22
date_completed: 2026-05-22
sessions: 1
status: complete
finalization_governance: "D-019 mandatory review enforced"
operator_approval: "approve epics-projeto_hdd-2026-05-22 — 2026-05-22"
operator_approval_decision: D-045
capacity_assumption_decision: D-046 (Cenário B Expected — 6-7 sty/sem · Sprint 0 = 3-4 sem · M1 = 1.0-1.3 mês)
prior_workflow: bmad-create-architecture (COMPLETED 2026-05-22 · APPROVE-WITH-CONDITIONS)
next_workflow: bmad-check-implementation-readiness
---

# Resumo de Finalização — `bmad-create-epics-and-stories` · HDD

> Per D-019 (revisão obrigatória em toda finalização), gerado o Resumo 3-tier
> para fechar o workflow. Operador revê e aprova antes de prosseguir para
> `bmad-check-implementation-readiness` (gate de transição Modo Colaborativo →
> Modo Autónomo).

---

## Tier-A — Glance (≤200 palavras, para WhatsApp `hdd_summary_finalization`)

```
[✓] bmad-create-epics-and-stories · projeto_hdd · 2026-05-22

50 stories decompostas em 7 epics + 4 sub-milestones (E1.a/b/c, E6.a/b,
E7.b) numa única sessão. StorySpec schema completo per story (11 campos
incluindo pri_feature F1-F9, ao_subset 4-8 AOs, ACs Given/When/Then
machine-checkable binary|property|coverage, files_created/modified,
estimated_tokens).

Decisões críticas:
• Pre-Mortem + Party Mode aplicados (10 alterações concretas absorvidas)
• Sprint 0 = 21 stories foundational; Sprint 1 = 27; Sprint 2 = 2
• Token ledger ~4.1M dev_with_retry; compatível Max 20x R$0 marginal
• Wiring AOs derivadas (path traversal + redaction + 2-step) adicionadas
  como ACs em stories runtime (2.3, 3.4, 2.6)
• FR coverage 53/56 story-level + 1 process + 3 design constraints + 1
  follow-up AC absorvido em Story 2.2

Estado: ready-for-operator-review · D-019 enforced · Janela: ~14%

→ Tier-B: ./bmad-epics-summary.md#tier-b
→ Aprovar: `approve epics-projeto_hdd-2026-05-22`
```

**(178 palavras, alvo ≤200)**

---

## Tier-B — Briefing

### Contexto

`bmad-create-epics-and-stories` invocado 2026-05-22 imediatamente após
`bmad-create-architecture` close (DRB APPROVE-WITH-CONDITIONS, 186 AOs). DRB
Sprint 0 implicit prereq — sem epics formais o Sprint Planner Agent (AO-117)
não consegue popular `story_deps` DAG.

### O que foi feito

- **`epics.md`** (~2000 linhas, single document) — Requirements Inventory + FR Coverage Map + 7 epics + 50 stories + DAG dependências + sumário quantitativo
- **`bmad-epics-summary.md`** (este ficheiro) — Resumo 3-tier obrigatório D-019
- **2 rondas de elicitation aplicadas** (Pre-Mortem + Party Mode com 4+4 perspectivas) gerando **10 alterações concretas absorvidas no design**:
  1. E1 quebrado em E1.a/b/c (sub-milestones com Resumo Tier-B entre cada)
  2. Idempotency keys movidas de E5 para E1.a (foundational invariante)
  3. E6 quebrado em E6.a (Sprint 1 must-have) + E6.b (Sprint 2 downgrade)
  4. E7.a (Tier-B/C gen) antecipado para E1.a — D-019 enforced desde Day 1
  5. AO-86 escalation gate Day 7 + CI budget ΔCI ≤10s por safety story
  6. `core/domain/interrupt-commands.ts` + `core/fsm.ts` em E1.a (resolve E3↔E4)
  7. StorySpec field `pri_feature: F1..F9` (rastreabilidade FR→Story)
  8. Wiring AOs (path traversal em 2.3, redaction em 3.4, 2-step em 2.6)
  9. Nota dependency versions → `architecture.md` Step 03 (não duplicar)
  10. FR-005 follow-up ACs (`bmad_save_artifact`/`complete_workflow` hooks)

### Decisões críticas (top 10)

| # | Decisão | Tipo |
|---|---|---|
| 1 | **7 epics por affinity (não 1:1 F1-F9)** | Structure |
| 2 | **E1 split E1.a/b/c** com Resumo Tier-B entre | Granularity |
| 3 | **Idempotency foundational em E1.a** (não E5) | Invariant ordering |
| 4 | **E6.a Sprint 1 must-have** (demo M1 não pode bater janela silenciosa) | Priority |
| 5 | **E7.a antecipado para E1.a** (D-019 enforced Day 1 via CLI review) | Governance |
| 6 | **3 cenários capacity Sprint 0**: 2/3-4/5 sem (best/expected/pessimistic) | Planning |
| 7 | **Token ledger ~4.1M dev_with_retry** (compatible budget R$1000/m em hybrid D-044) | Cost |
| 8 | **StorySpec estendido com `pri_feature: F1..F9`** | Schema extension |
| 9 | **3 wiring ACs adicionadas runtime** (path traversal, redaction, 2-step) | Safety enforcement |
| 10 | **FR-005 lifecycle hooks** absorvido em Story 2.2 AC | Coverage gap close |

### Trade-offs aplicados

- **YOLO vs Coaching:** operador escolheu C step-a-step + invocou A+P duas vezes para depth. Resultado: design + 10 alterações pre-mortem em 1 sessão sem sacrificar quality gates D-019.
- **Epic granularity vs PRD F1-F9 1:1:** affinity venceu — rastreabilidade preservada via `pri_feature` StorySpec field.
- **Sprint 0 capacity:** operador deve calibrar antes Day 1 (3 cenários documentados).
- **E5 reduzido vs foundational invariant:** idempotency keys movidas para E1.a; E5 fica focado em recovery boot + crash drills + rollback stub.

### Open items deferidos / `[ASSUMPTION]` pendentes

- **AO-43 rollback parcial automático** — diferido v1.1+; E5 entrega stub que emite Trigger P1 ao operador
- **Story 3.5 fixture accuracy ≥27/30** — calibrate Sprint 1 baseline real
- **Story 6.a.2 API Anthropic usage metrics** — `[ASSUMPTION]` API devolve; Plan B = tokens proxy (sem story dedicada — flagar pre-Sprint 1)
- **Capacity assumption Sprint 0** — operador confirma cenário antes Day 1
- **AO-86 webhook schema** — escalation gate Day 7; se ausente, mock fixtures + `[OPEN]` no readiness check
- **3 templates Meta** — operador submete em paralelo Sprint 0 (M1 mínimo)

### FR Coverage

| Categoria | Count | Notas |
|---|---|---|
| Story-level coverage | 53/56 | Cada FR aparece em ≥1 story `ao_subset[]` |
| Process marker (workflow externo) | 1 | FR-003 → `bmad-check-implementation-readiness` |
| Design constraint sem story | 3 | FR-017 (deferral), FR-028 (cost observ), FR-034 (single-project) |
| Follow-up AC absorvido | 1 | FR-005 lifecycle hooks → Story 2.2 |

### Métricas

- Janela LLM consumida: ~14% (estimate cumulative 4 sessions arch + 1 epics; instrumentação real é AO-151 Sprint 0)
- Duração: 1 sessão (continuação imediata pós-architecture)
- Stories produzidas: **50** total (E1.a:9 · E1.b:5 · E1.c:7 · E2:7 · E3:6 · E4:5 · E5:3 · E6.a:3 · E6.b:2 · E7.b:3)
- Token ledger: ~4.1M dev_with_retry (Sprint 0:1.7M · Sprint 1:2.3M · Sprint 2:0.13M)
- Linhas finais `epics.md`: ~2000
- AOs referenciadas (`ao_subset[]` consolidado): ~60-70 das 186 activas (subset minimum 4 per story → reduce 186→8 por story aplicado)
- Wiring AOs derivadas no Pre-Mortem #2: 3

### Reviewer findings consolidados

Pre-Mortem (6 failure modes) + Party Mode #1 (4 perspectivas: Senior Eng, Devil's Advocate, Future paulotodo, Sprint Planner) + Party Mode #2 (4 perspectivas: Test Engineer, AI Safety, PM, Worker) — verdict **APPROVE-WITH-AC-REFINEMENTS-IN-FOLLOWUP**. Acabam-se 2 ACs follow-up para calibrar Sprint 1 baseline (PM2-3 Q1/Q2/Q3) e capacity assumption confirmada antes Day 1 (PM2-4).

### Próximos passos sugeridos

1. **`bmad-check-implementation-readiness`** — gate antes Modo Autónomo; consome `epics.md` + `architecture.md` + valida 4 BLOCKERS Sprint 0 + 8 PT Tasks
2. **Sprint 0 Day 1 actions paralelas:**
   - Operador: validar capacity assumption (3 cenários docs); submeter 3 templates Meta para aprovação
   - Implementation: arrancar Story 1.c.7 (`bmad-cli` smoke test) **primeiro** — bloqueia E2 se falhar
3. **`bmad-sprint-planning`** (Sprint 0) — consome `StorySpec[]` deste workflow + popula DAG real
4. **Sprint 0 (2-5 semanas conforme cenário)** — E1.a → E1.b → E1.c com Resumo Tier-B entre cada
5. **Sprint 1 (4 semanas)** — E2+E3 paralelo → E4+E5+E6.a+E7.b paralelos

→ Tier-C: ./bmad-epics-summary.md#tier-c · Aprovar: `approve epics-projeto_hdd-2026-05-22`

**(680 palavras)**

---

## Tier-C — Full

### 1. Tier-B inline
*(repetido acima)*

### 2. Inventário de artefactos

| Path | Tipo | Status |
|---|---|---|
| `epics.md` | Epic + Story breakdown | complete (4 steps) |
| `bmad-epics-summary.md` | Resumo (este) | ready-for-review |
| `architecture.md` (input) | Architecture | unchanged |
| `prds/prd-projeto_hdd-2026-05-20/prd.md` (input) | PRD v2 | unchanged |
| `briefs/brief-projeto_hdd-2026-05-20/brief.md` (input) | Brief | unchanged |

### 3. StorySpec schema canónico (estende AR-054)

```typescript
interface StorySpec {
  story_id: string;                       // e.g. "1.a.5"
  title: string;
  type: 'foundational' | 'feature' | 'refactor' | 'bug-fix' | 'docs';
  epic: string;                           // e.g. "E1.a"
  sprint: 0 | 1 | 2;
  pri_feature: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'foundational';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  blocked_by: string[];                   // story_id refs
  unblocker?: string;                     // optional explicit unblock condition
  files_created: string[];
  files_modified: string[];
  ao_subset: string[];                    // 4-8 AOs from 186 activas
  acceptance_criteria: Array<{
    given: string;
    when: string;
    then: string;
    and?: string[];
    kind: 'binary' | 'property' | 'coverage';
  }>;
  estimated_tokens: {
    dev_core: number;                     // baseline
    dev_with_retry: number;               // baseline × 1.5
  };
}
```

### 4. DAG dependências (extracto canónico)

```
Sprint 0 critical path:
1.a.1 (scaffold) → 1.a.2 (Result+branded) → 1.a.3 (3 ports) → 1.a.4 (FSM+commands)
                                          ↓
                                          1.a.5 (db+idem) → 1.a.6 (audit) → 1.a.9 (run-context)
                                                          ↓
                                                          1.a.7 (bootstrap) → 1.a.8 (Tier-B/C)
                                                          ↓
                                          1.b.1 (path traversal) → 1.b.2 (2-step) → 1.b.3 (redaction)
                                          → 1.b.4 (sandbox) → 1.b.5 (PT suite)
                                                                ↓
                                          1.c.7 (bmad-cli smoke test) [Day 1] → 1.c.1 (systemd) →
                                          → 1.c.2 (secrets) → 1.c.3 (Litestream) → 1.c.4 (CI) →
                                          → 1.c.5 (SSH) → 1.c.6 (runbooks)

Sprint 1 critical path:
E2 (worker 2.1-2.7) || E3 (whatsapp 3.1-3.6) → E4 (4.1-4.5) → E7.b (7.b.1-7.b.3)
                                              ↓
                                              E5 (5.1-5.3) [paralelo]
                                              ↓
                                              E6.a (6.a.1-6.a.3) [paralelo]

Sprint 2:
E6.b (6.b.1, 6.b.2)
```

### 5. Pre-Mortem failure modes (PM-1..PM-6)

Failure modes identificados e mitigações aplicadas:

| FM | Failure scenario | Mitigação aplicada |
|---|---|---|
| FM-1 | Sprint 0 vira poço sem fundo | E1 split em E1.a/b/c com Resumo Tier-B intermédio |
| FM-2 | E5 idempotency "depois" quebra production | Idempotency foundational em E1.a (FR-030a + commit-before-side-effect) |
| FM-3 | AO-86 webhook schema fica em stub Sprint inteiro | Day 7 escalation gate em E1.b.5; mock fixtures + flag `webhook-mock` |
| FM-4 | E6 janela LLM tarde → demo M1 hit window-exhausted | E6.a Sprint 1 must-have (telemetry + 80% notify + pause hardcoded) |
| FM-5 | E7 Resumo último → D-019 violado em prática | E7.a (Tier-B/C) antecipado E1.a; D-019 enforced via CLI review desde Day 1 |
| FM-6 | 3 safety BLOCKERS apertam CI > 60s | CI budget ΔCI ≤10s per safety story; benchmark before/after |

### 6. Party Mode perspectivas convocadas

**Ronda 1 (Step 02 post epic design):**
- Senior Engineer (10y systems, hexagonal arch)
- Devil's Advocate
- Future `paulotodo` (1 year later, manutenção)
- Sprint Planner (operability lens)

**Ronda 2 (Step 03 post 50 stories):**
- Test Engineer (TDD discipline)
- AI Safety Engineer
- Project Manager (delivery realism)
- Worker (futuro consumer das stories)

### 7. Adoptions / Rejections

**Adopted (10):** todas as 7 alterações Pre-Mortem ronda 1 + 3 wiring ACs ronda 2 + nota dependency versions

**Adopted as Step 04 follow-up (3):** PM2-3 Q1 fixed em Story 3.5; PM2-3 Q2/Q3 documented; PM2-4 capacity 3 cenários documented

**Rejected (1):** Future paulotodo perspectiva sugeriu renaming E3 para capability-based ("OutboundNotify") — rejected porque memórias persistentes confirmam clihelper como integração v1 explícita; v1.1+ futureproofing **anotado em implementation notes** mas sem rename.

### 8. Trilha de aprovações

| Approval | Data | Decisão |
|---|---|---|
| Step 01 Requirements Inventory | 2026-05-22 | C |
| Step 02 Epic Design (post elicitation A+P) | 2026-05-22 | C (com 7 alterações Pre-Mortem absorvidas) |
| Step 03 Story Creation (post Party Mode #2) | 2026-05-22 | C (com 3 wiring + 1 versions nota absorvidas) |
| **Step 04 Final Validation** | **2026-05-22** | **ready-for-operator-review** |

### 9. Memórias persistentes consumidas (sem novas memórias geradas)

13 memórias auto-loaded aplicaram-se ao design sem fricção:
- `project-hdd-naming` · `project-hdd-vision` · `project-hdd-llm-budget`
- `project-hdd-whatsapp-api` · `project-hdd-clihelper-integration` · `project-hdd-n8n-topology`
- `project-hdd-openclaw-substituted-by-bun` · `project-hdd-cost-optimal-llm`
- `project-hdd-stack-v2-bun` · `project-hdd-bun-sd-notify-gotcha`
- `project-hdd-externalisation-thesis`
- `feedback-hdd-mandatory-review` (D-019 enforcement)
- `feedback-bmad-prd-discover-brief` · `feedback-hdd-soft-convention-rot` · `feedback-hdd-composition-risks`
- `context-window-1m`

### 10. Apêndices

- 50 stories completos em `epics.md` (single document, ~2000 linhas)
- Pre-Mortem ronda 1 synthesis (Step 02 chat history)
- Party Mode ronda 2 synthesis (Step 03 chat history)
- FR Coverage Map per-story → epic em `epics.md` §FR Coverage Map

---

## Estado final do workflow

**`complete`** desde 2026-05-22.

Aguardando `approve epics-projeto_hdd-2026-05-22` para liberar
**`bmad-check-implementation-readiness`** como próximo workflow obrigatório
(gate de transição Modo Colaborativo → Modo Autónomo).

**Workflow `bmad-create-epics-and-stories` formalmente fechado pendente aprovação operador.**

---

## Aprovação requerida — Responda no canal primário (WhatsApp template `hdd_summary_finalization` quando aprovado por Meta; ou CLI review):

- `approve epics-projeto_hdd-2026-05-22` — Avançar para `bmad-check-implementation-readiness`
- `request_changes <nota>` — Voltar a step específico
- `reject <razão>` — Workflow rejeitado

**Capacity assumption confirmation requerido em paralelo:**

- `[ ] Best case` — 10 sty/sem → Sprint 0 = 2 semanas
- `[ ] Expected` — 6-7 sty/sem → Sprint 0 = 3-4 semanas (recomendado default)
- `[ ] Pessimistic` — 4 sty/sem → Sprint 0 = 5 semanas → M1 desliza 1.5 mês
