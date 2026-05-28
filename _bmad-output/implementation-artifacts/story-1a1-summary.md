# Story 1.a.1 — Bun base scaffold + linting + test runner · projeto_hdd · 2026-05-28

> Resumo Tier-B (D-019 obrigatório). Gerado manualmente porque
> `summary-generator.service` ainda não existe (Story 1.a.8). Reviewer humano: operador.
> Status até aprovação: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 1+1, 1ª story implementacional foundational do Epic 1.a — Runtime Scaffold & Core Contracts. Entrega o esqueleto (Bun 1.3+, Biome, ESLint typescript-eslint, `bun test`, tsconfig strict) que as 47 stories restantes assumem como dado adquirido. Primeira story corrida pelo workflow canónico BMAD `bmad-create-story` → `bmad-dev-story` (Story 1.c.7 foi operator-directed sem create-story).

## O que foi feito

- **`package.json` (hdd-worker)** — bin entry `hdd-worker → ./dist/hdd-worker`, 8 scripts (`dev`, `build`, `test`, `test:coverage`, `lint`, `lint:fix`, `format`, `type-check`), `engines.bun >= 1.3.0`, 4 devDeps.
- **`bun.lock`** — committable (text format default Bun 1.3+); 94 packages após cold install.
- **`bunfig.toml`** — test runner + coverage thresholds AO-91 (line/function/statement ≥80%; effective quando houver source code).
- **`tsconfig.json`** — strict mode completo + 3 flags opt-in extra (`exactOptionalPropertyTypes`, `noUnusedLocals`, `noPropertyAccessFromIndexSignature`).
- **`biome.json`** — Biome 2.4.16, formatter + linter recommended + `noExcessiveLinesPerFile: { maxLines: 200 }` (AO-122 HARD).
- **`eslint.config.js`** — flat config (Q-2 resolved), typescript-eslint v8.60, `recommendedTypeChecked` + 5 regras async-safety explicitas como `error` (Q-1 union AR-018 ∪ AO-50).
- **`README.md`** — overview HDD, stack table, comandos, runtime requirements (incluindo `claude` CLI ≥ 2.1.x per D-052).
- **`src/{main.ts, bootstrap.ts}`** — stubs; subdirs `src/{core, ports, adapters, lib, db}/` com `.gitkeep` para preservar estrutura AR-002.
- **`tests/scaffold.test.ts`** — 2 smoke tests confirmam que `bun test` descobre `**/*.test.ts`; `tests/integration/*.sh` (Story 1.c.7) explicitamente NÃO apanhado.
- **`.gitignore`** — append `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.smoke-evidence/` (resolve O-1 herdado de 1.c.7).
- **`sprint-status.yaml`** — `1-a-1: backlog → review`, `epic-1a: backlog → in-progress`.
- **`_bmad-output/implementation-artifacts/1-a-1-bun-base-scaffold-linting-test-runner.md`** — story file completo (Acceptance Criteria, Tasks/Subtasks, Dev Notes, Dev Agent Record, File List, Change Log) com **TODAS as 11 tasks marcadas `[x]`**.
- **Este Resumo Tier-B**.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Habilitar **5 regras** async-safety (não 4) | Q-1: AR-018 (epics) e AO-50 (architecture) discordavam no 3º item; union elimina debate e custa zero. Trade-off: ligeiro overhead em legacy code se importarmos `any`-typed libs — aceitável para greenfield | (Q-1 / pendente ADR) |
| 2 | `eslint.config.js` flat config | Q-2: typescript-eslint v8+ standard. Rejeitada `.eslintrc.json` (legacy). Trade-off: `files_created` da story spec lista nome antigo → open item O-A1 para actualizar epics.md | (Q-2) |
| 3 | Defer pre-commit hook (AO-150) para Story 1.c.4 | Q-3: scope de 1.a.1 já lotado; CI story (1.c.4) é home natural do hook. Trade-off: janela onde author pode bypassar max-lines manualmente em commits locais (operator solo, risco baixo) | (Q-3) |
| 4 | `bun init -y` no cwd (não `bun create hono@latest hdd-worker`) | Q-4: repo já existe; sub-dir partiria layout. Hono entra explicitamente em Story 1.a.7/1.c.1. Trade-off: arquitectura linha 482 menciona o comando literal — open item O-A3 para confirmar nas stories seguintes | (Q-4) |
| 5 | Adoptar `bun.lock` (text) em vez de `bun.lockb` (binary) | Bun 1.3+ default text format; `bun.lockb` referido na story spec é nomenclatura legacy. Committable, diffável, reproducível | (in-story) |
| 6 | `@types/bun` em vez de `bun-types` | `bun init` instalou `@types/bun@1.3.14` — é o nome canónico actual. `bun-types` era nome legacy | (in-story) |
| 7 | Adicionar 3 flags TS opt-in (`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noPropertyAccessFromIndexSignature`) além do `strict` | Custo zero hoje (zero código), benefício significativo em escala. Alinha com filosofia AR-030 (no throw, branded types, errors first). Trade-off: pode forçar mais `_` prefix em params unused | (in-story) |

## Trade-offs aplicados

