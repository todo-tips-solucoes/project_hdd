# Next-session prompt — Story 1.b.1 (path traversal sanitization)

> **Copia o bloco abaixo (entre os marcadores) e cola na próxima sessão Claude Code.**
> O contexto foi pre-loaded em `CLAUDE.md` + memória persistente; o prompt diz ao agent o resto.

```
És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Hoje é Sprint 0 Day 5+ (ou Day 6 se a sessão for noutro dia) — continuação directa
da sessão anterior que entregou 4 stories (1.a.7+1.a.8+1.a.9+1.a.10) já committed
e pushed em origin/main. Último commit: 3801fd5. Epic 1.a (foundational layer) está
FECHADO 10/10. Sprint 0 progress: 11/22 stories done (50%). Capacity assumption
D-046 Cenário B Expected (6-7 sty/sem) — estás ~5 dias à frente do plano por
ritmo activo (~4 sty/sessão demonstrado).

## A tua tarefa

Executar **Story 1.b.1 — Path traversal sanitization (NO apply-diff)** seguindo o
método BMAD canónico (não dev manual).

Esta é a **1ª story do Epic 1.b (Safety BLOCKERS)** — DRB-mandated antes do M1
sign-off. Path traversal é attack surface crítico: qualquer file path que venha
de input externo (LLM output, webhook payload, BMAD skill output) precisa ser
sanitizado contra `../`, symlinks fora do workspace, escapes Unicode/encoding,
absolute paths. "NO apply-diff" significa que o HDD NÃO tem path resolution
herda code do utility apply-diff (que é vulnerable per PR-mortem).

## Workflow obrigatório (método BMAD canónico)

1. Invocar **`bmad-create-story`** com argumento "Story 1.b.1". A skill vai:
   - Resolver workflow customization (Python 3.8 → fallback manual; já testado
     em 4 stories desta semana; sem overrides activos).
   - Ler epics.md secção Story 1.b.1 + architecture.md AOs relevantes
     (provavelmente AR/AO sobre path safety, NO_APPLY_DIFF, allowlist, NFR-S
     security). Verificar Pre-Mortem entries S-N relacionadas com path.
   - Escrever story file em `_bmad-output/implementation-artifacts/
     1-b-1-path-traversal-sanitization-no-apply-diff.md` com Acceptance
     Criteria, Tasks/Subtasks, Dev Notes (big picture + scope delimit + AO
     matrix + esboços + previous story intelligence + anti-pattern guardrails
     + References), Open Questions for Operator.
   - Update sprint-status.yaml `1-b-1: backlog → ready-for-dev`. Marcar
     `epic-1b: backlog → in-progress` (1ª story do epic).

2. Pedir ao operador para responder as Open Questions (até 4 por
   `AskUserQuestion` call; remanescentes assumir defaults Recommended).

3. Actualizar story file marcando Q-B1-* como [RESOLVED — <choice>].

4. Invocar **`bmad-dev-story`** com argumento referenciando o story file +
   Q's resolvidas. A skill vai:
   - Move sprint-status 1-b-1: ready-for-dev → in-progress.
   - Implementar Tasks sequencialmente; correr `bun run lint && bun run
     type-check && bun test` entre tasks.
   - Update story file: tasks [x], Dev Agent Record (Agent Model, Debug Log,
     Completion Notes, File List), Change Log, Status review.
   - **TASK FINAL — Tier-B summary via generator (3ª dogfood):** correr
     `summaryGenerator.finalize()` via `scripts/generate-1b1-summary.ts`
     (pattern já estabelecido nas 1.a.9 + 1.a.10). Aplicar lessons O-A9-5/6/7
     (trim agressivo Tier-B). Auto-commit produz `summary(story-1b1): ...`.
   - Move sprint-status 1-b-1: in-progress → review.
   - Pedir `approve story-1b1` (NÃO commit/push do feat sem aprovação;
     summary auto-commit já tem sido aceite pelo operador).

5. Após `approve`:
   - Update sprint-status 1-b-1: review → done.
   - `git add` específicos (não `-A`); `git commit` com mensagem
     `feat(story-1b1): path traversal sanitization (N ACs verde; 1ª BLOCKER M1)` +
     footer Co-Authored-By; HEREDOC para multiline.
   - Pedir confirmação para `git push origin main` (envia summary auto +
     feat — 2 commits).

## Onde estão os detalhes canónicos (lê primeiro, NESTA ORDEM)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — estado actual
   (1-b-1 deve estar `backlog`; epic-1a `done`; 1-a-10 `done`).
2. `_bmad-output/planning-artifacts/epics.md` — procura "### Story 1.b.1"
   (~linha 870+) para StorySpec completo: blocked_by, files_created,
   files_modified, ao_subset, ACs Given/When/Then, estimated_tokens.
3. `_bmad-output/planning-artifacts/architecture.md` — secções de Security
   (path traversal, allowlist, NO_APPLY_DIFF), sandbox patterns, NFR-S.
4. `_bmad/_config/manifest.yaml` — BMAD v6.7.1.
5. **Story summaries das 10 stories foundational** (contexto técnico denso):
   - `story-1a1-summary.md` ... `story-1a10-summary.md`. Lê 1a5/1a6/1a7/1a9/1a10
     prioritariamente — db, audit, bootstrap, AsyncLocalStorage, LLM port.
6. **Pre-Mortem entries relacionadas com path safety** (procura no PRD ou
   architecture: PM-S1, PM-S2, etc. tipicamente relacionadas com filesystem
   risks).

NÃO releias o PRD inteiro nem o architecture.md inteiro — só as secções da
Story 1.b.1 e referências adjacentes (security AOs).

## Convenções emergidas das 10 stories anteriores (CRÍTICO — não estão em docs)

Estas convenções foram estabelecidas in-flight e devem ser respeitadas:

### Stack / config
- **Runtime:** Bun 1.3.14, TS strict + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes` + `noUnusedLocals/Parameters` +
  `noPropertyAccessFromIndexSignature` (opt-in 1.a.1).
