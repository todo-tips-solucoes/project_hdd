# NEXT-SESSION PROMPT — Story 1.c.1 (systemd unit + /healthz)

> Copia o bloco abaixo para uma sessão limpa do Claude Code (Developer agent HDD).
> Foi gerado no fim da sessão que fechou o **Epic 1.b (5/5)**. Último commit: `3aac00b`.

---

És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Continuação directa da sessão anterior que entregou o **Epic 1.b inteiro (Safety
BLOCKERS, 5 stories: 1.b.1→1.b.5)**, todas committed+pushed em `origin/main`.
Último commit: `3aac00b` (feat story-1b5). `main` em sync com origin.

## Estado actual (verificável)

- **Epic 1.a:** done 10/10. **Epic 1.b:** done 5/5. **Epic 1.c:** in-progress
  (1.c.7 done numa sessão anterior; **1.c.1 é a próxima em `backlog`**).
- **Sprint 0: 16/22 stories done** (~5 dias à frente do plano D-046 Cenário B).
- **Tests: 257 pass / 0 fail** (`bun test`). type-check clean, `bun run lint`
  exit 0 (≈23 infos `useLiteralKeys` pré-existentes, info-only — NÃO bloqueiam).
- **1º CI workflow do repo** activo (`.github/workflows/ci.yml`): build-and-test
  (lint/type-check/test + verify-redaction) + secret-scan (truffleHog) +
  security-suite (pentest-report). Criado na 1.b.3, expandido na 1.b.4/1.b.5.

## A tua tarefa

Executar **Story 1.c.1 — systemd unit Type=simple + /healthz endpoint** pelo
método BMAD canónico (NÃO dev manual). É a 1ª story do Epic 1.c (Bootstrap &
Operations). Objectivo: o worker passa a ser supervisionável por systemd **sem
`sd_notify`** (Bun gotcha) — supervisão via HTTP `/healthz` + Healthchecks.io.

## Workflow obrigatório (igual às 5 stories do Epic 1.b)

1. **`bmad-create-story`** com arg "Story 1.c.1". Python 3.8 → fallback manual
   (resolver `customize.toml` à mão; sem overrides team/user; sem
   `project-context.md` para carregar). Escrever story file em
   `_bmad-output/implementation-artifacts/1-c-1-systemd-unit-type-simple-healthz-endpoint.md`
   com ACs, Tasks/Subtasks, Dev Notes (big picture + scope delimit + AO matrix +
   esboços + previous story intelligence + anti-pattern guardrails + References)
   + Open Questions. Update sprint-status `1-c-1: backlog → ready-for-dev`
   (epic-1c já `in-progress`).
2. Sumarizar ACs + 3-4 Open Questions via `AskUserQuestion` (4 max/call). O
   operador costuma delegar ("o que recomendas?") → escolher Recommended e
   justificar em 1 linha cada.
3. Marcar Q-C1-* como `[RESOLVED — <choice>]` no story file.
4. **`bmad-dev-story`** com o story file + Q's resolvidas. Move `1-c-1` →
   in-progress; implementa Tasks com `bun run type-check && bun run lint &&
   bun test` entre tasks; preenche Dev Agent Record/File List/Change Log;
   Status → review.
5. **TASK FINAL — Tier-B summary via generator (8ª dogfood):** criar
   `scripts/generate-1c1-summary.ts` (pattern de `scripts/generate-1b5-summary.ts`),
   correr `gen.finalize(input)` (auto-commit `summary(story-1c1): ...`). Trim
   Tier-B agressivo (lesson O-A9-5; cap ~1000 words — os últimos ficaram 470-530).
6. Pedir `approve story-1c1`. Após approve: `1-c-1 → done`; `git add`
   específicos; `git commit` `feat(story-1c1): ...` + footer Co-Authored-By
   (HEREDOC); pedir confirmação para `git push origin main` (2 commits:
   summary + feat).

## StorySpec canónico (epics.md ~linha 1076 — lê primeiro)

```
### Story 1.c.1: systemd unit Type=simple + /healthz endpoint
- blocked_by: [1.a.7]                                  (done)
- files_created: systemd/hdd-worker.service, systemd/hdd-worker.env.example,
  src/cli/healthz.handler.ts, tests/cli/healthz.test.ts,
  docs/runbooks/systemd-deploy.md
- files_modified: src/cli/hdd-worker.ts (start monta Hono /healthz)
- ao_subset: [AR-020, NFR-P1, project-hdd-bun-sd-notify-gotcha memory]
- estimated_tokens: { dev_core: 48K, dev_with_retry: 72K }

ACs:
- AC1 (binary): systemctl start hdd-worker → active em <30s (NFR-P1)
  + curl http://localhost:8080/healthz → {status:"ok", uptime:<s>} 200.
- AC2 (binary): deadlock simulado → Healthchecks.io poll timeout 60s →
  alerta WhatsApp hdd_heartbeat template (depende de E3 stub; M1 mínimo).
```

