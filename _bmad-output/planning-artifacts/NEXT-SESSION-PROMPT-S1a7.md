# NEXT SESSION PROMPT — Story 1.a.7

> Copia o bloco abaixo (entre as 3 backticks) para a nova sessão Claude Code
> (sessão limpa). Self-contained — não depende de memória da sessão anterior.

---

```
És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Hoje é Sprint 0 Day 4 — continuação directa da sessão anterior que entregou
7 stories (1.c.7 + 1.a.1..1.a.6) já committed e pushed em origin/main
(último commit: b9ef765). Capacity assumption Cenário B Expected confirmada
(D-046: 6-7 sty/sem; estamos à frente — ritmo real ~5/dia em sessão activa).

## A tua tarefa

Executar **Story 1.a.7 — Bootstrap order + env validation Zod** seguindo o
método BMAD canónico (não dev manual).

Esta é a **1ª story end-to-end real do projeto**: liga tudo o que foi
construído até agora (Result/branded/ports/FSM/InterruptCommand/DomainEvent/
db schema/migrations/idempotency service/audit JSONL adapter) num sequence
de boot funcional. Garante fail-closed em credenciais missing + sem state
corruption em SIGTERM.

## Workflow obrigatório (método BMAD canónico)

1. Invocar **`bmad-create-story`** com argumento "Story 1.a.7". A skill vai:
   - Resolver workflow customization (Python 3.8 → fallback manual; já testado
     em todas as 6 stories anteriores; sem overrides activos).
   - Ler epics.md secção Story 1.a.7 (e adjacentes) + architecture.md AOs
     relevantes (AR-019 secrets, AR-037 boot order, AR-039 AsyncLocalStorage,
     AO-52 envalid/Zod, AO-76 sd_notify gotcha, D-04.15+).
   - Escrever story file em `_bmad-output/implementation-artifacts/
     1-a-7-bootstrap-order-env-validation-zod.md` com Acceptance Criteria,
     Tasks/Subtasks detalhados, Dev Notes (big picture + scope delimit + AO
     matrix + esboços de código canónicos + previous story intelligence +
     anti-pattern guardrails + References), e Open Questions for Operator.
   - Update sprint-status.yaml `1-a-7: backlog → ready-for-dev`.

2. Pedir ao operador para responder as Open Questions (até 4 por
   `AskUserQuestion` call; remanescentes assumir defaults Recommended).

3. Actualizar story file marcando Q-A7-* como [RESOLVED — <choice>].

4. Invocar **`bmad-dev-story`** com argumento referenciando o story file +
   Q's resolvidas. A skill vai:
   - Move sprint-status 1-a-7: ready-for-dev → in-progress.
   - Implementar Tasks sequencialmente; correr `bun run lint` + `bun run
     type-check` + `bun test` entre tasks.
   - Update story file: tasks [x], Dev Agent Record (Agent Model, Debug Log,
     Completion Notes, File List), Change Log, Status review.
   - Escrever Resumo Tier-B em `_bmad-output/implementation-artifacts/
     story-1a7-summary.md` (D-019 obrigatório — generator real chega na
     Story 1.a.8).
   - Move sprint-status 1-a-7: in-progress → review.
   - Pedir `approve story-1a7` (NÃO commit/push sem aprovação).

5. Após `approve`:
   - Update sprint-status 1-a-7: review → done.
   - `git add` específicos (não `-A`); `git commit` com mensagem
     `feat(story-1a7): bootstrap order + env Zod (...ACs verde)` + footer
     Co-Authored-By; HEREDOC para multiline.
   - Pedir confirmação para `git push origin main`.

## Onde estão os detalhes canónicos (lê primeiro, NESTA ORDEM)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — estado actual
   (1-a-7 deve estar `backlog`; 1-a-5 e 1-a-6 `done`; epic-1a `in-progress`).
2. `_bmad-output/planning-artifacts/epics.md` — procura "### Story 1.a.7"
   (~linha 815) para StorySpec completo: blocked_by, files_created,
   files_modified, ao_subset, ACs Given/When/Then, estimated_tokens.
3. `_bmad-output/planning-artifacts/architecture.md` — AR-019 (~linha 220),
   AR-037, AR-039 (~linhas 232+), AO-52 (envalid/Zod no boot), AO-76
   (sd_notify gotcha; HTTP /healthz alternativa), D-04.15 boot order.
4. `_bmad/_config/manifest.yaml` — BMAD v6.7.1.
5. **Story summaries prévios** (rico contexto: convenções emergidas + decisões
   técnicas + gotchas vivos):
   - `_bmad-output/implementation-artifacts/story-1a5-summary.md` —
     bun:sqlite + Drizzle + migrations + commit-state-before-side-effect.
   - `_bmad-output/implementation-artifacts/story-1a6-summary.md` —
     audit JSONL + hash chain + .tsr stub.
   - Outras: `story-1c7-summary.md`, `story-1a1-summary.md`,
     `story-1a2-summary.md`, `story-1a3-summary.md`, `story-1a4-summary.md`.

NÃO releias o PRD inteiro nem o architecture.md inteiro — só as secções da
Story 1.a.7 e referências adjacentes (AR-019/037/039, AO-52/76, D-04.15).

## Convenções emergidas das 7 stories anteriores (CRÍTICO — não estão em docs)

Estas convenções NÃO estão escritas em nenhum doc canónico mas foram
estabelecidas in-flight e devem ser respeitadas:

### Stack / config
- **Runtime:** Bun 1.3.14, TS strict + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes` + `noUnusedLocals/Parameters` +
  `noPropertyAccessFromIndexSignature` (todos opt-in 1.a.1).
