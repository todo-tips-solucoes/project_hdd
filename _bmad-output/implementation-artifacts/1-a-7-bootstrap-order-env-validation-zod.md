# Story 1.a.7: Bootstrap order + env validation Zod

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **worker process** (HDD hdd-worker daemon),
I want **`src/bootstrap.ts` com boot order explícito (load env → validate Zod → connect db → run migrations → init audit adapter → arm SIGTERM handler) e shutdown handler graceful**,
so that **fail-closed em credenciais missing (exit 1 em <500ms, zero linhas audit) + sem state corruption em SIGTERM (flush + close + exit 0 em <5s)**.

> **Big picture (1ª story end-to-end real do HDD):** as 6 stories anteriores (1.a.1..1.a.6) construíram peças isoladas — Result/branded, ports temporais, FSM pura, db schema + idempotency service, audit JSONL hash chain. Esta story é o primeiro **sequence de boot funcional** que liga tudo. Define o contrato `bootstrap()` que todos os arrancos futuros (CLI, daemon, tests E2E) usam, e o contrato `shutdown()` que garante crash recovery determinístico. Sem isto, `bun run start` é um no-op (o stub actual de `src/main.ts` apenas faz `console.log`).
>
> **Scope delimit (CRÍTICO — narrower que D-04.16 canon):** o D-04.16 canónico tem 7 passos boot + 5 shutdown, mas **3 desses 7 passos boot não têm pré-requisitos prontos nesta sprint** e ficam fora de scope:
> - **Boot passo 4 (Litestream watch verify)** → Story 1.c.3.
> - **Boot passo 5 (Hono server + /healthz endpoint)** → Story 1.c.1.
> - **Boot passo 6 (worker loop / story executor)** → Story 2.1+.
>
> Equivalentemente para shutdown:
> - **Shutdown passo 1 (worker loop drain)** → 2.1+.
> - **Shutdown passo 2 (Hono graceful stop)** → 1.c.1.
>
> Esta story implementa os **4 passos boot que têm dependências prontas + os 2 passos shutdown que aplicam ao estado actual**:
>
> **Boot canónico desta story (4 passos):**
> 1. parse env via Zod (`src/lib/env.ts`) — fail fast com exit code 1 se inválido, **antes de qualquer side-effect**.
> 2. `createDbConnection()` + `applyMigrations()` (re-uso de `src/db/connection.ts` da 1.a.5).
> 3. `createAuditAdapter()` (re-uso de `src/adapters/audit/jsonl-hash-chain.adapter.ts` da 1.a.6) + opcionalmente emitir evento "ProcessStarted" (Q-A7-3).
> 4. arm SIGTERM/SIGINT handler via `src/lib/shutdown.ts`.
>
> **Shutdown desta story (3 passos):**
> 1. opcionalmente emitir evento "ProcessStopped" via audit (Q-A7-4).
> 2. `db.close()` (bun:sqlite síncrono).
> 3. `process.exit(0)`.
>
> Conforme novos workers/adapters/servers entrarem em stories futuras, **eles vão ENROLAR-SE neste bootstrap** (DI-style). Esta story estabelece o esqueleto + os 2 contratos públicos.

## Acceptance Criteria

> Os ACs são extracted verbatim de `_bmad-output/planning-artifacts/epics.md` (Story 1.a.7). Apenas 2 ACs — ambos críticos.

**AC-1 (fail-closed em env missing — binary AC):**

**Given** env var `ANTHROPIC_API_KEY` ausente (ou vazia, ou whitespace-only)
**When** worker arranca via `bun run start` (i.e. `bun run src/main.ts`)
**Then** processo exit code 1 com mensagem `"ANTHROPIC_API_KEY required"` (substring exacta) no `stderr` em **<500ms** wall-clock desde spawn
**And** zero linhas escritas no audit log (`_bmad-output/audit/YYYY-MM-DD.jsonl`); **no partial init**

**AC-2 (SIGTERM graceful — property AC):**

**Given** worker rodando (boot complete: env validated + db open + audit adapter inicializado)
**When** o processo recebe SIGTERM
**Then** dentro de **<5s** wall-clock:
1. stop accepting new work (no worker loop nesta story; placeholder — implementação real em 2.1+);
2. flush pending audit events (opcional emit "ProcessStopped" — Q-A7-4);
3. close db connection (`db.close()` síncrono bun:sqlite);
4. exit code 0.

> Property nuance: o "<5s" deve ser robusto a clock variance. Testar via `setTimeout`-based race no spec usando `createTestClockAdapter()` quando possível, ou `Date.now()` delta wall-clock fallback. Margem prática: a sequência completa deve estar próximo de zero ms (~10-50ms) em condições normais — os 5s são budget de segurança, não target.

