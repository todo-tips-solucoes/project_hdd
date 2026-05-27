---
title: "Step 06 — Elicitation Results · HDD Project Structure"
workflow: bmad-create-architecture
step: 6
date: 2026-05-21
techniques: [file-by-file-dependency-graph-rigour, party-mode-cold-start-llm-reviewer]
status: pending-synthesis-approval
---

# Step 06 — Elicitation Results

## A — File-by-File Dependency Graph Rigour

**Verificação:**
- ✅ Zero ciclos detectados na layering DAG
- ✅ Adapter graph acyclic (store fundacional, audit depende de clock, outros dependem de clock+audit+store)
- ✅ Bootstrap order topologicamente consistente (14 passos)
- ✅ Hot spots identificados (lib/result, lib/branded, ports/store, ports/clock) são "infrastructure types", não god-objects

**3 questões reais identificadas + 3 AOs novas:**

| # | Issue | Resolução |
|---|---|---|
| **P1** | `ports/audit.port.ts` importa `core/events.ts` (DomainEvent type) — layering violation técnica | **AO-133:** types-only exception explícita. Ports PODEM importar types de `core/{events,errors}.ts`; NÃO PODEM importar behavior (transitions, gates, interrupts). ESLint rule custom enforça. |
| **P2** | `core/gap-detector/`, `parser-nlp/`, `narrative-summary/` chamam LLM via port — não é "pure domain" estrito | **AO-134:** sub-folder `src/core/services/` para application services que orquestram ports sem importar adapters. Refactor: move 3 files. Pure domain logic (FSM, idempotency, retry) mantém em `core/<feature>/`. Convenção documentada em `docs/conventions/core-vs-services.md`. |
| **P3** | `workers/story-executor.ts` vai ultrapassar 200 linhas (AO-122) — múltiplas responsabilidades | **AO-135:** split desde dia 1 em 4 ficheiros (`story-executor.ts` orquestrador top-level <100; `story-runner.ts` <150; `sub-agent-spawner.ts` <150; `gate-runner.ts` <150). |

**Refactor proposto ao tree:**
```
src/core/
├── fsm/, interrupts/, gates/, idempotency/, retry/, silence-monitor/  # PURE
├── errors.ts, events.ts                                                # types
└── services/                                                            # ← NEW
    ├── gap-detector.service.ts        (era core/gap-detector/ask-the-agent.ts)
    ├── intent-parser.service.ts       (era core/parser-nlp/intent-parser.ts)
    └── narrative-summary.service.ts   (era core/narrative-summary/builder.ts)

src/workers/
├── story-executor.ts          # ← split (orquestra top-level)
├── story-runner.ts            # ← NEW (single story run)
├── sub-agent-spawner.ts       # ← NEW (Dev/Reviewer/QA lifecycle)
├── gate-runner.ts             # ← NEW (4 gates execution)
└── watchdog, heartbeat, narrative-emitter, silence-monitor, budget-monitor
```

## P — Cold-Start LLM Reviewer

Esta perspectiva simulou um agente Sonnet 4.6 a olhar para o tree pela primeira vez (sem 123 AOs, sem PRD, sem decision-log). **Findings sobre descobribilidade.**

### O que se infere imediatamente do tree alone

- **Stack reconhecível 100%:** Bun + TypeScript + Hono + Commander + Drizzle + SQLite + Anthropic + Litestream + Biome + Renovate
- **Padrão arquitetural reconhecível:** Hexagonal (Ports & Adapters) sem ambiguidade
- **Folder roles inferíveis:** ports/adapters/core/workers/server/cli/lib/db separation clara

### O que NÃO se infere — 5 paths opacos

| Path | Risco de adivinha errada |
|---|---|
| `core/interrupts/{p1,s1,s2,s3}.ts` | Vai assumir prioridades (P1=crítico, S=secondary); são trigger types domain-specific |
| `core/gates/*.gate.ts` | Vai assumir sync validators; podem ser async com aprovação humana via WhatsApp |
| `adapters/whatsapp/leaky-bucket.ts` | Local? Coordenado com nginx? |
| `workers/narrative-emitter.ts` | Emite para onde? (WhatsApp? ficheiro? LLM?) |
| `core/context-bundle/{builder,schema}.ts` | Que contrato com o LLM? |

### Cold-start cost real

- **Top 5 ficheiros críticos** (~4K tokens base): `docs/conventions/naming.md`, `core/fsm/{states,transitions}.ts`, `core/events.ts`, `core/errors.ts + lib/result.ts`, `docs/conventions/review-rubric.md`
- **Para review de story complexa:** ~15-20K tokens só de orientação
- Cold-start ≈ **5-6% janela diária Sonnet** apenas para "perceber o projecto"
- Sprint 10 stories cold-start = ~150-200K tokens **só** em re-orientação (10× single review!)

→ **AO-143 (crítica):** context-bundle persiste entre runs do mesmo sub-agent role durante a mesma sprint; não re-orient cold a cada story; refresh só se ADRs/conventions mudaram. **Economia: ~135K tokens/sprint.**

