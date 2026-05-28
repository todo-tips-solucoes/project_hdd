# Story 1.a.2 — Result<T,E> + branded types + lib helpers · projeto_hdd · 2026-05-28

> Resumo Tier-B (D-019 obrigatório). Gerado manualmente; `summary-generator.service`
> chega em Story 1.a.8. Reviewer humano: operador. Status até aprovação: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 2, 2ª story implementacional do Epic 1.a. Estabelece os 2 pilares transversais que toda a 47 stories seguintes assumem: `Result<T,E>` (via `neverthrow@^8`) em vez de throw, e branded types nominais para identifiers críticos. Primeira story do projecto a usar property-based testing (`fast-check`). Workflow canónico `bmad-create-story` → `bmad-dev-story`.

## O que foi feito

- **`src/lib/result.ts` (100 linhas)** — neverthrow re-exports + 5 helpers canónicos (D-04.13): `pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient`. Cada um com JSDoc + referência AO. `tap` documenta G1 gotcha (architecture linha 1188) — idempotency-first AO-121 preservada.
- **`src/lib/branded.ts` (134 linhas)** — 4 branded types canónicos (`RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey`) verbatim de architecture.md linhas 627-632. 4 factory functions `mk*(s): Result<Brand, BrandError>` com validação regex (UUID v4 / story-id slug / SHA-256 hex). `BrandError` tagged union. `assertNever` + `assertInvariant` (AO-66 whitelist itens #1 e #2) com comentários `// allow-throw: AO-66 #N` + `eslint-disable-next-line`.
- **`tests/lib/result.test.ts` (189 linhas; 16 specs, 100% func/line coverage)** — incluindo 2 property tests fast-check sobre integers (100 runs) e strings (50 runs). Verifica `pipe(ok(x), lift(fn1), lift(fn2)) ≡ ok(fn2(fn1(x)))`.
- **`tests/lib/branded.test.ts` (148 linhas; 13 specs runtime)** — cada `mk*` valida formato; `assertNever` exhaustiveness; `assertInvariant` throw em false.
- **`docs/conventions/errors.md` (54 linhas)** — whitelist canónica 11 itens AO-66 (5 categorias) verbatim de architecture. Convenção operacional `// allow-throw: AO-66 #N` para grep-ability.
- **`eslint.config.js` modificado** — `no-restricted-syntax: ThrowStatement` em `src/**` com mensagem custom apontando `errors.md`; override `tests/**/*.ts` desactiva (AO-104).
- **`package.json` modificado** — `neverthrow@^8.2.0` (runtime), `fast-check@^4.8.0` (dev). `bun.lock` regenerado (104 packages totais).
- **`sprint-status.yaml`** — `1-a-2: backlog → review`.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Habilitar `no-restricted-syntax: ThrowStatement` (não custom plugin) | Architecture menciona "ESLint custom rule"; plugin real é cosmetic deferreable. Approximation via no-restricted-syntax + comments `// eslint-disable-next-line ... AO-66 #N` é 95% do valor a 5% do custo. | (in-story) |
| 2 | `assertNever` + `assertInvariant` em `src/lib/branded.ts` | Q-A2-2 resolved. Co-localização com factory functions (que precisam de `assertInvariant`). Evita ficheiro `assertions.ts` extra. | (Q-A2-2) |
| 3 | `pipe` com signature uniforme `T → Result<T, E>` (não polimórfica `T1 → T2`) | Story spec é explícita; signature polimórfica adiável se necessário em story posterior. | (story spec D-04.13) |
| 4 | `mkIdempotencyKey` acepta UUID v4 OU SHA-256 hex (não enforce um único formato) | Caller escolhe formato per use-case (e.g. WhatsApp dedup usa UUID; LLM cache usa hash). | (in-story) |
| 5 | Bun não expõe branch coverage; AC-2 cumprido via proxy 100% line+func + análise manual | Trade-off real: tooling limitation. Open item O-A2-1 para CI story (1.c.4) integrar Istanbul/c8 se necessário. | (O-A2-1) |
| 6 | `bunfig.toml` mantém `coverage = false`; AC-2 valida via flip ad-hoc | Q-A2-3 resolved. Mantém `bun test` rápido por defeito. CLI flag `--coverage` não substitui bunfig (Bun 1.3.14 gotcha — O-A2-2). | (Q-A2-3) |

## Trade-offs aplicados

- **Quis branch coverage real, fiquei com proxy 100% line+func + análise manual:** Bun 1.3.14 simplesmente não expõe `BRDA:`/`BRH:` em lcov. Aceito porque (a) a única ramificação em `tap` está testada em 2 specs, (b) `pipe` é reduce sem branches explícitas, (c) `sequence` delega para `Result.combine` (sem código de branching local). Open item para CI story decidir Istanbul integration.
- **Quis usar `andTee` do neverthrow para `tap`, escolhi wrapper manual:** G1 gotcha (architecture linha 1188) — `andTee` não força ordem semântica. Wrapper sync com `if (r.isOk())` garante AO-121 idempotency-first.
- **Quis comentários só `// allow-throw: AO-66 #N`, ficou `eslint-disable-next-line` explícito:** o `// allow-throw` é prosa documentacional (grep-able); o `eslint-disable` é o que efectivamente desactiva a rule. Os 2 comentários convivem deliberadamente — um para auditoria humana, outro para ESLint.

## Open items deferidos

- **O-A2-1:** Bun 1.3.14 não expõe branch coverage. Quando Story 1.c.4 (CI) for criada, considerar Istanbul/c8 wrapper para HTML + branch real. Alternativa: pinar Bun quando expor BRDA.
- **O-A2-2:** CLI flag `--coverage` não substitui `coverage = false` em bunfig.toml. Documentar gotcha no README quando 1.c.4 for criada.
- **O-A2-3 (acumula com O-A1 de 1.a.1):** `epics.md` Stories 1.a.1 + 1.a.2 listam `files_modified: .eslintrc.json` — actualizar para `eslint.config.js`. 1 commit `docs:` resolve ambos.
- **O-A2-4:** Considerar remover `tests/scaffold.test.ts` (placeholder de 1.a.1) quando 1.a.3 adicionar mais specs. Por agora mantido (sem custo).
- **Não-resolvidos herdados:** O-A2..O-A5 de 1.a.1 (Hono 1.a.7/1.c.1; Renovate política TS; `_bmad-output/` committable).

## Reviewer findings

N/A — gate de revisão humana pendente. Operador revê este Resumo + os 7 ficheiros novos/modificados + decide `approve story-1a2` ou pede alterações.

## Métricas

- Janela LLM: ~30% Opus (sessão única; `bmad-create-story` + `bmad-dev-story` consecutivos).
- Duração: ~1.5h elapsed (analyse + write + implement + validate).
- Tasks: 10/10 completed (35+ subtasks).
- ACs cobertos: 4/4 (AC-1 throw catch ✓ · AC-2 coverage proxy ✓ · AC-3 fast-check property ✓ · AC-4 branded compile error ✓).
- Tests: 33 pass / 0 fail / 47 expect() calls / 61ms wall-clock total.
- Coverage `src/lib/result.ts`: 100% lines, 100% funcs (branches verificadas manualmente — única em `tap`, coberta).
- Files: 5 novos committable + 2 modificados (eslint + package.json) + 1 auto (bun.lock) + 1 sprint-status. Stub `index.ts` permanece removido (1.a.1).
- Linhas de código produtivo novo: 100 (result.ts) + 134 (branded.ts) = 234 LOC src/ + 337 LOC tests/ + 54 LOC docs.
- Decisões registadas: 6 (4 humanas Q-A2-1..4 + 2 técnicas in-story).
- Dependencies adicionadas: 2 directas (neverthrow@8.2.0, fast-check@4.8.0) + 10 transitive (104 total agora).
- Capacity: ~1 day actual; coerente com Cenário B Expected D-046.

## Próximos passos sugeridos

1. **Operador aprova** com `approve story-1a2` → marco `1-a-2: review → done` em sprint-status, commit dos ~9 ficheiros (sem push). Mensagem proposta: `feat(story-1a2): Result+neverthrow + branded types + throw whitelist (4 ACs verde)`.
2. **Story 1.a.3 — 3 ports temporais Clock/Spawn/Notify** — próxima na ordem (`blocked_by: [1.a.2]`, agora destravada). Estimativa 64K dev_core. Introduz `src/ports/`, `src/adapters/clock/`, primeiro contrato port↔adapter, `no-restricted-globals: setTimeout, setInterval` em `src/core/` (AO-103).
3. **Em paralelo (opcional):** 1 commit `docs:` curto resolvendo O-A2-3 (epics.md → eslint.config.js em 1.a.1 + 1.a.2). Mantém docs consistentes antes de mais stories iterarem.

→ Ver Tier-C: `(N/A — generator chega em 1.a.8)` · Aprovar: `approve story-1a2` · Pedir alterações: `request-changes story-1a2 <razão>`