- **ESLint flat config** (`eslint.config.js`) com 7 regras: 5 async-safety +
  `no-restricted-syntax: ThrowStatement` (AO-66 whitelist em
  `docs/conventions/errors.md`) + `no-restricted-globals: setTimeout,
  setInterval` em `src/core/**` (AO-103). `argsIgnorePattern: "^_"`.
- **Biome 2.4.16** com `noExcessiveLinesPerFile: { maxLines: 200 }` HARD para
  `src/**`. Override `tests/**` desactiva.
- **bunfig.toml** `coverage = false` por defeito.
- **`@types/bun`** (não `bun-types`); **`bun.lock`** text format.
- **Deps instaladas até hoje:** drizzle-orm 0.45.2, neverthrow 8.2.0,
  fast-check 4.8.0, zod 4.4.3 (1.a.7), commander 14.0.3 (1.a.8),
  `@anthropic-ai/sdk` 0.100.1 (1.a.10).

### Padrões de código
- **`Result<T,E>` síncrono** via re-exports de `src/lib/result.ts` (neverthrow
  v8). `ResultAsync` só quando há async genuíno (fetch, SDK, spawn).
- **Branded types** `RunId/StoryId/Sha256Hash/IdempotencyKey/SessionId`
  (último entrou na 1.a.10) com factory `mk*()`.
- **`assertNever` / `assertInvariant`** em `src/lib/branded.ts` —
  whitelistadas AO-66 #1/#2.
- **`Bun.CryptoHasher("sha256")`** para hashing (síncrono).
- **Ports em `src/ports/*.port.ts`** (interfaces puras); adapters em
  `src/adapters/<name>/<name>.adapter.ts` (factory functions, não classes).
- **`src/core/`** = pure domain (FSM, events, interrupt-commands); NUNCA
  importa adapters.
- **`src/services/`** = shell layer; pode importar `src/db/`, `src/ports/`,
  `src/lib/`.
- **`process.env.X` acesso:** `noPropertyAccessFromIndexSignature` exige
  bracket `process.env["X"]` OU destructuring `const { X } = process.env`
  (preferido — Biome `useLiteralKeys` info-only não bloqueia).