## Tasks / Subtasks

> Sequência task-por-task com instrumentação ESLint+Biome+Bun test entre cada para apanhar regressões cedo. Estimated tokens: 56K core / 80K with retry (per epics StorySpec).

- [x] **Task 1 — Add `zod` dependency** (AC: foundational; sem AC directo)
  - [x] 1.1 `bun add zod` (latest stable confirmed via `bun add zod@latest`); registar versão exacta no Dev Agent Record. **Não** assumir v3 vs v4 — usar o que `bun add zod@latest` instalar e validar com `bunx zod --version` se aplicável.
  - [x] 1.2 Confirmar `bun.lock` updated em text format (per convenção 1.a.1).
  - [x] 1.3 Verificar que `bun run type-check` ainda passa.

- [x] **Task 2 — Criar `src/lib/env.ts`** (AC-1)
  - [x] 2.1 Definir Zod schema `EnvSchema` com `ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY required")`. **Whitespace-only deve falhar** — usar `.trim().min(1)` ou refinement custom.
  - [x] 2.2 Decidir scope adicional do schema per Q-A7-1 (default Recommended: APENAS `ANTHROPIC_API_KEY`). Se mais campos, todos `.optional()` com defaults sensíveis (`HDD_DB_PATH=./hdd.db`, `HDD_AUDIT_DIR=_bmad-output/audit`, `LOG_LEVEL=info`).
  - [x] 2.3 Exportar `type Env = z.infer<typeof EnvSchema>` e função `parseEnv(raw: NodeJS.ProcessEnv = process.env): Result<Env, EnvValidationError>`. **Síncrono** (Zod é síncrono).
  - [x] 2.4 `EnvValidationError` é uma tagged union ou estrutura simples com `kind: "EnvValidationError"`, `issues: ReadonlyArray<{path: string, message: string}>`, `formatted: string` (a primeira mensagem rendered para stderr — para AC-1 substring match).
  - [x] 2.5 **NÃO usar `throw`** em `parseEnv` — devolver `err(...)`. O `throw` (com `// allow-throw: AO-66 #3 boot-time failure`) só ocorre eventualmente em `bootstrap.ts` se a política for "throw + crash" em vez de `process.exit(1)` (Q-A7-5 default Recommended: `process.exit(1)` em `main.ts` após `parseEnv` devolver `err`, **não throw**).
  - [x] 2.6 Run `bun run lint && bun run type-check`.

- [x] **Task 3 — Criar `src/lib/shutdown.ts`** (AC-2)
  - [x] 3.1 Factory function `createShutdownHandler(deps: { db: Database; audit: AuditPort; clock: ClockPort; logger?: { info: (msg: string) => void } }): { arm(): () => void; trigger(reason: string): Promise<void> }`. `arm()` instala SIGTERM+SIGINT listeners e retorna função de unarm (cleanup para tests).
  - [x] 3.2 `trigger(reason)` faz a sequência:
    1. Set flag `isShuttingDown=true` (idempotente — re-entrant safe; segundo SIGTERM é no-op).
    2. Opcionalmente `await audit.append({ type: "ProcessStopped", reason, ... })` se Q-A7-4 = Yes.
    3. `db.close()` (síncrono bun:sqlite).
    4. `process.exit(0)`.
  - [x] 3.3 Re-entrance safety: dois SIGTERM rápidos → apenas uma sequência de cleanup; o segundo é ignorado.
  - [x] 3.4 **NÃO usar `setTimeout` em `src/core/**`** (AO-103 restricted-globals). Este ficheiro vive em `src/lib/` que está fora do ban, portanto OK usar `process.on()` + (se preciso de timeout-watchdog para 5s budget) `clock.setTimeout()` injectado.
  - [x] 3.5 Run `bun run lint && bun run type-check`.

- [x] **Task 4 — Re-escrever `src/bootstrap.ts`** (AC-1 + AC-2)
  - [x] 4.1 Substituir o stub actual (`export const bootstrap = (): void => {}`) por:
    ```ts
    export type BootDeps = { /* injectable for tests */ };
    export type BootResult = { /* db, audit, shutdown handle */ };
    export async function bootstrap(deps?: Partial<BootDeps>): Promise<Result<BootResult, BootError>>;
    ```
  - [x] 4.2 Sequência interna (4 passos da Big picture acima):
    1. `parseEnv()` → se `err`, devolver `err({ kind: "BootEnvInvalid", inner })`.
    2. `createDbConnection(env.HDD_DB_PATH)` + `applyMigrations(db, MIGRATIONS_DIR)`.
    3. `createAuditAdapter({ clock, db, baseDir: env.HDD_AUDIT_DIR })` + opcionalmente `audit.append({ type: "ProcessStarted", ... })` se Q-A7-3 = Yes.
    4. `createShutdownHandler({ db, audit, clock }).arm()`.
  - [x] 4.3 Default deps: `SystemClockAdapter` (da 1.a.3) para produção; tests injectam `createTestClockAdapter()` + `:memory:` SQLite.
  - [x] 4.4 **`BootError` tagged union:** `BootEnvInvalid | BootDbFailure | BootMigrationFailure | BootAuditFailure`.
  - [x] 4.5 Garantir ficheiro ≤200 linhas (Biome hard cap). Se exceder, factor helpers para `src/lib/`.
  - [x] 4.6 Run `bun run lint && bun run type-check`.

