# Story 1.a.10: LLMPort + AnthropicAdapter foundational (API SDK Sonnet+Haiku + Max 20x CLI fallback)

Status: done

## Story

As a **core service** (intent-classifier, gap-detector, dispatcher, narrative-summary, dev-agent, reviewer-agent, qa-agent — todos os consumers de LLM no HDD),
I want **`LLMPort` interface única + `AnthropicSDKAdapter` (Sonnet+Haiku via `@anthropic-ai/sdk` — caminho default de implementação per D-050) + `ClaudeCliAdapter` (Sonnet via `claude --print` Max 20x — planejamento + overflow/fallback per D-050) + `TestLLMAdapter` (fixture-based) com `SessionId` branded type**,
so that **E3 NLP classifier + E4 gap detector + E6.a dispatcher + E7.b narrative summary podem invocar LLM via porta única sem importar adapters; Plan B switch trivial (AO-55, AO-123); foundational para todas as stories LLM-aware downstream**.

> **Big picture (última story foundational de epic 1.a):** esta story fecha o foundational layer. As 9 stories anteriores construíram infraestrutura **interna** (Result/branded/ports/FSM/db/audit/env-Zod/withRunContext/Tier-B generator). Esta story adiciona a primeira **integração externa real** — Anthropic API + Claude CLI — e estabelece a porta única através da qual TODOS os consumers de LLM em Sprint 1+ vão chamar. **Sem ela, E3/E4/E6.a/E7.b ficam blocked.**
>
> **Routing canon (D-050 ratificado 2026-05-27):** roteamento **por FASE** (não por modelo):
> - **Planning + overflow/fallback (caminho Max 20x):** `ClaudeCliAdapter` invoca `claude --print --output-format json --model claude-sonnet-4-6 --resume <sessionId>? <prompt>`. R$0 marginal (OAuth Max 20x quota); session reuse via `--resume` corta cache cost ~75%.
> - **Implementation default (caminho API metered):** `AnthropicSDKAdapter` invoca `@anthropic-ai/sdk` directo. Sonnet 4.6 para impl autónoma + Haiku 4.5 para light (gap-detector, parser-nlp, narrative-summary AO-43). Cap $30/m (D-051) enforced por consumer; este adapter expõe apenas tokens.
> - **Mitiga D-032** (Max 20x ToS automation risk): se Anthropic enforça, fallback para API pay-per-token Sonnet (~$25-50/sprint).
>
> **Scope CRÍTICO (per epics StorySpec):**
> - **5 files_created:** `src/ports/llm.port.ts`, `src/adapters/llm/anthropic-sdk.adapter.ts`, `src/adapters/llm/claude-cli.adapter.ts`, `src/lib/llm-session-id.ts`, `tests/adapters/llm-foundational.test.ts`.
> - **1 file_modified:** `src/lib/branded.ts` (adicionar `SessionId` branded type).
> - **1 dep nova:** `@anthropic-ai/sdk` (canon Tech Stack AO-55 + AO-42).
>
> **Scope-out (NÃO esta story):**
> - **Token ledger persistence (AO-114):** `LLMResult.tokens` é exposto; persistência em DB table `token_ledger` entra em Story 6.a.1 (`token-ledger.queries.ts`). Esta story devolve os dados; consumer decide o que persistir.
> - **Plan B activation autónoma (AO-123):** detector "3 Anthropic 5xx/timeout → switch para CLI" + WhatsApp notify. Wiring em Story dedicada (provável 6.b.1 ou nova). Esta story expõe os 2 adapters; bootstrap escolhe um; swap dinâmico defer.
> - **`cache_control: ephemeral` automation (AO-42):** `LLMRequest.cacheControl?: boolean` exposto; default `false`. Caller decide per role. AO-42 auto-tuning entra em story própria.
> - **Session map persistence em DB:** session_id é capturado pelo `ClaudeCliAdapter` e devolvido em `LLMResult.sessionId`. Caller persistência (sprint_id → session_id) em Story 6.a+ ou wiring local. Adapter mantém in-memory para o lifetime do processo se quiser.
> - **`gap-detector.service.ts` / `intent-parser.service.ts` / etc.** — são consumers desta porta, NÃO esta story. Entram em Epic 3+ (E3 NLP, E4 gap detector).

## Acceptance Criteria

