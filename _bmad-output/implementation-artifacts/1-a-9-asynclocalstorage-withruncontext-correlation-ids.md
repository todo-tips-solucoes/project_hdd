# Story 1.a.9: AsyncLocalStorage withRunContext + correlation IDs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **cross-cutting logger** e **audit adapter** (observabilidade transversal do HDD worker),
I want **um `withRunContext({runId, storyId?, traceId?}, fn)` baseado em AsyncLocalStorage que propaga correlation IDs automaticamente a TODO log e audit event sem ter de passar como argumento explícito**,
so that **observability tem correlation IDs end-to-end sem poluir signatures de funções nem repetir `runId` em cada call site**.

> **Big picture (foundational → observability):** as Stories 1.a.7 e 1.a.8 introduziram um `bootRunId` UUID hardcoded que é manualmente passado em cada `audit.append()`. Para o worker loop futuro (Story 2.1+), onde cada run executa N stories e cada story emite dezenas de eventos, propagar `runId` explicitamente em cada layer (worker → service → adapter) seria ruidoso e error-prone. Esta story estabelece o **mecanismo canónico** de propagação cross-async via `node:async_hooks.AsyncLocalStorage`, wrapped numa API simples: `withRunContext(ctx, fn)`.
>
> **Onde se encaixa no canon (D-04.4', AO-72, AR-039):** AsyncLocalStorage é o pattern Node.js standard para context propagation em async stacks. Funciona em Bun 1.3.14 (Bun implementa `node:async_hooks` API). Substitui patterns alternativos como threading explicit ou React-style context.
>
> **Scope minimal (per epics StorySpec):**
> - **NEW** `src/lib/run-context.ts` + `tests/lib/run-context.test.ts` (canon spec).
> - **MODIFY** `src/adapters/audit/jsonl-hash-chain.adapter.ts` para `auto-inject` (ler `getRunContext()` quando `event.runId` não passado).
> - **Spec NÃO requer mas é minimal-add para coerência:** modificar `src/ports/audit.port.ts` (tornar `AuditEntry.runId` opcional + novo AuditError kind `RunIdMissing`). Sem isto, o type system impede a AC `sem ter sido passados explicitamente`.
>
> **Scope-out (NÃO esta story):**
> - **`pino` logger child integration** — `pino` ainda não é dep instalada; integration entra na story dedicada (ou 1.c.6 runbooks). `withRunContext` é genérico — qualquer logger pode chamar `getRunContext()`.
> - **Wiring de bootstrap.ts/review.command.ts** para usar `withRunContext` — Q-A9-3 default Defer. Demonstration end-to-end fica para story própria (ou opt-in).
> - **OpenTelemetry trace context propagation** — `traceId` no `RunContext` é apenas placeholder field. Integration real defer post-v1.

## Acceptance Criteria

> ACs extracted verbatim de `_bmad-output/planning-artifacts/epics.md#Story-1.a.9`. 2 ACs binary.

**AC-1 (correlation propagation — binary):**

**Given** caller invoca `withRunContext({ runId: "r1", storyId: "s1" }, () => audit.append({ ts, type, payload }))` **sem passar `runId`/`storyId` em `AuditEntry`**
**When** o event chega ao JSONL via `append()`
**Then** a linha escrita contém `run_id: "r1"` e `story_id: "s1"` lidos automaticamente do contexto (binary AC).

> **Detalhe:** o caller chama `audit.append({ ts, type, payload })` — sem runId/storyId. O adapter lê `getRunContext()` internamente e injecta. Se NEM contexto nem explicit forem fornecidos, `append()` retorna `err({ kind: "RunIdMissing" })`.

**AC-2 (concurrent isolation — property):**

**Given** 2 chamadas concorrentes em paralelo via `Promise.all([withRunContext({runId:"r1"}, ...), withRunContext({runId:"r2"}, ...)])`
**When** ambas chamadas escrevem ao mesmo JSONL no mesmo tick
**Then** cada linha JSONL preserva o seu próprio `run_id` correctamente — `r1` para a primeira call chain, `r2` para a segunda — **sem cruzar contexto** (property AC).

> **Por que é importante:** AsyncLocalStorage tem isolation semantics nativas via `node:async_hooks` (cada `run(ctx, fn)` cria um novo store frame). Verificamos com test que cria 2 contextos em `Promise.all` + interleaves audit.append calls + valida a JSONL output.

## Tasks / Subtasks

> 6 tasks. Estimated tokens: 40K core / 56K with retry (per epics StorySpec). Instrumentação `bun run lint && bun run type-check && bun test` entre tasks.

- [x] **Task 1 — Criar `src/lib/run-context.ts`** (foundational, AC-1 + AC-2)
  - [x] 1.1 Import `AsyncLocalStorage` de `node:async_hooks` (suportado em Bun 1.3.14 — confirmado pela presença em Bun stdlib).
  - [x] 1.2 Definir tipo `RunContext`:
    ```ts
    export type RunContext = {
      readonly runId: string;
      readonly storyId?: string;
      readonly traceId?: string;
    };
    ```
  - [x] 1.3 Singleton module-level `const storage = new AsyncLocalStorage<RunContext>()`.
  - [x] 1.4 Função `withRunContext<T>(ctx: RunContext, fn: () => T): T` — chama `storage.run(ctx, fn)` e devolve o valor de `fn` (sync; works for sync fn). Para async fn, devolve `Promise<T>` automaticamente (async stack tracking nativo do AsyncLocalStorage).
  - [x] 1.5 Função `getRunContext(): RunContext | undefined` — retorna `storage.getStore()`. Undefined quando fora de um `withRunContext` frame.
  - [x] 1.6 Helper `requireRunContext(): RunContext` — throws com `// allow-throw: AO-66 #1 programmer error` se chamado fora de contexto. Útil em adapters que sabem que SEMPRE devem ter contexto.
  - [x] 1.7 Run `bun run lint && bun run type-check`.

- [x] **Task 2 — Modificar `src/ports/audit.port.ts`** (foundational — sem isto AC-1 impossível type-system-wise)
  - [x] 2.1 Mudar `AuditEntry.runId: string` → `AuditEntry.runId?: string` (opcional).
  - [x] 2.2 Adicionar `AuditError` kind `RunIdMissing`:
    ```ts
    | { readonly kind: "RunIdMissing" }
    ```
  - [x] 2.3 Documentar no JSDoc da interface: "quando `runId` não passado, o adapter lê de `getRunContext()`. Se nem explicit nem contexto, devolve `RunIdMissing`."
  - [x] 2.4 Run `bun run lint && bun run type-check` (existing callers ainda passam explicit runId → backward compat 100%).

- [x] **Task 3 — Modificar `src/adapters/audit/jsonl-hash-chain.adapter.ts`** (AC-1)
  - [x] 3.1 Import `getRunContext` de `../../lib/run-context.ts`.
  - [x] 3.2 No início de `append()`, resolver runId/storyId:
    ```ts
    const ctx = getRunContext();
    const runId = event.runId ?? ctx?.runId;
    if (runId === undefined) return err({ kind: "RunIdMissing" });
    const storyId = event.storyId ?? ctx?.storyId;
    ```
  - [x] 3.3 Substituir `event.runId` por `runId` (var local) no rendering da JSONL line + computeHash inputs.
  - [x] 3.4 Substituir `event.storyId ?? null` por `storyId ?? null` no JSON.
  - [x] 3.5 Garantir biome 200-line cap mantido (adapter actual ~200 linhas; cuidado com cresc).
  - [x] 3.6 Run `bun run lint && bun run type-check && bun test tests/adapters/audit.test.ts` — specs existentes da 1.a.6 (que passam explicit runId) devem continuar verdes.

- [x] **Task 4 — Specs `tests/lib/run-context.test.ts`** (AC-1 + AC-2)
  - [x] 4.1 **AC-1 spec — propagation:**
    - Setup tmpdir audit adapter + `:memory:` SQLite + clock.
    - Dentro de `withRunContext({runId: "r1", storyId: "s1"}, () => audit.append({ts, type: "Test", payload: {}}))` — **NÃO** passa runId/storyId.
    - Ler JSONL → assert `run_id: "r1"` + `story_id: "s1"`.
  - [x] 4.2 **AC-1 spec — RunIdMissing error:**
    - Chamar `audit.append({ts, type: "Test", payload: {}})` **fora** de qualquer `withRunContext` → retorna `err({kind: "RunIdMissing"})`.
  - [x] 4.3 **AC-1 spec — explicit wins:**
    - Dentro de `withRunContext({runId: "r1"}, ...)`, chamar `audit.append({runId: "r-explicit", ts, type, payload})` → JSONL contém `r-explicit` (explicit overrides context).
  - [x] 4.4 **AC-2 spec — concurrent isolation:**
    - 2 contextos em `Promise.all`:
      ```ts
      await Promise.all([
        withRunContext({runId: "r1"}, async () => {
          await Promise.resolve(); // force async stack split
          return audit.append({ts: t1, type: "Test", payload: {n: 1}});
        }),
        withRunContext({runId: "r2"}, async () => {
          await Promise.resolve();
          return audit.append({ts: t2, type: "Test", payload: {n: 2}});
        }),
      ]);
      ```
    - Ler JSONL → 2 linhas; uma com `run_id: "r1"`, outra com `run_id: "r2"`. **NÃO** cruzam.
  - [x] 4.5 **AC-2 spec — nested context:**
    - `withRunContext({runId: "outer"}, () => withRunContext({runId: "inner"}, () => audit.append(...)))` → JSONL tem `inner`. Inner stack frame overrides outer.
  - [x] 4.6 **Helper test — getRunContext fora de wrap:**
    - `expect(getRunContext()).toBeUndefined()` quando chamado top-level.
  - [x] 4.7 **Helper test — requireRunContext fora de wrap:**
    - `expect(() => requireRunContext()).toThrow()` quando chamado top-level.
  - [x] 4.8 Run `bun test tests/lib/run-context.test.ts`.

- [x] **Task 5 — Verificar regressão zero das 14 specs prévias** (defensivo)
  - [x] 5.1 Run `bun test` (full suite). Asserção: ainda 130 pass / 0 fail, plus N novos da Task 4 (alvo +7-8 novos).
  - [x] 5.2 Especialmente `tests/adapters/audit.test.ts` (1.a.6) e `tests/bootstrap.test.ts` (1.a.7) que dependem de audit shape — verificar que continuam passar com `event.runId` explicit.

- [x] **Task 6 — Tier-B summary via summaryGenerator (1ª vez dogfood!) + sprint-status review**
  - [x] 6.1 **Meta-dogfood breakthrough**: usar `summaryGenerator.finalize()` da Story 1.a.8 para escrever `story-1a9-summary.md` — primeira story a usar o próprio generator. Construir `SummaryInput` mínimo + chamar `finalize`. Verificar auto-commit (operará no working tree real).
  - [x] 6.2 Se generator falhar em algum detalhe (template gap, formatter bug), documentar como reviewer finding + fallback para escrita manual sem bloquear. Reportar nas Open items para 1.a.10+.
  - [x] 6.3 Sprint-status: `1-a-9: in-progress → review`. Após `approve story-1a9`: `review → done`.

## Dev Notes

### AO matrix (compliance map)

| AO / Decisão | Story relevance | Aplicado em |
|---|---|---|
| **D-04.4'** AsyncLocalStorage wrapped em `withRunContext()` | Canon directo (motivação primária) | `src/lib/run-context.ts` |
| **AO-72** `withRunContext(runId, fn)` wrapper | Direct | API + audit adapter integration |
| **AR-039** correlation IDs cross-async | Direct | RunContext shape (runId/storyId/traceId) |
| **AO-117** parallel_safe stories | Tangential | AC-2 concurrent isolation prova que stories paralelas não cruzam contexto |
| **AR-061** audit JSONL com `prev_hash` + correlation IDs | Direct | Adapter injecta context no append |
| **AO-66** Throw whitelist | Canon | `requireRunContext()` throws — categoria #1 (programmer error) |
| **AO-122** 200-line cap | Hard | run-context.ts curto (~50); adapter modify dentro do cap |
| **AO-148** Auto-archive 30d | Tangencial | Sem impacto directo |
| **`process.env.NODE_ENV`** | N/A | Sem env dependency nova |

### Esboços canónicos

**`src/lib/run-context.ts` (target ~60-80 linhas):**

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export type RunContext = {
  readonly runId: string;
  readonly storyId?: string;
  readonly traceId?: string;
};

const storage = new AsyncLocalStorage<RunContext>();

export function withRunContext<T>(ctx: RunContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRunContext(): RunContext | undefined {
  return storage.getStore();
}

export function requireRunContext(): RunContext {
  const ctx = storage.getStore();
  if (ctx === undefined) {
    // allow-throw: AO-66 #1 — programmer error (caller misuse).
    // eslint-disable-next-line no-restricted-syntax -- AO-66 #1
    throw new Error("requireRunContext called outside withRunContext");
  }
  return ctx;
}
```

**`src/ports/audit.port.ts` (delta):**

```diff
 export type AuditEntry = {
   readonly ts: string;
-  readonly runId: string;
+  /**
+   * Optional desde Story 1.a.9. Quando não passado, o adapter lê
+   * `getRunContext()` (AsyncLocalStorage). Se nem explicit nem contexto,
+   * `append()` retorna `err({kind: "RunIdMissing"})`.
+   */
+  readonly runId?: string;
   readonly storyId?: string;
   ...
 };

 export type AuditError =
   | { readonly kind: "WriteFailure"; ... }
+  | { readonly kind: "RunIdMissing" }
   | { readonly kind: "ChainBreak"; ... }
   ...;
```

**`src/adapters/audit/jsonl-hash-chain.adapter.ts` (delta — apenas o trecho relevante do `append()`):**

```diff
+import { getRunContext } from "../../lib/run-context.ts";

 // dentro de append(event):
+const ctx = getRunContext();
+const runId = event.runId ?? ctx?.runId;
+if (runId === undefined) return err({ kind: "RunIdMissing" });
+const storyId = event.storyId ?? ctx?.storyId;

 ...

 const line = JSON.stringify({
   ts: event.ts,
   seq,
-  run_id: event.runId,
-  story_id: event.storyId ?? null,
+  run_id: runId,
+  story_id: storyId ?? null,
   type: event.type,
   payload: event.payload,
   prev_hash: prevHash,
-  this_hash: computeHash(prevHash, event.ts, seq, event.type, event.payload),
+  this_hash: computeHash(prevHash, event.ts, seq, event.type, event.payload),
 });
```

> **Hash chain consistency:** `computeHash` continua a usar `event.ts/seq/type/payload` — runId NÃO entra na fórmula da hash chain (per docs/audit-format.md Story 1.a.6). Portanto introduzir context injection NÃO altera o hash de eventos prévios. Chain integrity preservada.

### Previous story intelligence (1.a.6 + 1.a.7 + 1.a.8 — directly impacted)

**Da 1.a.6 (audit JSONL):**
- `audit.append({ts, runId, storyId?, type, payload})` é a interface actual. Tornar `runId` opcional é breaking change DE TYPE mas compatible em RUNTIME (existing callers ainda passam).
- Hash chain formula NÃO inclui runId (apenas ts/seq/type/canonical(payload)). Logo runId injection não quebra chain integrity.
- Test pattern 1.a.6 usa explicit runId em todos os specs. Vão continuar a passar (explicit wins).

**Da 1.a.7 (bootstrap):**
- `bootRunId = randomUUID()` gerado em `bootstrap()` e passado para `audit.append({runId: bootRunId, type: "ProcessStarted", ...})`.
- Os specs 1.a.7 `bootstrap.test.ts` verificam o JSONL output contém `runId: <uuid>` (e o test injecta `bootRunId: "test-boot-run-id"`). Continuam verdes.
- **Q-A9-3 (Defer)** — esta story NÃO modifica `bootstrap.ts` ou `shutdown.ts` por scope. Story própria (ou 2.x) wires bootstrap em withRunContext quando worker loop existir.

**Da 1.a.8 (review CLI + summary generator):**
- `review.command.ts` chama `audit.append({runId: workflowId, ...})` — continua a funcionar.
- Tests de review usam mock audit que regista `event.runId`. Continuam verdes (explicit runId é passed).
- `summaryGenerator.finalize()` NÃO usa audit. Sem impacto.
- **Task 6 dogfood:** vamos usar `finalize()` para gerar `story-1a9-summary.md` pela primeira vez. Se algo falhar, fallback manual + documenta.

**Convenções emergidas das 9 stories anteriores:**
- Result/branded/Bun.spawnSync canon mantido.
- ESLint flat config 7 regras (AO-66 throw whitelist activa — usar comment para requireRunContext throw).
- Biome 200-line cap HARD.
- `:memory:` SQLite + `mkdtempSync` para tests isolation.
- Factory functions, não classes.
- `process.exit` mock pattern (não aplicável aqui — sem CLI nesta story).

### Anti-pattern guardrails (NÃO fazer)

1. **NÃO usar `globalThis` ou Node `process` para context** — AsyncLocalStorage é o pattern canónico. Globals quebram em concurrency.
2. **NÃO criar dependency cycle** — `src/adapters/audit/` importa de `src/lib/run-context.ts` (✓ shell→lib é permitido). Mas `run-context.ts` NÃO pode importar de adapters (porta pura, depend-on-nothing).
3. **NÃO fazer `runId` required no audit port** — quebra AC-1 que diz "sem ter sido passados explicitamente".
4. **NÃO incluir `runId` na hash chain formula** — manter compat com `docs/audit-format.md` e specs 1.a.6 (verifyChain re-computa hashes; introduzir runId quebraria todas as chains existentes).
5. **NÃO modificar bootstrap.ts / review.command.ts nesta story** — fica scope-out (Q-A9-3 Defer). Demonstration end-to-end via tests/lib/run-context.test.ts é suficiente para ACs.
6. **NÃO instalar `pino` dep** — scope-out (Q-A9-4 Defer). Story dedicada para logger integration.
7. **NÃO chamar `requireRunContext()` em adapters de produção sem fallback** — se chamarem, MUST estar dentro de `withRunContext`. Em test, é OK porque controlamos call site.
8. **NÃO assumir Bun support AsyncLocalStorage** — confirma com smoke test inicial: `import { AsyncLocalStorage } from "node:async_hooks"; const s = new AsyncLocalStorage(); s.run({a:1}, () => console.log(s.getStore()));`.
9. **NÃO esquecer `await` em async callbacks** — AsyncLocalStorage tracking funciona via `await` propagation. `setTimeout(() => audit.append(...), 0)` SAI do context window (timer callback é um novo stack frame fora do `run()` zone). Para context-sensitive timer callbacks, usar `clock.setTimeout` injectado com explicit context capture.
10. **NÃO esquecer Result vs throw** — `withRunContext` propaga errors throws naturalmente (não captura). Se `fn` throws, context é removido + throw propaga. Logical: contexto é só para o tempo de vida da call.

### Testing strategy

- **`tests/lib/run-context.test.ts`** (canon spec) — 6-8 specs cobrindo:
  - AC-1: propagation com tmpdir audit real.
  - AC-1: RunIdMissing quando sem contexto + sem explicit.
  - AC-1: explicit overrides context.
  - AC-2: 2 contextos concurrent via `Promise.all` + `await Promise.resolve()` para forçar async stack split.
  - AC-2: nested context (inner overrides outer).
  - Helper tests: `getRunContext` undefined fora; `requireRunContext` throws fora.
- **Audit adapter regression**: re-run `tests/adapters/audit.test.ts` (1.a.6) sem mods — specs explicit-runId continuam verdes.
- Coverage target: ≥85% line em `run-context.ts` (trivial — 4 funções, todas testadas).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.a.9] — StorySpec + ACs canónicos.
- [Source: _bmad-output/planning-artifacts/architecture.md#D-04.4'] — AsyncLocalStorage wrapped em `withRunContext()`.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-72] — `withRunContext(runId, fn)` wrapper formal.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-117] — parallel_safe stories (motivação concurrent isolation AC).
- [Source: src/ports/audit.port.ts] — interface a modificar (runId optional + new error).
- [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts] — adapter a modificar (context injection).
- [Source: _bmad-output/implementation-artifacts/story-1a6-summary.md] — audit chain semantics + hash formula constraint.
- [Source: _bmad-output/implementation-artifacts/story-1a7-summary.md] — bootRunId pattern actual + 14 specs que devem continuar verdes.
- [Source: _bmad-output/implementation-artifacts/story-1a8-summary.md] — `summaryGenerator.finalize()` para Task 6 dogfood.

### Project Structure Notes

**Created (2):**
- `src/lib/run-context.ts` (~60-80 linhas)
- `tests/lib/run-context.test.ts` (~140-180 linhas, 6-8 specs)
- `_bmad-output/implementation-artifacts/story-1a9-summary.md` (1ª vez gerada via generator — dogfood)

**Modified (2):**
- `src/ports/audit.port.ts` (+5 linhas: runId opcional + AuditError RunIdMissing kind + JSDoc nota)
- `src/adapters/audit/jsonl-hash-chain.adapter.ts` (+5 linhas: import getRunContext, context resolution no append)

**Sprint tracking:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-a-9 lifecycle)

Sem dependências novas. Sem deviation vs architecture.

## Open Questions for Operator

> **Resolução em 2026-05-28** — todas em default Recommended via `AskUserQuestion` (4 questions).

- **Q-A9-1 [RESOLVED — Yes (opcional + RunIdMissing)]** — modifica `src/ports/audit.port.ts`: `runId` opcional + AuditError variant `RunIdMissing`. Backward compat 100% em runtime.
- **Q-A9-2 [RESOLVED — {runId, storyId?, traceId?}]** — RunContext inclui `traceId?: string` como placeholder OpenTelemetry futuro. Zero cost agora.
- **Q-A9-3 [RESOLVED — Defer]** — NÃO toca em `bootstrap.ts` nem `review.command.ts`. ACs validados via `tests/lib/run-context.test.ts` apenas. Wiring end-to-end fica para 2.1+.
- **Q-A9-4 [RESOLVED — Defer]** — sem `pino` dep. `withRunContext` é genérico; consumer integrate quando logger entrar.

**Implicações para tasks (delta):**
- Task 2 confirmada (runId opcional + RunIdMissing).
- Task 1.2 → `RunContext = { runId; storyId?; traceId? }`.
- Sem Task adicional para bootstrap/review.command wiring.
- Sem Task adicional para pino dep.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context).

### Debug Log References

- AsyncLocalStorage smoke test em Bun 1.3.14: `bun -e 'import {AsyncLocalStorage} from "node:async_hooks"; ...'` → context propaga após `await`; outside é undefined ✓.
- AuditEntry.runId optional triggered 1 TS error em `tests/cli/review.test.ts` (AppendCall.runId era `string`); fix: `string | undefined`.
- 3 rounds de TS4111 (`noPropertyAccessFromIndexSignature`) em `run-context.test.ts` Record<string,unknown> access; resolvi com bracket access global.
- **Task 6 DOGFOOD live findings (vermelho fluorescente):**
  - **1st run FAILED**: TierBOverflow 955 words (cap 900). Input verbose; trim → 618 words; OK.
  - **2nd run OK**: auto-commit `21ca7116b3c85923de09559462d829ba7797ffe6` criado contendo o summary file. Workflow canónico D-019 = 2 commits por story (summary auto + feat após approve).
  - **REVIEWER FINDINGS via dogfood**:
    - **O-A9-5**: Tier-B usa MESMOS dados de Tier-C; generator não separa "briefing" de "full". Para passar word cap fui forçado a trim Tier-B excessivamente (perdi detalhe que deveria viver em Tier-C). Fix proposed: `SummaryInput` aceita `tierBBrief` e `tierCFull` campos separados OU templates diferentes consomem subset diferentes.
    - **O-A9-6**: Tier-A placeholder aparece DUPLICADO (uma vez do `TIER_A_PLACEHOLDER` prepend em finalize, outra vez do template body `> **Tier-A:**`). Visual noise.
    - **O-A9-7**: HTML comments dos templates (`<!-- ... -->`) leakam para o output renderizado. Visíveis em raw markdown (invisíveis no GitHub render). Decisão: aceitável v1; remove em refactor futuro se enfeitar.

### Completion Notes List

- **Scope honrado**: 2 ACs (AC-1 propagation + AC-2 isolation) verde via `tests/lib/run-context.test.ts` (12 specs). Q-A9-1..4 todas Recommended.
- **AC-1 cobrado**: 4 specs — context propagation; RunIdMissing fora; explicit overrides context; storyId optional render null.
- **AC-2 cobrado**: 3 specs — Promise.all isolation per-payload; nested inner-overrides-outer; outer retoma após inner termina.
- **Helper APIs**: 5 specs — getRunContext undefined/inside/after; requireRunContext throws/inside.
- **Backward compat**: 14 specs bootstrap (1.a.7) + 6 specs review CLI (1.a.8) + 9 specs audit (1.a.6) + 7 specs summary (1.a.8) — TODOS verdes pós-modificações. AuditEntry.runId optional não quebra existing callers que passam explicit.
- **Hash chain integrity preservada**: `computeHash` formula NÃO inclui runId; verifyChain continua a funcionar.
- **DOGFOOD validated**: 1ª vez `summaryGenerator.finalize()` foi usado em workflow real. Funciona end-to-end. Auto-commit gerou `21ca711`. 3 reviewer findings live (O-A9-5/6/7) para fix em stories futuras.
- **142 tests pass** (was 130 após 1.a.8; +12 novos). Lint exit 0 (19 infos pré-existentes). Type-check clean.
- **Linhas**: run-context.ts 55; audit.port.ts +8; jsonl-hash-chain.adapter.ts +7; tests/lib/run-context.test.ts 199; tests/cli/review.test.ts compat shim +5. Total novo ≈ 274 linhas. Todos dentro Biome cap.
- **Zero deps novas**.

### File List

**Created (3):**
- `src/lib/run-context.ts` (55 linhas — RunContext + 3 funções)
- `tests/lib/run-context.test.ts` (199 linhas, 12 specs)
- `scripts/generate-1a9-summary.ts` (~170 linhas — one-shot dogfood; reusável para 1.a.10+)
- `_bmad-output/implementation-artifacts/story-1a9-summary.md` (gerado pelo `finalize()` — auto-committed `21ca711`)

**Modified (3):**
- `src/ports/audit.port.ts` (+8 linhas: runId opcional + RunIdMissing variant + JSDoc nota)
- `src/adapters/audit/jsonl-hash-chain.adapter.ts` (+7 linhas: import getRunContext + 4 linhas resolve em append())
- `tests/cli/review.test.ts` (+5 linhas: AppendCall.runId 'string | undefined' compat shim)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-a-9 lifecycle)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-05-28 | 0.1 | Story file criado por `bmad-create-story` (Sprint 0 Day 4 continuação 1.a.8) | Amelia (Dev Agent) |
| 2026-05-28 | 0.2 | Q-A9-1..4 todas Recommended resolvidas | Amelia (Dev Agent) |
| 2026-05-28 | 0.3 | Implementação Tasks 1-6 + 142 tests pass + DOGFOOD generator OK; 3 reviewer findings live (O-A9-5/6/7) | Amelia (Dev Agent) |
| 2026-05-28 | 0.4 | Status → review; summary auto-committed `21ca711` (separado do feat commit final) | Amelia (Dev Agent) |
| 2026-05-28 | 1.0 | Approve operador → Status done; feat commit pendente | Amelia (Dev Agent) |