- [x] **Task 5 — Re-escrever `src/main.ts`** (AC-1)
  - [x] 5.1 Top-level entry point: `await bootstrap()`. Se `result.isErr()`:
    - `console.error(result.error.formatted ?? result.error.kind)` no `stderr`;
    - `process.exit(1)` (com `// allow-throw: AO-66 #3` se quiser usar `throw` em vez de `exit`; default Recommended: `exit` directo).
  - [x] 5.2 Se `result.isOk()`: log `"hdd-worker started"` no stdout, mas **não bloquear** — o handler SIGTERM mantém o processo vivo (Node.js standard behaviour com listeners arm).
  - [x] 5.3 Manter `if (import.meta.main)` pattern para tolerar import em tests sem auto-executar.
  - [x] 5.4 Run `bun run lint && bun run type-check`.

- [x] **Task 6 — Specs `tests/bootstrap.test.ts`** (AC-1 + AC-2)
  - [x] 6.1 **AC-1 spec (env missing):**
    - Test 1: env `{}` (sem `ANTHROPIC_API_KEY`) → `bootstrap()` devolve `err(BootEnvInvalid)` com `formatted` contém substring `"ANTHROPIC_API_KEY required"`.
    - Test 2: env `{ ANTHROPIC_API_KEY: "" }` → mesmo erro.
    - Test 3: env `{ ANTHROPIC_API_KEY: "   " }` → mesmo erro (whitespace-only).
    - Test 4: env `{ ANTHROPIC_API_KEY: "sk-..." }` + `:memory:` + tmpdir audit → `bootstrap()` devolve `ok({ db, audit, shutdown })`.
    - Test 5 (**timing AC**): medir `Bun.nanoseconds()` antes/depois — total <500ms (ler com folga 250ms na CI; 500ms é budget).
    - Test 6 (**zero audit lines**): após Test 1, verificar que `_bmad-output/audit/*.jsonl` não foi criado (usar `mkdtempSync` para tmpdir isolation; statSync deve throw ENOENT).
  - [x] 6.2 **AC-2 spec (SIGTERM graceful):**
    - Test 7: arrancar bootstrap em `:memory:` + tmpdir; armar shutdown; chamar `shutdown.trigger("test")` directamente (vez de SIGTERM real para determinismo); verificar `db.close()` foi chamado (db.query throws após close); verificar `process.exit` foi invocado com `0` (mock `process.exit`).
    - Test 8 (**timing AC**): mesmo cenário, medir wall-clock — <5s budget; típico ~10-50ms.
    - Test 9 (**re-entrance**): chamar `trigger()` duas vezes em paralelo → apenas uma sequência cleanup (verificar `db.close` chamado 1x).
  - [x] 6.3 Helpers: `mkdtempSync(join(tmpdir(), "hdd-boot-"))`, `createTestClockAdapter()` da 1.a.3, mock `process.exit` via `spyOn(process, "exit").mockImplementation(((code) => { throw new Error(`exit(${code})`); }) as never)`.
  - [x] 6.4 Run `bun test tests/bootstrap.test.ts` — todos verdes.
  - [x] 6.5 Run `bun test` (full suite — sem regressões nas 7 stories anteriores).
  - [x] 6.6 Run `bun run lint && bun run type-check` final.

- [x] **Task 7 — Resumo Tier-B + sprint-status update**
  - [x] 7.1 Escrever `_bmad-output/implementation-artifacts/story-1a7-summary.md` manualmente (template em `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md`). Generator automático chega 1.a.8 (D-019).
  - [x] 7.2 Actualizar `_bmad-output/implementation-artifacts/sprint-status.yaml`: `1-a-7: in-progress → review` (no fim de dev-story; depois `review → done` após `approve story-1a7`).
  - [x] 7.3 Update `last_updated: 2026-05-28` no sprint-status.

## Dev Notes

### AO matrix (compliance map)

