---
title: "Step 05 — Elicitation Results · HDD Implementation Patterns"
workflow: bmad-create-architecture
step: 5
date: 2026-05-21
techniques: [boundary-test-throw-whitelist, party-mode-bmad-reviewer-introspection]
status: pending-synthesis-approval
---

# Step 05 — Elicitation Results

## A — Boundary Test sobre AO-66 (throw whitelist)

Testados **12 cenários-fronteira** contra a whitelist original de 4 itens. Resultado: whitelist subspecificada — **refinada a 11 itens em 4 categorias** + **4 novas AOs** (AO-101..104).

### Whitelist refinada (vai para `docs/conventions/errors.md`)

**Programmer errors (bugs):**
1. `assertNever(x: never)` em discriminated unions exhaustivas
2. `assertInvariant(cond: boolean, msg: string)` em pure domain code — violation = bug

**Boot-time failures (process must exit 1):**
3. Config schema validation fail (envalid/Zod no boot)
4. Migration failure após `BEGIN EXCLUSIVE` rollback (boot)
5. Boot-time prerequisite verification failures (docker daemon ausente, secrets file inválido, R2 unreachable no first boot)

**Filesystem / state corruption (irrecuperável):**
6. Audit log hash chain corruption detectada no boot
7. SQLite database file unreadable / corrupt magic header

**Shutdown handlers (last resort):**
8. Shutdown handler force-exit after error logging

**Boundary wrappers (internal throws absorvidos):**
9. Async iterator excepção dentro de `for await` — DEVE ter `try/catch` envolvente + `Result` retorno
10. `ClockPort.setTimeout` callback — DEVE ter `try/catch` envolvente

**Test code (excluded by ESLint overrides):**
11. Test assertion frameworks (`expect`, `assert`) em `*.test.ts` files

### AOs derivadas do Boundary Test

| # | Obrigação |
|---|---|
| **AO-101** | `assertInvariant(cond, msg)` helper em `src/lib/assert.ts` para programmer errors em pure domain code |
| **AO-102** | `for await` requer `try/catch` envolvente OR retorna `AsyncIterable<Result<…>>` — ESLint rule |
| **AO-103** | `setTimeout`/`setInterval` apenas via `ClockPort` — ESLint `no-restricted-globals` |
| **AO-104** | Test files isentos da throw whitelist via Biome/ESLint `overrides` |

## P — Party Mode: BMAD Reviewer Agent (auto-introspecção)

Esta foi a perspectiva mais valiosa do workflow inteiro — o próprio agente que vai validar as 100+ AOs revelou **o que ele consegue/não consegue validar**, expondo gaps no architecture document.

### Findings críticos da auto-introspecção

**1. Tooling-detectable vs LLM-judgment split (50/50):**
- ✅ Mecanicamente validável: throw whitelist (ESLint AST), neverthrow import, branded types presence, factory functions vs classes (parcial), file size, import order, naming (parcial), `kind` discriminant (parcial), coverage thresholds, `O_APPEND` audit, idempotency lookup (parcial).
- 🧠 Exige LLM judgment: factory function semantics, naming wire shape, retry/CB owner layer, functional core boundary, gap PRD↔código, idempotency lookup ordering, AO-101..104 (não existem ainda).

**2. Non-determinism risk:** dois reviews ao mesmo diff podem chegar a veredictos diferentes em judgment AOs. **Mitigação:** context-bundle deve conter **rubrica binária estruturada** ("I/O em `src/adapters/`? S/N") em vez de prose. Sem isto, variance alta entre runs.

**3. FP/FN risks específicos:**
- **FP risk alto:** `kind` vs `type` discriminant (semântico vs sintáctico), factory function rule (helper classes em `src/lib/` false-positive), functional core (Result combinators podem parecer I/O).
- **FN risk alto:** idempotency ordering (race condition entre lookup e side-effect), gap PRD vagamente especificado, AO-101..104 (não detectáveis até existirem), retry policies sem schema machine-readable.

**4. Gap detector decision tree (5 critérios):**

```
1. PRD diz X explicitamente + código faz Y → P1 obrigatório
2. PRD silencia + decisão interna trivial → não dispara
3. PRD vago + código razoável + sem violação AO → WARN sugerindo ADR
4. PRD vago + código viola AO ou muda comportamento externo → P1 obrigatório
5. Sem AO + sem PRD coverage → INFO + sugerir ADR
```

**Critério de corte P1:** divergência afecta **comportamento observável pelo operador** (interrupt flow, audit log, mensagens WhatsApp, FSM state).

**5. Auto-validation paradox (meta-dogfood):** ao rever HDD a construir-se a si próprio, risco de aceitar violações "que fazem sentido". Mitigação: **rubrica binária independente do módulo** + flag `selfReview: true` no audit JSONL para auditoria retrospectiva.

**6. Cost budget concreto:** ~14-24K tokens por review (Sonnet 4.6). Sprint de 10 stories = ~200K tokens Sonnet. Bottleneck não é janela total — é **custo acumulado** + qualidade que degrada nas 8-10 judgment AOs.

**7. Output contract formalizado:**

