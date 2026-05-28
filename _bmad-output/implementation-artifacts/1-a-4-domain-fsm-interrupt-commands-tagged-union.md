# Story 1.a.4: Domain — FSM + interrupt-commands tagged union

Status: review

> **Story Context Engine output.** `bmad-create-story` 2026-05-28.
> Reviewer humano: `operador`. Quarta story implementacional do Epic 1.a;
> 1ª story a colocar código real em `src/core/` — primeira validação **viva**
> de AO-103 (no `setTimeout` em core) + Dep Graph Rigour (core não importa adapters).

---

## Story

As a `worker` e `WhatsApp listener`,
I want `src/core/fsm.ts` com FSM enum + transition table e `src/core/domain/interrupt-commands.ts` com tagged union dos Quick Reply payloads,
So that o estado do worker é único source-of-truth e o canal WhatsApp / regra de interrupt partilham o mesmo contrato sem coupling circular.

## Acceptance Criteria

1. **AC-1 (binary):** FSM com **6 estados** — `idle`, `running`, `paused_for_interrupt`, `paused_awaiting_review`, `paused_window_exhausted`, `failed`. `fsm.transition('idle', 'StartRun')` retorna `ok({ to: 'running' })` [Source: epics.md#story-1a4 linha 736-737].
2. **AC-2 (binary):** Transição inválida (e.g. `idle` → `failed` sem evento mediador) retorna `err({ kind: 'IllegalTransition', from, event })` [Source: epics.md#story-1a4 linha 738].
3. **AC-3 (property):** Para todo estado S × todo evento E, a transition table é **total** ou rejeita explicitamente. Property test via fast-check garante que não há throw / undefined behaviour [Source: epics.md#story-1a4 linha 739; AO-92 mutation-testing pyramid].
4. **AC-4 (binary):** `interrupt-commands.ts` tagged union com **5 kinds** — `P1Continuar`, `P1Pausar`, `FinAprovar`, `FinPedirMudancas`, `FinRejeitar`. Parser recebe payload `"p1_continuar_assim"` → `ok({ kind: 'P1Continuar' })` [Source: epics.md#story-1a4 linha 741-742].
5. **AC-5 (binary):** Payload desconhecido → `err({ kind: 'UnknownCommand', received: <raw> })` [Source: epics.md#story-1a4 linha 743].

**ACs implícitas (validação automática que esta story dispara):**

- **Dep Graph Rigour** test (de 1.a.3) começa a ter substância — `src/core/fsm.ts`, `events.ts`, `domain/interrupt-commands.ts` existem e o test confirma que NENHUM importa `src/adapters/`.
- **AO-103** ESLint rule fica activa — qualquer `setTimeout` em `src/core/` falha lint. Esta story usa apenas funções puras síncronas; não precisa de Clock.

## Tasks / Subtasks

- [x] **Task 1 — Pré-flight (AC: todas)**
  - [x] 1.1 Confirmar baseline pós-1.a.3: `bun --version` ≥ 1.3.0, `bun run lint` exit 0, `bun test` 44 pass.
  - [x] 1.2 Confirmar `src/lib/result.ts` + `src/lib/branded.ts` + `src/ports/` disponíveis (heritage 1.a.2 + 1.a.3).
  - [x] 1.3 Confirmar `tests/ports/contracts.test.ts#AC-1 Dep Graph Rigour` actualmente passa **trivialmente** (src/core/ vazio); após esta story passa **com substância**.
  - [x] 1.4 Criar dirs necessárias: `src/core/domain/`, `tests/core/`.
- [x] **Task 2 — `src/core/fsm.ts` (AC: #1, #2, #3)**
  - [x] 2.1 Definir enum-as-union (TS literal types) `FsmState = 'idle' | 'running' | 'paused_for_interrupt' | 'paused_awaiting_review' | 'paused_window_exhausted' | 'failed'`.
  - [x] 2.2 Definir tagged union `FsmEvent` com pelo menos: `StartRun`, `InterruptP1`, `InterruptS1`, `InterruptS2`, `InterruptS3`, `OperatorResponded`, `OperatorPausedReview`, `OperatorApproved`, `OperatorRejected`, `WindowExhausted`, `Fail`. Cada com `kind` discriminator. (Detalhe específico de payload diferido para 1.a.5+ — aqui só os kinds suficientes para cobrir as 6 transições da FSM.)
  - [x] 2.3 Tabela `transitionTable: ReadonlyMap<FsmState, ReadonlyMap<EventKind, FsmState>>` OU equivalente object `Record<FsmState, Partial<Record<EventKind, FsmState>>>`. Documentar **explicitamente** transições válidas via tabela markdown no JSDoc.
  - [x] 2.4 Função pura `transition(from: FsmState, event: FsmEvent): Result<{ to: FsmState }, FsmError>` retornando `ok({to})` se transição existe na tabela, `err({kind:'IllegalTransition', from, event: event.kind})` caso contrário.
  - [x] 2.5 Tipo `FsmError = { kind: 'IllegalTransition'; from: FsmState; event: string }`.
  - [x] 2.6 NÃO usar `throw` (whitelist AO-66 não cobre); apenas Result. NÃO importar nada de `src/adapters/` ou `src/ports/` aqui (FSM é puro domain).
  - [x] 2.7 Confirmar ≤200 linhas (AO-122).
- [x] **Task 3 — `src/core/domain/interrupt-commands.ts` (AC: #4, #5)**
  - [x] 3.1 Definir tagged union `InterruptCommand` com 5 kinds: `P1Continuar`, `P1Pausar`, `FinAprovar`, `FinPedirMudancas`, `FinRejeitar`. Cada elemento literal `{ readonly kind: '...' }` (sem payload por agora — payload entra com 4.x).
  - [x] 3.2 Mapping canónico `payload → kind`: tabela `PAYLOAD_MAP: Readonly<Record<string, InterruptCommand['kind']>>` com pares `"p1_continuar_assim" → "P1Continuar"`, `"p1_pausar_agora" → "P1Pausar"`, `"fin_aprovar" → "FinAprovar"`, `"fin_pedir_mudancas" → "FinPedirMudancas"`, `"fin_rejeitar" → "FinRejeitar"`.
  - [x] 3.3 Função pura `parseInterruptCommand(raw: string): Result<InterruptCommand, InterruptCommandError>`. `raw` que match em `PAYLOAD_MAP` → `ok({kind})`; caso contrário → `err({kind:'UnknownCommand', received: raw})`.
  - [x] 3.4 Tipo `InterruptCommandError = { kind: 'UnknownCommand'; received: string }`.
  - [x] 3.5 NÃO usar `throw`. NÃO importar adapters/ports.
  - [x] 3.6 Confirmar ≤200 linhas (AO-122).
- [x] **Task 4 — `src/core/events.ts` (AR-036, D-04.19; AC implícita)**
  - [x] 4.1 Definir tagged union `DomainEvent` baseada em architecture.md linhas 665-672. Inclui:
    - `{ kind: 'RunStarted'; runId: RunId; at: Date }`
    - `{ kind: 'StoryCompleted'; runId: RunId; storyId: StoryId; at: Date }`
    - `{ kind: 'InterruptTriggered'; runId: RunId; trigger: 'P1' | 'S1' | 'S2' | 'S3'; at: Date }`
    - `{ kind: 'GateFailed'; runId: RunId; gate: GateName; reason: string; at: Date }`
    - `{ kind: 'WhatsAppMessageSent'; runId: RunId; templateName: string; msgId: string; at: Date }`
    - `{ kind: 'WhatsAppMessageReceived'; runId: RunId; senderId: string; intent: ParsedIntent; at: Date }`
  - [x] 4.2 Definir `GateName = 'StoryToDev' | 'DevToReview' | 'ReviewToQA'` (stub conservador per architecture menções).
  - [x] 4.3 Definir `ParsedIntent` como stub MVP `{ kind: 'Unknown'; raw: string } | { kind: 'Interrupt'; command: InterruptCommand['kind'] }` — refinar quando NLP fallback (1.a.10) e parser real (3.4) chegarem.
  - [x] 4.4 Importar `RunId`, `StoryId` de `../lib/branded.ts` (via re-export se possível, senão path directo). Importar `InterruptCommand` de `./domain/interrupt-commands.ts` para o `ParsedIntent`.
  - [x] 4.5 Confirmar ≤200 linhas (AO-122).
- [x] **Task 5 — `tests/core/fsm.test.ts` (AC: #1, #2, #3)**
  - [x] 5.1 Specs determinísticas das 6 transições válidas (1 spec por transição): `idle → StartRun → running`, `running → InterruptP1 → paused_for_interrupt`, etc. Cobertura do happy path da FSM.
  - [x] 5.2 Specs de transições inválidas: `idle → Fail` direct, `idle → OperatorApproved`, etc. — todas devem retornar `err({kind:'IllegalTransition', ...})` com `from` e `event` correctos.
  - [x] 5.3 **AC-3 property test:** `fc.assert(fc.property(fc.constantFrom(...all states), fc.constantFrom(...all event kinds), (s, e) => { const r = transition(s, {kind: e} as FsmEvent); return r.isOk() || (r.isErr() && r._unsafeUnwrapErr().kind === 'IllegalTransition'); }))`. Garante totalidade: sempre Result (nunca throw, nunca undefined).
  - [x] 5.4 Spec adicional: `Object.keys(transitionTable)` lista exactamente as 6 states; `Object.values` confirma todos os targets são states válidos (no orphan target).
- [x] **Task 6 — `tests/core/interrupt-commands.test.ts` (AC: #4, #5)**
  - [x] 6.1 Specs para cada payload conhecido: `parseInterruptCommand("p1_continuar_assim").isOk() === true` + `._unsafeUnwrap().kind === 'P1Continuar'`. 5 specs total.
  - [x] 6.2 Spec para payload desconhecido: `parseInterruptCommand("foo_bar").isErr()` + `._unsafeUnwrapErr() === { kind: 'UnknownCommand', received: 'foo_bar' }`.
  - [x] 6.3 Spec para edge cases: string vazia, payload com whitespace (`" p1_continuar_assim "` deve falhar — match exacto não é trim — confirma decisão; Q-A4-2 para confirmar política), case-sensitivity (`"P1_CONTINUAR_ASSIM"` deve falhar; payloads são lowercase exact).
- [x] **Task 7 — Validação E2E + Dep Graph Rigour + AO-103 (AC: todas + implícitas)**
  - [x] 7.1 `bun run type-check` exit 0.
  - [x] 7.2 `bun run lint` exit 0. AO-103 ESLint rule deve passar (esta story não usa `setTimeout`/`setInterval`). Confirmar que nenhum throw fora da whitelist foi introduzido.
  - [x] 7.3 `bun test` 100% pass; contagem ≥ 44 + novos.
  - [x] 7.4 `bun test tests/ports/contracts.test.ts#AC-1` continua a passar — agora **com substância** (3 ficheiros reais em src/core/, todos sem imports de adapters).
  - [x] 7.5 Sanity AO-103 (anti-regression): criar `src/core/__sanity_setTimeout.ts` com `setTimeout(()=>{}, 100)`, correr ESLint, confirmar exit 1 (AO-103 active); apagar ficheiro.
  - [x] 7.6 Sanity Dep Graph (anti-regression): criar `src/core/__sanity_adapter_import.ts` com `import { x } from "../adapters/clock/system-clock.adapter.ts"`, correr contracts.test.ts, confirmar fail; apagar.
- [x] **Task 8 — Resumo Tier-B + sprint-status review (D-019)**
  - [x] 8.1 Escrever `_bmad-output/implementation-artifacts/story-1a4-summary.md`.
  - [x] 8.2 Update sprint-status `1-a-4-domain-fsm-interrupt-commands-tagged-union: ready-for-dev → review`.
  - [x] 8.3 Pedir `approve story-1a4`.

---

## Dev Notes

### Big picture

Story 1.a.4 inaugura `src/core/` — o **functional core** do HDD (AO-95: functional core / imperative shell). Aqui vivem apenas funções puras, dependendo apenas de `src/lib/` (Result, branded) e de tipos de `src/ports/` (interfaces) — **nunca** de adapters concretos. Esta separação é o que torna toda a lógica de domínio testável determinísticamente.

3 conceitos fundamentais entram com esta story:
1. **FSM** (`fsm.ts`): estado único do worker. 6 estados que cobrem o ciclo de vida de uma run. Transições explícitas via tabela.
2. **InterruptCommand** (`domain/interrupt-commands.ts`): contrato partilhado entre webhook listener (parse de Quick Reply) e regra de interrupt (consume). Sem este contrato, E3 (WhatsApp) e E4 (Interrupts) ficariam acoplados.
3. **DomainEvent** (`events.ts`): catálogo de eventos do sistema. Auditado em JSONL (Story 1.a.6) e processado por handlers (Stories 4.x).

### O que NÃO entra nesta story (delimitar scope)

- ❌ **Persistência FSM em SQLite** (AO-40 `tabela single-row + BEGIN IMMEDIATE atomic`) → **Story 1.a.5** (db schema). Esta story é pura: nenhum I/O.
- ❌ **Queue de triggers durante PAUSED** (AO-2 "novos triggers enquanto PAUSED entram em queue") → **Story 4.x** (interrupt rule engine). Esta story define apenas a tabela de transições.
- ❌ **Payloads ricos em FsmEvent** (e.g. `OperatorResponded` carrega `InterruptCommand` real) — diferido. Esta story só define os `kind`s suficientes para a tabela.
- ❌ **AsyncLocalStorage / correlation IDs** → **Story 1.a.9**.
- ❌ **Audit JSONL emission** de DomainEvents → **Story 1.a.6**.
- ❌ **Webhook parser real** que consome `parseInterruptCommand` → **Story 3.4** (inbound HTTP).
- ❌ **NLP fallback Haiku** para texto livre → **Story 3.5**.
- ❌ **Mutation testing Stryker** (AO-92) → **Story 1.c.4** (CI).
- ❌ **Two-step confirmation** (AO-155, irreversíveis) → **Story 1.b.2**.

### Architectural compliance — AOs / ARs cobertos

| ID | Cobertura nesta story | Onde |
|----|----------------------|------|
| **AR-035** FSM como enum + transition table em `src/core/fsm.ts` | Sim (full) | Task 2 |
| **AR-036** Domain events tagged union em `src/core/events.ts` | Sim (full) | Task 4 |
| **AO-2** FSM explícita do ciclo | Parcial (estados + transitions; queue diferida 4.x) | Task 2 |
| **AO-40** FSM persisted single-row + BEGIN IMMEDIATE | NÃO (Story 1.a.5) | — |
| **AO-68** FSM enum + transition table validada em domain | Sim (full) | Tasks 2, 5 |
| **AO-92** Property-based + mutation testing | Parcial (property test sim; Stryker em 1.c.4) | Task 5.3 |
| **AO-95** Functional core / imperative shell | Sim (full — código é 100% puro) | Tasks 2-4 |
| **AO-103** `setTimeout`/`setInterval` apenas via ClockPort | Validado (esta story não usa nada disto) | Task 7.5 |
| **AO-122** max-lines 200 HARD | Mantida | Tasks 2.7, 3.6, 4.5 |
| **D-04.17** FSM enum + transition table | Sim | Task 2 |
| **D-04.19** Domain events tagged union | Sim | Task 4 |
| **Dep Graph Rigour** core não importa adapters | Validado (1ª story com código real em src/core) | Task 7.4 |

### Library/framework — sem deps novas

Story 1.a.4 NÃO instala nada novo. Usa:
- `bun:test` (built-in).
- `fast-check@^4.8.0` (1.a.2) — para property test AC-3.
- `neverthrow@^8.2.0` (1.a.2) via re-export `src/lib/result.ts`.
- `RunId`/`StoryId` de `src/lib/branded.ts`.

### File structure (delta sobre 1.a.3)

**Novos:**
```
src/core/
├── fsm.ts                              (~120 linhas est.)
├── events.ts                           (~70 linhas est.)
└── domain/
    └── interrupt-commands.ts           (~60 linhas est.)
tests/core/
├── fsm.test.ts                         (~180 linhas est.)
└── interrupt-commands.test.ts          (~80 linhas est.)
```

**Substituiu `.gitkeep`:**
- `src/core/.gitkeep` removido (Task 2 cria `fsm.ts`).

**Modificados:** nenhum (story é puramente aditiva).

### Testing standards summary

- **Runner:** `bun test`.
- **Property-based:** AC-3 obriga property test sobre toda combinação estado × evento. fast-check arbitraries: `fc.constantFrom(...allStates)`, `fc.constantFrom(...allEventKinds)`.
- **Coverage target:** AO-91 (branch ≥85% em `src/core/`) — esta story é a primeira que materializa este target. Validar com `bun test --coverage` (flip bunfig temp para `coverage = true` per O-A2-2). Linha + branch ≥85%.
- **Determinismo:** zero `setTimeout`, zero async I/O — tests determinísticos, totais.

### Code patterns canónicos

**FSM transition table (esboço):**

```typescript
// src/core/fsm.ts (esboço)
import { type Result, err, ok } from "../lib/result.ts";

export type FsmState =
  | "idle"
  | "running"
  | "paused_for_interrupt"
  | "paused_awaiting_review"
  | "paused_window_exhausted"
  | "failed";

export type FsmEvent =
  | { kind: "StartRun" }
  | { kind: "InterruptP1" }
  | { kind: "InterruptS1" }
  | { kind: "InterruptS2" }
  | { kind: "InterruptS3" }
  | { kind: "OperatorResponded" }
  | { kind: "OperatorPausedReview" }
  | { kind: "OperatorApproved" }
  | { kind: "OperatorRejected" }
  | { kind: "WindowExhausted" }
  | { kind: "Fail" };

export type FsmError = {
  readonly kind: "IllegalTransition";
  readonly from: FsmState;
  readonly event: FsmEvent["kind"];
};

const TABLE: Readonly<
  Record<FsmState, Partial<Record<FsmEvent["kind"], FsmState>>>
> = {
  idle: { StartRun: "running" },
  running: {
    InterruptP1: "paused_for_interrupt",
    InterruptS1: "paused_for_interrupt",
    InterruptS2: "paused_for_interrupt",
    InterruptS3: "paused_for_interrupt",
    OperatorPausedReview: "paused_awaiting_review",
    WindowExhausted: "paused_window_exhausted",
    Fail: "failed",
  },
  paused_for_interrupt: { OperatorResponded: "running" },
  paused_awaiting_review: {
    OperatorApproved: "running",
    OperatorRejected: "failed",
  },
  paused_window_exhausted: { OperatorResponded: "running" },
  failed: {}, // terminal
};

export function transition(
  from: FsmState,
  event: FsmEvent,
): Result<{ to: FsmState }, FsmError> {
  const to = TABLE[from][event.kind];
  if (to === undefined) {
    return err({ kind: "IllegalTransition", from, event: event.kind });
  }
  return ok({ to });
}
```

**InterruptCommand parser (esboço):**

```typescript
// src/core/domain/interrupt-commands.ts (esboço)
import { type Result, err, ok } from "../../lib/result.ts";

export type InterruptCommand =
  | { readonly kind: "P1Continuar" }
  | { readonly kind: "P1Pausar" }
  | { readonly kind: "FinAprovar" }
  | { readonly kind: "FinPedirMudancas" }
  | { readonly kind: "FinRejeitar" };

export type InterruptCommandError = {
  readonly kind: "UnknownCommand";
  readonly received: string;
};

const PAYLOAD_MAP: Readonly<Record<string, InterruptCommand["kind"]>> = {
  p1_continuar_assim: "P1Continuar",
  p1_pausar_agora: "P1Pausar",
  fin_aprovar: "FinAprovar",
  fin_pedir_mudancas: "FinPedirMudancas",
  fin_rejeitar: "FinRejeitar",
};

export function parseInterruptCommand(
  raw: string,
): Result<InterruptCommand, InterruptCommandError> {
  const kind = PAYLOAD_MAP[raw];
  if (kind === undefined) {
    return err({ kind: "UnknownCommand", received: raw });
  }
  return ok({ kind });
}
```

### Previous Story Intelligence

**Story 1.a.3 (commit `1abfa68`):**
- `tests/ports/contracts.test.ts#AC-1 Dep Graph Rigour` foi escrito mas passa **trivialmente** porque `src/core/` estava vazio. Esta story é a 1ª a popular `src/core/` — o test passa a ter substância real.
- AO-103 ESLint rule activada em `src/core/**`. Esta story confirma que o rule funciona sem fazer noise (não usa `setTimeout`).
- Padrão `argsIgnorePattern: "^_"` global aplicável aqui se houver assinatura com unused params.
- `tsconfig noUnusedParameters: true` ainda activo — atenção a parâmetros não usados (deve ser raro em domain code puro).

**Story 1.a.2 (commit `4c3a4b6`):**
- `Result`/`Err`/`Ok` pattern canónico via `../lib/result.ts`. Reusar — NÃO importar `neverthrow` directo.
- `assertNever` disponível em `../lib/branded.ts` — útil para exhaustiveness checks em switch (não estritamente necessário aqui mas vale ter em mente para Task 5).
- ESLint `no-restricted-syntax: ThrowStatement` activo. NÃO throw.

**Story 1.a.1 (commit `29f3e15`):**
- Biome max-lines 200 HARD para `src/**`. Cada um dos 3 ficheiros desta story deve ficar ≤200.
- ESLint `no-unsafe-assignment` activo — atenção a casts para `any`.

### Git intelligence — últimos 5 commits

```
1abfa68 feat(story-1a3): 3 ports temporais (Clock/Spawn/Notify) + AO-103 enforce (3 ACs verde)
4c3a4b6 feat(story-1a2): Result+neverthrow + branded types + throw whitelist (4 ACs verde)
29f3e15 feat(story-1a1): bun scaffold + biome + eslint + bun test (5 ACs verde)
a9cecf7 feat(story-1c7): smoke test bmad-cli + ADR D-052 (Claude headless)
f38e20a docs: marca AO-151 como resolvido no architecture.md
```

Padrões a manter: conventional commit `feat(story-NN):` em PT-PT, Co-Authored-By footer, 1 story = 1 commit, sem push automático.

### Project Structure Notes

**Conflitos detectados / decisões para operador (Open Questions):**

- **Q-A4-1 [CRITICAL]:** **Naming dos estados FSM** diverge entre epics.md e architecture.md.
  - **epics.md story AC** (linha 736): 6 estados lowercase snake_case — `idle`, `running`, `paused_for_interrupt`, `paused_awaiting_review`, `paused_window_exhausted`, `failed`.
  - **architecture.md AO-2** (linha 132): 9 estados UPPERCASE — `RUNNING`, `PAUSED_P1`, `PAUSED_S1`, `PAUSED_S2`, `PAUSED_S3`, `RESPONDING`, `RESUMED`, `DONE`, `FAILED`.
  - **Default desta story:** seguir **epics.md** (6 lowercase) porque a AC é literal e canónica para a story; consolidação posterior pode unir os 4 PAUSED_X em `paused_for_interrupt` (pure design refinement).
  - **Trade-off:** se architecture canon mudar para 9 estados, esta story precisa retrabalho. Recomendação: confirmar 6 lowercase como canónico definitivo (re-edit arch silenciosamente em commit `docs:` posterior).

- **Q-A4-2:** Política de matching para `parseInterruptCommand`. Match exacto literal? Ou trim + lowercase tolerantes?
  - **Default:** match exacto literal (string `===`). Whitespace/casing wrong → `UnknownCommand`. Justificação: payloads vêm de buttons Meta que são strings fixas; tolerância só introduz ambiguidade.

- **Q-A4-3:** `DomainEvent.GateName` e `ParsedIntent` são stubs nesta story?
  - **Default:** stubs conservadores. `GateName = 'StoryToDev' | 'DevToReview' | 'ReviewToQA'` (3 gates mencionadas). `ParsedIntent` MVP com 2 kinds. Refinar quando NLP fallback + parser real chegarem (Stories 1.a.10, 3.4, 3.5).

- **Q-A4-4:** `DomainEvent` é exportado como tagged union mas **não tem builders** (factory functions tipo `mkRunStarted(...)`) nesta story.
  - **Default:** sem builders. Construção via object literal: `{ kind: 'RunStarted', runId, at: clock.now() }`. Stories futuras podem adicionar builders se padrão repetitivo emergir.

### Anti-pattern guardrails (DEV: NÃO fazer)

- ❌ NÃO importar nada de `src/adapters/` (Dep Graph Rigour). Apenas `../lib/...` e `../ports/...` (tipos).
- ❌ NÃO usar `setTimeout`/`setInterval` (AO-103 ESLint bloqueia em `src/core/`). FSM é síncrona; eventos vêm de fora.
- ❌ NÃO `throw new Error(...)` — não está na whitelist AO-66. Usar `Result`.
- ❌ NÃO importar `neverthrow` directo — usar `../lib/result.ts`.
- ❌ NÃO adicionar persistência (DB write) ao `transition()` — é Story 1.a.5. FSM aqui é pure function `(state, event) → Result<state, error>`.
- ❌ NÃO implementar queue de eventos durante PAUSED — diferido para Story 4.x.
- ❌ NÃO adicionar logging directo (pino) — caller injecta logger se quiser. Domain é silent.
- ❌ NÃO assumir `at: Date` é `clock.now()` real — caller injecta (vai ser do ClockPort no shell).
- ❌ NÃO criar mais de 200 linhas num único ficheiro.

### References

- [Source: epics.md#story-1a4] — StorySpec linhas 725-743.
- [Source: epics.md#AR-035] — linha 230 (FSM enum + transition table).
- [Source: epics.md#AR-036] — linha 231 (Domain events tagged union).
- [Source: epics.md#AR-037] — linha 232 (Boot/shutdown order; Story 1.a.7).
- [Source: architecture.md#AO-2] — linha 132 (FSM explícita; **conflito Q-A4-1**).
- [Source: architecture.md#AO-40] — linha 202 (FSM persisted single-row; Story 1.a.5).
- [Source: architecture.md#AO-68] — linha 838 (FSM enum + transition table validada).
- [Source: architecture.md#AO-92] — linha 862 (Mutation testing Stryker; deferred 1.c.4).
- [Source: architecture.md#AO-95] — linha 865 (Functional core / imperative shell).
- [Source: architecture.md#D-04.17] — linha 499 (FSM como enum + transition table em domain).
- [Source: architecture.md#D-04.19] — linhas 661-672 (DomainEvent tagged union canónica).
- [Source: architecture.md] linha 2342 — Quick Reply payloads chegam como text (input format para parser).
- [Source: 1-a-3-3-ports-temporais-clock-spawn-notify.md] — Dep Graph Rigour test + AO-103 ESLint rule herdados.
- [Source: 1-a-2-result-t-e-branded-types-lib-helpers.md] — Result + branded + assertion helpers.
- [Source: docs/conventions/errors.md] — 11-item throw whitelist (sem novos throws nesta story).
- [Memory: project-hdd-stack-v2-bun] — Bun-first stack.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` — Amelia, sessão directa.

### Debug Log References

- Biome `--fix` removeu silenciosamente o cast `as FsmEvent` no property test (porque inferência funciona sem ele). Consequência: `import type { FsmEvent }` ficou unused → ESLint catch. Removi a import manualmente.
- Bun coverage **NÃO conta `src/core/events.ts`** porque é puro types (`export type DomainEvent = ...`) sem código executável. Esperado e correcto.
- AO-103 anti-regression confirmou: `setTimeout` em `src/core/` faz ESLint sair 1 com mensagem `"Use ClockPort.setTimeout (AO-103)"`. Rule activa há 1 commit (1.a.3); 1.a.4 é a primeira story onde tem código real para guardar.
- Dep Graph Rigour anti-regression confirmou: import de `src/core/ → src/adapters/` faz `tests/ports/contracts.test.ts#AC-1` falhar com `"Dep Graph Rigour violation: src/core/__sanity_adapter_import.ts:1 → ../adapters/clock/system-clock.adapter.ts"`.

### Completion Notes List

**Validação E2E — 2026-05-28**

| Verificação | Resultado | AC |
|-------------|-----------|----|
| `bun run type-check` | exit 0 | AC-4 indirecto |
| `bun run lint` | exit 0 (18 files; AO-103 + AO-66 + 5 async-safety activas; sem novos throws) | — |
| `bun test` | 74 pass / 0 fail / 123 expect() / 115ms total wall-clock | AC-1, AC-2, AC-3, AC-4, AC-5 |
| **Coverage src/core/fsm.ts** | 100% funcs / 100% lines (Bun não expõe branches — proxy) | AO-91 (proxy) |
| **Coverage src/core/domain/interrupt-commands.ts** | 100% funcs / 100% lines | AO-91 (proxy) |
| **Coverage src/core/events.ts** | N/A (puro types, sem código executável — esperado) | — |
| AO-103 anti-regression: setTimeout em src/core/ falha lint | exit 1 com mensagem | implícita ✓ |
| Dep Graph anti-regression: src/core/ importa adapters | test fail com mensagem clara | implícita ✓ |
| AC-3 property: 200 runs, todas pass | confirmado | AC-3 ✓ |

**Decisões aplicadas (Q-A4-1..Q-A4-4):**

- Q-A4-1: 6 estados lowercase snake_case (epics.md AC literal). Architecture.md AO-2 precisa edit silencioso posterior para reconciliar (acumula com O-A1/O-A2-3/O-A3-4 em commit `docs:` futuro).
- Q-A4-2: match exacto literal — `parseInterruptCommand(" p1_continuar_assim ").isErr()` confirmado em spec.
- Q-A4-3: `GateName` stub 3 valores (`StoryToDev`, `DevToReview`, `ReviewToQA`); `ParsedIntent` MVP 2 kinds (`Unknown`, `Interrupt`).
- Q-A4-4: sem builders. Caller constrói via object literal.

**Open items emergentes:**

- O-A4-1 (acumula O-A1/O-A2-3/O-A3-4): epics.md vs architecture.md mismatch nos states FSM. Story spec 6 lowercase agora canónico; architecture precisa edit AO-2.
- O-A4-2: `src/core/events.ts` não tem testes próprios (puro types). Quando 1.a.6 (audit) construir o adapter que consome `DomainEvent`, escrever testes de schema lá.
- O-A4-3: `assertNever` (de 1.a.2 branded.ts) **não foi usado** nesta story porque a transition lookup via `Record<state, Partial<Record<event, state>>>` faz exhaustiveness compile-time-friendly sem switch. Aceitável; `assertNever` continua disponível para futuros usos.
- O-A4-4: `tests/core/fsm.test.ts` tem 164 linhas — abaixo de 200, mas perto. Se 1.a.5+ adicionar mais transições, considerar split em files dedicados (e.g. `tests/core/fsm-transitions.test.ts`, `tests/core/fsm-totality.test.ts`).
- O-A4-5: Stryker mutation testing (AO-92) ainda deferred para 1.c.4. FSM transition table é o teste perfeito para mutation (mudar 1 entrada na tabela = test deve falhar).

### File List

**Ficheiros criados (committable):**

- `src/core/fsm.ts` (112 linhas) — FSM com 6 states + 11 event kinds + transition table + `transition()` pure function. JSDoc com tabela markdown das transições válidas.
- `src/core/domain/interrupt-commands.ts` (46 linhas) — 5-kind tagged union + `PAYLOAD_MAP` canónico + `parseInterruptCommand()` pure parser.
- `src/core/events.ts` (62 linhas) — `DomainEvent` tagged union (6 kinds) + `GateName` stub + `ParsedIntent` stub MVP.
- `tests/core/fsm.test.ts` (164 linhas) — 18 specs: 10 transições válidas (AC-1), 5 inválidas (AC-2), 1 property test (AC-3, 200 runs), 3 sanity da tabela.
- `tests/core/interrupt-commands.test.ts` (78 linhas) — 11 specs: 5 payloads conhecidos (AC-4), 4 unknown/edge (AC-5), 2 sanity do PAYLOAD_MAP.
- `_bmad-output/implementation-artifacts/1-a-4-domain-fsm-interrupt-commands-tagged-union.md` — esta story file.
- `_bmad-output/implementation-artifacts/story-1a4-summary.md` — Tier-B antecipado.

**Modificados:**

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-a-4: backlog → review`.

**Removidos:**

- `src/core/.gitkeep` — substituído por `fsm.ts` + `events.ts` + `domain/`.

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-28 | bmad-create-story (Amelia) | Story file criada. Status `backlog → ready-for-dev`. Conflito Q-A4-1 detectado entre epics.md e architecture.md sobre naming dos FSM states. |
| 2026-05-28 | operador | Resolveu Q-A4-1..4 (6 lowercase / exacto / stubs / só tipos). |
| 2026-05-28 | bmad-dev-story (Amelia) | Implementação: 8 tasks done; 5 ACs + 2 implícitas verificadas; src/core/ 100% line+func coverage; status `ready-for-dev → in-progress → review`. |

---

## Open Questions for Operator — RESOLVIDAS 2026-05-28

- **Q-A4-1 [RESOLVED — 6 lowercase]:** FSM com 6 estados lowercase snake_case (epics.md AC literal). Open follow-up: architecture.md AO-2 precisa edit silencioso posterior para consolidar 4 PAUSED_P1/S1/S2/S3 num `paused_for_interrupt` + remover `RESPONDING`/`RESUMED`/`DONE` ou re-mapeá-los. Acumula com O-A1/O-A2-3/O-A3-4.
- **Q-A4-2 [RESOLVED — exacto]:** `parseInterruptCommand` faz match exacto literal (`string ===`). Whitespace/casing errado → `UnknownCommand`. Parser inbound (Story 3.4) garante cleanup upstream.
- **Q-A4-3 [RESOLVED — stubs]:** `GateName` stub 3 valores, `ParsedIntent` stub MVP 2 kinds. Refina-se em 1.a.10 / 3.4 / 3.5.
- **Q-A4-4 [RESOLVED — só tipos]:** Sem builders nesta story. Caller constrói `{ kind: '...' }` via object literal.

→ Implementação destrava com defaults. Estimativa: 64K dev_core / 96K dev_with_retry.

---

**Story Status:** ready-for-dev · **Created by:** bmad-create-story (Amelia, 2026-05-28)
**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