| AO / Decisão | Story relevance | Onde aplicado nesta story |
|---|---|---|
| **D-04.16** Boot/shutdown order explícito | Canon directo | `src/bootstrap.ts` implementa 4-de-7 passos boot + 3-de-5 shutdown (scope-out justified) |
| **D-04.5'** Zod sobre `process.env` apenas | Canon directo | `src/lib/env.ts` schema mínimo; sem layered config |
| **D-04.6'** Secrets via systemd `EnvironmentFile=` | Operational context | Cobrir em 1.c.2; aqui apenas garantir que o schema lê de `process.env` directamente |
| **AO-52** envalid/Zod no boot, fail fast | Direct | `parseEnv()` síncrono + fail-closed em `main.ts` |
| **AO-66** Throw whitelist | Canon | `process.exit(1)` em vez de `throw` em produção; throws apenas com `// allow-throw: AO-66 #N` comment (categoria #3 boot-time failure aplica se preferir throw) |
| **AO-76** sd_notify → HTTP /healthz | Future story 1.c.1 | Nesta story: nenhuma referência sd_notify; nenhum endpoint /healthz |
| **AO-103** setTimeout/setInterval restricted in src/core | Canon | `shutdown.ts` vive em `src/lib/` (fora do ban) — pode usar `process.on()` directo; se precisar de timer, injectar `clock.setTimeout()` |
| **AO-104** test files isent of throw whitelist + biome 200-line | Canon | `tests/bootstrap.test.ts` pode exceder 200 linhas + usar throws livremente |
| **FR-080..085 (feature F9 Bootstrap)** | Direct (FR-081 graceful shutdown; FR-082 fail-closed) | Esta story implementa FR-081 + FR-082 inicial; FR-085 heartbeat proactivo defer 1.c.1 |

**Inconsistência documentada (não-blocker):**
- A epics StorySpec referencia `AR-019`, `AR-037`, `AR-039` no `ao_subset`. Estes códigos vêm do namespace AR-NNN pré-shift; o canon actual (architecture.md) usa `D-04.x'` e `AO-NN`. Mapeamento:
  - AR-019 ≈ D-04.6' (secrets via EnvironmentFile)
  - AR-037 ≈ D-04.16 (boot/shutdown order)
  - AR-039 ≈ D-04.4' (AsyncLocalStorage withRunContext — DEFER para Story 1.a.9; **não toca aqui**)

**Open item acumulado (O-A6-6 da 1.a.6 + agora também):** próxima consolidação `docs:` deve reconciliar `epics.md` `ao_subset` codes com canon D-04.x / AO-NN.

### Esboços de código canónicos

**`src/lib/env.ts` (esqueleto target ~50-80 linhas):**

```ts
import { z } from "zod";
import { type Result, err, ok } from "./result.ts";

export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().trim().min(1, "ANTHROPIC_API_KEY required"),
  // Q-A7-1 default Recommended: APENAS o key acima.
  // Wider scope (se Q-A7-1 escolher): HDD_DB_PATH, HDD_AUDIT_DIR, LOG_LEVEL,
  // todos optional com defaults.
});

export type Env = z.infer<typeof EnvSchema>;

export type EnvValidationError = {
  readonly kind: "EnvValidationError";
  readonly issues: ReadonlyArray<{ readonly path: string; readonly message: string }>;
  readonly formatted: string;
};

export function parseEnv(
  raw: NodeJS.ProcessEnv = process.env,
): Result<Env, EnvValidationError> {
  const parsed = EnvSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  const formatted = issues.map((i) => i.message).join("; ");
  return err({ kind: "EnvValidationError", issues, formatted });
}
```

**`src/lib/shutdown.ts` (esqueleto target ~60-100 linhas):**

```ts
import type { Database } from "bun:sqlite";
import type { AuditPort } from "../ports/audit.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";

export type ShutdownDeps = {
  readonly db: Database;
  readonly audit: AuditPort;
  readonly clock: ClockPort;
  readonly emitStoppedEvent?: boolean; // Q-A7-4
};

export type ShutdownHandle = {
  readonly arm: () => () => void; // returns unarm fn for test cleanup
  readonly trigger: (reason: string) => Promise<void>;
};

export function createShutdownHandler(deps: ShutdownDeps): ShutdownHandle {
  let shuttingDown = false;
  const trigger = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (deps.emitStoppedEvent) {
      await deps.audit.append({ /* ProcessStopped event payload */ });
    }
    deps.db.close();
    // allow-throw: not used; process.exit is not a throw.
    process.exit(0);
  };
  const arm = (): (() => void) => {
    const onSig = (sig: NodeJS.Signals): void => {
      void trigger(`signal:${sig}`);
    };
    process.on("SIGTERM", onSig);
    process.on("SIGINT", onSig);
    return () => {
      process.off("SIGTERM", onSig);
      process.off("SIGINT", onSig);
    };
  };
  return { arm, trigger };
}
```

**`src/bootstrap.ts` (esqueleto target ~80-130 linhas):**

```ts
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { createAuditAdapter } from "./adapters/audit/jsonl-hash-chain.adapter.ts";
import { createSystemClockAdapter } from "./adapters/clock/system-clock.adapter.ts";
import { applyMigrations, createDbConnection } from "./db/connection.ts";
import { parseEnv, type Env, type EnvValidationError } from "./lib/env.ts";
import { type Result, err, ok } from "./lib/result.ts";
import { createShutdownHandler, type ShutdownHandle } from "./lib/shutdown.ts";
import type { AuditPort } from "./ports/audit.port.ts";
import type { ClockPort } from "./ports/clock.port.ts";

const MIGRATIONS_DIR_DEFAULT = "src/db/migrations";

export type BootDeps = {
  readonly env?: NodeJS.ProcessEnv;
  readonly clock?: ClockPort;
  readonly migrationsDir?: string;
  readonly emitProcessStartedEvent?: boolean; // Q-A7-3
  readonly emitProcessStoppedEvent?: boolean; // Q-A7-4
};

export type BootResult = {
  readonly env: Env;
  readonly db: Database;
  readonly audit: AuditPort;
  readonly shutdown: ShutdownHandle;
};

export type BootError =
  | { kind: "BootEnvInvalid"; inner: EnvValidationError }
  | { kind: "BootDbFailure"; message: string }
  | { kind: "BootMigrationFailure"; message: string }
  | { kind: "BootAuditFailure"; message: string };

export async function bootstrap(
  deps: BootDeps = {},
): Promise<Result<BootResult, BootError>> {
  // 1. env Zod fail-fast.
  const envR = parseEnv(deps.env ?? process.env);
  if (envR.isErr()) return err({ kind: "BootEnvInvalid", inner: envR.error });
  const env = envR.value;

  const clock = deps.clock ?? createSystemClockAdapter();

  // 2. db + migrations.
  let db: Database;
  try {
    db = createDbConnection(env.HDD_DB_PATH ?? "./hdd.db");
  } catch (e) {
    return err({ kind: "BootDbFailure", message: String(e) });
  }
  const migR = applyMigrations(db, deps.migrationsDir ?? MIGRATIONS_DIR_DEFAULT);
  if (migR.isErr()) {
    db.close();
    return err({ kind: "BootMigrationFailure", message: JSON.stringify(migR.error) });
  }

  // 3. audit adapter + opcional ProcessStarted.
  const audit = createAuditAdapter({
    clock,
    db,
    baseDir: env.HDD_AUDIT_DIR ?? "_bmad-output/audit",
    projectId: env.HDD_PROJECT_ID ?? "projeto_hdd",
  });
  if (deps.emitProcessStartedEvent) {
    const appR = await audit.append({ type: "ProcessStarted", /* payload */ });
    if (appR.isErr()) {
      db.close();
      return err({ kind: "BootAuditFailure", message: JSON.stringify(appR.error) });
    }
  }

  // 4. shutdown handler armed.
  const shutdown = createShutdownHandler({
    db,
    audit,
    clock,
    emitStoppedEvent: deps.emitProcessStoppedEvent ?? false,
  });
  shutdown.arm();

  return ok({ env, db, audit, shutdown });
}
```

**`src/main.ts` (target ~20-30 linhas):**

```ts
import { bootstrap } from "./bootstrap.ts";

if (import.meta.main) {
  const result = await bootstrap();
  if (result.isErr()) {
    const msg = "formatted" in result.error
      ? // @ts-expect-error narrow on inner
        result.error.formatted ?? result.error.kind
      : result.error.kind;
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }
  process.stdout.write("hdd-worker started\n");
  // process stays alive via SIGTERM/SIGINT listeners.
}
```

> **Atenção sobre exit-vs-throw em main.ts:** AO-66 categoria #3 ("Boot-time failures") permite `throw` com comment. `process.exit(1)` é **NÃO-throw** (chama syscall directo) e portanto não atinge ESLint `no-restricted-syntax`. Default Recommended: usar `process.exit(1)` directo — mais simples e Bun-idiomático.

### Previous story intelligence (1.a.5 + 1.a.6 — directly leveraged)

**Da 1.a.5 (db schema):**
- `createDbConnection(path)` retorna `Database` com PRAGMAs WAL+FK+busy_timeout+sync NORMAL aplicados. Esta story re-usa directamente — sem reinventar.
- `applyMigrations(db, dir)` aplica todos os `NNN_descricao.sql` dentro de `BEGIN EXCLUSIVE`, idempotente. Esta story chama no boot.
- `commitBeforeSideEffect()` padrão: commit DB transaction antes de side-effect externo — relevante para shutdown ordering (não para esta story em particular, mas a regra geral aplica).
- bun:sqlite é **síncrono**; não usar `ResultAsync` quando o cleanup é puro DB.

**Da 1.a.6 (audit JSONL):**
- `createAuditAdapter({ clock, db, baseDir, projectId })` factory; lê + actualiza `audit_chain_state` (table da migration 002) em cada `append`.
- `append(event)` é `async` e retorna `ResultAsync<void, AuditError>`. Mesmo que a syscall fs seja síncrona, a interface é async — manter consistency.
- O adapter **não tem `close()`** — usa O_APPEND syscall fresh por linha (`fs.openSync(path, 'a')` + write + close). No file descriptor persistente → **shutdown não precisa fechar audit explicitamente**. Apenas garantir que não há `append()` em-flight no momento do exit (mitigation: `await` antes de `db.close()`).
- Rotation date-based UTC: ao mudar de dia emite `.tsr` stub e reset chain.
- **Reviewer findings 1.a.6:** `fsync` foi deliberadamente NÃO implementado (WAL + Litestream compensam). Para esta story confirma-se: shutdown handler não precisa de fsync explicit no audit — basta `await` no último append antes do exit.

**Convenções emergidas (tácitas, não em docs canónicos — herança das 7 stories):**
- `Result<T,E>` sync de `src/lib/result.ts`; `ResultAsync` só quando o I/O é genuinamente async (que para esta story só aplica em `audit.append`).
- Branded types de `src/lib/branded.ts` (não precisas directamente nesta story).
- Bun.CryptoHasher para SHA-256 (não precisas aqui).
- `:memory:` SQLite + `mkdtempSync` para tests isolation.
- `createTestClockAdapter()` para tests determinísticos sem `setTimeout` real.
- Test seeds usam SQL raw (db.query("INSERT...").run()) não Drizzle.
- ESLint: `no-restricted-syntax: ThrowStatement` activo com whitelist; throws precisam de `// eslint-disable-next-line no-restricted-syntax -- AO-66 #N` comment.
- `no-restricted-globals: setTimeout, setInterval` em `src/core/**` — **bootstrap/shutdown vivem em `src/` raiz e `src/lib/` (fora do ban)**, portanto OK usar `process.on()` directo.
- Biome 200-line HARD cap em `src/**` (tests/** override desactiva). **Atenção: `bootstrap.ts` pode exceder 200 se incluir todos os esboços; planear factor de helpers para `src/lib/` se necessário.**
- `@types/bun` (não `bun-types`); `bun.lock` text format.

### Anti-pattern guardrails (NÃO fazer)

1. **NÃO escrever audit linha antes do env validar.** A AC-1 exige "zero linhas no audit log" quando env é inválido — isto significa que o `createAuditAdapter` (que pode tocar disco para criar baseDir) **só deve ser invocado depois de env passar Zod**. A ordem no `bootstrap()` (env → db → audit) é estrita.
2. **NÃO usar `throw` em `parseEnv` ou helpers de `src/lib/env.ts`.** Result-based propagation. Throws apenas em boot-time failure categoria AO-66 #3, e mesmo aí `process.exit(1)` é preferível.
3. **NÃO criar persistent file handle no audit adapter** (já não tem, mas em refactor futuro tentação existirá). Shutdown não precisa fechar — confiar na O_APPEND semantics.
4. **NÃO usar `setTimeout` global** se shutdown precisar de watchdog 5s — injectar `clock.setTimeout()`. Esta story provavelmente não precisa (sequência síncrona é trivialmente <5s).
5. **NÃO tocar em `src/core/**`** — bootstrap/shutdown são SHELL, não DOMAIN. O Dep Graph Rigour test (`tests/ports/contracts.test.ts`) vai falhar se importares de adapters para `src/core/`. Para esta story tudo vive em `src/` raiz + `src/lib/`.
6. **NÃO assumir Litestream/Hono/worker prontos.** Estão fora de scope. Se sentes que falta algo, é porque vem em 1.c.1/1.c.3/2.1. Não tentar adiantar.
7. **NÃO modificar migrations 001/002 ou schema.ts** — não há razão para isso aqui. Se sentires que precisas, **pára e pede ao operador** — provavelmente é regression.
8. **NÃO usar `process.exit` dentro de `bootstrap()`** — devolve sempre `Result`. O `exit` só acontece em `main.ts`.
9. **NÃO assumir versão Zod** sem confirmar com `bun add zod@latest`. Em 2026-05-28, Zod 4.x é stable mas API muda subtilmente vs 3.x (e.g. `.error.issues` é `.error.errors` em 3.x). **Validar via type-check + test, não assumir.**
10. **NÃO escrever testes que dependam de `process.on("SIGTERM", ...)` real** — em Bun test runner, instalar listeners reais polui outros testes. Usar `shutdown.trigger()` directamente + mock `process.exit`. Em isolation E2E real-SIGTERM, ficar como follow-up (deferred).

### Testing strategy

- Co-located unit tests para `env.ts`, `shutdown.ts` (cada um ~3-5 specs) — se sair scope do `bootstrap.test.ts`. Default: tudo em `tests/bootstrap.test.ts` para minimizar overhead.
- Property tests via fast-check **opcionais** — AC-2 é "property AC" no spec mas a propriedade essencial (idempotência re-entrance + ordering) cobre-se com 2-3 deterministic specs. Adicionar fast-check só se houver tempo (não bloquear merge).
- Coverage target (Bun 1.3.14 não expõe branch coverage; line+func only): apontar >85% line nos 3 ficheiros novos.
- `bun test` full suite deve continuar verde — todas as 9 stories anteriores não regridem.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.a.7] — StorySpec + ACs canónicos.
- [Source: _bmad-output/planning-artifacts/architecture.md#Boot/shutdown-order-explícito-(D-04.16)] — sequência boot 7 passos + shutdown 5 passos canónica; esta story implementa subset alinhado a scope disponível.
- [Source: _bmad-output/planning-artifacts/architecture.md#D-04.5'] — Zod sobre process.env apenas, sem layered config v1.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-52] — envalid/Zod validation no boot — fail fast em env var faltante.
- [Source: _bmad-output/planning-artifacts/architecture.md#AO-66] — throw whitelist categories.
- [Source: docs/conventions/errors.md#Throw-whitelist] — categoria #3 (Boot-time failures) cobre exit(1) em main.
- [Source: _bmad-output/implementation-artifacts/story-1a5-summary.md] — db connection PRAGMA + migrations contract; commit-before-side-effect rule.
- [Source: _bmad-output/implementation-artifacts/story-1a6-summary.md] — audit adapter factory + no-persistent-fd design + fsync deliberately omitted.
- [Source: src/db/connection.ts] — `createDbConnection`, `applyMigrations` re-used by bootstrap.
- [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts] — `createAuditAdapter` factory re-used.
- [Source: src/adapters/clock/system-clock.adapter.ts] — `createSystemClockAdapter` default deps for bootstrap.
- [Source: src/ports/clock.port.ts, audit.port.ts] — port interfaces consumed by `BootResult` + `ShutdownDeps`.

### Project Structure Notes

Story alinha com layout actual `src/{core,ports,adapters,lib,db,services}/`. Novos ficheiros:
- `src/lib/env.ts` (NEW) — env Zod schema.
- `src/lib/shutdown.ts` (NEW) — SIGTERM handler factory.
- `src/bootstrap.ts` (UPDATE — substitui stub) — boot orchestration.
- `src/main.ts` (UPDATE — substitui stub) — top-level entry consuming bootstrap.
- `tests/bootstrap.test.ts` (NEW) — specs.

Sem variances vs architecture.

## Open Questions for Operator

> **Resolução em 2026-05-28** — todas em default Recommended via `AskUserQuestion` (4 questions; Q-A7-5 sem perguntar — assumido Recommended).

- **Q-A7-1 [RESOLVED — Minimal]** — `EnvSchema` scope: APENAS `ANTHROPIC_API_KEY: z.string().trim().min(1)`. Outras vars (HDD_DB_PATH, HDD_AUDIT_DIR, etc.) **não** entram nesta story; em bootstrap.ts usar defaults hardcoded (`./hdd.db`, `_bmad-output/audit`, `projeto_hdd`).

- **Q-A7-2 [RESOLVED — Latest stable]** — `bun add zod@latest`. Dev Agent regista versão exacta no Dev Agent Record. Type-check + tests adaptam-se à API actual (v3 vs v4 diff subtil: error.issues path).

- **Q-A7-3 [RESOLVED — Yes]** — emitir evento `"ProcessStarted"` (`audit.append({ type: "ProcessStarted", pid: process.pid, version: pkg.version, ... })`) ao fim do bootstrap, antes de `arm()` do shutdown handler. Liga audit chain desde o primeiro tick.

- **Q-A7-4 [RESOLVED — Yes]** — emitir evento `"ProcessStopped"` (`audit.append({ type: "ProcessStopped", reason })`) no shutdown handler antes de `db.close()`. Útil para postmortem.

- **Q-A7-5 [RESOLVED — default exit(1) directo]** — `main.ts` em err: `process.stderr.write(msg)` + `process.exit(1)`. Sem throw.

**Implicações para tasks (delta):**
- Task 2.2 → apenas `ANTHROPIC_API_KEY`.
- Task 4.2 step 3 → `emitProcessStartedEvent` default `true` em produção; tests podem override para `false`.
- Task 3.2 step 2 → `emitStoppedEvent` default `true` em produção; tests podem override.
- AC-1 spec (Task 6.1) — verificar que "zero linhas no audit log" ainda holds (env validation falha **antes** de `createAuditAdapter`, portanto baseDir nem é criado).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context).

### Debug Log References

- `bun add zod` → `zod@4.4.3` instalado; lockfile text format mantido.
- Lint cycle: 4 round-trips com `bun run lint:fix` (organizeImports + format auto-fix; `lint/complexity/useLiteralKeys` em `src/db/cli/migrate.ts:11` permanece como **info pré-existente não-blocker** — pre-existing 1.a.5 code, conflitua com `noPropertyAccessFromIndexSignature`; não toquei).
- Smoke test manual antes dos specs: `unset ANTHROPIC_API_KEY && bun run src/main.ts` → `"ANTHROPIC_API_KEY required"` no stderr + exit 1; happy path via inline `bun -e` → bootstrap OK + shutdown exit 0.
- Type-check pass com Zod v4 sem alterações ao código — API `safeParse().error.issues[].path` mantém-se igual a v3.
- `process.exit` mock pattern: substituí `spyOn(...).mockImplementation(...)` por manual `process.exit = (code) => { throw new Error("exit-called:N") }` + `originalExit` restore em `afterEach` para evitar leak `any` via `ReturnType<typeof spyOn>`.

### Completion Notes List

- **Scope honrado**: 4-de-7 boot steps + 3-de-5 shutdown steps (Litestream/Hono/worker loop ficam fora — 1.c.3/1.c.1/2.x).
- **AC-1 verde**: 3 specs em `parseEnv` (missing/empty/whitespace) + 2 specs em `bootstrap` (BootEnvInvalid + zero audit dir) + 1 timing spec (<500ms). Mensagem `"ANTHROPIC_API_KEY required"` em substring match. `audit/<project>/` nem é criado quando env falha (createAuditAdapter nunca corre).
- **AC-2 verde**: 4 specs em SIGTERM graceful: trigger() → ProcessStopped escrito + db.close + exit(0); timing <5s; re-entrance (duas chamadas → uma cleanup); `emitStoppedEvent=false` opt-out funciona.
- **Q-A7-3 + Q-A7-4 implementados**: defaults `emitProcessStartedEvent !== false` e `emitProcessStoppedEvent !== false` (i.e. ON unless explicit false). Tests provam ambos os events escritos no audit log via JSONL inspection.
- **bootRunId**: `randomUUID()` por boot, partilhado entre ProcessStarted + ProcessStopped (correlação postmortem).
- **Síncrono throughout**: descoberta crítica de meio de implementação — `AuditPort.append` retorna `Result<T,E>` sync (não `ResultAsync`). Corrigi `bootstrap()` e `shutdown.trigger()` para sync (esboço inicial assumira async). `main.ts` consome com `bootstrap()` directo sem `await`.
- **117 tests pass** (was 103; +14 novos). 0 regressões. Type-check + lint exit 0 (1 info pré-existente migrate.ts).
- **Linha counts**: bootstrap.ts 122 / env.ts 46 / shutdown.ts 84 / main.ts 41 — todos dentro do Biome 200-line hard cap.
- **Inconsistência epics.md ↔ architecture.md** documentada em Dev Notes (AR-019/037/039 vs D-04.x). Não-blocker; sai em próximo `docs:` consolidado (O-A6-6 acumula).

### File List

**Created (4):**
- `src/lib/env.ts` (46 linhas)
- `src/lib/shutdown.ts` (84 linhas)
- `tests/bootstrap.test.ts` (262 linhas)
- `_bmad-output/implementation-artifacts/story-1a7-summary.md` (criado em Task 7 — D-019 Tier-B obrigatório)

**Modified (3):**
- `src/bootstrap.ts` (de stub 9-line para 122 linhas — boot orchestration)
- `src/main.ts` (de stub 6-line para 41 linhas — entry point com fail-closed)
- `package.json` + `bun.lock` (zod@4.4.3 dep)

**Sprint tracking:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-a-7 backlog→ready-for-dev→in-progress→review)

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-05-28 | 0.1 | Story file criado por `bmad-create-story` (Sprint 0 Day 4) | Amelia (Dev Agent) |
| 2026-05-28 | 0.2 | Q-A7-1..5 resolvidas em default Recommended | Amelia (Dev Agent) |
| 2026-05-28 | 0.3 | Implementação Tasks 1-6 + tests verde + Status → review | Amelia (Dev Agent) |
| 2026-05-28 | 1.0 | Approve operador → Status done; commit pendente | Amelia (Dev Agent) |