### 6 gaps no tree (ficheiros esperados mas ausentes)

| Gap | Severity | Acção |
|---|---|---|
| `CHANGELOG.md` | medium | **AO-139** Keep-a-Changelog format |
| `docker-compose.yml` (dev local) | medium | docs/runbooks/local-dev.md OR `docker-compose.dev.yml` |
| `.env.schema.ts` / Zod env doc | low | já em `src/config/schema.ts` (AO-52) — link explícito no README |
| `ARCHITECTURE.md` (root) com diagrama de sequência | HIGH | **AO-137** separado do BMAD output |
| `LICENSE` | medium | **AO-140** `[OPEN]` — operador decide (MIT default?) |
| `tests/unit/` | low | está co-located (não é gap real — clarify no README) |

### 5 melhorias para cold-start 10× melhor

1. **`docs/ARCHITECTURE.md` (root)** com **diagrama de sequência** de UMA story end-to-end (WhatsApp → interrupt → FSM → gate → worker → BMAD → resultado). **1 diagrama vale 5K tokens de leitura.** → **AO-137**

2. **`docs/glossary.md`** com `p1/s1/s2/s3`, "gate", "interrupt", "context-bundle", "silence-monitor" definidos — elimina as 5 adivinhações erradas em ~800 tokens. → **AO-136**

3. **`docs/conventions/naming.md` com exemplos reais do projecto** (não só regras abstractas). → **AO-141**

4. **`README.md` no root** com:
   - Project tagline (1 frase)
   - "Tour of codebase" (10 linhas, paths reais — entry → flow → output)
   - Índice de ADRs críticos (não só pasta `docs/decisions/` opaca)
   - Links para conventions + runbooks → **AO-138**

5. **`docs/decisions/000-index.md`** — entry point para ADRs com "porquê este projecto faz X em vez de Y" responses → reduz loops de questionamento

### AOs derivadas do Cold-Start

| # | Obrigação |
|---|---|
| **AO-136** | `docs/glossary.md` obrigatório (~800 tokens) — define p1/s1/s2/s3, gate, interrupt, context-bundle, silence-monitor, etc. |
| **AO-137** | `docs/ARCHITECTURE.md` (root, separado de `_bmad-output/.../architecture.md`) com diagrama sequência de UMA story end-to-end (Mermaid) |
| **AO-138** | `README.md` root estruturado: tagline + tour-of-codebase (10 linhas paths reais) + ADR index + links conventions/runbooks |
| **AO-139** | `CHANGELOG.md` no root (Keep-a-Changelog format) — versões pré-release marcadas |
| **AO-140** | `LICENSE` no root — `[OPEN]` operador decide antes M1 (default proposto: MIT) |
| **AO-141** | `docs/conventions/naming.md` inclui **exemplos reais do projecto** (não só regras abstractas) |
| **AO-142** | `context-bundle.json` tier core inclui glossary + naming + 5 critical files (AO-136 + AO-141 + states.ts + transitions.ts + events.ts + errors.ts + result.ts) — ~4K tokens base |
| **AO-143** | Context-bundle **persistido entre runs** do mesmo sub-agent role na mesma sprint; refresh só em mudança de ADR/conventions. Economia ~135K tokens/sprint vs cold-start cada story. |

---

## Synthesis

**3 AOs do Dep Graph (AO-133..AO-135)** + **8 AOs do Cold-Start (AO-136..AO-143)** = **11 novas AOs**.

**Refactor estrutural confirmado:**
- `core/services/` introduzido (3 files moved)
- `workers/` split em 4 sub-files
- Tree atualizado em `architecture.md` Step 06

**Cold-start strategy** muda materialmente o `context-bundle.json` design (AO-119) — agora tem 2 sub-tiers:
- **tier core base** (always loaded): glossary + naming + 5 critical files ≈ 4K tokens
- **tier core per-story** (per-invocation): story spec + AOs relevantes + diff ≈ 8-12K tokens
- **tier reference** (fetch-on-demand): ADRs, decision-log, full architecture

**Total AOs activas: 137** (AO-1..AO-143; AO-25 dispensada + 5 não-aplicáveis pós-D-033 a re-verificar; contagem efectiva 137).

### Implicações imediatas para Step 07 (Validation)

Validation precisa de verificar:
- Layering DAG enforced (ESLint rule custom para AO-133)
- `core/services/` existe e tem só application services
- `workers/` split aplicado
- `docs/glossary.md` + `ARCHITECTURE.md` + `README.md` + `CHANGELOG.md` + `LICENSE` existem
- Context-bundle tem 2-tier core (base + per-story)

### Pendências a fechar antes de incorporar Step 06

1. Confirmar adopção do refactor `core/services/` + workers split
2. Confirmar AO-140 LICENSE (default MIT?)
3. Confirmar diagrama sequência format (Mermaid OK?)

---

> **Estado:** synthesis pronta. 11 novas AOs (AO-133..AO-143). Refactor tree confirmado. A incorporar no `architecture.md` Step 06.