- **ESLint flat config** (`eslint.config.js`, NÃO `.eslintrc.json`) com 7
  regras activas: 5 async-safety (no-floating-promises, no-misused-promises,
  await-thenable, require-await, no-unsafe-assignment) + `no-restricted-
  syntax: ThrowStatement` (AO-66 whitelist em `docs/conventions/errors.md`)
  + `no-restricted-globals: setTimeout, setInterval` em `src/core/**`
  (AO-103). Plus `argsIgnorePattern: "^_"` em `no-unsafe-assignment`.
- **Biome 2.4.16** com `noExcessiveLinesPerFile: { maxLines: 200 }` HARD
  para `src/**`. Override `tests/**` desactiva (test files podem ser longos).
- **bunfig.toml** `coverage = false` por defeito; flip ad-hoc para validar
  coverage (Bun 1.3.14 não expõe branch coverage — só line+func).
- **`@types/bun`** é o pacote canónico (não `bun-types` legacy).
- **`bun.lock`** text format (não `.lockb` binary).

### Padrões de código
- **`Result<T,E>` síncrono** via re-exports de `src/lib/result.ts` (neverthrow
  v8). `ResultAsync` só quando há async genuíno; bun:sqlite e fs são síncronos.
- **Branded types** `RunId/StoryId/Sha256Hash/IdempotencyKey` de
  `src/lib/branded.ts` com factory functions `mk*()` validation.
- **`assertNever` / `assertInvariant`** em `src/lib/branded.ts` — whitelistadas
  AO-66 #1 e #2 (comments `// allow-throw: AO-66 #N` + `// eslint-disable-
  next-line no-restricted-syntax -- AO-66 #N`).
- **`Bun.CryptoHasher("sha256")`** para hashing (síncrono, idiomático).
- **Ports em `src/ports/*.port.ts`** (interfaces puras); adapters em
  `src/adapters/<name>/<name>.adapter.ts` (factory functions, não classes).
- **`src/core/`** = pure domain (FSM, events, interrupt-commands); NUNCA
  importa adapters (Dep Graph Rigour test em `tests/ports/contracts.test.ts`
  enforces).
- **`src/services/`** = shell layer; pode importar `src/db/`, `src/ports/`,
  `src/lib/`.

### Padrões DB
- **PRAGMAs aplicados em `createDbConnection`**: WAL + foreign_keys=ON +
  busy_timeout=5000 + synchronous=NORMAL. Per-connection (não persisted).
- **Migrations em `src/db/migrations/NNN_descricao.sql`** dentro de
  `BEGIN EXCLUSIVE; ... COMMIT;` + INSERT em `schema_migrations`.
  Idempotente via check `WHERE version = ?`.
- **Test seeds usam SQL raw** (`db.query("INSERT...").run(...)`) não Drizzle
  — mais directo; Drizzle wrapper testado em 1 spec sanity.
- **`audit_chain_state`** (1 row per project) é state machine externo do
  audit adapter; lido + actualizado em cada `append()`.

### Test patterns
- **fast-check property tests** quando ACs incluem property AC.
- **`:memory:` SQLite** + `mkdtempSync` para tmpdir isolation.
- **`createTestClockAdapter`** para tests determinísticos sem `setTimeout`
  real.
- **Helper `parseLine/parseTsr` etc.** com cast explícito quando
  `JSON.parse()` retorna `any` (typescript-eslint `no-unsafe-assignment`).

### FSM canon (Story 1.a.4 Q-A4-1)
6 estados lowercase: `idle, running, paused_for_interrupt,
paused_awaiting_review, paused_window_exhausted, failed`. `runs.status` usa
estes; `paused_trigger` em metadata separada. (Architecture AO-2 reconciliado
em commit ac4c7ec.)

### `stories.status` (DB lifecycle, diferente da FSM)
5 estados UPPERCASE: `PENDING, RUNNING, PAUSED, DONE, ROLLED_BACK`.

## Princípios não-negociáveis (D-019 enforced)

