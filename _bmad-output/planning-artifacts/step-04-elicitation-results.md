---
title: "Step 04 — Elicitation Results · HDD Architectural Decisions"
workflow: bmad-create-architecture
step: 4
date: 2026-05-21
techniques: [five-whys, party-mode-senior-fp-test-devops]
status: pending-synthesis-approval
---

# Step 04 — Elicitation Results

## A — Five Whys: `Result<T, E>` vs throw

**Cadeia descendente confirmou que Result<T,E> é requisito de produto** (não preferência estética): a classificação de erro IS o produto — triggers P1/S1/S2/S3 + audit log JSONL dependem de tagged unions.

**Counter-Five-Whys quebra-se em W5:** verbosity de `Result` é mitigada por helpers (~30 linhas) + Drizzle-typed queries. Sem razão dura para preferir throw.

**Conclusão:**
- Manter `Result<T,E>` para erros previsíveis/recuperáveis.
- Throw apenas em invariantes não-recuperáveis: `assertNever`, schema fail no boot, hash chain corruption, filesystem corruption.
- **Effect-TS rejeitado** (overkill solo-op intermediate).
- **AO-66:** throw restrito a lista exaustiva em `docs/conventions/errors.md`.

## P — Party Mode: 4 perspectivas

### Senior Engineer (pragmatic)

**Verdict:** stack tem boa espinha mas acumula 3-4 camadas abstractas que solo-op intermediate larga a meio do M1.

**Over-engineered (cortar):**
- `ClockPort`: `vi.setSystemTime` chega
- `AsyncLocalStorage` para correlation IDs: passar `run_id` por parâmetro explícito
- Layered config (defaults → env → CLI): Zod sobre `process.env` apenas no daemon
- 10+ error variants por adapter: começar com 3 categorias (`Transient | Permanent | RateLimited`)

**Under-engineered (vai doer 3-6 meses):**
- Boot/shutdown order não especificado
- Transaction boundary não definida
- FSM sem representação em código (`status` TEXT é bug à espera)
- Webhook clihelper schema é **blocker explícito**

**Conventions faltantes:** tamanho máximo ficheiro (200 linhas), adapters como factory functions (não classes), prefixos de log por componente.

**Sequência ajustada:** bootstrap → result.ts → DB schema → FSM enum → primeiro adapter (WhatsApp outbound, não LLM).

### FP-Purist

**Verdict:** esqueleto de functional core/imperative shell mas falta tecido conectivo (`andThen`/`pipe`).

**Decisão concreta:** **substituir `Result<T,E>` home-rolled por `neverthrow@^8`** — ~4KB zero deps, `ResultAsync` built-in cobre todos os casos HDD. Effect-TS reservado para v2.

**Vectores de contaminação a corrigir:**
- `src/audit/` faz I/O → mover para `src/adapters/audit/`
- FSM transitions devem ser puras + persistência no shell layer (`workers/`)

**Branded types desde dia 1:** `RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey` — eliminam classe de bugs silenciosos.

**Helpers obrigatórios (5 funções):** `pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient`.

**Property-based testing (fast-check):** FSM transitions, idempotency keys, hash chain — 1-2 dias investimento, ROI alto.

**Domain events como ADT** em `src/core/events.ts` — exhaustive checked pelo compilador.

**O que NÃO levar:** Reader monad/Effect Layer (DI simples chega), `fp-ts` TaskEither (neverthrow é melhor), Optics (sem nested immutable state).

### Test Engineer

**Verdict:** estratégia correcta na direcção mas incompleta em 3 pontos: proporções não especificadas, isolamento DB paralelo, ClockPort não afecta `setTimeout` real do Bun.

**ClockPort completo** (design dado):
```typescript
interface ClockPort {
  now(): number
  setTimeout/clearTimeout/setInterval/clearInterval
}
// + FakeClock com advance(ms)
```

**Crítico:** `Bun.spawn` e `systemd WatchdogSec` **não honram FakeClock** — exigem `SpawnPort` e `NotifyPort` separados injectáveis.

**Property-based testing:** FSM (gerar sequências de eventos), idempotency keys (determinism + collision), hash chain (mutate any entry → verify fails), Result combinators (functor/monad laws), NLP parser (confidence < 0.7 → low_confidence).

