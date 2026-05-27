---
title: "Step 06 — Elicitation Round 2 · HDD"
workflow: bmad-create-architecture
step: 6
round: 2
date: 2026-05-21
techniques: [reverse-engineering-m1, party-mode-qa-sprint-planner-future-operador]
status: pending-synthesis-approval
---

# Step 06 — Elicitation Round 2

## A — Reverse Engineering M1

**Critical path identificado (Day 0 → Day 28):**
- Day 0: Operator pré-work paralelo (Meta templates 1-3d, VPS, R2, GitHub PAT)
- Day 1-7: foundational ports + adapters + bootstrap + LLM/WhatsApp adapters
- Day 5: **🚨 AO-86 webhook schema MUST be unblocked** (single point of schedule failure)
- Day 7-12: FSM + state persistence + Hono routes
- Day 12-16: Story Executor + Sub-Agent Spawner + Gate Runner
- Day 16-28: 6-10 stories executadas com interrupts P1 + S3 fallback testado

**Load-bearing AOs identificadas: 27 críticas** (FSM, Ports DI, error handling, state, audit, WhatsApp+e-mail, LLM, boot/shutdown, sandbox, Reviewer contract)

**Cosmetic AOs deferreableis: 13** (license-checker CI, RFC 3161, Stryker mutation, chaos automated, Renovate, binary rubrics, narrative summary, max-lines HARD, Plan B autónoma, core/services refactor, CHANGELOG, naming exemplos reais, context-bundle persisted)

**Padrão de falha mais provável:** AO-86 slip → cascading delay 1-2 semanas. Tolerable dado M1 = "até 1 mês".

**Riscos identificados:**
- Bun first-time debug exotic (2-3 dias buffer)
- Reviewer prompt calibration (1 sprint feedback)
- Anthropic Max 20x ToS (D-032 risk; Plan B becomes must-have not cosmetic)

**→ AO-144:** `docs/m1-critical-path.md` com dependências AOs + gates por week + mitigações.

## P — 3 perspectivas (QA + Sprint Planner + Future operador)

### QA Agent introspecção

**Active not passive** — gera novas test cases + properties para branches uncovered descobertos.

**Key insights:**
- Coverage 85% pode ser false sense — precisa `untestedBranches: string[]` no DevOutput + mutation spotcheck manual nos 3-5 branches críticos
- Flaky detection: 3 runs sequenciais; falha ≥1/3 sem alterações = flake, não bloqueia merge, abre issue separado
- `:memory:` SQLite isolation é convenção do Dev, não garantia do QA — validado via `dbIsolationPattern` field
- Chaos test corre por **epic** (não por story) — custo de setup alto

**QAOutput schema formalizado (11 fields):**
```typescript
interface QAOutput {
  coveragePassed: boolean
  coverageActual: { lines, branches, functions }
  branchesUncovered: string[]
  flakyTestsDetected: string[]
  chaosTestPassed: boolean
  chaosRecoveryTimeMs: number
  chaosAuditIntegrityOk: boolean
  e2eTestsPassed: boolean
  e2eFailures: string[]
  newPropertiesGenerated: number
  mutationSpotcheckPassed: boolean
  blockers: string[]
}
```

**Extensão a DevOutput (AO-120):** + `untestedBranches`, `testFilePaths`, `dbIsolationPattern`, `propertyTestSeeds`

**Cost realistic:** ~15K tokens base; 20-25K para epic boundary com chaos. Master budget elástico.

**6 BLOCKERS:** 5 fixtures (`db-factory`, `fake-llm`, `mock-webhook-server`, `fake-clock`, `fake-spawn`) + `bunfig.toml` thresholds configurados (não só CLI flags).

### Sprint Planner Agent introspecção

**Story granularity:** uma story = adapter completo OU módulo core coeso; tecto 200 LoC + ≤3 directórios.

**Path mapping anti-drift:** `files_created[]` + `files_modified[]` declarados ex-ante; Reviewer valida `DevOutput` contra mapping; ficheiro fora = **P1 imediato**.