> 5 ACs binary extracted verbatim de `_bmad-output/planning-artifacts/epics.md#Story-1.a.10`.

**AC-1 (Dep Graph Rigour — binary):**

**Given** `LLMPort` interface define `invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError>`
**When** importo `import type { LLMPort } from "src/ports/llm.port.ts"` num core service (e.g. `src/core/...`) ou test consumer
**Then** o serviço **NÃO** importa qualquer ficheiro de `src/adapters/` (Dep Graph Rigour test confirma via análise estática).

**AC-2 (AnthropicSDKAdapter happy + 401 — binary):**

**Given** `AnthropicSDKAdapter` criado com `ANTHROPIC_API_KEY` válido (real ou mock client injectado)
**When** chamo `adapter.invoke({role: "classifier", model: "claude-haiku-4-5", prompt: "test"})` E `adapter.invoke({role: "dev", model: "claude-sonnet-4-6", prompt: "test"})` (D-050: SDK serve Haiku light **E** Sonnet impl)
**Then** ambos retornam `ok({content, tokens: {input, output, cacheReadInputTokens?}, model, sessionId?})` (binary).
**And** quando o client retorna 401, adapter retorna `err({kind: "Unauthorized"})` (binary).

> **Test strategy:** SDK client é injectable via `createAnthropicSDKAdapter({apiKey, client?})`. Tests injectam mock client que retorna fixture (sem network call). Smoke real fica para 1.c.7 follow-up (já fizeste smoke claude headless lá).

**AC-3 (ClaudeCliAdapter session reuse — property):**

**Given** `ClaudeCliAdapter` invoca `claude --print --output-format json --model claude-sonnet-4-6 [--resume <sessionId>] <prompt>` via `Bun.spawn` (injectable)
**When** session reuse cenário — primeira call sem sessionId, segunda call passa `sessionId` retornado da primeira
**Then** segunda invocação tem `Bun.spawn` args contendo `["--resume", "<sessionId>"]` (binary spawn args check) **E** `LLMResult.tokens.cacheReadInputTokens > 0` quando o mock spawn simula resposta com `cache_read_input_tokens` no JSON (property — 75% economy target per D-044).

> **Test strategy:** spawn injectable retorna JSON fixture. Test 1: sem sessionId → args NÃO contém `--resume`. Test 2: com sessionId → args CONTÉM `--resume sid-abc`. Test 3: fixture com `cache_read_input_tokens: 100` → result.tokens.cacheReadInputTokens === 100.

**AC-4 (TestLLMAdapter — binary):**

**Given** `createTestLLMAdapter(fixtures)` retorna `LLMPort`
**When** core service consume `LLMPort` em test mode e chama `invoke(req)`
**Then** retorna fixture pre-defined sem network call (binary).
**And** quando fixture não existe para a key, retorna `err({kind: "ParseError"})` ou similar (binary).

**AC-5 (SessionId branded — binary, type-check):**

**Given** `SessionId = string & { readonly _brand: "SessionId" }` definido em `src/lib/branded.ts`
**When** atribuo `const s: SessionId = "raw-string"` sem `as SessionId` nem `mkSessionId()`
**Then** TypeScript compile erro (validado via `// @ts-expect-error` directive em test type-only spec).

## Tasks / Subtasks

> 9 tasks. Estimated tokens: 56K core / 80K with retry. Instrumentação `lint + type-check + test` entre cada.

- [x] **Task 1 — Add `@anthropic-ai/sdk` dependency** (foundational; AC-2)
  - [x] 1.1 `bun add @anthropic-ai/sdk` (latest stable); regista versão exacta.
  - [x] 1.2 Confirma `bun.lock` text format.
  - [x] 1.3 `bun run type-check` passa.

- [x] **Task 2 — Add `SessionId` branded type em `src/lib/branded.ts`** (AC-5)
  - [x] 2.1 Adicionar type:
    ```ts
    export type SessionId = string & { readonly _brand: "SessionId" };
    ```
  - [x] 2.2 Adicionar factory `mkSessionId(s: string): Result<SessionId, BrandError>` com validação UUID v4 (ou claude-session-format detect).
  - [x] 2.3 Run lint + type-check; specs branded existentes da 1.a.2 devem continuar verdes (≥85% coverage line).