- **Single-story-at-a-time** — não tentar adiantar Stories 1.a.8+ ou outras.
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`) — read-only do installer.
- **NÃO inventes versões / paths / comandos** — descobre via execução real
  (`bun add @latest`, `bunx <tool> --version`).
- **Confirma com operador antes de:** (a) decidir Q-A7-* se Recommended não
  é óbvio; (b) push (commit é OK após approve mas push exige confirm);
  (c) instalar deps que não estão na story spec.
- **Resumo Tier-B obrigatório** em `_bmad-output/implementation-artifacts/
  story-1a7-summary.md` per D-019 (generator real chega 1.a.8; escrever
  manualmente seguindo template `_bmad-output/planning-artifacts/prds/
  prd-projeto_hdd-2026-05-20/finalization-summary-templates.md`).
- **Audit log JSONL** existe agora (Story 1.a.6 entregou). Eventos relevantes
  da bootstrap podem ser registados via `audit.append()` se útil (não
  obrigatório — usa judgment).

## Outputs esperados desta sessão

1. `_bmad-output/implementation-artifacts/1-a-7-bootstrap-order-env-
   validation-zod.md` (committable) — story file gerado por `bmad-create-story`.
2. `src/bootstrap.ts` — boot order canónico (env → Zod → DB → migrations →
   adapters init → FSM start).
3. `src/lib/env.ts` — Zod schema dos env vars (AR-019 secrets via
   `EnvironmentFile=` systemd; AO-52 fail fast).
4. `src/lib/shutdown.ts` — graceful SIGTERM handler.
5. `tests/bootstrap.test.ts` — specs do boot order + env validation.
6. `_bmad-output/implementation-artifacts/story-1a7-summary.md` (Resumo
   Tier-B per D-019).
7. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`:
   `1-a-7-bootstrap-order-env-validation-zod: backlog → done`.
8. Commit `feat(story-1a7): ...` + push (após `approve story-1a7` + confirm
   push).

## Stack disponível (já entregue pelas 7 stories anteriores)

```
src/
├── core/{fsm, events, domain/interrupt-commands}.ts   (1.a.4 — pure domain)
├── ports/{clock, spawn, notify, audit}.port.ts        (1.a.3 + 1.a.6)
├── adapters/{clock/{system,test}, spawn/fake, audit/jsonl-hash-chain}/    (1.a.3 + 1.a.6)
├── lib/{result, branded}.ts                           (1.a.2)
├── db/{schema, connection, cli/migrate, migrations/{001,002}}.ts   (1.a.5 + 1.a.6)
├── services/idempotency.service.ts                    (1.a.5)
├── bootstrap.ts                                       ← stub (1.a.1; ESTA STORY substitui)
└── main.ts                                            ← stub (1.a.1; ESTA STORY consume bootstrap)
```

**Deps disponíveis:** Bun 1.3.14, drizzle-orm 0.45.2, drizzle-kit 0.31.10,
neverthrow 8.2.0, fast-check 4.8.0, Biome 2.4.16, eslint 10.4, typescript-
eslint 8.60, typescript 5.9.3, @biomejs/biome, @types/bun.

**Stories 1.a.7 vai introduzir:** `zod` (ou `envalid`) para env validation —
confirmar versão actual via `bun add @latest` quando dev-story arrancar.

## Capacity context

Sprint 0 = 22 stories; 7 done, 15 restantes. Cenário B Expected D-046 =
6-7 sty/sem; sessão activa entrega ~5/dia. Story 1.a.7 estimada 64K/96K
tokens (similar a 1.a.5). Se sessão ficar longa, OK parar após 1.a.7 done
+ push (1 story por sessão limpa é capacity defensável).

## Plano de comunicação

- **Antes de invocar `bmad-create-story`:** confirma em 2-3 linhas o que
  entendeste + estado actual (último commit, branch sync, stories pendentes).
- **Após `bmad-create-story` produzir o story file:** sumariza ACs + 4-5 Q's
  via `AskUserQuestion` (4 max por call; assumir default na 5ª se houver).
- **Após cada Task implementada:** sem report verboso; só ao fim do dev-story
  ou em falhas relevantes.
- **No fim de `bmad-dev-story`:** Resumo Tier-B inline + pedido de aprovação
  `approve story-1a7`.
- **Após approve:** confirmar antes de commit; confirmar antes de push.

Começa.
```

---

## Instruções para o operador

1. **Abre nova sessão Claude Code** no diretório `/var/lib/projeto_hdd/`.
2. **Cola o bloco entre as 3 backticks acima** (do `És o Developer agent…` até
   `Começa.`) como primeira mensagem na nova sessão.
3. **O novo agente vai:**
   - Ler sprint-status, story 1.a.7 spec em epics.md, AOs relevantes em
     architecture.md, e os summaries das stories prévias.
   - Confirmar contigo em 2-3 linhas.
   - Invocar `bmad-create-story` → story file gerado.
   - Pedir respostas às Q-A7-*.
   - Invocar `bmad-dev-story` → implementação.
   - Pedir `approve story-1a7`.
   - Commit (sem push automático) → pedir confirm para `git push origin main`.

**Não esquecer:** se quiseres parar antes do commit (ex: rever o story file
primeiro), basta dizer ao novo agente para parar após `bmad-create-story` —
o workflow está desenhado para permitir pause em cada gate.

**Memórias persistentes** (em `/root/.claude/projects/-var-lib-projeto-hdd/
memory/`) continuam disponíveis para o novo agente — não precisas de
re-carregar D-052, project-hdd-stack-v2-bun, etc.