**bun:sqlite `:memory:`:** cada test file cria `new Database(':memory:')` próprio; migrations via SQL pré-gerado (`db/migrations/*.sql`); paralelismo seguro.

**LLMPort mock:** scriptable (`enqueue(...responses)`) — não fixtures estáticas.

**Webhook simulation:** HTTP server local com `Bun.serve({ port: 0 })` (OS aloca porta livre); helper `startMockWebhookServer(fixtures)`.

**Chaos test scriptable:** `scripts/chaos-kill-test.sh` com SIGKILL + verificar `run.state` no SQLite após restart.

**Anti-flakiness top 5:** `Date.now()` directo → ClockPort enforced; `:memory:` partilhado → factory por describe; timers reais em unit → FakeClock; `Bun.spawn(docker)` em CI → SpawnPort mock; porta fixa → `port: 0`.

**Thresholds:** `lines: 80, branches: 85, functions: 80`. CI total <60s.

**Mutation testing (Stryker)** post-CI manual em sprints — foco em `src/core/fsm/` e `src/core/interrupts/`.

### DevOps Validator

**Verdict:** operacionalmente viável mas 4 pontos críticos antes do M1.

**Validações críticas:**

1. **systemd 1 unit `litestream run -- bun ...`:** funciona; `Restart=on-failure` aplica-se ao Litestream wrapper. Caveat: `TimeoutStopSec=30` + graceful shutdown handler em Bun obrigatórios para fechar bun:sqlite antes do SIGTERM.

2. **`sd_notify` NÃO funciona em Bun nativo** — `WatchdogSec=1800` com `Type=notify` deixa unit em `activating` indefinidamente. **Solução pragmática:** substituir por HTTP `/healthz` Hono + `Type=simple` + `ExecStartPost` curl polling.

3. **Deploy manual ssh+git pull+restart:** razoável mas precisa de: SSH `authorized_keys` com `command=` restriction (impede shell livre), script que corre `bun test` antes restart, registar commit SHA no audit JSONL.

4. **Cold start ≤30s NFR-P1:** `bun run src/main.ts` **interpreted** é 2-5s só de transpilação JIT. **`bun build --compile --outfile dist/hdd-worker` obrigatório no deploy.** Docker image pre-pull também (primeiro spawn puxa 500MB+).

**Findings críticos:**
- Disk IO contention real no CX22 (SQLite WAL + Litestream stream + JSONL append + docker pull) → pre-pull imagens, `PRAGMA wal_autocheckpoint=1000`
- Litestream R2 PUT costs sub-estimados — `retention=24h`, `snapshot-interval=24h` obrigatórios
- Redaction CI sem mecanismo concreto → `scripts/verify-redaction.ts` com regex + `truffleHog` step
- Drizzle migrations sem lock distribuído → `busy_timeout=5000` + `BEGIN EXCLUSIVE`
- RFC 3161 `.tsr` token **deve ser armazenado** junto JSONL (sem isto AO-27 é fachada)

**8 Runbooks must-have em `docs/runbooks/`:**
1. deploy (trigger=merge main; bun test antes restart; audit JSONL commit SHA)
2. rollback (trigger=healthz DOWN; git checkout prev → restart; RTO ≤5min)
3. restore-from-backup (trigger=disk corruption; Litestream restore + verify-audit-chain)
4. secret-rotation (90d rotina; envalid OK no reboot; revogar antiga)
5. ban-Anthropic-emergency (Plan B LLM AO-55)
6. ban-clihelper-emergency (fallback Resend NFR-S5)
7. disk-full (`docker system prune` + rclone verify + clean logs)
8. OOM-kill (verify zombie containers + `MemoryMax=2G` ceiling)

**Renovate config** completa fornecida em snippet (patch-automerge + minor/major manual + security imediato).

**Healthchecks.io free + WhatsApp heartbeat 4h** combinados — heartbeat WatchdogSec/2 = 15min para Healthchecks.

---

## Synthesis — convergências + tensões resolvidas

### Convergências fortes (todas as 4 perspectivas alinham)