- **Quis literal "AC says 4 rules", escolheu "5 rules"**: o operador validou Q-1 union em vez de eleger uma das versões. Custou zero, ganhou previsibilidade. Implica reconciliação futura nos docs (O-A2).
- **Quis `bun.lockb` per story spec, ficou com `bun.lock`**: o tooling moderno mudou debaixo da arquitectura. Em vez de forçar binary lockfile (passar `--save-text-lockfile=false`), aceitei o default que é objectivamente melhor (diffável). Documentar em O-A1 / O-A3.
- **Quis adicionar Husky agora, deferi para 1.c.4**: respeitar Q-3 + scope de 1.a.1 já era pesado. Em troca: 1.a.1 fica genuinamente foundational sem features escondidas.
- **Quis correr `tsc` strict-everything desde o início, fiz**: 3 flags extra. Custo zero hoje (sem código real), benefício enorme em 1.a.2+ (Result<T,E> + branded types beneficiam directamente de `exactOptionalPropertyTypes` e `noPropertyAccessFromIndexSignature`).

## Open items deferidos

- **O-A1:** actualizar `files_created` Story 1.a.1 em `epics.md` linha 653: `.eslintrc.json` → `eslint.config.js`. Trivial.
- **O-A2:** reconciliar AR-018 (epics) ∪ AO-50 (architecture) como union de 5 regras nos docs canónicos. Pode ser ADR breve ou edit silencioso. Resolver na Story 1.c.4 (CI consolida lint config) ou imediato via `bmad-edit-prd` / `bmad-correct-course`.
- **O-A3:** confirmar adopção de Hono em Story 1.a.7 (bootstrap) ou Story 1.c.1 (server) — actualmente sem dep `hono`. Mencionar no respectivo Dev Notes quando essa story for criada.
- **O-A4:** `typescript@5.9.3` vs disponível `6.0.3` — Renovate (Story 1.c.4) ditará política. Por agora 5.x.
- **O-A5:** confirmar que `_bmad-output/` é committable (parece ser, dado que `sprint-status.yaml` já foi committed em 1.c.7). Não foi tocado em `.gitignore` desta story.
- **O-A6 (herdado de 1.c.7):** resolvido — `.smoke-evidence/` agora em `.gitignore`.

## Reviewer findings

N/A — gate de revisão humana pendente. Operador revê este Resumo + os ~17 ficheiros novos/modificados + decide `approve story-1a1` ou pede alterações.

## Métricas

- Janela LLM: ~25% Opus (sessão única; sem Sonnet/Haiku usado nesta story; inclui `bmad-create-story` + `bmad-dev-story` consecutivos).
- Duração: ~2h elapsed (inclui `bmad-create-story` análise exaustiva + `bmad-dev-story` implementação + validação).
- Tasks: 11/11 completed.
- ACs binary cobertos: 5/5 (AC-1 install/lint/test exit 0 ✓ · AC-2 Biome max-lines 200 ✓ · AC-3 ESLint 5 async-safety ✓ · AC-4 bun ≥1.3.0 ✓ · AC-5 `bun test` <10s ✓).
- Validações executadas: cold install (28ms), type-check (exit 0), lint (exit 0), `bun test` (38ms, 2 pass), Biome catch test (exit 1 sobre 201 linhas), ESLint catch test (exit 1 sobre floating promise).
- Tests added: 2 (scaffold.test.ts smoke).
- Files: 14 novos committable + 2 modificados (`.gitignore`, `sprint-status.yaml`) + 1 removido (`index.ts`).
- Coverage: N/A (sem código real; threshold dorme até 1.a.2).
- Decisões registadas: 7 (1 humana via questions Q-1..Q-4 = 4 inputs + 3 técnicas in-story).
- Dependencies instaladas: 4 devDeps directas (`@biomejs/biome@2.4.16`, `@types/bun@1.3.14`, `eslint@10.4.0`, `typescript-eslint@8.60.0`) + `typescript@5.9.3` (peer dep). 94 packages no total via transitive.
- Capacity: 1ª story do Sprint 0 day 2; ~1 day actual; coerente com Cenário B Expected D-046 (6-7 sty/sem).

## Próximos passos sugeridos

1. **Operador aprova** com `approve story-1a1` → eu marco `1-a-1: review → done` em `sprint-status.yaml` e faço commit dos ~17 ficheiros (sem push, per CLAUDE.md). Mensagem proposta: `feat(story-1a1): bun scaffold + biome + eslint + bun test (5 ACs verde)`.
2. **Story 1.a.2 — `Result<T,E>` + branded types + lib helpers** — próxima na ordem do Epic 1.a (`blocked_by: [1.a.1]`, agora destravada). Estimativa 56K dev_core. Introduz `neverthrow@^8`, `src/lib/result.ts`, `src/lib/branded.ts`, `fast-check`, throw whitelist + ESLint custom rule AO-66, primeiras specs com coverage real (≥85% branch).
3. **Em paralelo (opcional):** resolver O-A1 + O-A2 com 1 commit `docs:` curto a alinhar epics.md ↔ architecture.md sobre as 5 regras + flat config — mantém docs sincronizados antes de mais stories iterarem.

→ Ver Tier-C: `(N/A — generator chega em Story 1.a.8)` · Aprovar: `approve story-1a1` · Pedir alterações: `request-changes story-1a1 <razão>`
