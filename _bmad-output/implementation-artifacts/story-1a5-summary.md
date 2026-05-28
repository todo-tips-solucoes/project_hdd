# Story 1.a.5 — db schema base + Drizzle + idempotency_keys · projeto_hdd · 2026-05-28

> Resumo Tier-B (D-019 obrigatório). Reviewer: operador. Status: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 3, 5ª story implementacional do Epic 1.a (8ª total nesta sequência). **1ª story com I/O real**: introduz `bun:sqlite` + Drizzle + migrations + WAL + commit-state-before-side-effect (AO-3/AO-89 — propriedade central que torna o sistema crash-safe).

## O que foi feito

- **`drizzle.config.ts` (16 linhas)** — Drizzle Kit config; `HDD_DB_PATH` env override (defaults `./.hdd-state.db`).
- **`src/db/schema.ts` (102 linhas)** — 4 tables Drizzle-typed: `runs` (6 lowercase states canon + paused_trigger metadata), `stories` (UPPERCASE entity lifecycle), `idempotency_keys`, `schema_migrations`. Inferred `Run`/`NewRun`/`Story`/etc.
- **`src/db/connection.ts` (88 linhas)** — `createDbConnection` aplica PRAGMAs (WAL + foreign_keys + busy_timeout=5000 + synchronous=NORMAL). `applyMigrations` lê `migrations/*.sql` ordenados, skip se já em `schema_migrations`, aplica via `db.exec` (cada migration usa `BEGIN EXCLUSIVE; ... COMMIT;` interno). Retorna `Result<{ appliedCount }, MigrationError>`.
- **`src/db/migrations/001_init.sql` (60 linhas)** — 4 CREATE TABLE + 2 indexes + `INSERT INTO schema_migrations`. Tudo dentro de `BEGIN EXCLUSIVE; ... COMMIT;`. Idempotente via `IF NOT EXISTS`.
- **`src/db/cli/migrate.ts` (24 linhas)** — `bun run db:migrate` entry point.
- **`src/services/idempotency.service.ts` (83 linhas)** — `generate` (SHA-256 via `Bun.CryptoHasher`) + `commitBeforeSideEffect` (try/catch sobre `db.query.run`). `Result<...>` síncrono (bun:sqlite é síncrono).
- **`tests/db/schema.test.ts` (177 linhas, 12 specs)** — PRAGMAs ×4, migrations idempotência ×2, CHECK constraints ×4 (incluindo `runs.status` rejeita UPPERCASE, `stories.status` aceita UPPERCASE), FK violation ×1, Drizzle wrapper sanity ×1.
- **`tests/services/idempotency.test.ts` (134 linhas, 9 specs)** — determinismo ×6 (incluindo fast-check property 100 runs) + crash drill in-process ×3.
- **`package.json`** — +3 scripts (`db:generate`, `db:migrate`, `db:studio`) + 2 deps (`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`).
- **`.gitignore`** — append: `*.db`, `*.db-wal`, `*.db-shm`, `.hdd-state.db*`.
- **`sprint-status.yaml`** — `1-a-5: backlog → review`.
- **`src/db/.gitkeep`** removido.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Defer `audit_events` SQL 100% para 1.a.6 (JSONL canon) | AR-060 estabelece audit como JSONL append-only. Spec da story mencionava table SQL mas arch é canon. Reduz scope. | Q-A5-1 |
| 2 | Formula idempotency `SHA-256(runId||storyId||operation||seqLocal)` | AO-89 generic; WhatsApp passa template_name como operation. Reutilizável. | Q-A5-2 |
| 3 | Scope = só 4 tables (runs/stories/idempotency_keys/schema_migrations) | YAGNI. Outras 6+ tables entram em migrations 002+ nas stories que as consomem. | Q-A5-3 |
| 4 | Migration apply: CLI + auto-boot (ambos) | `bun run db:migrate` para dev/CI; `applyMigrations()` exposta para 1.a.7 bootstrap. | Q-A5-4 |
| 5 | `stories.status` UPPERCASE per architecture | DB enum convention para entity lifecycle; distinta da worker FSM (runs.status lowercase). | Q-A5-5 |
| 6 | `Result<...>` síncrono em `commitBeforeSideEffect` (não `ResultAsync`) | bun:sqlite é síncrono nativo; ResultAsync seria wrapping artificial. Caller-friendly. | (in-story) |
| 7 | `Bun.CryptoHasher` em vez de `crypto.subtle.digest` | Síncrono (vs async ArrayBuffer); 1-line API; Bun-native. | (in-story) |
| 8 | PRAGMAs via `db.exec` em `createDbConnection` em vez de pragma config object | Compatível com bun:sqlite + Drizzle wrapper; per-connection enforcement reliable. | (in-story) |
| 9 | Tests usam `bun:sqlite` raw para INSERT/SELECT no setup (não Drizzle) | Mais directo para test seed; Drizzle pattern testado em wrapper sanity spec. | (in-story) |
| 10 | `MIGRATION_FILENAME_RE = /^(\d+)_.+\.sql$/` enforced | Garante naming convention `NNN_descricao.sql`. Erros precoces na CLI. | (in-story) |