| # | Decisão | Origem |
|---|---|---|
| **CV1** | **`neverthrow@^8`** substitui Result<T,E> home-rolled | FP (concrete); Senior (helpers needed); Test (combinators); DevOps (n/a) |
| **CV2** | **`ClockPort + SpawnPort + NotifyPort`** (não só clock) | Test (concrete); Senior aceita; FP aceita; DevOps confirma |
| **CV3** | Branded types: `RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey` | FP (concrete); Senior (sem objecção); Test (helps) |
| **CV4** | Boot/shutdown order explícito em `src/bootstrap.ts` | Senior (crítico); DevOps confirma; Test (helps determinism) |
| **CV5** | FSM como enum + transition table validada em domain | Senior (crítico); FP (pure); Test (PBT-able) |
| **CV6** | Webhook clihelper schema = **blocker** antes de M1 | Senior (crítico); Test (mock structure); DevOps (Zod boundary) |
| **CV7** | `bun build --compile` no deploy (não interpreted) | DevOps (NFR-P1); Senior aceita; Test (consistent prod) |
| **CV8** | `sd_notify` → HTTP `/healthz` Hono endpoint | DevOps (Bun não suporta nativo); Test (testável); Senior (simplifica); FP (n/a) |
| **CV9** | Property-based testing fast-check: FSM, idempotência, hash chain | Test (concrete); FP (confirma); Senior aceita |
| **CV10** | Domain events como tagged union ADT | FP (proposto); Senior (exhaustive); Test (PBT-able) |

### Tensões resolvidas

| # | Tensão | Resolução |
|---|---|---|
| **TR1** | Senior corta ClockPort ↔ Test+FP mantêm | **Manter os 3 ports** (Clock+Spawn+Notify) — concreto de Test ganha. Compromisso: não proliferar ports para tudo. |
| **TR2** | Senior corta layered config ↔ DevOps valida `process.env` only | **Simplificar: Zod sobre `process.env` apenas no daemon**; CLI flags via Commander remain apenas em `scripts/`. |
| **TR3** | Senior cuts AsyncLocalStorage ↔ FP wants wrapped | **Manter mas wrap em `withRunContext(runId, fn)` helper** — nunca raw ALS. |
| **TR4** | Senior: 3 error categories; FP: tagged union root | **Hybrid:** começar 3 (`Transient \| Permanent \| RateLimited`); adicionar variantes específicas onde remediation difere (e.g. `WindowExhausted` → Plan B distinto de `Transient`). |
| **TR5** | Senior: audit no `src/core/` ↔ FP: audit é I/O, mover | **Mover para `src/adapters/audit/`** (FP correcto). |

### Refinamentos das decisões originais

**D-04.1 → D-04.1' refinada:** Adoptar **`neverthrow@^8`** (não home-rolled). Error categories iniciais: 3 (`Transient | Permanent | RateLimited`); variantes específicas onde remediation difere.

**D-04.2 → D-04.2' refinada:** Port interfaces + Zod boundary + **branded types** (4 mínimos).

**D-04.3 → D-04.3' refinada:** **Três ports** (Clock + Spawn + Notify), não só Clock.

**D-04.4 → D-04.4' refinada:** 2 streams (pino + JSONL); **AsyncLocalStorage wrapped** em `withRunContext()`; nunca raw.

**D-04.5 → D-04.5' simplificada:** Zod sobre `process.env` apenas no daemon. CLI flags só em scripts.

**D-04.6 → D-04.6' refinada:** + Redaction CI mechanism (`scripts/verify-redaction.ts` + `truffleHog`); + `ConditionPathExists` em systemd.

**D-04.7:** mantido (retry policies tabuladas; adapter owns retry/CB).

**D-04.8 → D-04.8' refinada:** Test pyramid + **branch coverage ≥85%, line ≥80%**; Stryker post-CI; fast-check FSM/idempotency/hash chain; `scripts/chaos-kill-test.sh` automated; CI total <60s.

**D-04.9 → D-04.9' refinada:** Hybrid + **`audit/` em adapters**, não core.

**D-04.10 → D-04.10' refinada:** Drizzle migrations + `busy_timeout=5000` + `BEGIN EXCLUSIVE`; SQL pré-gerado para tests.

**D-04.11 → D-04.11' refinada:** + **`bun build --compile`** obrigatório; Docker pre-pull obrigatório; Renovate config concreta (snippet entregue).