- [x] **Task 3 — Criar `src/lib/llm-session-id.ts`** (helpers session_id parsing)
  - [x] 3.1 Helper `extractSessionIdFromCliJson(parsed: unknown): Result<SessionId, ParseError>` — espera `parsed.session_id` string; valida via `mkSessionId`.
  - [x] 3.2 Tipo `LLMSessionParseError = { kind: "ParseError"; cause: unknown }` (ou re-export de port errors).
  - [x] 3.3 NOT incluir persistence map nesta story (defer). Helper é puro parsing.

- [x] **Task 4 — Criar `src/ports/llm.port.ts`** (AC-1; core do design)
  - [x] 4.1 Definir tipos:
    ```ts
    export type LLMRole =
      | "classifier"      // E3 NLP intent parsing (Haiku)
      | "gap-detector"    // E4 gap detection (Haiku, AO-43)
      | "dev"             // dev-agent (Sonnet)
      | "reviewer"        // reviewer-agent (Sonnet)
      | "qa"              // qa-agent (Sonnet)
      | "narrative-summary" // F8 Tier-A 5 bullets (Haiku, AO-146)
      | "dispatcher";     // E6.a router

    export type LLMRequest = {
      readonly role: LLMRole;
      readonly model: string;            // e.g. "claude-haiku-4-5", "claude-sonnet-4-6"
      readonly prompt: string;
      readonly systemPrompt?: string;
      readonly sessionId?: SessionId;    // for CLI --resume
      readonly maxTokens?: number;       // default 4096
      readonly cacheControl?: boolean;   // AO-42 ephemeral marker
    };

    export type LLMTokens = {
      readonly input: number;
      readonly output: number;
      readonly cacheReadInputTokens?: number;
      readonly cacheCreationInputTokens?: number;
    };

    export type LLMResult = {
      readonly content: string;
      readonly model: string;
      readonly tokens: LLMTokens;
      readonly sessionId?: SessionId;
    };

    export type LLMError =
      | { readonly kind: "Unauthorized" }
      | { readonly kind: "RateLimited"; readonly retryAfter?: number }
      | { readonly kind: "Timeout" }
      | { readonly kind: "ServerError"; readonly status: number; readonly message: string }
      | { readonly kind: "NetworkError"; readonly cause: unknown }
      | { readonly kind: "ParseError"; readonly cause: unknown }
      | { readonly kind: "PolicyDenied"; readonly reason: string };

    export interface LLMPort {
      invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError>;
    }
    ```
  - [x] 4.2 JSDoc completo no port file referenciando AO-55, AO-42, AO-43, AO-123, D-050.
  - [x] 4.3 Garantir biome ≤200 linhas; port deve ser puro types.

- [x] **Task 5 — Criar `src/adapters/llm/anthropic-sdk.adapter.ts`** (AC-2)
  - [x] 5.1 Factory `createAnthropicSDKAdapter(deps: {apiKey: string; client?: Anthropic}): LLMPort`. Default `client = new Anthropic({apiKey: deps.apiKey})`.
  - [x] 5.2 `invoke(req)`:
    1. Build messages array; se `req.cacheControl === true`, wrap `prompt` em `[{type: "text", text: prompt, cache_control: {type: "ephemeral"}}]` (AO-42).
    2. Call `client.messages.create({model: req.model, max_tokens: req.maxTokens ?? 4096, system: req.systemPrompt, messages})`.
    3. Map response → `LLMResult` (content do primeiro `content[0].text`; tokens de `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens`).
    4. Wrap em `ResultAsync.fromPromise` com `mapError`:
       - HTTP 401 → `{kind: "Unauthorized"}`
       - HTTP 429 → `{kind: "RateLimited", retryAfter: ?}`
       - HTTP 408/timeout → `{kind: "Timeout"}`
       - HTTP 5xx → `{kind: "ServerError", status, message}`
       - Network/fetch fail → `{kind: "NetworkError", cause}`
       - Parse fail → `{kind: "ParseError", cause}`
  - [x] 5.3 Biome 200-line cap; se exceder, factor helper para `src/adapters/llm/anthropic-mapper.ts`.

