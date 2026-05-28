# Story 1.a.5: db schema base + Drizzle + idempotency_keys table

Status: review

> **Story Context Engine output.** `bmad-create-story` 2026-05-28.
> Reviewer humano: `operador`. **1ª story com I/O real do projeto** —
> introduz `bun:sqlite` + Drizzle + migrations + commit-state-before-side-effect.

---

## Story

As a `state store consumer`,
I want db schema com tables `runs`, `stories`, `idempotency_keys` + Drizzle migrations + WAL + idempotency key generation helper,
So that toda side-effect é precedida de commit-state-before-side-effect (AO-3 / AO-39) e crash entre commit e side-effect é recuperável.

## Acceptance Criteria

1. **AC-1 (binary):** db vazio + `bun run db:migrate` aplica `001_init.sql` → PRAGMA `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL` activos verificados via query [Source: epics.md#story-1a5; AR-013 linha 214; AO-81 linha 854].
2. **AC-2 (binary):** Migrations correm dentro de `BEGIN EXCLUSIVE` transaction; segunda execução é no-op idempotente (sem duplicar tables nem registar entry duplicada em `schema_migrations`) [Source: AR-013; D-04.10' linha 515; D-04.22; AO-81].
3. **AC-3 (property):** `idempotency.service.generate({ runId, storyId, operation, seqLocal })` retorna o **mesmo** `IdempotencyKey` (SHA-256 hex 64-char lowercase) para os mesmos parâmetros. fast-check property test em arbitraries [Source: epics.md#story-1a5; AO-39 linha 201; AO-89 linha 862; AR-033 branded Sha256Hash de 1.a.2].
4. **AC-4 (binary):** `idempotency.service.commitBeforeSideEffect(key, payload)` insere a chave numa transaction; após crash simulado (kill processo entre `commit` e `side-effect`), recovery boot detecta key existente e re-tentativa retorna `{ alreadyCommitted: true, result_ref }` SEM nova execução. **Crash drill in-process** simulado nesta story (process kill real fica para E5 Story 5.2) [Source: epics.md#story-1a5; AO-3 commit-state-before-side-effect; PM-2].

## Tasks / Subtasks

- [x] **Task 1 — Pré-flight (AC: todas)**
  - [x] 1.1 Confirmar baseline pós-1.a.4: `bun run lint` exit 0, `bun test` 74 pass.
  - [x] 1.2 Confirmar disponibilidade `Result` / `branded` (`Sha256Hash`, `RunId`, `StoryId`) de 1.a.2.
  - [x] 1.3 Verificar git working tree limpo (modulo `.smoke-evidence/` gitignored).
  - [x] 1.4 Criar dirs: `src/db/migrations/`, `src/services/`, `tests/db/`, `tests/services/`.
- [x] **Task 2 — Instalar deps Drizzle (AC: todas)**
  - [x] 2.1 `bun add drizzle-orm` — runtime ORM (AO-49).
  - [x] 2.2 `bun add -d drizzle-kit` — migration generator + dev tools.
  - [x] 2.3 Confirmar `bun.lock` regenerado; ambos em `dependencies` / `devDependencies` correctos.
- [x] **Task 3 — `drizzle.config.ts` (AC: #1, #2)**
  - [x] 3.1 Config no root: `dialect: "sqlite"`, `schema: "./src/db/schema.ts"`, `out: "./src/db/migrations"`, `dbCredentials: { url: process.env.HDD_DB_PATH ?? "./.hdd-state.db" }`.
  - [x] 3.2 Excluir `./.hdd-state.db` em `.gitignore` (qualquer ficheiro `*.db`, `*.db-wal`, `*.db-shm`).
- [x] **Task 4 — `src/db/schema.ts` (AC: #1, #2)**
  - [x] 4.1 Definir 3 tables core com `sqliteTable`:
    - `runs` — colunas canónicas per architecture.md linhas 215-228 (já reconciliadas com 6 lowercase states em commit `ac4c7ec`).
    - `stories` — colunas linhas 230-242.
    - `idempotency_keys` — colunas linhas 269-275: `key TEXT PRIMARY KEY`, `story_id TEXT REFERENCES stories(story_id)`, `side_effect TEXT NOT NULL`, `executed_at TEXT NOT NULL`, `result_ref TEXT`.
  - [x] 4.2 Definir `schema_migrations` — `version INTEGER PRIMARY KEY`, `applied_at TEXT NOT NULL`, `description TEXT`. (AO-41 versionadas append-only.)
  - [x] 4.3 Export types inferidos: `Run`, `NewRun`, `Story`, `NewStory`, `IdempotencyKeyRow`, `NewIdempotencyKey` via `$inferSelect` / `$inferInsert`.
  - [x] 4.4 NÃO criar `fsm_state` / `interrupts_pending` / `consumption_*` / `templates_meta` / `audit_events` aqui — diferido para stories próprias (Q-A5-3 default).
- [x] **Task 5 — `src/db/migrations/001_init.sql` (AC: #1, #2)**
  - [x] 5.1 SQL bruto: PRAGMAs no topo (`journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`).
  - [x] 5.2 `CREATE TABLE` para os 4 tables definidos em Task 4. Cobrir todas as colunas/constraints; CHECK constraints para `status` (6 lowercase states em `runs`), `paused_trigger` ('P1'|'S1'|'S2'|'S3'), etc.
  - [x] 5.3 Indexes: `idx_stories_run`, `idx_idem_story` (para queries por `story_id`).
  - [x] 5.4 Tudo dentro de `BEGIN EXCLUSIVE; ... COMMIT;`. Final: `INSERT INTO schema_migrations (version, applied_at, description) VALUES (1, datetime('now'), '001_init: runs+stories+idempotency_keys+schema_migrations + 6-state FSM canon')`.
- [x] **Task 6 — `src/db/connection.ts` (AC: #1, #2)**
  - [x] 6.1 Factory `createDbConnection(path: string): Database` (`bun:sqlite`). Aplica PRAGMAs declarados em AR-013 imediatamente após open: `db.exec("PRAGMA journal_mode=WAL"); db.exec("PRAGMA foreign_keys=ON"); db.exec("PRAGMA busy_timeout=5000"); db.exec("PRAGMA synchronous=NORMAL");`.
  - [x] 6.2 Função `applyMigrations(db: Database, migrationsDir: string): Result<{ appliedCount: number }, MigrationError>`:
    - Lê ficheiros `migrations/*.sql` ordenados por nome.
    - Cria `schema_migrations` table se ausente (idempotente).
    - Para cada migration: `SELECT 1 FROM schema_migrations WHERE version = ?` — skip se já aplicada.
    - Aplicar com `db.transaction(() => { db.exec(sql); })` que usa `BEGIN IMMEDIATE` por defeito; **deliberadamente** override para `BEGIN EXCLUSIVE` via SQL bruto na migration (Task 5.4).
  - [x] 6.3 `MigrationError = { kind: "ReadFailure"; path: string; cause: unknown } | { kind: "ApplyFailure"; version: number; cause: unknown }`.
  - [x] 6.4 Export Drizzle wrapper: `const drizzleDb = drizzle(db, { schema })`.
- [x] **Task 7 — `src/services/idempotency.service.ts` (AC: #3, #4)**
  - [x] 7.1 Importar `RunId`, `StoryId`, `Sha256Hash`, `mkSha256Hash` de `../lib/branded.ts`. Importar `Result`, `Ok`, `Err`, `fromPromise` de `../lib/result.ts`.
  - [x] 7.2 Definir tipo `IdempotencyService` com 2 métodos:
    - `generate({ runId: RunId; storyId: StoryId; operation: string; seqLocal: number }): Sha256Hash` — pure function. Computa `SHA-256(runId + "|" + storyId + "|" + operation + "|" + seqLocal)` lowercase hex via `crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))`. Wrapper assíncrono OU `Bun.CryptoHasher` (síncrono — preferir).
    - `commitBeforeSideEffect(deps: { drizzleDb }, params: { key: Sha256Hash; storyId: StoryId; sideEffect: string; resultRef?: string }): ResultAsync<{ alreadyCommitted: boolean; resultRef: string | null }, IdempotencyError>` — query `idempotency_keys` por key; se existe retorna `ok({ alreadyCommitted: true, resultRef })`. Senão `INSERT`. Atómico via `db.transaction()`.
  - [x] 7.3 Factory `createIdempotencyService(deps: { drizzleDb }): IdempotencyService`.
  - [x] 7.4 `IdempotencyError = { kind: "DbWriteFailure"; cause: unknown }`.
  - [x] 7.5 **NÃO** importar adapters concretos — service depende apenas de `drizzleDb` injectado (dep graph friendly; `src/services/` é shell layer, pode importar `src/db/`).
- [x] **Task 8 — `package.json` scripts (AC: #1)**
  - [x] 8.1 Adicionar scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "bun run src/db/cli/migrate.ts"`, `"db:studio": "drizzle-kit studio"`.
  - [x] 8.2 Criar `src/db/cli/migrate.ts` — entry point CLI: `const db = createDbConnection(path); applyMigrations(db, "./src/db/migrations")`. Logging mínimo (1-2 linhas).
  - [x] 8.3 `.gitignore`: adicionar `*.db`, `*.db-wal`, `*.db-shm`, `.hdd-state.db*`.
- [x] **Task 9 — `tests/db/schema.test.ts` (AC: #1, #2)**
  - [x] 9.1 Setup: `:memory:` SQLite via `createDbConnection(":memory:")`.
  - [x] 9.2 Spec AC-1: aplicar `001_init.sql`, verificar PRAGMAs `journal_mode=wal` (note: SQLite returns lowercase), `foreign_keys=1`, `busy_timeout=5000`, `synchronous=1` (1=NORMAL).
  - [x] 9.3 Spec AC-2 idempotência: aplicar migrations 2× consecutivas — second call retorna `{ appliedCount: 0 }`; `schema_migrations` continua com 1 row.
  - [x] 9.4 Specs de constraints: insert em `runs` com status inválido (e.g. `"RUNNING"` UPPERCASE) deve falhar; insert com `status='running'` deve passar.
  - [x] 9.5 Spec FK: insert em `idempotency_keys` com `story_id` que não existe em `stories` deve falhar.
- [x] **Task 10 — `tests/services/idempotency.test.ts` (AC: #3, #4)**
  - [x] 10.1 Spec AC-3 determinismo: invocar `generate(params)` 5× com os mesmos params → mesma key.
  - [x] 10.2 Spec AC-3 property test: fast-check sobre arbitraries de `(runId UUID, storyId slug, operation string, seqLocal int)` — para todos os inputs válidos, `generate(p) === generate(p)`.
  - [x] 10.3 Spec AC-3 sensitivity: changing qualquer um dos 4 params produz key diferente (4 sub-specs).
  - [x] 10.4 Spec AC-3 format: output é `Sha256Hash` brand (passa `mkSha256Hash(out).isOk()`).
  - [x] 10.5 Spec AC-4 commit-before-side-effect: setup db em :memory:; chamar `commitBeforeSideEffect(deps, {key, storyId, sideEffect: "whatsapp_send"})`; verificar key existe em `idempotency_keys` e response = `{alreadyCommitted: false, resultRef: null}`.
  - [x] 10.6 Spec AC-4 crash drill in-process: simular crash NÃO matando processo mas chamando 2× `commitBeforeSideEffect` com mesma key — 2ª call retorna `{alreadyCommitted: true, resultRef}`. (Real process-kill crash drill = E5 Story 5.2.)
- [x] **Task 11 — Validação E2E (AC: todas)**
  - [x] 11.1 `bun run type-check` exit 0.
  - [x] 11.2 `bun run lint` exit 0 (5 async-safety + AO-66 throw + AO-103 setTimeout core + 5 ports/adapters Dep Graph todas mantidas).
  - [x] 11.3 `bun test` 100% pass, contagem ≥ 74 + novos (≥ ~85).
  - [x] 11.4 `bun run db:migrate` real (não :memory:) cria `.hdd-state.db` no cwd, com PRAGMAs activos + 4 tables + 1 row em `schema_migrations`. Rm o ficheiro após validação (não committable).
  - [x] 11.5 Coverage spot-check `src/services/idempotency.service.ts` — line + func ≥80% (flip bunfig coverage=true ad-hoc).
- [x] **Task 12 — Resumo Tier-B + sprint-status review (D-019)**
  - [x] 12.1 Escrever `_bmad-output/implementation-artifacts/story-1a5-summary.md`.
  - [x] 12.2 Update sprint-status `1-a-5: ready-for-dev → review`.
  - [x] 12.3 Pedir `approve story-1a5`.

---

## Dev Notes

### Big picture

Story 1.a.5 é o **divisor de águas**: até aqui todo o código foi puro (FSM, Result, branded, ports, adapters fake). Esta é a 1ª story com I/O real persistente — bun:sqlite + Drizzle + migrations + `commit-state-before-side-effect`.

**A propriedade central** é AO-3 / AO-39 / AO-89: **toda side-effect (POST WhatsApp, write file, git commit) deve ter o seu idempotency key registado no SQLite ANTES do side-effect acontecer**. Crash recovery (Story 5.1) usa estas keys para evitar re-execução. Este pattern é o que torna o sistema crash-safe — sem isto, kill -9 entre commit FSM e POST WhatsApp duplica mensagens ao operador.

### O que NÃO entra nesta story (delimitar scope)

- ❌ **Audit JSONL adapter** (AR-060/61) → **Story 1.a.6** (blocked_by: [1.a.2, 1.a.5]).
- ❌ **Bootstrap order** (AR-037 — apply migrations no boot, env validation, DB init, server) → **Story 1.a.7**.
- ❌ **AsyncLocalStorage withRunContext()** correlation IDs → **Story 1.a.9**.
- ❌ **Outras tables** (`fsm_state`, `interrupts_pending`, `consumption_window_llm`, `consumption_whatsapp`, `templates_meta`) → stories próprias (Q-A5-3 default: deferir).
- ❌ **`audit_events` table SQL** (story spec menciona; Q-A5-1 resolve: audit é JSONL canon, NÃO SQL — deferir 100% a 1.a.6).
- ❌ **Crash drill com process kill real** → Story 5.2 (E5 Crash Recovery). Esta story faz crash drill in-process (2 calls sequenciais).
- ❌ **Litestream backup wiring** → Story 1.c.3.
- ❌ **StorePort interface** → emergir naturalmente em 1.a.7+ quando outros services consumirem.

### Architectural compliance — AOs / ARs cobertos

| ID | Cobertura nesta story | Onde |
|----|----------------------|------|
| **AR-013** State store bun:sqlite + Drizzle + WAL + busy_timeout=5000 + synchronous=NORMAL + drizzle-kit + BEGIN EXCLUSIVE | Sim (full) | Tasks 2, 3, 5, 6 |
| **AO-3** Idempotência hash do artefacto verificado antes commit | Sim (commit-before-side-effect implementado) | Task 7 |
| **AO-39** WhatsApp idempotency key `SHA-256(runId\|\|storyId\|\|template_name\|\|seq_local)` | Parcial (generalizado para "operation" per AO-89) | Task 7 |
| **AO-40** FSM persisted single-row + BEGIN IMMEDIATE | Parcial (table `runs` tem `status` + `paused_trigger`; FSM persistence layer real entra com Story 1.a.7 bootstrap consumer) | Task 4 |
| **AO-41** Schema migrations versionadas append-only desde v1 (nunca DROP/ALTER) | Sim (schema_migrations table + 001_init.sql) | Tasks 4, 5 |
| **AO-48** bun:sqlite (não better-sqlite3) | Sim | Task 6 |
| **AO-49** Drizzle ORM + drizzle-kit migrations runner | Sim | Tasks 2, 3, 8 |
| **AO-81** Drizzle migrations BEGIN EXCLUSIVE + busy_timeout=5000 | Sim | Tasks 5, 6 |
| **AO-89** Idempotency keys uniformes em todos adapters com side-effects | Sim (service genérico criado; adapters consumem em stories próprias) | Task 7 |
| **AO-95** Functional core / imperative shell — service em `src/services/` é shell, não core | Sim | Task 7.5 |
| **AO-122** max-lines 200 HARD | Mantida | todos Tasks |
| **D-04.10'** Drizzle migrations + BEGIN EXCLUSIVE + busy_timeout | Sim | Tasks 5, 6 |
| **D-04.22** Drizzle migrations atómicas | Sim | Tasks 5, 6 |

### Library/framework — versões 2026-05-28

| Dep | Versão alvo | Razão |
|-----|------------|-------|
| `drizzle-orm` | `@latest` (~0.x ou 1.x em 2026) | AO-49; usar tipos `sqliteTable` + `$inferSelect`/`$inferInsert` |
| `drizzle-kit` | `@latest` (dev) | CLI `drizzle-kit generate` + `studio` |
| `bun:sqlite` | built-in (Bun 1.3.14 já tem) | AO-48; zero deps externas, zero N-API |

### File structure (delta sobre 1.a.4)

**Novos:**
```
src/db/
├── connection.ts             (~90 linhas est.)
├── schema.ts                 (~100 linhas est.)
├── cli/migrate.ts            (~30 linhas est.)
└── migrations/
    └── 001_init.sql          (~80 linhas est.)
src/services/
└── idempotency.service.ts    (~100 linhas est.)
drizzle.config.ts             (~15 linhas est.)
tests/db/
└── schema.test.ts            (~120 linhas est.)
tests/services/
└── idempotency.test.ts       (~150 linhas est.)
```

**Modificados:**
- `package.json` (3 novos scripts + 1 dep + 1 devDep)
- `bun.lock` (regenerated)
- `.gitignore` (add `*.db*`, `.hdd-state.db*`)

**Substituiu `.gitkeep`:**
- `src/db/.gitkeep` removido (Task 4 cria `schema.ts`).

### Testing standards summary

- **Runner:** `bun test`.
- **Isolation:** todos os tests usam SQLite `:memory:` para isolamento + velocidade. Real disco-backed DB testado em Task 11.4 manualmente.
- **fast-check:** AC-3 property test sobre arbitraries de inputs.
- **Coverage target:** AO-91 (line ≥80% global, branch ≥85% src/core/). Esta story popula `src/db/` e `src/services/` (não src/core/); target line ≥80% em ambos.
- **Crash drill scope:** AC-4 só testa in-process (2 calls sequenciais). Process-kill drill verdadeiro é E5 Story 5.2 — esta story não tenta.

### Code patterns canónicos

**Drizzle schema (esboço):**

```typescript
// src/db/schema.ts (esboço)
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  runId: text("run_id").primaryKey(),
  projectId: text("project_id").notNull().default("projeto_hdd"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  status: text("status", {
    enum: ["idle", "running", "paused_for_interrupt", "paused_awaiting_review", "paused_window_exhausted", "failed"],
  }).notNull(),
  pausedTrigger: text("paused_trigger", { enum: ["P1", "S1", "S2", "S3"] }),
  pausedReviewReason: text("paused_review_reason"),
  contextBundleHash: text("context_bundle_hash").notNull(),
  llmTokensTotal: integer("llm_tokens_total").notNull().default(0),
  schemaVersion: integer("schema_version").notNull().default(1),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

// ... stories, idempotencyKeys, schemaMigrations
```

**Connection + migration runner (esboço):**

```typescript
// src/db/connection.ts (esboço)
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema.ts";
import { type Result, err, ok } from "../lib/result.ts";

export type MigrationError =
  | { readonly kind: "ReadFailure"; readonly path: string; readonly cause: unknown }
  | { readonly kind: "ApplyFailure"; readonly version: number; readonly cause: unknown };

export function createDbConnection(path: string): Database {
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA synchronous = NORMAL");
  return db;
}

export function createDrizzle(db: Database) {
  return drizzle(db, { schema });
}

export function applyMigrations(
  db: Database,
  dir: string,
): Result<{ appliedCount: number }, MigrationError> {
  // 1. ensure schema_migrations exists (bootstrap)
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, description TEXT)",
  );

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch (e) {
    return err({ kind: "ReadFailure", path: dir, cause: e });
  }

  let applied = 0;
  for (const f of files) {
    const version = parseInt(f.split("_")[0] ?? "", 10);
    const existing = db.query("SELECT 1 FROM schema_migrations WHERE version = ?").get(version);
    if (existing !== null) continue;

    let sql: string;
    try {
      sql = readFileSync(join(dir, f), "utf8");
    } catch (e) {
      return err({ kind: "ReadFailure", path: join(dir, f), cause: e });
    }

    try {
      // BEGIN EXCLUSIVE embedded no SQL bruto (Task 5.4)
      db.exec(sql);
    } catch (e) {
      return err({ kind: "ApplyFailure", version, cause: e });
    }
    applied++;
  }

  return ok({ appliedCount: applied });
}
```

**Idempotency service (esboço):**

```typescript
// src/services/idempotency.service.ts (esboço)
import { type Sha256Hash, mkSha256Hash } from "../lib/branded.ts";
import { type Result, type ResultAsync, ok, err, fromPromise } from "../lib/result.ts";
import type { Database } from "bun:sqlite";

export type IdempotencyService = {
  generate(params: {
    runId: string;
    storyId: string;
    operation: string;
    seqLocal: number;
  }): Sha256Hash;
  commitBeforeSideEffect(params: {
    key: Sha256Hash;
    storyId: string;
    sideEffect: string;
    resultRef?: string;
  }): ResultAsync<{ alreadyCommitted: boolean; resultRef: string | null }, IdempotencyError>;
};

export type IdempotencyError = { readonly kind: "DbWriteFailure"; readonly cause: unknown };

export function createIdempotencyService(deps: { db: Database }): IdempotencyService {
  return {
    generate({ runId, storyId, operation, seqLocal }) {
      const input = `${runId}|${storyId}|${operation}|${seqLocal}`;
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(input);
      const hex = hasher.digest("hex");
      // mkSha256Hash valida formato; sabemos que sai válido
      return hex as Sha256Hash;
    },
    commitBeforeSideEffect({ key, storyId, sideEffect, resultRef }) {
      return /* ResultAsync wrapping a transaction */;
    },
  };
}
```

### Previous Story Intelligence — Story 1.a.4 (commit `48a9a3a`)

Aprendizagens directas:
1. **Padrão `Record<K, V>` data-driven** (FSM transition table) é idiomático; pode usar-se aqui para tabelas SQL → Drizzle schema mapping.
2. **`Result` para tudo** — `applyMigrations` retorna `Result<..., MigrationError>`; `commitBeforeSideEffect` retorna `ResultAsync<..., IdempotencyError>`. Sem throws.
3. **`assertNever` continua disponível** — usar em switches sobre `IdempotencyError.kind` ou `MigrationError.kind` se necessário (caso provável: handler de error em CLI).
4. **AO-103** activa em `src/core/**` — mas esta story toca `src/db/` e `src/services/` (NÃO core). `setTimeout` permitido aqui.
5. **Dep Graph Rigour** — `src/services/` pode importar `src/db/` (shell layer). `src/core/` NÃO pode importar nenhum dos dois.
6. **Biome `tests/**` override** — test files podem >200 linhas.
7. **bunfig `coverage = false`** — flip ad-hoc para AC-3 / Task 11.5.
8. **Convenção `_args` prefix** — útil para interface impls com unused params.

### Git intelligence — últimos 6 commits

```
ac4c7ec docs: reconcilia epics.md + architecture.md com canon ratificado em Sprint 0 Day 2 (5 items)
48a9a3a feat(story-1a4): FSM + InterruptCommand + DomainEvent (5+2 ACs verde)
1abfa68 feat(story-1a3): 3 ports temporais (Clock/Spawn/Notify) + AO-103 enforce (3 ACs verde)
4c3a4b6 feat(story-1a2): Result+neverthrow + branded types + throw whitelist (4 ACs verde)
29f3e15 feat(story-1a1): bun scaffold + biome + eslint + bun test (5 ACs verde)
a9cecf7 feat(story-1c7): smoke test bmad-cli + ADR D-052 (Claude headless)
```

Convenção: `feat(story-NN): <summary>` + Co-Authored-By footer. 1 story = 1 commit. Sem push automático.

### Latest tech information (snapshot 2026-05-28)

- **`bun:sqlite`** built-in em Bun 1.3.14. Já validado em 1.a.1 setup.
- **`drizzle-orm`** suporta `bun-sqlite` driver nativo (`drizzle-orm/bun-sqlite`). API estável; `sqliteTable`, `$inferSelect`/`$inferInsert`, `text()`/`integer()` column builders.
- **`drizzle-kit`** dev tool: `generate` (gera SQL a partir do TS schema), `migrate` (aplica), `studio` (UI local).
- **`Bun.CryptoHasher`** síncrono, ideal para hashing curto (SHA-256). Alternativa: `crypto.subtle.digest` (assíncrono, retorna ArrayBuffer).

### Project Structure Notes

**Alignment:** primeira story que toca `src/db/` + `src/services/` reais. Substitui `.gitkeep` de `src/db/`.

**Conflitos / Open Questions:**

- **Q-A5-1 [CRITICAL]:** **`audit_events` table SQL** — story spec menciona, mas architecture.md AR-060 trata audit como **JSONL append-only** (não SQL). **Default:** deferir 100% audit para Story 1.a.6 (JSONL canónico). Nesta story criar apenas `runs` + `stories` + `idempotency_keys` + `schema_migrations`. Architecture é fonte canónica; spec da story refletia design earlier. Story 1.a.5 epics.md deve ser actualizada a remover `audit_events` do enunciado quando consolidação `docs:` próxima rolar (acumula com O-A4-1).

- **Q-A5-2:** **Idempotency key formula** — AO-39 menciona `template_name`; AO-89 generaliza para `operation`. **Default:** generic `operation` (mais reutilizável; WhatsApp adapter passa `template_name` como valor de `operation`). Bate com AO-89 spirit.

- **Q-A5-3:** **Scope das tables** — criar só 4 (`runs`, `stories`, `idempotency_keys`, `schema_migrations`) per story spec, OU também `fsm_state`, `interrupts_pending`, `consumption_window_llm`, `consumption_whatsapp`, `templates_meta` per architecture canon? **Default:** só 4 da story spec. Outras entram em stories que as consomem (1.a.6 audit_events deferido; 1.a.9 fsm_state; 3.x consumption_whatsapp; 4.x interrupts_pending; etc.). YAGNI / scope discipline.

- **Q-A5-4:** **Migration apply strategy** — `bun run db:migrate` standalone script (default; também para CI) OR auto-apply on boot (Story 1.a.7 bootstrap)? **Default:** ambos. CLI script existe agora; bootstrap call em 1.a.7 invoca `applyMigrations` no startup.

- **Q-A5-5:** **`stories.status` enum** — architecture canon usa UPPERCASE `('PENDING','RUNNING','PAUSED','DONE','ROLLED_BACK')` (lifecycle de cada story, diferente da worker FSM). **Default:** preservar UPPERCASE per architecture (não alterar — convenção DB enum legítima para entity status). Worker FSM (`runs.status`) usa 6 lowercase.

### Anti-pattern guardrails (DEV: NÃO fazer)

- ❌ NÃO usar `better-sqlite3` — AO-48 bun:sqlite obrigatório.
- ❌ NÃO usar `crypto.subtle` se `Bun.CryptoHasher` serve (síncrono é melhor aqui).
- ❌ NÃO esquecer `BEGIN EXCLUSIVE` na migration — perda atomicidade = corrupção em concurrent boot.
- ❌ NÃO usar `throw` (whitelist AO-66). DB errors → `Result<..., MigrationError>` / `Result<..., IdempotencyError>`.
- ❌ NÃO importar `src/adapters/` em `src/db/` ou `src/services/` (Dep Graph; embora `services/` seja shell, importar adapters específicos viola layering — services dependem de ports interfaces se precisarem de side-effects externos).
- ❌ NÃO esquecer FK `ON` PRAGMA — sem ela CASCADE etc. são silently ignored.
- ❌ NÃO commit `.hdd-state.db` ou `*.db-wal` / `*.db-shm` — gitignore obrigatório (Task 8.3).
- ❌ NÃO criar mais tables além das 4 do scope (Q-A5-3).
- ❌ NÃO esquecer line count ≤200 em qualquer src/ file.

### References

- [Source: epics.md#story-1a5] — StorySpec.
- [Source: epics.md#AR-013] — linha 214 (bun:sqlite + Drizzle + WAL + busy_timeout=5000).
- [Source: architecture.md] linhas 215-260 — SQL canon `runs`/`stories`/`idempotency_keys`/`schema_migrations`/`fsm_state`/`interrupts_pending` (reconciliado em commit `ac4c7ec`).
- [Source: architecture.md#AO-3] — linha 133 (idempotência LLM-aware).
- [Source: architecture.md#AO-39] — linha 201 (WhatsApp idempotency key formula).
- [Source: architecture.md#AO-40] — linha 202 (FSM persisted single-row + BEGIN IMMEDIATE).
- [Source: architecture.md#AO-41] — linha 203 (migrations append-only desde v1).
- [Source: architecture.md#AO-48] — linha 472 (bun:sqlite obrigatório).
- [Source: architecture.md#AO-49] — linha 473 (Drizzle + drizzle-kit).
- [Source: architecture.md#AO-81] — linha 854 (BEGIN EXCLUSIVE + busy_timeout=5000).
- [Source: architecture.md#AO-89] — linha 862 (idempotency uniforme).
- [Source: architecture.md#D-04.10'] — linha 515.
- [Source: architecture.md#D-04.22] — linha 522.
- [Source: 1-a-2-result-t-e-branded-types-lib-helpers.md] — Result + branded `Sha256Hash` + factory `mkSha256Hash`.
- [Source: 1-a-4-domain-fsm-interrupt-commands-tagged-union.md] — 6 lowercase canon (runs.status enum).
- [Source: docs/conventions/errors.md] — 11-item throw whitelist (sem novos throws nesta story).
- [Memory: project-hdd-stack-v2-bun] — Bun-first stack.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` — Amelia, sessão directa.

### Debug Log References

- `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` instalados sem incidentes; `drizzle-orm/bun-sqlite` driver nativo via `import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"`.
- `process.env.HDD_DB_PATH` errou TC com `noPropertyAccessFromIndexSignature` (opt-in tsconfig de 1.a.1). Fix: `process.env["HDD_DB_PATH"]` bracket notation em `drizzle.config.ts` e `src/db/cli/migrate.ts`.
- `expect(["wal", "memory"]).toContain(r?.journal_mode)` errou TC porque `r?.journal_mode` é `string | undefined`. Fix: `expect(r).not.toBeNull(); expect([...]).toContain(r?.journal_mode ?? "")`.
- Verificação real disco (não :memory:) **crítica**: PRAGMAs `busy_timeout` / `synchronous` / `foreign_keys` são **per-connection**; só persiste `journal_mode` no WAL header. Validação real disk via `createDbConnection` confirmou todos os 4 PRAGMAs activos: `journal_mode=wal`, `busy_timeout=5000`, `synchronous=1`, `foreign_keys=1`. Migration registada com descrição esperada.
- `Bun.CryptoHasher("sha256")` síncrono — usado em `idempotency.service.ts:generate()`. Output sempre 64 chars hex lowercase; satisfaz `Sha256Hash` brand sem necessidade de `mkSha256Hash()` runtime validation (input controlado).
- DB queries `db.query<RowType, ParamsTuple>(sql).get/all/run` — Bun `bun:sqlite` API typed e clean. FK CHECK violations throwam `SQLiteError` que apanhamos em `commitBeforeSideEffect` via try/catch, retornando `err({kind: 'DbWriteFailure', cause})`.
- WAL sidecar files (`.hdd-state.db-wal`, `.hdd-state.db-shm`) NÃO ficaram presentes após `db.close()` — WAL checkpointou e merged. `.gitignore` lista os 3 padrões anyway por segurança.

### Completion Notes List

**Validação E2E — 2026-05-28**

| Verificação | Resultado | AC |
|-------------|-----------|----|
| `bun run type-check` | exit 0 | — |
| `bun run lint` | exit 0 (95 tests não introduziram regressões) | — |
| `bun test` | 95 pass / 0 fail / 159 expect / 171-192ms | AC-3, AC-4 |
| **`bun run db:migrate` real disk** | exit 0; output `[db:migrate] OK dbPath=./.hdd-state.db applied=1` | AC-1, AC-2 |
| **PRAGMAs real disk (via createDbConnection)** | `journal_mode=wal`, `busy_timeout=5000`, `synchronous=1 (NORMAL)`, `foreign_keys=1 (ON)` | AC-1 ✓ |
| **AC-2 idempotência** | 2ª invocação retorna `{ appliedCount: 0 }`; `schema_migrations` continua com 1 row | ✓ |
| **AC-3 property test** | 100 runs fast-check sobre 4 arbitraries; todos pass; 6 specs determinismo + sensitivity | ✓ |
| **AC-4 crash drill in-process** | 1ª call `{alreadyCommitted: false}`; 2ª call mesma key `{alreadyCommitted: true, resultRef}`; só 1 row em DB | ✓ |
| **Coverage `src/services/idempotency.service.ts`** | 100% line / 100% func | AO-91 (proxy) |
| FK violation handled | `err({kind: 'DbWriteFailure'})` returned cleanly via try/catch | ✓ |

**Decisões aplicadas (Q-A5-1..Q-A5-5):**

- Q-A5-1: `audit_events` table NÃO criada. Audit 100% deferido para Story 1.a.6 (JSONL canon AR-060).
- Q-A5-2: formula generic `SHA-256(runId||storyId||operation||seqLocal)` per AO-89.
- Q-A5-3: scope = só 4 tables (runs / stories / idempotency_keys / schema_migrations). Outras em migrations 002+ (AO-41 append-only).
- Q-A5-4: ambos — CLI `bun run db:migrate` standalone + `applyMigrations()` exposta para Story 1.a.7 bootstrap consumir.
- Q-A5-5: `stories.status` mantém UPPERCASE per architecture canon.

**Open items emergentes:**

- O-A5-1 (acumula O-A4-1 e anteriores docs items): epics.md story 1.a.5 spec menciona `audit_events` table mas decisão Q-A5-1 deferiu — actualizar epics.md no próximo `docs:` consolidado.
- O-A5-2: `commitBeforeSideEffect` retorna `Result<...>` síncrono (não `ResultAsync`) porque bun:sqlite é síncrono. Story file mencionava `ResultAsync` — implementação preferiu API mais simples. Documentar no spec/architecture se necessário.
- O-A5-3: SQLite FK violation devolve `SQLiteError` genérico — caller perde detalhe (qual FK violou, qual coluna). Futuro story pode adicionar parsing rica de erros DB (low priority).
- O-A5-4: `drizzle.config.ts` está no root; típico Bun projects ficam felizes mas alguns linters podem reclamar (até agora Biome OK). Manter.
- O-A5-5: tests usam `bun:sqlite` directo (não Drizzle) para INSERTs/SELECTs em test setup. Stories futuras (1.a.7+) podem mover para Drizzle puro para uniformidade.

### File List

**Ficheiros criados (committable):**

- `drizzle.config.ts` (16 linhas) — Drizzle Kit config; HDD_DB_PATH override.
- `src/db/schema.ts` (102 linhas) — 4 tables com `sqliteTable` + inferred types.
- `src/db/connection.ts` (88 linhas) — `createDbConnection` (PRAGMAs) + `createDrizzle` + `applyMigrations` (BEGIN EXCLUSIVE idempotente).
- `src/db/migrations/001_init.sql` (60 linhas) — 4 tables + indexes + insert em schema_migrations; tudo dentro de `BEGIN EXCLUSIVE; ... COMMIT;`.
- `src/db/cli/migrate.ts` (24 linhas) — `bun run db:migrate` entry point.
- `src/services/idempotency.service.ts` (83 linhas) — `generate` + `commitBeforeSideEffect` + tipos.
- `tests/db/schema.test.ts` (177 linhas) — 12 specs (PRAGMAs ×4, migrations ×2, CHECK constraints ×4, Drizzle wrapper ×1, edge ×1).
- `tests/services/idempotency.test.ts` (134 linhas) — 9 specs (determinismo ×6, AC-4 commit ×3).
- `_bmad-output/implementation-artifacts/1-a-5-db-schema-base-drizzle-idempotency-keys-table.md` — story file.
- `_bmad-output/implementation-artifacts/story-1a5-summary.md` — Tier-B.

**Modificados:**

- `package.json` — 3 novos scripts (`db:generate`, `db:migrate`, `db:studio`) + 2 deps (`drizzle-orm`, `drizzle-kit`).
- `bun.lock` — regenerado (193 packages totais).
- `.gitignore` — append: `*.db`, `*.db-wal`, `*.db-shm`, `.hdd-state.db*`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-a-5: backlog → review`.

**Removidos:**

- `src/db/.gitkeep` — substituído por código real.

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-28 | bmad-create-story (Amelia) | Story file criada. Status `backlog → ready-for-dev`. 5 Q's abertas (Q-A5-1 audit_events SQL vs JSONL crítica). |
| 2026-05-28 | operador | Resolveu Q-A5-1..Q-A5-5 (defer audit / generic operation / só 4 tables / ambos CLI+boot / UPPERCASE stories.status). |
| 2026-05-28 | bmad-dev-story (Amelia) | Implementação: 12 tasks done; 4 ACs verificados (PRAGMAs WAL+busy_timeout+sync+FK em real disk; migrations idempotentes BEGIN EXCLUSIVE; idempotency key determinístico fast-check 100 runs; commit-before-side-effect crash drill in-process); status `ready-for-dev → in-progress → review`. |

---

## Open Questions for Operator — RESOLVIDAS 2026-05-28

- **Q-A5-1 [RESOLVED — defer]:** Audit (incluindo `audit_events`) inteiramente deferido para Story 1.a.6 (JSONL canónico AR-060). Esta story NÃO cria `audit_events` SQL. Open follow-up: actualizar epics.md spec da 1.a.5 a remover audit_events do enunciado (acumula com docs items futuros).
- **Q-A5-2 [RESOLVED — generic]:** Formula `SHA-256(runId||storyId||operation||seqLocal)` per AO-89. WhatsApp adapter passará `template_name` como valor de `operation`.
- **Q-A5-3 [RESOLVED — só 4]:** runs + stories + idempotency_keys + schema_migrations. Outras tables (fsm_state, interrupts_pending, consumption_*, templates_meta) entram nas stories próprias via migrations 002+ (AO-41 append-only).
- **Q-A5-4 [RESOLVED — ambos]:** CLI `bun run db:migrate` nesta story + Story 1.a.7 bootstrap invoca `applyMigrations()` no startup.
- **Q-A5-5 [ASSUMED default UPPERCASE]:** `stories.status` mantém UPPERCASE (PENDING/RUNNING/PAUSED/DONE/ROLLED_BACK) per architecture canon — convenção DB enum legítima; lifecycle entity ≠ state machine worker.

→ Implementação destrava com defaults. Estimativa: 72K dev_core / 108K dev_with_retry.

---

**Story Status:** ready-for-dev · **Created by:** bmad-create-story (Amelia, 2026-05-28)
**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