**DAG inference algorithm:** (1) import graph → arcos; (2) port/adapter contract → adapter espera port MERGED; (3) Step 04 sequence = esqueleto.

**Critérios de aceitação format YAML (machine-checkable):**
```yaml
acceptance_criteria:
  - id: AC-01
    type: coverage      # binary | property | coverage
    check: "bun test src/core/fsm/ --coverage"
    pass_condition: "branch ≥85%"
```

**First sprint (bootstrap) — 7 stories:**
1. S01 repo-scaffold (configs)
2. S02 db-schema + migration 0001
3. S03 ports-core (interfaces)
4. S04 result-lib (neverthrow + helpers)
5. S05 audit-adapter (hash chain)
6. S06 fsm-core (FSM completa)
7. S07 bootstrap (boot/shutdown order)

S01-S04 paralelos. S05 paralelo S04. S06 espera S02+S03+S04. S07 fecha sprint.

**`BLOCKED` semantics:** `BLOCKED_BY_OPERATOR` sub-state para human unblocker; `parallel_safe[]` permite outras stories progredir enquanto blocker espera.

**SprintPlanOutput schema formalizado** com `stories[]` + `dag.edges[]` + `dag.blocked_external[]` (com `parallel_safe[]` por entry) + `token_budget` + `context_bundles{}` + `ready_to_spawn[]`.

**Cost estimation:** baseline ~64K/story; range 40-80K conforme complexidade. Master pre-spawn: `remaining > estimated × 1.2`.

**5 BLOCKERS do Planner:** epics formais (PRD §7 features não decompostos), context-bundle schema canónico, AO-86 ETA, sprint token budget máx, `docs/conventions/errors.md` + `review-rubric.md`.

### Future operador (2027-05-21, 1 year later)

**🔥 Devastatingly honest insights** — operador real após 1 ano vivendo com HDD + 1 colaborador (Rodrigo) + 1 produto MEDIPLAN entrado em Nov 2026.

**O que aconteceu na realidade (vs plano):**
- **47 Resumos acumulados** (não 200 — sizing real menor) — só 4 acessados activamente; outros são "archive morto"
- **ADRs viraram lifesavers** — ADR-005 antecipava exatamente o bug que estava a debugar hoje; **mas parou de escrever ADRs em Agosto após 7**
- **Bun upgrade Março 2027 partiu hot-reload 2 dias** (confirma AO-94 patch-only automerge + Bun runtime never automerge)
- **`review-session.ts` chegou a 800 linhas** — autor próprio violou AO-122 (max-lines 200) "porque sou eu o único que mexe"
- **Autor próprio violou AO-89** (state mutable sem logging) "sabia da AO, tinha pressa em Julho" → exatamente o bug que está a debugar hoje
- **`context-bundle` persisted** (AO-143): benefício 6 semanas; depois debt silencioso — duas vezes confundiu modelo com decisões revertidas. **Falta mecanismo TTL/purge**
- **`skills/` e `design-artifacts/`** viraram dark code — não sabe se ainda válidos
- **Frase canónica para colaborador novo:** *"Lê ARCHITECTURE.md + ADRs (20 min). O resto está nesses 8 ficheiros."*

**Docs que salvaram:** `docs/ARCHITECTURE.md` (diagrama ASCII), ADRs `0001-0007`, `docs/glossary.md` (Rodrigo usou no onboarding).

**Docs que ficaram piores que nada:** `summaries/` long-form prose — falsa sensação de documentação.

**Redesenharia:**
- `review-session.ts` em 3 ficheiros <300 linhas desde início (não "depois")
- Summaries formato curto fixo (5 bullets, não prosa)
- Context-bundle com TTL explícito + comando `bun run purge-context`

---

## Synthesis — 7 novas AOs (AO-144..AO-150)