- [x] **Task 6 — Criar `src/adapters/llm/claude-cli.adapter.ts`** (AC-3)
  - [x] 6.1 Factory `createClaudeCliAdapter(deps: {spawn?: ClaudeSpawn; logger?}): LLMPort`. Default `spawn = defaultClaudeSpawn`.
  - [x] 6.2 `ClaudeSpawn = (args: string[], stdin: string) => Promise<{exitCode: number; stdout: string; stderr: string}>`. Default impl usa `Bun.spawn(["claude", ...args], {stdin: "pipe", stdout: "pipe", stderr: "pipe"})` + write stdin + await stdout buffer (per memory `project-hdd-d052-claude-headless-invoker`).
  - [x] 6.3 `invoke(req)`:
    1. Args: `["--print", "--output-format", "json", "--model", req.model]`.
    2. Se `req.sessionId !== undefined`: append `["--resume", req.sessionId]`.
    3. Spawn com prompt em stdin (prompt as positional pode estourar argv limit; stdin é safe).
    4. Parse stdout JSON. Esperado: `{type: "result", result: string, session_id: string, usage: {input_tokens, output_tokens, cache_read_input_tokens?, cache_creation_input_tokens?}}` (per `claude --print --output-format json` spec).
    5. Extract `sessionId` via `extractSessionIdFromCliJson`.
    6. Build `LLMResult`. Map error kinds (timeout, parse, exit code != 0).

- [x] **Task 7 — `TestLLMAdapter` (test fixture adapter)** (AC-4)
  - [x] 7.1 Definir em `tests/adapters/llm-foundational.test.ts` (NÃO em src/, é test-only).
  - [x] 7.2 `createTestLLMAdapter(fixtures: Map<string, LLMResult>): LLMPort`. Key por convenção: `${role}:${first 40 chars do prompt}`.
  - [x] 7.3 Helper `defaultTestFixtures()`: fixture set canónico (1 por role).

- [x] **Task 8 — Specs `tests/adapters/llm-foundational.test.ts`** (AC-1..5 todos)
  - [x] 8.1 **AC-1 spec — Dep Graph Rigour:** test que lê `src/ports/llm.port.ts` source via `readFileSync` + grep para `from "../adapters/"` ou `from "src/adapters/"`. Assert: zero matches. (Static analysis simples; reusa pattern futuro de `tests/ports/contracts.test.ts` da architecture).
  - [x] 8.2 **AC-2 specs — AnthropicSDKAdapter:**
    - happy Haiku: mock client retorna `{content: [{type: "text", text: "ok"}], usage: {input_tokens: 10, output_tokens: 5}}` → assert `ok({content: "ok", tokens: {input: 10, output: 5}, model: "claude-haiku-4-5"})`.
    - happy Sonnet: mesmo pattern com model `claude-sonnet-4-6`.
    - 401: mock throw `{status: 401}` → assert `err({kind: "Unauthorized"})`.
    - cache_control on: assert messages array shape contém `cache_control: {type: "ephemeral"}`.
  - [x] 8.3 **AC-3 specs — ClaudeCliAdapter:**
    - sem sessionId: assert spawn args = `["--print", "--output-format", "json", "--model", "claude-sonnet-4-6"]`.
    - com sessionId: assert spawn args contém `["--resume", "sid-abc"]`.
    - session_id parsing: mock spawn retorna `{result: "ok", session_id: "uuid-v4", usage: {...}}` → result.sessionId === branded.
    - cache_read_input_tokens propagado: mock fixture com `cache_read_input_tokens: 47000` → result.tokens.cacheReadInputTokens === 47000.
  - [x] 8.4 **AC-4 specs — TestLLMAdapter:**
    - fixture exists: invoke → ok com fixture.
    - fixture missing: invoke → err.
  - [x] 8.5 **AC-5 spec — SessionId branded (type-only):**
    - `// @ts-expect-error TS2322 — string não-branded` em assignment `const s: SessionId = "raw"` (a directive falha se NÃO houver erro = type isolation perdida).
  - [x] 8.6 Run `bun test tests/adapters/llm-foundational.test.ts`.

- [x] **Task 9 — Generator-driven Tier-B summary + sprint-status review**
  - [x] 9.1 Build trimmed `SummaryInput` (aprende lessons O-A9-5: Tier-B usa MESMOS dados de Tier-C → trim agressivo).
  - [x] 9.2 Run `summaryGenerator.finalize()` via `scripts/generate-1a10-summary.ts`. Auto-commit produz `summary(story-1a10): ...`.
  - [x] 9.3 Sprint-status: `1-a-10: in-progress → review`.

## Dev Notes

### AO matrix (compliance map)

