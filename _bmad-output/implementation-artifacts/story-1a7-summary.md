# Story 1.a.7 — Bootstrap order + env Zod · projeto_hdd · 2026-05-28

> **Tier-B (Resumo Geração Manual)** per D-019 — generator automático chega Story 1.a.8. Este resumo segue o template `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md`.

## Contexto (1-2 frases)

1ª story **end-to-end real** do HDD: liga `Result/branded` (1.a.2) + ports temporais (1.a.3) + FSM/InterruptCommand (1.a.4) + db schema/migrations (1.a.5) + audit JSONL hash chain (1.a.6) + env Zod (novo) + shutdown handler (novo) num sequence de boot funcional. Fail-closed em credenciais missing + sem state corruption em SIGTERM.

## O que foi feito

- **`src/lib/env.ts` (46 linhas)** — Zod `EnvSchema` minimal (Q-A7-1) com `ANTHROPIC_API_KEY: z.string({error: ...}).trim().min(1, "ANTHROPIC_API_KEY required")`. `parseEnv()` síncrono devolve `Result<Env, EnvValidationError>` com `formatted: string` para substring AC-1.
- **`src/lib/shutdown.ts` (84 linhas)** — `createShutdownHandler({db, audit, clock, bootRunId, emitStoppedEvent})` factory. `arm()` instala SIGTERM+SIGINT listeners (retorna unarm para tests). `trigger(reason)` sync com re-entrance flag → opcional emit `ProcessStopped` → `db.close()` → `process.exit(0)`. Best-effort audit append (ignora err para não bloquear exit).
- **`src/bootstrap.ts` (122 linhas — substitui stub 9-line)** — orchestração 4 passos: parseEnv fail-fast → createDbConnection+applyMigrations (1.a.5) → createAuditAdapter+ProcessStarted event (1.a.6 + Q-A7-3) → shutdown.arm(). Retorna `Result<BootResult, BootError>` (sync — descobri meio-implementação que `AuditPort.append` é sync, não async). `bootRunId` UUID partilhado entre ProcessStarted/ProcessStopped.
- **`src/main.ts` (41 linhas — substitui stub 6-line)** — top-level entry. `bootstrap()` → err: `process.stderr.write + process.exit(1)`; ok: stdout "hdd-worker started"; `import.meta.main` guard. `formatBootError` switch nas 4 kinds da tagged union.
- **`tests/bootstrap.test.ts` (262 linhas, 14 specs)** — 4 describes: (1) parseEnv unit (5), (2) AC-1 bootstrap fail-closed (4 com timing <500ms), (3) AC-2 SIGTERM graceful (4 com timing <5s, re-entrance, emit toggle), (4) shutdown listener hygiene arm/unarm (1).
- **Q-A7-1..5 resolvidas (todas Recommended)** — Minimal env (só ANTHROPIC_API_KEY); zod@4.4.3 (latest stable); emit ProcessStarted Yes; emit ProcessStopped Yes; main.ts `process.exit(1)` directo (não throw).
- **Dependência adicionada**: `zod@4.4.3` (não havia antes; package.json + bun.lock text format).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Scope env minimal — só `ANTHROPIC_API_KEY` | YAGNI estrito. Outras vars (HDD_DB_PATH, AUDIT_DIR) entram quando consumidas; defaults hardcoded em bootstrap.ts por agora. | Q-A7-1 |
| 2 | `bun add zod@latest` → v4.4.3 | API `safeParse().error.issues[].path/.message` mantém-se igual a v3; type-check + tests passam sem ajustes. | Q-A7-2 |
| 3 | Emit `ProcessStarted` + `ProcessStopped` events | Liga audit chain desde primeiro tick + dá postmortem distinguir graceful vs crash. ~5-10ms cost dentro do budget. | Q-A7-3 + Q-A7-4 |
| 4 | `process.exit(1)` directo em main.ts (não throw) | exit é syscall (não atinge AO-66 no-restricted-syntax); mais simples que `throw` + caught-by-runtime. | Q-A7-5 |
| 5 | `bootstrap()` síncrono (não async) | Descoberta meio-implementação: `AuditPort.append` é `Result<T,E>` sync. Async wrap seria artificial. main.ts consome directo sem `await`. | (in-story) |
| 6 | `bootRunId = randomUUID()` partilhado Started/Stopped | Correlação postmortem. Boot fresco gera UUID novo; tests override via `deps.bootRunId`. | (in-story) |
| 7 | `process.exit` mock manual (não `spyOn`) | `ReturnType<typeof spyOn>` resolve para `any` e dispara `@typescript-eslint/no-redundant-type-constituents` + 2 unsafe-call errors. Manual `process.exit = ...` + `originalExit` restore mais clean. | (in-story) |
| 8 | Best-effort audit append no shutdown | Se `audit.append({ ProcessStopped })` falhar, ignoramos o err e prosseguimos para `db.close()` + exit. Bloquear exit por audit failure não traz nada útil. | (in-story) |
| 9 | `emitProcessStartedEvent !== false` (default ON) | Tests podem override para `false` se quiserem isolar; produção mantém defaults. Mesmo padrão para Stopped. | (in-story) |
| 10 | Tests em ficheiro único `tests/bootstrap.test.ts` | Story spec original sugeria ficheiro único; mantive 4 describes para legibilidade. parseEnv unit no mesmo ficheiro (vs `tests/lib/env.test.ts`) — menos overhead. | (in-story) |