## Onde ler (NESTA ordem; NÃO releias PRD/epics/arch inteiros)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-c-1` deve
   estar `backlog`; `epic-1c: in-progress`; `1-c-7: done`.
2. `_bmad-output/planning-artifacts/epics.md` linhas 1076-1100 (StorySpec 1.c.1).
3. **Ficheiro MODIFY (lê na íntegra — regra dev-story):** `src/cli/hdd-worker.ts`
   (Commander root, só tem `review` subcommand hoje; vais adicionar `start` que
   monta o Hono `/healthz`). Ver também `src/bootstrap.ts` (o `start` provavelmente
   chama `bootstrap()` daemon-mode) e `src/main.ts` (entry daemon actual).
4. Memory **`project-hdd-bun-sd-notify-gotcha`** (CRÍTICA p/ esta story):
   Bun não suporta `sd_notify` nativo → usar `Type=simple` + HTTP `/healthz` +
   Healthchecks.io polling (NÃO `Type=notify`).
5. Story summaries 1.a.7 (bootstrap), 1.a.8 (CLI Commander) — padrões de boot+CLI.
6. `_bmad/_config/manifest.yaml` — BMAD v6.7.1.

## ⚠️ Dependência nova provável: Hono

A Story 1.c.1 precisa de um servidor HTTP para `/healthz`. O stack canónico
(memory `project-hdd-stack-v2-bun`) prevê **Hono**, que **ainda NÃO está
instalado**. Vais precisar de `bun add hono` (confirma a versão real via
`bun add hono@latest` e regista no story file). **Instalar deps que não estão
no StorySpec exige confirmação do operador** — pergunta antes (Open Question ou
inline). Serve via `Bun.serve` + Hono app; porta 8080 (confirmar via Q).

## Convenções emergidas (CRÍTICO — não estão nos docs canónicos)

### Stack / config
- **Runtime:** Bun 1.3.14, TS strict + `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes` + `noUnusedLocals/Parameters` +
  `noPropertyAccessFromIndexSignature`.
- **`process.env` access:** bracket `process.env["X"]` OU destructuring
  (preferido). `Record<string,unknown>` → bracket sempre.
- **ESLint:** `no-restricted-syntax: ThrowStatement` (AO-66 whitelist em
  `docs/conventions/errors.md`) + `no-restricted-globals: setTimeout,setInterval`
  em `src/core/**` (AO-103 — usar `ClockPort`). `argsIgnorePattern: "^_"`.
- **Biome 2.4.16:** `noExcessiveLinesPerFile maxLines:200` HARD em `src/**`
  (override `tests/**` desactiva). `useLiteralKeys` é info-only (não bloqueia;
  mas `noUnusedVariables`/`noUnusedLocals` SÃO erro → exit 1).
- **Lint flow:** se `bun run lint` der exit 1 por FIXABLE (format/organizeImports)
  → corre `bun run lint:fix` e re-verifica. Erros reais (dead vars) → corrige à mão.
- **Deps instaladas:** drizzle-orm 0.45.2, neverthrow 8.2.0, fast-check 4.8.0,
  zod 4.4.3, commander 14.0.3, @anthropic-ai/sdk 0.100.1. (Hono ainda não.)

### Padrões de código
- **`Result<T,E>` síncrono** via `src/lib/result.ts` (re-exporta neverthrow v8:
  `ok/err/Result/ResultAsync`). `ResultAsync` só p/ async genuíno (fetch/spawn/
  `Bun.serve`). Para `Promise<Result<T,E>>` → `ResultAsync` usa `new ResultAsync(promise)`
  (NÃO `fromSafePromise`, que não achata).
- **Ports** `src/ports/*.port.ts` (interfaces puras); **adapters** factory functions
  em `src/adapters/<name>/<name>.adapter.ts` (não classes). **Services** shell em
  `src/services/`. **`src/core/`** = domínio puro, nunca importa adapters.
- **`ClockPort`** injectável (`now():Date`, `setTimeout/setInterval` com cancel);
  `createTestClockAdapter(initial).advance(ms)` p/ tests determinísticos (uptime!).
- **Bootstrap** (`bootstrap.ts`) é **síncrono** (`Result<BootResult,BootError>`),
  `cliMode?` skipa shutdown.arm()+ProcessStarted. Tem `sandboxImageCheck?`
  injectável (default `checkSandboxImageSync` via `Bun.spawnSync docker image
  inspect`; **skip em cliMode**). `BootError` é union com `switch` exaustivo em
  `main.ts#formatBootError` → se adicionares variante, actualiza o switch.