| AO / Decisão | Story relevance | Aplicado em |
|---|---|---|
| **D-050** Cost-optimal LLM hybrid routing por FASE | Canon directo | 2 adapters expostos (SDK + CLI); routing é responsabilidade do caller (bootstrap escolhe) |
| **AO-55** `LLMAdapter` interface — Plan B switch trivial | Direct | LLMPort interface em `src/ports/llm.port.ts` |
| **AO-42** `cache_control: ephemeral` prompt caching | Direct | `LLMRequest.cacheControl?: boolean` → SDK adapter wraps prompt |
| **AO-43** Haiku 4.5 para gap detector + parser NLP | Direct (via LLMRole) | `role: "gap-detector" \| "classifier" \| "narrative-summary"` → caller passa model "claude-haiku-4-5" |
| **AO-114** Token ledger SQLite | Future story 6.a.1 | `LLMResult.tokens` exposto; persistence defer |
| **AO-123** Plan B activation autónoma (3 5xx → switch) | Future story | 2 adapters expostos; swap logic defer |
| **AO-66** Throw whitelist | Canon | Adapters retornam `Result`; SDK errors mapped via `fromPromise` |
| **AO-122** Biome 200-line cap | Hard | Mapper helpers em ficheiro próprio se SDK adapter exceder |
| **D-051** Cost cap $30/m | Operational | Não enforced nesta story (consumer responsabilidade); doc-out no JSDoc |
| **D-052** Claude headless invoker validation | Direct (1.c.7 já validou) | `claude --print --output-format json` é spec confirmada |

### Esboços canónicos

**`src/lib/branded.ts` delta (apenas o trecho a adicionar):**

```ts
export type SessionId = string & { readonly _brand: "SessionId" };

// UUID v4 OR claude session format (e.g. "sid-<hex>") — claude pode usar formato próprio.
// Per D-052 smoke output observado em 1.c.7, session_id parece UUID v4. Validar contra ambos.
const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mkSessionId(s: string): Result<SessionId, BrandError> {
  if (!SESSION_ID_RE.test(s)) {
    return err({ kind: "BrandError", value: s, expected: "UUID-like session_id" });
  }
  return ok(s as SessionId);
}
```

**`src/ports/llm.port.ts` (target ≤120 linhas pure types + JSDoc):**

```ts
import type { ResultAsync } from "../lib/result.ts";
import type { SessionId } from "../lib/branded.ts";

// LLMRole, LLMRequest, LLMTokens, LLMResult, LLMError, LLMPort (per esboço Task 4.1)
```

**`src/adapters/llm/anthropic-sdk.adapter.ts` (target ≤180 linhas):**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { ResultAsync } from "../../lib/result.ts";
import type { LLMError, LLMPort, LLMRequest, LLMResult } from "../../ports/llm.port.ts";

export type AnthropicSDKDeps = {
  readonly apiKey: string;
  readonly client?: Anthropic;
};

export function createAnthropicSDKAdapter(deps: AnthropicSDKDeps): LLMPort {
  const client = deps.client ?? new Anthropic({ apiKey: deps.apiKey });

  return {
    invoke: (req) =>
      ResultAsync.fromPromise(
        client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens ?? 4096,
          system: req.systemPrompt,
          messages: [{
            role: "user",
            content: req.cacheControl
              ? [{ type: "text", text: req.prompt, cache_control: { type: "ephemeral" } }]
              : req.prompt,
          }],
        }),
        mapAnthropicError,
      ).map(mapAnthropicResponse(req.model)),
  };
}

function mapAnthropicError(raw: unknown): LLMError {
  // SDK throws Anthropic.APIError com .status; map per kind.
  // ...
}

function mapAnthropicResponse(model: string) {
  return (resp: Anthropic.Message): LLMResult => ({
    content: resp.content[0]?.type === "text" ? resp.content[0].text : "",
    model,
    tokens: {
      input: resp.usage.input_tokens,
      output: resp.usage.output_tokens,
      cacheReadInputTokens: resp.usage.cache_read_input_tokens ?? undefined,
      cacheCreationInputTokens: resp.usage.cache_creation_input_tokens ?? undefined,
    },
  });
}
```

**`src/adapters/llm/claude-cli.adapter.ts` (target ≤150 linhas):**

```ts
import { errAsync, okAsync } from "../../lib/result.ts";
import { extractSessionIdFromCliJson } from "../../lib/llm-session-id.ts";