**D-04.12 → D-04.12' refinada:** Adapter contracts com 3 categorias + variantes específicas onde diferenciam remediation.

### Novas decisões (D-04.13..D-04.26)

| # | Decisão | Origem |
|---|---|---|
| **D-04.13** | `neverthrow@^8` + helpers obrigatórios em `src/lib/result.ts`: `pipe`, `fromPromise`, `sequence`, `tap`, `mapTransient` | FP |
| **D-04.14** | `sd_notify` → HTTP `/healthz` endpoint Hono; `Type=simple` em systemd | DevOps |
| **D-04.15** | `bun build --compile --outfile dist/hdd-worker` em CI; deploy binário | DevOps |
| **D-04.16** | Boot/shutdown order explícito em `src/bootstrap.ts` | Senior |
| **D-04.17** | FSM como enum + transition table em domain layer | Senior |
| **D-04.18** | Webhook schema clihelper é blocker explícito antes M1 | Senior + Test |
| **D-04.19** | Domain events como tagged union em `src/core/events.ts` | FP |
| **D-04.20** | RFC 3161 `.tsr` token storage junto ao JSONL | DevOps |
| **D-04.21** | Litestream `retention=24h`, `snapshot-interval=24h` | DevOps |
| **D-04.22** | Drizzle migrations: `BEGIN EXCLUSIVE` + `busy_timeout=5000` | DevOps |
| **D-04.23** | Redaction CI: `scripts/verify-redaction.ts` regex + `truffleHog` step | DevOps |
| **D-04.24** | 8 Runbooks em `docs/runbooks/` (deploy, rollback, restore, rotation, ban-Anthropic, ban-clihelper, disk-full, OOM) | DevOps |
| **D-04.25** | SSH `authorized_keys` com `command=` restriction para deploy | DevOps |
| **D-04.26** | Healthchecks.io free (interval 15min) + WhatsApp heartbeat (interval 4h) combinados | DevOps |

### Novas AOs (AO-66..AO-95)

| # | Obrigação | Origem |
|---|---|---|
| **AO-66** | Throw restrito a lista exaustiva em `docs/conventions/errors.md`; ESLint custom rule | Five Whys |
| **AO-67** | Boot/shutdown order explícito em `src/bootstrap.ts` | Senior CV4 |
| **AO-68** | FSM como enum + transition table validada em domain layer | Senior CV5 |
| **AO-69** | `neverthrow@^8` em vez de Result home-rolled | FP CV1 |
| **AO-70** | Branded types: `RunId`, `StoryId`, `Sha256Hash`, `IdempotencyKey` | FP CV3 |
| **AO-71** | `ClockPort + SpawnPort + NotifyPort` (3 ports) | Test CV2 |
| **AO-72** | `withRunContext(runId, fn)` wrapper para AsyncLocalStorage | TR3 |
| **AO-73** | Zod sobre `process.env` apenas (sem layered config v1) | TR2 |
| **AO-74** | Redaction CI: regex scan + `truffleHog` | D-04.23 |
| **AO-75** | `ConditionPathExists` em systemd para fail-fast em secrets file | DevOps |
| **AO-76** | `sd_notify` → HTTP `/healthz` Hono; `Type=simple` | D-04.14 |
| **AO-77** | `bun build --compile --outfile dist/hdd-worker` em deploy | D-04.15 |
| **AO-78** | Docker image pre-pull obrigatório no deploy script | DevOps |
| **AO-79** | RFC 3161 `.tsr` token storage junto JSONL | D-04.20 |
| **AO-80** | Litestream retention/snapshot 24h | D-04.21 |
| **AO-81** | Drizzle migrations `BEGIN EXCLUSIVE` + `busy_timeout=5000` | D-04.22 |
| **AO-82** | 8 Runbooks em `docs/runbooks/` | D-04.24 |
| **AO-83** | SSH `authorized_keys` com `command=` restriction | D-04.25 |
| **AO-84** | Healthchecks.io + WhatsApp heartbeat combinados | D-04.26 |
| **AO-85** | Domain events tagged union em `src/core/events.ts` | FP CV10 |
| **AO-86** | Webhook schema clihelper = blocker antes M1; stub `z.unknown()` temp permitido | CV6 |
| **AO-87** | Audit como adapter (`src/adapters/audit/`), não core | TR5 |
| **AO-88** | Adapter error categories: 3 base + variantes onde remediation difere | TR4 |
| **AO-89** | Idempotency keys uniformes em **todos** adapters com side-effects | Senior |
| **AO-90** | JSONL audit com `maxSize`/`maxAge` rotation (~100MB ou diário) | Senior |
| **AO-91** | Coverage: branch ≥85% em `src/core/`; line ≥80% global | Test |
| **AO-92** | Mutation testing (Stryker) para FSM + interrupts post-CI manual | Test |
| **AO-93** | `scripts/chaos-kill-test.sh` automated SIGKILL chaos test | Test |
| **AO-94** | Renovate config `renovate.json` (snippet DevOps) | D-04.11' |
| **AO-95** | Functional core / imperative shell: pure transitions no `src/core/`, I/O no shell | FP |