- **CLI (1.a.8):** Commander 14 root em `src/cli/hdd-worker.ts`; subcommands via
  `registerXCommand(program)`. `import.meta.main` guard. `requiredOption()` +
  `program.exitOverride()` em tests. Existe `src/cli/review.command.ts` como
  exemplo de subcommand.
- **Eventos audit** são PascalCase (`ProcessStarted`, `SecurityViolation`).

### Gotchas de tooling (custaram tempo esta sessão — ver memórias)
- **`[[feedback-write-tool-control-chars]]`**: NÃO escrevas bytes de control
  literais no Write (corrompe o ficheiro); detecta por `charCodeAt`,
  constrói em tests via `String.fromCharCode`. (Provavelmente irrelevante p/ 1.c.1.)
- **`[[project-hdd-git-workflow-scope]]`**: push de `.github/workflows/*` exige
  scope `workflow` no token. **JÁ refrescado nesta sessão** (`gh auth refresh -s
  workflow` corrido; scope persiste). A Story 1.c.1 cria `systemd/` (NÃO
  `.github/workflows/`) → não deve precisar. A **Story 1.c.4 (CI)** vai mexer no
  workflow → se o push falhar, re-corre o refresh.

### D-019 enforcement (2 commits por story)
1. `summary(story-X): ...` — auto-committed pelo `summaryGenerator.finalize()`
   ANTES de approve, via `scripts/generate-XYZ-summary.ts`. **8 dogfoods feitos**
   (1a9,1a10,1b1-1b5); 1.c.1 = 9º. `SummaryInput` shape em
   `src/services/summary/types.ts`. `diffAgainst:"HEAD"` + `diffPaths:[...]` opcional.
2. `feat(story-X): ...` — operator approval; `git add` ESPECÍFICOS (não `-A`).

## Princípios não-negociáveis
- **Single-story-at-a-time** (não adiantar 1.c.2+).
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`).
- **NÃO inventes versões/paths/comandos** — descobre via execução real.
- **Confirma com operador antes de:** (a) Q-C1-* sem Recommended óbvio;
  (b) instalar Hono ou qualquer dep fora do StorySpec; (c) push (commit OK após
  approve; push exige confirm).
- **Revisão humana obrigatória** (`[[feedback-hdd-mandatory-review]]`): nunca
  auto-aprovar; `approve story-1c1` vem do operador.
- **Mock-only em CI** — sem real-network/systemd/docker nos tests. O `/healthz`
  testa-se via o handler Hono directo (`app.request('/healthz')` ou fetch ao
  `Bun.serve` em porta efémera no test), NÃO via systemd real. AC1 `systemctl`/
  AC2 `Healthchecks.io`+WhatsApp são integração/E3-stub — documenta o que fica
  diferido (E3 = canal WhatsApp, ainda não existe).

## Outputs esperados desta próxima sessão
1. Story file `1-c-1-...md` (committable).
2. `systemd/hdd-worker.service` + `systemd/hdd-worker.env.example` (NEW).
3. `src/cli/healthz.handler.ts` + `tests/cli/healthz.test.ts` (NEW).
4. `docs/runbooks/systemd-deploy.md` (NEW).
5. `src/cli/hdd-worker.ts` (MODIFY — `start` subcommand monta `/healthz`).
6. Possível `package.json` (+hono) + `bun.lock`.
7. `scripts/generate-1c1-summary.ts` + `story-1c1-summary.md` (auto-commit).
8. sprint-status `1-c-1 → done`; commit `feat` + push.

## Open Items abertos do projecto (contexto, não-bloqueantes p/ 1.c.1)
- **O-B5-3 / AO-86:** schema clihelper inbound real ainda NÃO recebido →
  `webhook-mock=true` em `_bmad-output/feature-flags.json`; `[OPEN]` em
  `_bmad-output/planning-artifacts/readiness-open-items.md`. Re-correr
  `bun run check:webhook-schema` quando o schema chegar. Depende do operador
  clihelper; não bloqueia Epic 1.c.
- **O-B5-1:** run de integração com docker real (escapes PT-1/PT-4 ao vivo).
- **O-B5-2:** PT-5 rebuff semântico → Epic 4.
- **O-A6-6:** epics.md `ao_subset` codes (AR-NNN) vs canon architecture
  (D-04.x/AO-NN) ainda por reconciliar num `docs:` futuro.

## Plano de comunicação
- Antes de `bmad-create-story`: confirma em 2-3 linhas o estado (último commit
  `3aac00b`, branch sync, epic-1a+1b done, 1-c-1 backlog).
- Após o story file: sumariza ACs + Open Questions via `AskUserQuestion`.
- Após dev-story: Resumo inline + summary auto-commit + pedido `approve story-1c1`.
- Após approve: confirmar antes de commit; confirmar antes de push.

Começa.
