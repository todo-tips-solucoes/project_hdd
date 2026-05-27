---
title: "Session Resume — HDD bmad-create-epics-and-stories"
project: projeto_hdd (HORSE DRIVEN DEVELOPMENT)
paused_at: 2026-05-22
prior_workflow: bmad-create-architecture (COMPLETED 2026-05-22)
next_workflow: bmad-create-epics-and-stories
phase: Solução (BMAD 3) → close gap antes Fase 4 Implementação
operator: operador
---

# SESSION RESUME — HDD · Epics & Stories

## Onde estamos

**`bmad-create-architecture` está COMPLETO** (8 steps, DRB APPROVE-WITH-CONDITIONS verdict).
**Próximo workflow obrigatório:** `bmad-create-epics-and-stories` para decompor PRD §7 features em epics formais com stories prontas para Sprint 1.

DRB Sprint 0 Condition #2 implicit prereq — sem epics formais o Sprint Planner Agent não consegue popular `story_deps` DAG (AO-117).

## Estado do projeto (snapshot)

```
Brief (Fase 1 Análise)        ✅ briefs/brief-projeto_hdd-2026-05-20/
PRD v2 (Fase 2 Planejamento)  ✅ prds/prd-projeto_hdd-2026-05-20/prd.md (D-030 approved)
Architecture (Fase 3 Solução) ✅ architecture.md (D-040 APPROVE-WITH-CONDITIONS)
Epics + Stories               ⏳ ← AGORA
UX Design                     N/A (no UI v1)
Implementation Readiness gate ⏸ depende de epics
Sprint 0                      ⏸ depende de epics + 4 BLOCKERS resolvidos
Sprint 1 M1                   ⏸ depende de Sprint 0
```

## Artefactos canónicos (todos persistidos)

### Devem ser lidos pelo workflow

| Path | Conteúdo crítico |
|---|---|
| `_bmad-output/planning-artifacts/architecture.md` | 8 steps + 186 AOs + 5 schemas formais (DevOutput, ReviewOutput, QAOutput, SprintPlanOutput, StorySpec) + Sprint 0 actionable checklist |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/prd.md` | PRD v2 final · 87 FRs em 9 features (F1-F9) · 7 NFR categorias · 3 princípios não-negociáveis · 5 marcos M0-Q4 |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/.decision-log.md` | 44 decisões D-001..D-044 |
| `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/brief.md` | Brief autoritativo (D-021 confirma autoridade) |

### Adicionais (synthesis trail)

- `step-02-elicitation-results.md` + `step-02-elicitation-round2.md`
- `step-03-elicitation-results.md`
- `step-04-elicitation-results.md`
- `step-05-elicitation-results.md`
- `step-06-elicitation-results.md` + `step-06-elicitation-round2.md`
- `step-07-elicitation-results.md` + `step-07-elicitation-round2.md`
- `whatsapp-templates-utility.md` — 6 templates UTILITY desenhados
- `bmad-architecture-summary.md` — Resumo Finalização 3-tier do workflow architecture

## Memórias persistentes (auto-loaded em qualquer sessão futura)

13 ficheiros em `/root/.claude/projects/-var-lib-projeto-hdd/memory/`:

| Memória | Aplicabilidade |
|---|---|
| `project-hdd-naming.md` | Nome oficial HDD |
| `project-hdd-vision.md` | Visão bimodal + meta-dogfood |
| `project-hdd-llm-budget.md` | Anthropic Max 20x exclusivo |
| `project-hdd-whatsapp-api.md` | WhatsApp Cloud API oficial Meta |
| `project-hdd-clihelper-integration.md` | clihelper outbound endpoint |
| `project-hdd-n8n-topology.md` | n8n inbound aggregator |
| `project-hdd-stack-v2-bun.md` | Stack v2 Bun-first |
| `project-hdd-bun-sd-notify-gotcha.md` | Bun não suporta sd_notify nativo |
| `project-hdd-openclaw-substituted-by-bun.md` | D-043 Bun substitui OpenClaw |
| `project-hdd-cost-optimal-llm.md` | D-044 hybrid cost-optimal |
| `project-hdd-externalisation-thesis.md` | Tese central: externalização contexto |
| `feedback-hdd-mandatory-review.md` | D-019 revisão obrigatória |
| `feedback-bmad-prd-discover-brief.md` | Descobrir briefs prévios |
| `feedback-hdd-soft-convention-rot.md` | 3 lessons enforcement |
| `feedback-hdd-composition-risks.md` | AI Safety + Pentester insights |

## 44 decisões registadas (highlights)

- **D-016** Nome HDD · **D-017** Anthropic Max 20x · **D-018** Piloto projeto_hdd · **D-019** Revisão obrigatória
- **D-021..D-024** Brief autoritativo · WhatsApp · VPS · Bimodal · Gates qualidade
- **D-031..D-034** WhatsApp Cloud API · ToS ACCEPTED RISK · Clihelper integration · Backup Litestream
- **D-035** Stack v2 Bun-first
- **D-040** DRB APPROVE-WITH-CONDITIONS
- **D-042** n8n inbound topology
- **D-043** Bun substitui OpenClaw operacionalmente
- **D-044** Cost-optimal LLM hybrid validated com smoke tests