## Trade-offs aplicados

- **Quis ResultAsync para uniformidade FP, escolhi Result síncrono:** bun:sqlite é síncrono. ResultAsync wrap artificial. Caller usa await trivialmente noutros caminhos; aqui pura função pode usar try/catch interno.
- **Quis drizzle migrate via drizzle-kit (auto-generate SQL), escolhi raw SQL handcrafted:** drizzle-kit `generate` gera SQL útil mas não permite directives como `BEGIN EXCLUSIVE` no início — pattern AO-81 requer SQL bruto. Tomei controlo manual.
- **Quis testes real-disk (file fs), escolhi `:memory:` para isolation + 1 spec real-disk em Task 11.4:** velocidade + paralelismo. Real-disk apenas em manual validation; CI corre :memory:.

## Open items deferidos

- **O-A5-1 (acumula O-A4-1 e anteriores docs):** epics.md story 1.a.5 spec menciona `audit_events` — actualizar próximo `docs:` consolidado.
- **O-A5-2:** spec mencionava `ResultAsync` em `commitBeforeSideEffect`; implementação ficou `Result` síncrono. Documentar no spec se necessário.
- **O-A5-3:** SQLite FK violation devolve `SQLiteError` genérico — futuro story pode parsear (low priority).
- **O-A5-4:** `drizzle.config.ts` no root (típico) — Biome OK, alguns linters reclamam de configs no root.
- **O-A5-5:** test seeds usam SQL raw (não Drizzle) — uniformizar em stories futuras se pattern repetir.

## Reviewer findings

N/A — gate pendente.

## Métricas

- Janela LLM: ~40% Opus.
- Duração: ~2h elapsed (story mais substancial até agora).
- Tasks: 12/12 completed.
- ACs cobertos: **4/4 ✓** — AC-1 PRAGMAs (validado real disk via createDbConnection) · AC-2 BEGIN EXCLUSIVE idempotente · AC-3 property test determinismo (100 runs) · AC-4 commit-before-side-effect crash drill in-process.
- Tests: 95 pass / 0 fail / 159 expect() / 192ms wall-clock (+21 novos: 12 schema + 9 idempotency; -0 removidos; era 74).
- Coverage `src/services/idempotency.service.ts`: 100% line / 100% func. `src/db/connection.ts` indirectamente coberto via schema tests.
- Files: 8 novos src + 2 test files + 4 modificados + 1 removido.
- LOC novo: ~373 src (drizzle.config 16 + schema 102 + connection 88 + migration 60 + cli 24 + idempotency 83) + ~311 tests = ~684 LOC.
- Decisões registadas: 10 (5 humanas Q-A5-1..5 + 5 técnicas in-story).
- Dependencies: +2 (`drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`) + ~16 transitive. 193 packages totais.
- Capacity: 6ª story numa sequência (1.c.7 + 1.a.1..1.a.5). Sprint 0 = 22 stories → 16 restantes. Já fizemos mais de uma semana inteira (Cenário B Expected D-046 6-7/sem).

## Próximos passos sugeridos

1. **Operador aprova** com `approve story-1a5` → marco done + commit dos ~15 ficheiros (sem push). Mensagem proposta: `feat(story-1a5): db schema base + Drizzle + idempotency_keys (4 ACs verde; 1ª story com I/O real)`.
2. **Story 1.a.6 — Audit JSONL adapter + hash chain + RFC 3161 stub** — próxima na ordem (`blocked_by: [1.a.2, 1.a.5]` ambos done agora). Introduz `src/adapters/audit/jsonl-hash-chain.adapter.ts` + `src/ports/audit.port.ts`. Hash chain SHA-256 + O_APPEND + rotação. RFC 3161 timestamp tokens (stub diário).
3. **Em paralelo (opcional):** push origin antes de 1.a.6 — `git push origin main` leva os 6 commits actuais (1.a.4 + docs + 1.a.5 a chegar). Útil para visibility.

→ Aprovar: `approve story-1a5` · Pedir alterações: `request-changes story-1a5 <razão>`
