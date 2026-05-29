# NEXT-SESSION PROMPT — Story 1.c.3 (Litestream + R2 EU + rclone)

> Copia o bloco abaixo para uma sessão limpa do Claude Code (Developer agent HDD).
> Gerado no fim da sessão que entregou 1.c.1 + 1.c.2. Último commit: `0fbfb6b`.

---

És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Continuação directa. Último commit `0fbfb6b` (feat story-1c2). `main` em sync com origin.

## Estado actual (verificável)

- **Epic 1.a:** done 10/10. **Epic 1.b:** done 5/5 (+ retro + camada de integração real D-053). **Epic 1.c:** in-progress.
- **Epic 1.c:** 1.c.1 (systemd+/healthz) ✅ · 1.c.2 (secrets EnvironmentFile) ✅ · 1.c.7 (bmad-cli smoke) ✅ · **1.c.3 é a próxima em `backlog`** · faltam 1.c.4/1.c.5/1.c.6.
- **Sprint 0: 18/22 done.**
- **Tests: 279 pass / 1 skip / 0 fail** (`bun test`); `bun run test:integration` = 11 specs reais (docker + fs/audit + healthz). type-check clean, `bun run lint` exit 0 (~23 infos `useLiteralKeys`, info-only).
- **CI** (`.github/workflows/ci.yml`): build-and-test + secret-scan (truffleHog) + security-suite + integration.

## A tua tarefa

Executar **Story 1.c.3 — Litestream supervisor + R2 EU + rclone** pelo método BMAD
canónico (NÃO dev manual). Backup/restore do state+audit: Litestream stream WAL →
Cloudflare R2 EU (primário, RPO ~1s) + rclone dump diário gzipped (secundário) +
runbook de restore. É a defesa contra crash de VPS / disk failure (Epic 5 crash
recovery depende disto).

## Workflow obrigatório (idêntico às 8 stories anteriores)

1. **`bmad-create-story`** arg "Story 1.c.3". Python 3.8 → fallback manual (sem
   overrides team/user; sem `project-context.md`). Escrever story file em
   `_bmad-output/implementation-artifacts/1-c-3-litestream-supervisor-r2-eu-rclone.md`
   com ACs/Tasks/Dev Notes/Open Questions. sprint-status `1-c-3 → ready-for-dev`.
2. Sumarizar ACs + 3-4 Open Questions via `AskUserQuestion`. O operador costuma
   delegar ("o que recomendas?") MAS já escolheu não-Recommended antes (Q-C2-1
   CLIHELPER required) — **apresenta sempre as alternativas honestamente**.
3. Marcar Q-C3-* `[RESOLVED — <choice>]`.
4. **`bmad-dev-story`** + Q's. sprint-status `1-c-3 → in-progress`; gates
   (`bun run type-check && bun run lint && bun test`) entre tasks.
5. **TASK FINAL — Tier-B summary via generator (10ª dogfood):**
   `scripts/generate-1c3-summary.ts` (pattern de `generate-1c2-summary.ts`) →
   `gen.finalize(input)` (auto-commit `summary(story-1c3): ...`). Trim Tier-B
   agressivo (últimos: 450-530 words; cap O-A9-5).
6. Pedir `approve story-1c3`. Após approve: `1-c-3 → done`; `git add` específicos;
   `git commit feat(story-1c3): ...` + footer Co-Authored-By (HEREDOC); pedir
   confirmação p/ `git push origin main` (2 commits: summary + feat).

## StorySpec canónico (epics.md ~linha 1126 — lê primeiro)