export type ClaudeSpawnResult = { exitCode: number; stdout: string; stderr: string };
export type ClaudeSpawn = (args: ReadonlyArray<string>, stdin: string) => Promise<ClaudeSpawnResult>;

export function createClaudeCliAdapter(deps: { spawn?: ClaudeSpawn } = {}): LLMPort {
  const spawn = deps.spawn ?? defaultSpawn;

  return {
    invoke: (req) => {
      const args = ["--print", "--output-format", "json", "--model", req.model];
      if (req.sessionId !== undefined) args.push("--resume", req.sessionId);

      return ResultAsync.fromPromise(spawn(args, req.prompt), (cause) => ({
        kind: "NetworkError" as const, cause,
      })).andThen((res) => {
        if (res.exitCode !== 0) {
          return errAsync({ kind: "ServerError", status: res.exitCode, message: res.stderr });
        }
        try {
          const parsed = JSON.parse(res.stdout) as { result?: string; session_id?: string; usage?: {...} };
          const sidR = extractSessionIdFromCliJson(parsed);
          if (sidR.isErr()) return errAsync({ kind: "ParseError", cause: sidR.error });
          return okAsync({ content: parsed.result ?? "", model: req.model, tokens: {...}, sessionId: sidR.value });
        } catch (cause) {
          return errAsync({ kind: "ParseError", cause });
        }
      });
    },
  };
}

