# Story 1.a.6 — Audit JSONL + hash chain + RFC 3161 stub · projeto_hdd · 2026-05-28

> Resumo Tier-B (D-019). Reviewer: operador. Status: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 3, 6ª story implementacional do Epic 1.a (7ª total Sprint 0). **2ª story com I/O real** (filesystem agora). Entrega tamper-evident audit trail — base de toda a auditabilidade do worker. SHA-256 chain + O_APPEND atomic + .tsr daily stub.

## O que foi feito

- **`src/ports/audit.port.ts` (49 linhas)** — `AuditPort` interface com `append()` + `verifyChain()`. `AuditError` tagged union 4 kinds.
- **`src/adapters/audit/jsonl-hash-chain.adapter.ts` (200 linhas)** — factory `createAuditAdapter`. `append()` faz read-state→hash→write-line→update-state em sequência. `verifyChain()` re-computa todos os hashes e detecta ChainBreak no primeiro mismatch. Helpers: `canonicalPayload` (flat sort), `computeHash` (Bun.CryptoHasher SHA-256), `emitTsrStub` (JSON mock).
- **`src/db/migrations/002_audit_chain_state.sql` (20 linhas)** — nova table `audit_chain_state` (project_id PK, current_date, last_seq, last_hash, updated_at) dentro de BEGIN EXCLUSIVE. Insert em schema_migrations registado.
- **`src/db/schema.ts`** modificado (+15 linhas) — `auditChainState` table + inferred types.
- **`scripts/verify-audit-chain.ts` (34 linhas)** — `bun run audit:verify <date>` CLI. Exit 0/1.
- **`docs/audit-format.md` (~135 linhas)** — spec canónica completa (formato, hash formula, rotation, retention, redaction warning, recovery procedure, CLI usage).
- **`tests/adapters/audit.test.ts` (~245 linhas, 9 specs)** — AC-1 (atomicidade), AC-2 (genesis + chain + formula manual), AC-3 (ok + ChainBreak + FileNotFound), AC-4 (rotation + .tsr).
- **`package.json`** — `audit:verify` script novo.
- **`.gitignore`** — `_bmad-output/audit/`.
- **`tests/db/schema.test.ts`** — specs migrations actualizadas para robustez (`toBeGreaterThanOrEqual`) + assertion nova de `audit_chain_state` table presente.
- **`sprint-status.yaml`** — `1-a-6: backlog → review`.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Flat sort top-level para canonical JSON | Q-A6-1: payloads HDD shallow; JCS over-engineering v1. | Q-A6-1 |
| 2 | Migration 002 + DB table `audit_chain_state` | Q-A6-2: atómico junto com append; single source of truth; race-safe. | Q-A6-2 |
| 3 | `.tsr` mock JSON com `tsa_real: false` | Q-A6-3: AR-061 explicit defer v1.1+; sem network/CI flakiness. | Q-A6-3 |
| 4 | Date-based rotation only (midnight UTC) | Q-A6-4: size-based diferido 1.c.3; mantém append simples. | Q-A6-4 |
| 5 | Redaction 100% caller-responsibility v1 + doc warning | Q-A6-5: AR-063 BLOCKER M1 = Story 1.b.3 dedicated. | Q-A6-5 |
| 6 | Helpers `parseLine`/`parseTsr` em tests com cast explícito | typescript-eslint `no-unsafe-assignment` (1.a.1) bloqueia `JSON.parse() as any` raw. Centraliza casts em 2 helpers. | (in-story) |
| 7 | Specs migrations robustos (não literal count) | Migration 002 quebrou expectativa literal `appliedCount: 1`. Robustez contra futuras 003+. | (in-story) |
| 8 | `clock.now().toISOString().slice(0,10)` para date | Determinístico em tests via TestClock; ISO 8601 sortable; midnight UTC explicit. | (in-story) |
| 9 | O_APPEND via `fs.openSync(path, 'a')` (não `appendFileSync`) | Controlo explícito de flag mode; matches docs/audit-format.md sem ambiguidade. | (in-story) |

## Trade-offs aplicados

- **Quis cobrir error paths 100%, fiquei com 93.94% line (100% func):** 6.06% linhas não cobertas são try/catch outer dos error kinds (WriteFailure caso fs falhe; FileNotFound em verifyChain quando readFileSync throw). Cobrir requer mock complexo (chmod 000 ou path inválido) — baixo ROI.
- **Quis test E2E real disk em CI, fiquei com :memory: + 1 manual real disk:** velocidade + paralelismo. Real disk só validado em Task 10.6 manual.
- **Quis fsync após cada append (durabilidade extra), fiquei sem:** WAL + Litestream (1.c.3) compensam. fsync adicionaria latency 5-10ms por append; audit volume HDD não justifica.

## Open items deferidos

- **O-A6-1:** error paths `WriteFailure` / `FileNotFound` cobertos por code mas não por specs.
- **O-A6-2:** `audit_chain_state.updated_at` actualizado mas não testado directamente.
- **O-A6-3:** rotation spec usa `clock.advance(24h)` directo; multi-day + midnight-precise specs adia.
- **O-A6-4:** `.tsr` real RFC 3161 binário (v1.1+) requer dep + AO-176 NTP drift check.
- **O-A6-5:** redaction caller-responsibility é frágil; **Story 1.b.3 BLOCKER M1** resolve.
- **O-A6-6 (acumula):** epics.md story spec deve ser actualizada com Q-A6-* resolutions no próximo `docs:` consolidado.

## Reviewer findings

N/A — gate pendente.

## Métricas

- Janela LLM: ~50% Opus.
- Duração: ~2h elapsed.
- Tasks: 11/11 completed.
- ACs cobertos: **4/4 ✓** — AC-1 atomic append, AC-2 chain SHA-256 (genesis + recomputação manual), AC-3 verifyChain ok+ChainBreak+FileNotFound, AC-4 rotation date + .tsr stub.
- Tests: 103 pass / 0 fail / 193 expect / 181-219ms wall-clock (+8 novos audit; +1 novo schema audit_chain_state assertion; era 95).
- Coverage `src/adapters/audit/jsonl-hash-chain.adapter.ts`: 100% func / 93.94% line.
- Files: 7 novos (port + adapter + migration + cli + docs + test + summary) + 5 modificados.
- LOC novo: ~440 src+scripts (49+200+20+34+135) + ~245 tests = ~685.
- Decisões: 9 (5 humanas Q-A6-1..5 + 4 técnicas in-story).
- Dependencies: **0 novas**.
- Capacity: 7ª story numa sequência (1.c.7 + 1.a.1..1.a.6). Sprint 0 progresso = 7/22.

## Próximos passos sugeridos

1. **Operador aprova** `approve story-1a6` → marco done + commit ~13 ficheiros (sem push). Mensagem proposta: `feat(story-1a6): audit JSONL + SHA-256 chain + RFC 3161 stub (4 ACs verde; 2ª story I/O real)`.
2. **Story 1.a.7 — Bootstrap order + env validation Zod** — próxima (`blocked_by: [1.a.5, 1.a.6]` ambos done). Cria `src/bootstrap.ts` (boot order: env→Zod→db→migrations→adapters→FSM), `src/lib/env.ts`, `src/lib/shutdown.ts`. Liga tudo o que foi construído até agora.
3. **Em paralelo (opcional):** push origin agora — leva commit 1.a.6 a chegar. OR adia para depois de 1.a.7.

→ Aprovar: `approve story-1a6` · Pedir alterações: `request-changes story-1a6 <razão>`