| # | Obrigação | Origem |
|---|---|---|
| **AO-144** | `docs/m1-critical-path.md` com dependências AOs + gates por week + mitigações | Reverse Engineering A |
| **AO-145** | Context-bundle persisted TTL (6 semanas default) + comando `bun run purge-context` — **refina AO-143**; sem TTL torna-se debt silencioso | Future operador |
| **AO-146** | Resumos de Finalização Tier-A + AO-113 daily narrative em **formato curto FIXO** (5 bullets máx, não prosa). Long-form só Tier-C audit forensic | Future operador |
| **AO-147** | ADR momentum check: CI gate trimestral "última ADR > 60 dias + features merged ≥3" = warning. Evita ADR-fatigue após initial enthusiasm | Future operador |
| **AO-148** | Auto-archive policy `summaries/` — após 30d sem acesso → move para `summaries/archive/` separado para reduzir noise | Future operador |
| **AO-149** | `skills/` (BMB custom outputs) tem `README.md` index obrigatório — sem isso vira dark code em 6 meses | Future operador |
| **AO-150** | AO-122 max-lines aplicada em **manual edits** também — pre-commit hook (não só CI gate Dev agent). Author-bypass ("ninguém me chama") é falha real | Future operador case study |

### Refinamentos a AOs existentes

| AO | Refinamento |
|---|---|
| AO-113 daily narrative | Formato 5 bullets fixo (não prosa) — AO-146 |
| AO-143 context-bundle persistido | + TTL 6 semanas + purge-context command — AO-145 |
| AO-120 DevOutput schema | + `untestedBranches`, `testFilePaths`, `dbIsolationPattern`, `propertyTestSeeds` (QA input) |
| AO-106 ReviewerPort | QAOutput schema acoplado, 11 fields formais (chaos metrics, mutation spotcheck, flaky detection) |
| AO-117 story_deps DAG | + `parallel_safe[]` em entries blocked_external (Sprint Planner) |
| AO-122 max-lines HARD | + pre-commit hook (não só CI gate) — author-bypass mitigation |

### Schema formal — SprintPlanOutput + StorySpec

Adicionado em `architecture.md` Step 06 como referência canónica para Master Agent.

### Lessons devastadoras para guardar

**Future operador case study revela 3 patterns que matam projetos solo:**

1. **Convention enforcement só funciona com CI HARD** — soft conventions (200 linhas, no mutable state) que dependem de "ninguém me chama à atenção" são violadas pelo próprio autor em meses.

2. **Long-form prose docs viram archive morto** após volume aumentar — 47 summaries, 4 acessados. Short fixed format wins.

3. **Beneficios optimistic become debt silencioso** se faltar mecanismo de truncação — context-bundle persisted, audit JSONL crescente, ADRs sem revisão.

**→ Salvar como memória persistente** `feedback-hdd-soft-convention-rot.md` para future sessions.

---

## Total acumulado

- **144 AOs activas** (AO-1..AO-150; AO-25 dispensada + 5 não-aplicáveis pós-D-033 a re-verificar)
- **39 decisões D-001..D-039** (D-039 será D-038 → updated)
- **6 elicitation results files** (step-02 r1+r2, step-03, step-04, step-05, step-06 r1+r2)
- **10 memórias persistentes** após salvar `feedback-hdd-soft-convention-rot.md`

### Implicações para Step 06 incorporação

A synthesis confirma o tree refactored + bota mais 7 AOs + refina 6 existentes + adiciona schemas formais `SprintPlanOutput`/`StorySpec`. **Step 06 está pronto para fechar.**

### Pendências antes de incorporar

1. ✅ Refactor `core/services/` + workers split (confirmado round 1)
2. ⚠️ **AO-140 LICENSE** ainda precisa de operator confirm (default MIT)
3. ✅ Mermaid para diagramas (confirmado round 1)

---

> **Estado:** synthesis round 2 pronta. 7 novas AOs (AO-144..AO-150). Total 144 AOs. A incorporar no `architecture.md`.