async function defaultSpawn(args: ReadonlyArray<string>, stdin: string): Promise<ClaudeSpawnResult> {
  const p = Bun.spawn(["claude", ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  p.stdin.write(stdin); p.stdin.end();
  const stdout = await new Response(p.stdout).text();
  const stderr = await new Response(p.stderr).text();
  const exitCode = await p.exited;
  return { exitCode, stdout, stderr };
}
```

### Previous story intelligence (1.a.7 + 1.a.9 + 1.c.7 directly leveraged)

**Da 1.a.7 (bootstrap + env Zod):**
- `ANTHROPIC_API_KEY` já está em `EnvSchema` (minimal scope). Esta story usa-o sem alterações ao schema.
- bootstrap.ts NÃO precisa de instanciar LLM adapters; consumers/bootstrap futuro fazem-no quando E3+ entrar.

**Da 1.a.9 (withRunContext):**
- LLM adapters NÃO precisam wrap em `withRunContext`. Caller pode propagar contexto e logger child reads `getRunContext()` quando logger integration entrar.
- LLM tokens contam para budget — esses logs vão querer `runId` correlation. Future story logger wire.

**Da 1.c.7 (claude headless validation):**
- D-052 validou: worker invoca skills BMAD via `claude -p` headless. `--output-format json` retorna `{type: "result", result, session_id, usage}`.
- Smoke confirmou que `claude --print --resume <sid>` propaga session + cache. Esta story implementa o adapter.

**Convenções emergidas das 9 stories anteriores:**
- ResultAsync para async I/O (neverthrow); ResultAsync.fromPromise para SDK calls.
- Factory functions, não classes.
- `:memory:` SQLite + tmpdir para tests.
- `process.exit` mock pattern (não aplicável aqui — sem CLI direct nesta story).
- `noPropertyAccessFromIndexSignature` → bracket access em `Record<string, unknown>`.
- Biome 200-line HARD cap em `src/**` (tests/** override).
- Lint cycle: `lint:fix` resolve format + organize-imports na maioria dos casos.

### Anti-pattern guardrails (NÃO fazer)

1. **NÃO importar adapter de port** — AC-1 Dep Graph Rigour. Port é puro types + interface; nunca importa de `../adapters/`.
2. **NÃO usar `fetch` directo** no `AnthropicSDKAdapter` — usar `@anthropic-ai/sdk` que já gere retry, rate limit headers, etc. (AO-53 nativo fetch é para outros adapters, não LLM).
3. **NÃO hardcode `claude-haiku-4-5` ou `claude-sonnet-4-6` no adapter** — `req.model` vem do caller. Adapters são model-agnostic; routing decisão é do consumer.
4. **NÃO persistir session_id em DB nesta story** — session map persistence defer Story 6.a.1. In-memory ou caller decide.
5. **NÃO incluir Plan B autonomous swap logic** — esta story expõe adapters; swap em story dedicada (Pre-Mortem L-2 docs).
6. **NÃO escrever audit log no adapter** — caller (bootstrap/service) decide se audit. Adapter retorna Result; pure boundary.
7. **NÃO assumir Anthropic SDK API shape** — confirma com `node_modules/@anthropic-ai/sdk/index.d.ts` em runtime. SDK pode ter mudado entre versions.
8. **NÃO chamar `claude` CLI em CI sem skip-flag** — `claude` binário pode não estar instalado no GitHub Actions; tests usam mock spawn. Real-CLI smoke fica para dev local + 1.c.7 process já documentado.
9. **NÃO usar `Bun.spawnSync` para Claude CLI** — sync block daria timeout em LLM calls multi-segundo. Async com `Bun.spawn` + await streams.
10. **NÃO esquecer `cache_control` no SDK adapter** — AO-42 é optimização cost crítica; se ignorar, cost vai 4× mais para prompts repetidos.

### Testing strategy

- **`tests/adapters/llm-foundational.test.ts`** (canon spec file) — ~250-350 linhas:
  - AC-1 Dep Graph: read llm.port.ts source, grep for adapters import.
  - AC-2 SDK happy×2 (Haiku, Sonnet) + 401 + cache_control on.
  - AC-3 CLI: 3 specs (no sessionId, with sessionId, cache_read propagation).
  - AC-4 TestLLMAdapter: 2 specs (hit/miss).
  - AC-5 SessionId branded: `@ts-expect-error` directive test.
- **No real-network tests in CI.** Smoke real fica para dev local manual ou 1.c.7 process.
- Coverage target: ≥85% line nos 3 adapter files + port + lib.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.a.10] — StorySpec + 5 ACs.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-55] — LLMAdapter interface canon.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-42] — cache_control: ephemeral.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-43] — Haiku para light tasks.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-114] — Token ledger (defer).
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-123] — Plan B activation (defer).
- [Memory: project-hdd-cost-optimal-llm] — D-050 hybrid routing canon.
- [Memory: project-hdd-llm-budget] — D-051 metered cap $30/m.
- [Memory: project-hdd-d052-claude-headless-invoker] — claude --print --output-format json spec.
- [Source: _bmad-output/implementation-artifacts/story-1c7-summary.md] — D-052 validation evidence.

### Project Structure Notes

**Created (5 + 1 dogfood):**
- `src/ports/llm.port.ts`
- `src/adapters/llm/anthropic-sdk.adapter.ts`
- `src/adapters/llm/claude-cli.adapter.ts`
- `src/lib/llm-session-id.ts`
- `tests/adapters/llm-foundational.test.ts`
- `scripts/generate-1a10-summary.ts` (dogfood gen)
- `_bmad-output/implementation-artifacts/story-1a10-summary.md` (gerado)

**Modified (3):**
- `src/lib/branded.ts` (+ SessionId type + mkSessionId factory ≈ +15 linhas)
- `package.json` + `bun.lock` (`@anthropic-ai/sdk`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

Sem deviation vs architecture. Epic 1.a fecha após esta story (10/10).

## Open Questions for Operator

> **Resolução em 2026-05-29** — todas em default Recommended via `AskUserQuestion` (4 questions).

- **Q-A10-1 [RESOLVED — Mock-only]** — SDK client injectável + Bun.spawn injectável; tests offline-safe. Smoke real fica para dev local manual + 1.c.7 process já valida `claude --print` end-to-end.
- **Q-A10-2 [RESOLVED — Defer in-memory]** — adapter mantém in-memory para lifetime do processo; persistence DB entra em Story 6.a.1.
- **Q-A10-3 [RESOLVED — Opt-in]** — `LLMRequest.cacheControl?: boolean` default `false`; caller decide. Explicit.
- **Q-A10-4 [RESOLVED — Defer]** — esta story NÃO implementa Plan B swap. 2 adapters expostos isolados; bootstrap escolhe um. Auto-swap detector entra em story dedicada.

**Implicações para tasks (delta):**
- Task 5 → `client?: Anthropic` injectable; tests mock client.
- Task 6 → `spawn?: ClaudeSpawn` injectable; tests mock spawn.
- Task 6.x → session map ficar simples (return em `LLMResult.sessionId`; no persistence call).
- Task 8.2 → último spec "cache_control on" valida que `cacheControl: true` propaga para messages array shape.
- Sem task adicional para LLMRouter.