- **`Record<string, unknown>` access:** bracket sempre. Object spread literal
  ao construir (`{ ...(extra.note !== undefined ? { note } : {}) }`).
- **`exactOptionalPropertyTypes` ZAP:** `{ field?: T }` rejeita `field:
  undefined`; usar spread-conditional ou `field: T | undefined` explícito.

### Padrões DB
- **PRAGMAs aplicados em `createDbConnection`**: WAL + foreign_keys=ON +
  busy_timeout=5000 + synchronous=NORMAL.
- **Migrations em `src/db/migrations/NNN_descricao.sql`** dentro de
  `BEGIN EXCLUSIVE; ... COMMIT;` + INSERT em `schema_migrations`.
  Idempotente via check `WHERE version = ?`.
- **SQL reserved words em SELECT:** quote identifiers — `SELECT
  "current_date" FROM ...` (bug latente apanhado em 1.a.10; SQLite trata
  `current_date` sem quoting como built-in function).
- **`audit_chain_state`** é state machine externo do audit adapter.

### Test patterns
- **`:memory:` SQLite** + `mkdtempSync` para tmpdir isolation.
- **`createTestClockAdapter`** para tests determinísticos.
- **`process.exit` mock pattern:** manual `process.exit = (code) => { throw
  ... }` + `afterEach(() => { process.exit = originalExit })` (não `spyOn`
  pelo `any`-leak de `ReturnType<typeof spyOn>`).
- **`@ts-expect-error` directive** para branded type tests (1.a.10 pattern).
- **fast-check property tests** quando ACs incluem property AC.
- **Helper `parseLine/parseTsr/etc.`** com cast quando `JSON.parse()`
  retorna `any`.
- **Cross-async context:** AsyncLocalStorage funciona em Bun via `node:async_hooks`.
  Tests de isolation usam `Promise.all([withRunContext(...), withRunContext(...)])`
  + `await Promise.resolve()` para forçar stack split.

### FSM canon (Story 1.a.4 Q-A4-1)
6 estados lowercase em `runs.status`: `idle, running, paused_for_interrupt,
paused_awaiting_review, paused_window_exhausted, failed`. `paused_trigger`
em column separada.

### `stories.status` (DB lifecycle, diferente da FSM)
5 estados UPPERCASE: `PENDING, RUNNING, PAUSED, DONE, ROLLED_BACK`.

### D-019 enforcement canónico (estabelecido 1.a.8, executado 1.a.9+1.a.10)
**2 commits por story:**
1. `summary(story-X): ...` — auto-committed pelo `summaryGenerator.finalize()`
   ANTES de approve, via `scripts/generate-XYZ-summary.ts` (pattern em
   `scripts/generate-1a9-summary.ts` + `1a10-summary.ts`).
2. `feat(story-X): ...` — operator approval triggers; restantes ficheiros.

**Workflow obrigatório:** dev-story corre Task FINAL que gera o summary via
generator (NÃO escreve manualmente). 1.a.9 foi o 1º dogfood; 1.a.10 foi o 2º.

### Lessons aprendidas / reviewer findings acumulados
- **O-A9-5 (importante)**: `summaryGenerator` usa MESMOS dados para Tier-B e
  Tier-C → TierBOverflow se input verbose. Workaround: trim agressivo no
  `SummaryInput`. Fix definitivo: `SummaryInput` aceita `tierBBrief` separado.
  Story dedicada a propor.
- **O-A9-6**: Tier-A placeholder duplicado (prepend em `finalize` + template
  body). Visual noise mas funcional.
- **O-A9-7**: HTML comments dos templates leakam para raw markdown (invisível
  no GitHub render). Aceitável v1.
- **O-A10-5**: `audit_chain_state` SQL keyword fix landed. Spec regressão
  dedicada (date != real-today) seria útil; criar follow-up.
- **O-A6-6 acumula:** epics.md `ao_subset` codes (AR-NNN) vs canon
  architecture.md (D-04.x / AO-NN) ainda por reconciliar. Próximo `docs:`
  consolida.