```
### Story 1.c.3: Litestream supervisor + R2 EU + rclone
- blocked_by: [1.a.5, 1.c.2]                          (done)
- files_created: systemd/litestream.service, litestream.yml,
  scripts/rclone-daily-backup.sh, docs/runbooks/litestream-restore.md,
  tests/integration/backup-restore.test.sh
- files_modified: systemd/hdd-worker.service (depend on litestream.service)
- ao_subset: [AR-014, D-04.21, project-hdd-stack-v2-bun memory]
- estimated_tokens: { dev_core: 56K, dev_with_retry: 80K }

ACs:
- AC1 (binary): db data.db WAL + Litestream activo; simulo crash + restore em
  VPS limpa → db restaurado com ≤24h retention loss (D-04.21).
- AC2 (binary): R2 EU bucket hdd-backup; rclone daily cron → dump
  data-<date>.db.gz aparece no bucket secundário.
```

## Onde ler (NESTA ordem; NÃO releias PRD/epics/arch inteiros)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-c-3` deve estar
   `backlog`; `epic-1c: in-progress`.
2. `_bmad-output/planning-artifacts/epics.md` linhas 1126-1148 (StorySpec).
3. `architecture.md` — secções Litestream/backup: linhas ~379-406 (systemd
   supervisor model), ~465-475 (AO-51 `litestream run -- bun run src/main.ts`),
   ~722-729 (cold start + backup orchestration: Litestream WAL→R2 EU RPO~1s,
   rclone cron `0 */6 * * *`), D-04.21 (retention 24h).
4. **Ficheiro MODIFY (lê na íntegra):** `systemd/hdd-worker.service` (criado 1.c.1,
   tightened 1.c.2). Hoje: `Type=simple`, `ExecStart=/opt/hdd/dist/hdd-worker
   start` (binário DIRECTO — litestream foi DIFERIDO p/ esta story na Q-C1-3),
   `ExecStartPre` perm-gate 0600 (1.c.2), `ExecStartPost` poll /healthz.
5. **`src/db/connection.ts`** — confirma WAL pragma já aplicado (1.a.5: WAL +
   foreign_keys + busy_timeout + synchronous=NORMAL). Litestream exige WAL.
6. Memórias: `project-hdd-stack-v2-bun` (Litestream supervisor + Litestream em
   vez de dockerode), `project-hdd-d053-integration-testing` (integração real).

## ⚠️ Decisões de arquitectura a clarificar (Open Questions prováveis)

- **Q-C3-1 — modelo de supervisão:** o architecture canon (AO-51) usa o WRAPPER
  `ExecStart=litestream run -- /opt/hdd/dist/hdd-worker start` (litestream supervisiona
  o worker). MAS o StorySpec lista `systemd/litestream.service` SEPARADO +
  `hdd-worker.service` a depender dele. Dois modelos:
  (a) **wrapper** — hdd-worker.service ExecStart passa a `litestream run -- …`
      (alinha com AO-51; 1 processo);
  (b) **serviço separado** — `litestream.service` corre `litestream replicate`
      independente; `hdd-worker.service` ganha `Requires=/After=litestream.service`.
  Recomendação a pensar: (a) é o canon AO-51 e mais simples (litestream gere o
  restart do worker); mas o StorySpec sugere (b). **Apresenta os dois ao operador.**
- **Q-C3-2 — Litestream binário:** NÃO é dep bun/npm — é um binário externo
  (download do GitHub releases). Confirmar via execução real se está instalado
  (`which litestream`); se não, o teste de integração faz `skipIf` (como o
  sandbox docker) OU usa replica para ficheiro local (`file://`) em vez de R2.
- **Q-C3-3 — credenciais R2:** o AC2 precisa de R2 real (bucket `hdd-backup` +
  S3 creds). Provavelmente NÃO disponíveis no ambiente → integração real do R2
  fica `skipIf`/diferida; testar com replica local (`litestream replicate
  data.db file:///tmp/replica`) + restore real local (prova o mecanismo sem R2).
  Documentar a config R2 no runbook. (Alinha com D-053: real onde possível, doc
  o resto.)