**Total: 95 Architectural Obligations activas** (AO-1..AO-95; AO-25 dispensada D-033).

---

## Implementation sequence (refinada Senior+FP)

```
1. config/schema.ts (Zod sobre process.env; envalid)
2. lib/result.ts (neverthrow + helpers pipe/fromPromise/sequence/tap)
3. lib/branded.ts (RunId, StoryId, Sha256Hash, IdempotencyKey)
4. ports/{clock,spawn,notify}.port.ts (interfaces)
5. adapters/{clock,spawn,notify}/system.ts (production implementations)
6. core/errors.ts (AppError tagged union root)
7. core/events.ts (DomainEvent tagged union)
8. core/fsm/transitions.ts (pure functions Result-returning)
9. db/schema.ts (Drizzle) + db/migrations/0001_init.sql
10. db/index.ts (StorePort impl + busy_timeout + BEGIN EXCLUSIVE)
11. adapters/audit/jsonl.ts (hash chain + RFC 3161 tsr storage)
12. bootstrap.ts (boot/shutdown order)
13. adapters/whatsapp/clihelper.adapter.ts (BLOCKER: aguarda schema operador)
14. adapters/llm/anthropic.adapter.ts + LLMPort
15. adapters/email/resend.adapter.ts (fallback S3)
16. adapters/sandbox/spawn-docker.adapter.ts (Bun.spawn)
17. adapters/bmad/cli.adapter.ts (CLI-wrapper)
18. core/interrupts/{p1,s1,s2,s3}.ts (event-driven)
19. core/gates/{prd-arq,story-dev,dev-review,review-qa}.ts
20. core/context-bundle.ts (imutável + hash)
21. core/gap-detector.ts (ask-the-agent via Haiku)
22. server/hono-webhook.ts (POST /callback + /healthz)
23. cli/commander.ts (hdd-worker start/pause/resume/status/logs)
24. workers/story-executor.ts (long-running loop)
25. scripts/{mock-webhook,verify-audit-chain,verify-native,reconcile-stuck-runs,audit-replay,chaos-kill-test,verify-redaction}.ts
26. systemd unit + Litestream config (retention 24h)
27. CI: GitHub Actions + Renovate + license-checker + truffleHog
```

---

## Decisões implícitas tornadas explícitas (Senior input)

- **Boot order:** Zod config → DB init → migrations → Litestream watch (via systemd wrapper) → HTTP server → worker loop
- **Shutdown order (SIGTERM):** worker drain queue → HTTP server stop (15s timeout) → DB close → exit code 0
- **Hot reload semantics:** `bun --hot` em dev apenas; produção sempre `bun build --compile`
- **Idempotency key scope:** uniforme em **todos os adapters com side-effects** (AO-89), não só WhatsApp
- **Tamanho máximo ficheiro:** 200 linhas; ultrapassar → extrair sub-módulo
- **Adapters como factory functions:** `createWhatsAppAdapter(config, deps): WhatsAppPort` — não classes
- **DB sync nas queries:** `bun:sqlite` é sync — comentário `/* sync */` inline; nunca `await` em DB calls
- **Prefixos log:** `logger.child({ component: 'whatsapp-adapter' })` obrigatório em cada adapter

---

> **Estado:** synthesis pronta. 26 decisões D-04.* + 30 novas AOs (AO-66..AO-95). A incorporar no `architecture.md`.