## Trade-offs aplicados

- **Quis cobrir env vars completas (HDD_DB_PATH/AUDIT_DIR/etc.) no schema, fiquei com Minimal:** AC-1 só exige `ANTHROPIC_API_KEY` e os outros nomes ainda não são canónicos (epics referencia AR-019/037/039 vs architecture D-04.x). YAGNI vence; bootstrap usa hardcoded defaults por agora.
- **Quis verificar shutdown em SIGTERM real (process.kill), fiquei com `trigger()` directo:** matar o test runner é mau; assinar listeners reais polui describe-blocks adjacentes. `trigger()` directo prova a sequência sem signal handler real. Spec extra "arm/unarm listener hygiene" confirma o wiring.
- **Quis test E2E spawn-bun-child via `Bun.spawn` para validar AC-1 exit 1 + timing wall-clock real, fiquei com bootstrap() in-process + Bun.nanoseconds():** spawn adds 50-100ms overhead + flake risk em CI; `bootstrap({env:{}})` in-process valida toda a sequência minus o `process.exit(1)` (que é coberto pelo smoke test manual + AC-2 specs).
- **Quis `audit.append` em try/catch para BootAuditFailure mais detalhado, fiquei com `appR.isErr() → return err`:** consistency com migration handling (mesmo pattern). Detail vem do `inner: AuditError` tagged union.
- **Quis bootstrap.ts dividido em helpers separados (env-loader.ts, db-init.ts, etc.), fiquei com tudo em bootstrap.ts:** 122 linhas dentro do Biome 200-line cap. Split prematuro complica; refactor se outra story precisar de re-usar pedaços.

## Open items deferidos

- **O-A7-1:** error path `BootDbFailure` (createDbConnection throw) e `BootMigrationFailure`/`BootAuditFailure` não cobertos por spec dedicado. Coverage exige `:memory:` corruption simulation — baixo ROI nesta story; comentário em mind para 1.a.8 retro.
- **O-A7-2:** `WORKER_VERSION = "0.0.1"` hardcoded em bootstrap.ts. Future: ler de `package.json#version` via `await import("../package.json", { with: { type: "json" } })` ou `import.meta` API quando Bun expor. Não-blocker; primeiro v0.0.1 fica fixo.
- **O-A7-3:** Real-SIGTERM E2E test deferred. Adicionar `scripts/chaos-sigterm.sh` quando 1.b.4 (sandbox docker) entrar e for fácil isolar.
- **O-A7-4:** `lint/complexity/useLiteralKeys` em `src/db/cli/migrate.ts:11` permanece como info pré-existente (1.a.5 code, conflitua com `noPropertyAccessFromIndexSignature`). Não toquei nesta story; fix em 1.a.8 ou em retro de epic 1.a.
- **O-A6-6 acumula:** próximo `docs:` deve reconciliar `epics.md` `ao_subset` codes (AR-019/037/039) com canon `D-04.x'/AO-NN` da architecture.md.
- **O-A7-5:** `ProcessStarted` event payload é mínimo (`pid, version`). Sem `RunContext` ainda — espera Story 1.a.9 (AsyncLocalStorage withRunContext) para enriquecer com correlation IDs.

## Reviewer findings

_(nenhum review ainda — a aguardar `approve story-1a7` do operador antes de commit.)_

## Métricas

- **Tests:** 117 pass / 0 fail (was 103; **+14 novos**), 233 expect() calls, 281ms.
- **Linhas de código:** 293 total novas (env.ts 46 + shutdown.ts 84 + bootstrap.ts 122 + main.ts 41); 262 linhas tests.
- **Type-check:** clean.
- **Lint:** clean (0 errors, 1 info pré-existente migrate.ts não-blocker).
- **Biome line cap:** todos os 4 ficheiros src/** dentro do 200-line hard cap.
- **Dependências adicionadas:** 1 (`zod@4.4.3`).
- **Wall-clock spec timing:**
  - AC-1 fail-closed: <500ms budget; medido típico ~5-15ms.
  - AC-2 shutdown: <5s budget; medido típico ~2-10ms.
- **Token usage approx:** ~75K (entre core e dev-story); within `estimated_tokens.dev_with_retry: 80K`.

## Próximos passos sugeridos

1. **Operador aprova** `approve story-1a7` → marco done + commit ~9 ficheiros (sem push). Mensagem proposta: `feat(story-1a7): bootstrap order + env Zod (4 ACs verde; 1ª story end-to-end real)`.
2. **Story 1.a.8 — Resumo 3-tier Tier-B/C gerador + CLI review** — próxima (`blocked_by: [1.a.7]` agora done). Implementa o generator real para Tier-B/C (substitui escrita manual deste summary). Bom seguimento natural.
3. **Em paralelo (opcional):** push origin agora vs adia para depois de 1.a.8.

→ Aprovar: `approve story-1a7` · Pedir alterações: `request-changes story-1a7 <razão>`