### CLI patterns (Story 1.a.8)
- **Commander 14** root em `src/cli/hdd-worker.ts` + subcommands via
  `registerXCommand(program)`. Story 2.1 expandirá com `start/stop/etc.`.
- **CLI mode no bootstrap:** `BootDeps.cliMode?: boolean` (1.a.8). Quando
  true: skipa `shutdown.arm()` + default `emitProcessStartedEvent=false`.
- **`requiredOption()`** + `program.exitOverride()` em tests para
  Commander error throw em vez de exit.

### LLM canon (Story 1.a.10)
- **LLMPort** em `src/ports/llm.port.ts`. **2 adapters** em `src/adapters/llm/`:
  - `anthropic-sdk.adapter.ts` — SDK direct calls; client injectável.
  - `claude-cli.adapter.ts` — `Bun.spawn(["claude", "--print", ...])`; spawn
    injectável.
- **D-050 routing por FASE:** SDK = implementation default; CLI = planning
  + overflow/fallback. Bootstrap escolhe um.
- **Test fixture adapter** em test file (não em `src/adapters/`).
- **Mock-only network policy** — sem real-network em CI.

## Princípios não-negociáveis (D-019 enforced)

- **Single-story-at-a-time** — não tentar adiantar 1.b.2+.
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`) — read-only do installer.
- **NÃO inventes versões / paths / comandos** — descobre via execução real
  (`bun add @latest`, `bunx <tool> --version`).
- **Confirma com operador antes de:** (a) decidir Q-B1-* se Recommended não
  é óbvio; (b) push (commit é OK após approve mas push exige confirm);
  (c) instalar deps que não estão na story spec.
- **Resumo Tier-B via GENERATOR** (não manual). Pattern em
  `scripts/generate-1aN-summary.ts`. Trim Tier-B input agressivo (lesson O-A9-5).

## Outputs esperados desta sessão

1. `_bmad-output/implementation-artifacts/1-b-1-path-traversal-sanitization-
   no-apply-diff.md` (committable) — story file.
2. `src/lib/path-safe.ts` ou similar (NEW; nome a confirmar via story file).
3. `tests/lib/path-safe.test.ts` ou similar (NEW).
4. Possíveis modifications em `src/adapters/*` que aceitam paths externos.
5. `_bmad-output/implementation-artifacts/story-1b1-summary.md` (gerado pelo
   `summaryGenerator.finalize()` — auto-committed `summary(story-1b1): ...`).
6. `scripts/generate-1b1-summary.ts` (dogfood script).
7. Update `sprint-status.yaml`: `1-b-1: backlog → done` + `epic-1b:
   backlog → in-progress`.
8. Commit `feat(story-1b1): ...` + push (após approve + confirm push).

## Stack disponível (já entregue pelas 10 stories Epic 1.a)

```
src/
├── core/{fsm, events, domain/interrupt-commands}.ts   (1.a.4 — pure domain)
├── ports/{clock, spawn, notify, audit, llm}.port.ts   (1.a.3 + 1.a.6 + 1.a.10)
├── adapters/
│   ├── clock/{system, test}.adapter.ts                (1.a.3)
│   ├── spawn/fake-spawn.adapter.ts                    (1.a.3)
│   ├── audit/jsonl-hash-chain.adapter.ts              (1.a.6 + bug fix 1.a.10)
│   └── llm/{anthropic-sdk, claude-cli}.adapter.ts     (1.a.10)
├── lib/
│   ├── result.ts                                      (1.a.2)
│   ├── branded.ts                                     (1.a.2 + SessionId 1.a.10)
│   ├── env.ts                                         (1.a.7 — Zod)
│   ├── shutdown.ts                                    (1.a.7 — SIGTERM)
│   ├── run-context.ts                                 (1.a.9 — AsyncLocalStorage)
│   └── llm-session-id.ts                              (1.a.10)
├── db/
│   ├── schema.ts                                      (1.a.5)
│   ├── connection.ts                                  (1.a.5)
│   ├── cli/migrate.ts                                 (1.a.5)
│   └── migrations/{001,002}.sql                       (1.a.5 + 1.a.6)
├── services/
│   ├── idempotency.service.ts                         (1.a.5)
│   ├── summary-generator.service.ts                   (1.a.8)
│   └── summary/{types, format, internals}.ts          (1.a.8)
├── cli/
│   ├── hdd-worker.ts                                  (1.a.8 — Commander root minimal)
│   └── review.command.ts                              (1.a.8 — D-019 verdicts)
├── bootstrap.ts                                       (1.a.7 + cliMode 1.a.8)
└── main.ts                                            (1.a.7 — entry)

templates/
├── summary-tier-b.md                                  (1.a.8)
└── summary-tier-c.md                                  (1.a.8)

scripts/
├── generate-1a9-summary.ts                            (1.a.9 — 1ª dogfood)
└── generate-1a10-summary.ts                           (1.a.10 — 2ª dogfood)

tests/                                                 (155 specs verdes)
├── adapters/
│   ├── audit.test.ts                                  (1.a.6)
│   └── llm-foundational.test.ts                       (1.a.10 — 13 specs)
├── cli/review.test.ts                                 (1.a.8)
├── db/schema.test.ts                                  (1.a.5)
├── lib/run-context.test.ts                            (1.a.9 — 12 specs)
├── ports/                                             (1.a.3 contracts)
├── services/summary.test.ts                           (1.a.8)
└── bootstrap.test.ts                                  (1.a.7 — 14 specs)
```

## Capacity context

Sprint 0 = 22 stories; 11 done, 11 restantes. Cenário B Expected D-046 =
6-7 sty/sem; estás à frente do plano (ritmo activo 4 sty/sessão demonstrado).

Story 1.b.1 estimada — descobre via epics.md StorySpec `estimated_tokens`.
Provável 56-80K tokens dado o scope (sanitization library + specs).

## Plano de comunicação

- **Antes de invocar `bmad-create-story`:** confirma em 2-3 linhas o que
  entendeste + estado actual (último commit `3801fd5`, branch sync, epic-1a
  done, 1-b-1 backlog).
- **Após `bmad-create-story` produzir o story file:** sumariza ACs + 4-5 Q's
  via `AskUserQuestion` (4 max por call; assumir Recommended na 5ª).
- **Após cada Task implementada:** sem report verboso; só ao fim do dev-story
  ou em falhas relevantes.
- **No fim de `bmad-dev-story`:** Resumo inline + summary auto-commit via
  generator + pedido de aprovação `approve story-1b1`.
- **Após approve:** confirmar antes de commit; confirmar antes de push.

Começa.
```

---

## Notas para o operador (não copiar para a sessão fresca)

**Sessão actual entregou:**
- 4 stories: 1.a.7, 1.a.8, 1.a.9, 1.a.10 (epic 1.a fechado 10/10)
- 8 commits push'd em `origin/main`
- 155 tests pass / 0 fail (+52 desta sessão)
- 3 deps novas: zod 4.4.3, commander 14.0.3, @anthropic-ai/sdk 0.100.1
- 1 bonus bug fix: `audit_chain_state` SQL keyword collision
- 2 dogfood reais do `summaryGenerator.finalize()` validados

**Último commit:** `3801fd5 feat(story-1a10): LLMPort + AnthropicSDK + ClaudeCli adapters (5 ACs verde; epic 1.a 10/10 done)`.

**Sprint 0:** 11/22 done (50%). Epic 1.a foundational FECHADO.

**Próximo arco (Epic 1.b — Safety BLOCKERS DRB-mandated):**
- 1.b.1 path-traversal-sanitization-no-apply-diff (esta story)
- 1.b.2 two-step-confirmation-accoes-irreversiveis
- 1.b.3 audit-redaction-multi-pattern
- 1.b.4 sandbox-bun-spawn-docker-network-none
- 1.b.5 8-pentest-tasks-pt-1-pt-8-test-suite

**Path para iniciar sessão fresca:**
```bash
cd /var/lib/projeto_hdd
claude   # nova sessão
# Cola o bloco prompt entre ``` ``` acima
```