- **Q-C3-4 — `backup-restore.test.sh`:** é um teste **shell** (`.test.sh`, não
  `.ts`). Decidir como corre: `bun run test:integration` é `bun test
  tests/integration` (só `.ts`). Adicionar script `test:backup` que corre o
  `.sh`, OU converter para `.integration.test.ts` que invoca litestream via
  `Bun.spawn` (mais consistente com a suite). Recomendação: `.integration.test.ts`
  com `skipIf(!hasLitestream)`.

## Convenções emergidas (CRÍTICO — não estão nos docs canónicos)

### Stack / config
- **Runtime:** Bun 1.3.14, TS strict + noUncheckedIndexedAccess +
  exactOptionalPropertyTypes + noUnusedLocals/Parameters + noPropertyAccessFromIndexSignature.
- **`process.env`:** bracket `process.env["X"]` ou destructuring.
- **Biome** maxLines:200 HARD em `src/**` (tests/** override). `useLiteralKeys`
  info-only (não bloqueia); `noUnusedVariables`/`noUnusedLocals` SÃO erro.
- **Lint flow:** exit 1 por FIXABLE (format/organizeImports) → `bun run lint:fix`
  + re-verifica. Erros reais (dead vars, floating promises) → corrige à mão.
  Gotcha 1.c.1: `no-floating-promises` em `server.stop()`/qualquer Promise não-await.
- **Deps:** drizzle-orm, neverthrow, fast-check, zod, commander,
  @anthropic-ai/sdk, **hono@4.12.23** (1.c.1). Litestream/rclone NÃO são deps —
  binários externos.

### Padrões de código
- **`Result<T,E>` síncrono** (`src/lib/result.ts`, neverthrow v8). `ResultAsync`
  só p/ async genuíno; `Promise<Result>` → `new ResultAsync(promise)` (NÃO
  fromSafePromise). **`SpawnPort` real existe:**
  `src/adapters/spawn/system-spawn.adapter.ts` (Bun.spawn) — usar p/ correr
  litestream/rclone reais; fake-spawn p/ unit.
- **Ports** `src/ports/*.port.ts`; **adapters** factory em
  `src/adapters/<name>/<name>.adapter.ts`; **services** shell; **core** puro.
- **`ClockPort`** injectável; `createTestClockAdapter(initial).advance(ms)` p/ tests.
- **bootstrap.ts** síncrono; `cliMode?`; `sandboxImageCheck` (fail-closed sandbox);
  `BootError` union com `switch` exaustivo em `main.ts` E `hdd-worker.ts`
  (`formatBootError`) — se adicionares variante, actualiza AMBOS.
- **env.ts:** `parseEnv` Zod (ANTHROPIC_API_KEY + CLIHELPER_TOKEN, ambos required);
  `checkSecretsFilePerms` (1.c.2). Se Litestream precisar de R2 creds
  (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`), decidir se entram no
  Zod (required parte o boot sem R2 → provavelmente optional em M0; **Open Q**).
- **CLI:** `hdd-worker.ts` Commander root (`review` + `start`); build compila
  `src/cli/hdd-worker.ts` → `dist/hdd-worker` (1.c.1). `dist/` é gitignored.

### Testes / D-053
- **Mock-only por defeito** em `bun test`; **integração real** em
  `tests/integration/*.integration.test.ts` com `describe.skipIf(!hasX)` (sem o
  recurso → skip, CI verde). Padrão estabelecido p/ docker (1.b.4) + healthz (1.c.1).
  Para litestream: `skipIf(!hasLitestream)` + replica local em vez de R2.
- `:memory:` SQLite + `mkdtempSync` + `createTestClockAdapter` nos unit.
- **Bash scripts:** `bash -n` p/ syntax; sem `set -x` em scripts com secrets.

### Gotchas de tooling (memórias)
- **`[[project-hdd-git-workflow-scope]]`:** push de `.github/workflows/*` exige
  scope `workflow` (já refrescado nesta sessão; persiste). **1.c.3 NÃO toca
  workflows** (só systemd/ + scripts + docs + tests) → push normal. **1.c.4 (CI)
  vai tocar** → se falhar, `gh auth refresh -h github.com -s workflow`.
- **`[[feedback-write-tool-control-chars]]`:** não escrever bytes de control
  literais no Write (provavelmente irrelevante aqui).
- **Hook context-mode bloqueia curl/wget/fetch inline no Bash** — para smoke de
  HTTP/rede usar testes (`bun test` Bun.serve/fetch) ou `ss`/logs, não curl.

### D-019 (2 commits por story)
1. `summary(story-X): ...` — auto-commit pelo `summaryGenerator.finalize()` via
   `scripts/generate-XYZ-summary.ts` ANTES do approve. **9 dogfoods feitos**
   (1a9,1a10,1b1-5,1c1,1c2); 1.c.3 = 10º. `SummaryInput` em `src/services/summary/types.ts`.
2. `feat(story-X): ...` — operator approval; `git add` ESPECÍFICOS (não `-A`).
   Deixar `.claude/settings.local.json` FORA do commit (settings locais do harness).

## Princípios não-negociáveis
- **Single-story-at-a-time** (não adiantar 1.c.4+).
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`).
- **NÃO inventes versões/paths/comandos** — descobre via execução real
  (`which litestream`, `which rclone`, `litestream version`).
- **Confirma com operador antes de:** (a) Q-C3-* (apresenta alternativas, ele
  pode escolher não-Recommended); (b) instalar litestream/rclone se ausentes
  (são binários de sistema — provavelmente NÃO instalar, antes `skipIf`+doc);
  (c) push (commit OK após approve; push exige confirm).
- **Revisão humana obrigatória** (`[[feedback-hdd-mandatory-review]]`) — nunca
  auto-aprovar.
- **D-053:** real onde possível (replica local de litestream), doc/skip o que
  exige R2 creds não disponíveis.

## Outputs esperados
1. Story file `1-c-3-...md` (committable).
2. `systemd/litestream.service` + `litestream.yml` (NEW).
3. `scripts/rclone-daily-backup.sh` (NEW).
4. `docs/runbooks/litestream-restore.md` (NEW).
5. `tests/integration/backup-restore.*` (NEW — ver Q-C3-4).
6. `systemd/hdd-worker.service` (MODIFY — supervisão litestream conforme Q-C3-1).
7. `scripts/generate-1c3-summary.ts` + `story-1c3-summary.md` (auto-commit).
8. sprint-status `1-c-3 → done`; commit `feat` + push.

## Open Items abertos do projecto (contexto, não-bloqueantes)
- **O-B5-3 / AO-86:** schema clihelper inbound real ainda NÃO recebido →
  `webhook-mock=true` (`_bmad-output/feature-flags.json`); `[OPEN]` em
  `_bmad-output/planning-artifacts/readiness-open-items.md`. Re-correr
  `bun run check:webhook-schema` quando chegar.
- **O-C2-1:** wire CLIHELPER_TOKEN no cliente clihelper — Epic 3.
- **O-C1-1:** `dev` script (`bun --hot src/main.ts`) não serve /healthz; alinhar
  com `hdd-worker start` ou consolidar entries.
- **O-B5-1:** escapes docker reais ao vivo (parcialmente coberto pela integração 1.b.4).
- **O-A6-6:** epics `ao_subset` (AR-NNN) vs canon architecture (D-04.x/AO-NN).

## Plano de comunicação
- Antes de `bmad-create-story`: confirma estado (último commit `0fbfb6b`, branch
  sync, epic-1a+1b done, 1-c-3 backlog) em 2-3 linhas.
- Após o story file: ACs + Open Questions via `AskUserQuestion`.
- Após dev-story: Resumo inline + summary auto-commit + pedido `approve story-1c3`.
- Após approve: confirmar antes de commit; confirmar antes de push.

Começa.