## 186 Architectural Obligations activas (AO-1..AO-186; AO-25 dispensada)

Listadas em `architecture.md` + decision-log. Categorias:
- F1 Pipeline bimodal · F2 Regra Interrupt · F3 WhatsApp + e-mail · F4 Worker VPS
- F5 State+idempotência · F6 Gates qualidade · F7 Janela LLM · F8 Resumo 3-tier · F9 Bootstrap
- Cross-cutting: hash chain audit · idempotência LLM-aware · context-bundle tiered + TTL
- Safety: 3 BLOCKERS Sprint 0 (AO-155+164, AO-158+165, AO-160+166)

## 4 Sprint 0 BLOCKERS pendentes

| # | Item | Owner |
|---|---|---|
| ⏳ | AO-155+164 two-step confirmation acções irreversíveis | Implementation |
| ⏳ | AO-158+165 path traversal sanitization no apply-diff | Implementation |
| ⏳ | AO-160+166 audit redaction multi-pattern (REFORÇADO pelo n8n payload verbose) | Implementation |
| ⏳ | DRB C4: 3 templates Meta submitted antes Day 7 (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`) | Operator action |
| ⏳ | AO-185 ANTHROPIC_API_KEY config para Haiku SDK direct | Operator setup |

## Stack confirmada (D-035 + D-043 + D-044)

| Layer | Choice |
|---|---|
| Runtime | Bun 1.3+ (não Node, não OpenClaw) |
| HTTP server | Hono |
| CLI | Commander.js |
| State store | bun:sqlite + Drizzle ORM |
| Backup | Litestream supervisor (1 unit) + rclone secundário R2 EU |
| LLM heavy (Dev/Reviewer/QA) | **claude --print --model claude-sonnet-4-6** via OAuth Max 20x (R$0 marginal) |
| LLM light (gap-detector/NLP/narrative) | Anthropic SDK Haiku 4.5 (~R$5-25/m) |
| Sandbox | Bun.spawn('docker' --network=none) |
| Logger | pino + custom audit JSONL hash chain |
| Tests | bun test + fast-check property-based |
| Build | bun build --compile |
| Lint | Biome + typescript-eslint (4 regras async-safety) |
| Secrets | systemd EnvironmentFile + envalid/Zod |
| Watchdog | systemd Type=simple + HTTP /healthz + Healthchecks.io |

## Topologia comunicacional

```
OUTBOUND (HDD → operador):
  HDD worker
    → POST https://api.example.com/principal/apis/mensagem/...
    → clihelper backend
    → Meta Cloud API
    → telemóvel operador

INBOUND (operador → HDD):
  telemóvel operador
    → Meta Cloud API
    → n8n.example.com (captura + filter + forward)
    → HDD /callback (Hono) com Zod minimal schema DROP-AT-INGRESS
```

## Preferências do operador (confirmadas ao longo de 3 sessões)

- **Idioma:** Português (PT)
- **Modo Auto activo:** make the reasonable call without stopping
- **Fast path:** prefiro batch + propor com `[ASSUMPTION]` tags sobre Coaching
- **Parallel agents** para party mode (vários subagentes em paralelo)
- **Resumo de Finalização 3-tier** obrigatório em toda finalização (D-019)
- **Skill level:** intermediate em BMAD
- **Não inventar** info não-justificável; usar `[ASSUMPTION]` ou `[OPEN]`
- **Não duplicar trabalho:** se um artefacto já existe e está canónico, ler — não regenerar
- **Budget:** R$1000/m total LLM (= Max 20x subscription cost exact)

## Plano para `bmad-create-epics-and-stories`

Espera-se que o workflow:

1. **Lê PRD v2 + architecture.md** — fonte dos epics
2. **Decompõe 9 features F1-F9 em epics formais** (provavelmente E1-E9 ou agrupados em E1-E5 por affinity)
3. **Por cada epic, gera user stories** com:
   - Story ID + title + epic ref
   - Acceptance criteria machine-checkable (do StorySpec schema do Sprint Planner)
   - `files_created[]` + `files_modified[]` (anti-drift, AO Step 06)
   - `ao_subset[]` (AOs relevantes; reduce 186 → 4-8 por story)
   - `estimated_tokens` (cost ledger AO-114)
   - Dependencies (DAG `story_deps` AO-117 base)
4. **First sprint plan candidate** — provavelmente alinhado com Sprint Planner Step 06 round 2 proposal (S01-S07 foundational)
5. **Output:** `_bmad-output/planning-artifacts/epics.md` (+ possivelmente `stories/` subfolder)

**Expected dimensão:** PRD tem 87 FRs. Estimate ~5-10 epics + 30-50 stories no v1. Sprint 1 = 7-12 stories foundational.

## Risks specific to this workflow

- **Volume risk:** 186 AOs filtradas por story precisa de algoritmo (não trivial). Workflow pode tentar carregar tudo no contexto → window pressure.
- **Schema alignment:** epics/stories devem alinhar com `StorySpec` schema definido em architecture Step 06. Verificar consistency.
- **DAG complexity:** dependencies entre stories podem ser complexas (especialmente foundational story chain S01-S07). Tooling DAG visualizer pode ajudar.