```typescript
interface ReviewIssue {
  ao: string                   // e.g. "AO-66", "AO-95", "GAP-PRD-FR-010"
  severity: 'P1' | 'WARN' | 'INFO'
  file: string
  line?: number
  description: string
  suggestion: string
  toolingDetectable: boolean   // could linter/CI have caught?
}

interface ReviewOutput {
  storyId: StoryId
  reviewedAt: string           // ISO-8601
  verdict: 'APPROVED' | 'APPROVED_WITH_WARNINGS' | 'REJECTED' | 'BLOCKED_P1'
  issues: ReviewIssue[]
  gapDetected: boolean         // true → master agent dispara P1
  gapDescription?: string      // obrigatório se gapDetected=true
  coveragePassed: boolean
  selfReview: boolean          // meta-dogfood flag
  missingAOs: string[]         // AOs referenced but não em architecture.md
}
```

**8. P1 trigger criteria (6 regras concretas):**

| # | Critério | Trigger |
|---|---|---|
| 1 | `gapDetected=true` + afecta operador externo | **P1 imediato** |
| 2 | `REJECTED` + ≥1 P1 em AO segurança (AO-11..14, 16, 17) | **P1 imediato** |
| 3 | `REJECTED` + ≥1 P1 em AO correctness FSM (AO-2, 68, 89) | **P1 imediato** |
| 4 | `coveragePassed=false` | WARN, não P1 (CI bloqueia merge) |
| 5 | `APPROVED_WITH_WARNINGS` apenas | Inclui no PR description, não P1 |
| 6 | `missingAOs` não vazio | INFO + bloqueia self-sign-off até confirmação |

### 5 BLOCKERS críticos identificados pelo Reviewer

1. **Step 05 não existe ainda** → AO-101..104 referenciadas mas não documentadas. *Acção:* criar `docs/conventions/errors.md` + secção patterns no architecture.md.
2. **`docs/conventions/errors.md` não existe** → AO-66 sem fonte autoritativa. *Acção:* criar antes da primeira story.
3. **`ReviewerPort` interface não definida** → master FSM sem contrato formal de output. *Acção:* `src/ports/reviewer.port.ts` com schema `ReviewOutput`.
4. **Rubricas binárias por AO ausentes** → judgment AOs em prose. *Acção:* `docs/conventions/review-rubric.md` com checklist binário por judgment AO.
5. **AO-86 webhook clihelper schema ainda blocker** → impossível validar `src/server/callback.ts`. *Acção:* operador partilha payload real antes M1.

### AOs derivadas da auto-introspecção do Reviewer

| # | Obrigação |
|---|---|
| **AO-105** | Per-AO binary rubrics em `docs/conventions/review-rubric.md` (substitui prose para judgment AOs) |
| **AO-106** | `ReviewerPort` interface em `src/ports/reviewer.port.ts` com `ReviewOutput` schema (formal contract) |
| **AO-107** | Review output inclui `selfReview: boolean` flag para meta-dogfood; exportado para audit JSONL |
| **AO-108** | `missingAOs` field obrigatório; reviewer bloqueia self-sign-off quando não-vazio até architect confirmar |
| **AO-109** | Reviewer context-bundle inclui **rubrica binária** + ESLint AST rule list (não só prose architecture.md) |
| **AO-110** | P1 trigger criteria documentados em `docs/conventions/review-p1-criteria.md` (6 regras concretas) |
| **AO-111** | Sonnet 4.6 cost budget per review ~24K tokens; sprint cap ~200K tokens (alert em 80%) |

---

## Synthesis

**Boundary Test refinou whitelist de 4 → 11 itens** + **4 novas AOs** (AO-101..104) que tornam a regra realmente enforceable (`assertInvariant`, for-await wrapping, ClockPort enforced, test overrides).

**Reviewer Agent introspection adicionou 7 AOs** (AO-105..111) focadas em **tornar as conventions validáveis na prática**:
- Rubricas binárias para judgment AOs (não só prose)
- Contract formal de output (`ReviewerPort` + `ReviewOutput`)
- Cost budget explicitado
- P1 criteria criteria
- Meta-dogfood flag

**Total acumulado: 111 AOs activas** (AO-1..AO-111; AO-25 dispensada).

### Implicações para Step 06 (Structure)

A próxima fase precisa de:
- **3 novos ficheiros em `docs/conventions/`**: `errors.md` (throw whitelist), `review-rubric.md` (binary rubrics), `review-p1-criteria.md` (P1 trigger criteria)
- **1 novo port em `src/ports/reviewer.port.ts`** com `ReviewOutput` schema
- **Adição em estrutura proposta:** `src/lib/assert.ts` (assertInvariant helper)
- **CI gates:** Sonnet cost budget tracking + sprint cap alert em 80%

### Pendências paralelas (não bloqueiam Step 05 close)

- AO-86 webhook clihelper schema (continua) — operador
- AO-105 binary rubrics conteúdo concreto — pode ser criado durante a implementação das primeiras AOs

---

> **Estado:** synthesis pronta. Boundary Test + Reviewer Agent introspection juntos = 11 novas AOs (AO-101..111). A incorporar no `architecture.md`.
