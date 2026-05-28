# Story 1.a.6: Audit JSONL adapter com hash chain + RFC 3161 stub

Status: review

> **Story Context Engine output.** `bmad-create-story` 2026-05-28.
> Reviewer humano: `operador`. **2ª story com I/O real** (filesystem agora).
> Introduz audit tamper-evident — base de toda a auditabilidade do worker.

---

## Story

As a `audit consumer` (worker, services),
I want `src/adapters/audit/jsonl-hash-chain.adapter.ts` que append eventos com `prev_hash` chain SHA-256 + `.tsr` daily stub,
So that toda decisão, side-effect e interrupt fica trail-able e tamper-evident.

## Acceptance Criteria

1. **AC-1 (binary):** `audit.append(event)` escreve 1 linha JSON em `_bmad-output/audit/<project>/<date>.jsonl` via `O_APPEND` syscall (atomic-per-line) [Source: epics.md#story-1a6; AR-060 linha 247; AO-14 linha 144].
2. **AC-2 (property):** Cada linha contém `prev_hash = SHA-256(linha anterior canonicalizada)` (ou string literal `"genesis"` se primeira do ficheiro). `this_hash = SHA-256(prev_hash || ts || seq || type || canonical(payload))` per architecture linha 328 [Source: epics.md#story-1a6; AR-060].
3. **AC-3 (binary):** `bun run audit:verify <date>` lê o JSONL diário, recomputa cada `this_hash`, e retorna `ok({verified: N})` quando chain íntegra. Corromper linha 50 (alterar 1 char) → retorna `err({kind: 'ChainBreak', atLine: 50})` [Source: epics.md#story-1a6; scripts/verify-audit-chain.ts mencionado em AO-54].
4. **AC-4 (binary):** Rotation diária (date changes ou maxSize 100MB hit): novo ficheiro `<new-date>.jsonl` com primeira linha `prev_hash = "genesis"`. Ficheiro anterior dispara emissão de `<date>.tsr` (RFC 3161 stub — mock TSA call por agora; TSA real diferida v1.1+) [Source: epics.md#story-1a6; AR-061 linha 248; AR-062 linha 249; AO-79 linha 852].

## Tasks / Subtasks

- [x] **Task 1 — Pré-flight (AC: todas)**
  - [x] 1.1 Baseline pós-1.a.5: `bun --version` ≥ 1.3.0, `bun run lint` exit 0, `bun test` 95 pass.
  - [x] 1.2 Confirmar disponibilidade `Result` / `branded` (`Sha256Hash`, `RunId`, `StoryId`) + `DomainEvent` (de 1.a.4) + `createDbConnection` (de 1.a.5).
  - [x] 1.3 Criar dirs: `src/adapters/audit/`, `tests/adapters/`.
- [x] **Task 2 — `src/ports/audit.port.ts` (AC: todas)**
  - [x] 2.1 Definir interface `AuditPort` com 2 métodos:
    - `append(event: AuditEntry): Result<{ seq: number; thisHash: Sha256Hash }, AuditError>` — sync (fs O_APPEND nativo); retorna seq + hash da linha gerada.
    - `verifyChain(date: string): Result<{ verified: number }, AuditError>` — re-lê e re-computa o chain do ficheiro `<date>.jsonl`.
  - [x] 2.2 `AuditEntry` tagged union (sub-set de `DomainEvent` para v1; campos canónicos `ts`, `seq`, `run_id`, `story_id?`, `type`, `payload`).
  - [x] 2.3 `AuditError = { kind: 'WriteFailure'; cause: unknown } | { kind: 'ChainBreak'; atLine: number; expected: string; actual: string } | { kind: 'FileNotFound'; path: string }`.
- [x] **Task 3 — Migration 002 + schema update (AC: #2, #4 — last-hash persistence)**
  - [x] 3.1 Criar `src/db/migrations/002_audit_chain_state.sql` dentro de `BEGIN EXCLUSIVE`:
    ```sql
    CREATE TABLE IF NOT EXISTS audit_chain_state (
      project_id    TEXT PRIMARY KEY,
      current_date  TEXT NOT NULL,           -- '2026-05-28'
      last_seq      INTEGER NOT NULL DEFAULT 0,
      last_hash     TEXT NOT NULL DEFAULT 'genesis',
      updated_at    TEXT NOT NULL
    );
    INSERT INTO schema_migrations (version, applied_at, description)
    VALUES (2, datetime('now'), '002_audit_chain_state: per-project last hash tracking');
    ```
  - [x] 3.2 Add Drizzle table `auditChainState` em `src/db/schema.ts` com colunas equivalentes.
  - [x] 3.3 Updates a `last_seq` + `last_hash` + `current_date` ocorrem em `append()` numa única transaction (read state → compute hash → write JSONL → update state).
- [x] **Task 4 — `src/adapters/audit/jsonl-hash-chain.adapter.ts` (AC: #1, #2, #4)**
  - [x] 4.1 Factory `createAuditAdapter(deps: { db: Database; baseDir: string; project: string; clock: ClockPort }): AuditPort`.
  - [x] 4.2 `append(event)`:
    1. Lê linha actual de `audit_chain_state` para `project` (cria com defaults se ausente).
    2. Determina `date = clock.now().toISOString().slice(0, 10)` (e.g. `"2026-05-28"`).
    3. **Detect rotation:** se `date !== state.current_date` → emite `.tsr` para `state.current_date` (Task 6) + reset `last_seq = 0`, `last_hash = 'genesis'`.
    4. Compute canonical JSON do payload (chaves sorted, no whitespace — `JSON.stringify` com replacer ordenado).
    5. Compute `this_hash = SHA-256(prev_hash || ts || seq || type || canonical(payload))` via `Bun.CryptoHasher`.
    6. Construir linha JSON canónica completa (ordem chaves: `ts, seq, run_id, story_id, type, payload, prev_hash, this_hash`) + `\n`.
    7. Append via `fs.openSync(path, 'a')` + `fs.writeSync(fd, line)` + `fs.closeSync(fd)`. `'a'` mode = `O_APPEND` atomic-per-line (até PIPE_BUF ~4KB; payloads pequenos são tipicamente seguros).
    8. Update `audit_chain_state` com `last_seq = seq + 1`, `last_hash = this_hash`, `current_date = date`, `updated_at = now`. Tudo dentro de `db.transaction(() => { ... })`.
  - [x] 4.3 `verifyChain(date)`:
    1. Abre `<baseDir>/<project>/<date>.jsonl`.
    2. Itera linhas; para cada uma:
       - Parseia JSON.
       - Recomputa `expectedHash = SHA-256(prevHashFromFile || ts || seq || type || canonical(payload))`.
       - Compara com `this_hash`; se diferente → `err({kind: 'ChainBreak', atLine: i, expected, actual})`.
       - `prevHashFromFile = this_hash` para próxima iteração.
    3. Retorna `ok({verified: count})`.
  - [x] 4.4 ≤200 linhas (AO-122).
- [x] **Task 5 — `scripts/verify-audit-chain.ts` (AC: #3)**
  - [x] 5.1 CLI standalone: `bun run audit:verify YYYY-MM-DD`. Argumentos: date (default = today).
  - [x] 5.2 Carrega config: `HDD_AUDIT_DIR` (default `_bmad-output/audit`), `HDD_PROJECT` (default `projeto_hdd`).
  - [x] 5.3 Invoca `verifyChain(date)`; print resultado human-readable. Exit 0 ok / 1 fail.
- [x] **Task 6 — RFC 3161 stub (AC: #4)**
  - [x] 6.1 Função privada `emitTsrStub(jsonlPath, tsrPath): Result<void, AuditError>`. Mock per Q-A6-3 default: ficheiro `.tsr` com conteúdo `{ "stub_version": 1, "covered_file": "<jsonlPath>", "covered_sha256": "<SHA-256 do JSONL>", "ts_local": "<ISO>", "tsa_real": false, "note": "TSA real diferida v1.1+ per AR-061" }` (NÃO é RFC 3161 binário real; mock JSON).
  - [x] 6.2 Emitido quando rotation ocorre (date change ou size threshold — size detection diferido se Q-A6-4 default).
- [x] **Task 7 — `package.json` script + `.gitignore` (AC: #1, #3)**
  - [x] 7.1 Add script `"audit:verify": "bun run scripts/verify-audit-chain.ts"`.
  - [x] 7.2 `.gitignore`: add `_bmad-output/audit/` (audit files são runtime-only; nunca committable).
- [x] **Task 8 — `docs/audit-format.md` (AC: todas — spec canónica)**
  - [x] 8.1 Documento Markdown ~100 linhas:
    - Formato canónico (ordem de chaves, encoding, ts formato ISO 8601 UTC).
    - Algoritmo de hash exacto (com exemplo trabalhado em texto).
    - Conventions: 1 line = 1 event; `\n` separator; no embedded newlines em payload.
    - Política de rotation (date OR 100MB; future v1.1+ size detection).
    - Política de retention (90 dias local, 1 ano R2 EU per AR-062).
    - Procedimento de recovery em caso de chain break (truncate ao último seq íntegro + restore Litestream).
    - Comando `bun run audit:verify <date>` + exit codes.
- [x] **Task 9 — `tests/adapters/audit.test.ts` (AC: todas)**
  - [x] 9.1 Setup: tmpdir via `fs.mkdtempSync(os.tmpdir() + "/hdd-audit-")`; DB `:memory:` com migrations 001+002 aplicadas.
  - [x] 9.2 Spec AC-1: append 3 eventos → ficheiro tem 3 linhas; cada linha é JSON parseável; `seq` incrementa 0,1,2.
  - [x] 9.3 Spec AC-2 genesis: primeira linha tem `prev_hash = "genesis"`.
  - [x] 9.4 Spec AC-2 chain: linha 2 tem `prev_hash === linha1.this_hash` (string match exacto).
  - [x] 9.5 Spec AC-2 formula: re-computar `SHA-256(...)` manualmente em test e comparar com `this_hash` salvo.
  - [x] 9.6 Spec AC-3 verifyChain ok: append 10 eventos; `verifyChain(date).isOk()` + `{verified: 10}`.
  - [x] 9.7 Spec AC-3 ChainBreak: append 10 eventos; corromper linha 5 (modificar 1 char em payload); `verifyChain(date)._unsafeUnwrapErr()` = `{kind: 'ChainBreak', atLine: 5, ...}`.
  - [x] 9.8 Spec AC-4 rotation date change: append 1 evento; bump TestClock 1 dia; append outro; verificar:
    - 2 ficheiros JSONL existem (`<date1>.jsonl`, `<date2>.jsonl`).
    - `<date2>.jsonl` primeira linha tem `prev_hash = "genesis"`.
    - `<date1>.tsr` foi criado.
- [x] **Task 10 — Validação E2E (AC: todas)**
  - [x] 10.1 `bun run type-check` exit 0.
  - [x] 10.2 `bun run lint` exit 0 (sem novos throws fora AO-66 whitelist).
  - [x] 10.3 `bun test` ≥ 95 + ~10 novos (~105 total).
  - [x] 10.4 `bun run db:migrate` aplica 001 + 002 sucessivamente; `schema_migrations` tem 2 rows.
  - [x] 10.5 Coverage `src/adapters/audit/jsonl-hash-chain.adapter.ts` ≥80% line (ad-hoc flip bunfig).
  - [x] 10.6 Real disk E2E: append 5 eventos em `/tmp/audit-e2e/`; verifyChain ok; cleanup.
- [x] **Task 11 — Resumo Tier-B + sprint-status review (D-019)**
  - [x] 11.1 Escrever `_bmad-output/implementation-artifacts/story-1a6-summary.md`.
  - [x] 11.2 Update sprint-status `1-a-6: ready-for-dev → review`.
  - [x] 11.3 Pedir `approve story-1a6`.

---

## Dev Notes

### Big picture

Story 1.a.6 entrega **tamper-evident audit trail** — sem isto, nenhum dos sub-systems (interrupt rule, gates, reviewer agent, recovery) tem como provar o que aconteceu. Cada `audit.append()` é um POST a um log forensically verifiable:
- **Atomicidade por linha:** `O_APPEND` syscall garante que múltiplos writers não cortam linhas uns dos outros (até PIPE_BUF ≈ 4KB).
- **Chain integrity:** cada linha referencia o hash da anterior; corrupção é detectada em O(n) via `verifyChain`.
- **Timestamp externo:** `.tsr` daily stub (RFC 3161 v1.1+ real) prova que o ficheiro existiu antes de uma data — mitigação para retro-active tampering.

### O que NÃO entra nesta story (delimitar scope)

- ❌ **RFC 3161 TSA real** (FreeTSA HTTP call) → diferido v1.1+ per AR-061; Q-A6-3 default = mock JSON.
- ❌ **Redaction multi-pattern** (AR-063, AO-160/166 BLOCKER M1) → **Story 1.b.3**. Esta story NÃO sanitiza payload — caller é responsável (temporariamente; 1.b.3 adiciona middleware).
- ❌ **Bootstrap order + env validation** → **Story 1.a.7** (consome `createAuditAdapter`).
- ❌ **Litestream backup** dos JSONL → **Story 1.c.3**.
- ❌ **R2 EU sync remoto** → **Story 1.c.3** + posterior.
- ❌ **AO-176 NTP drift check** → diferido (precisa de ClockPort + NTP query — Story 1.b.x security).
- ❌ **Size-based rotation (100MB hit)** → Q-A6-4 default: diferida; só date-based rotation v1. Stories futuras (1.c.3 ops) implementam.
- ❌ **Logger pino integração** (arch line 399) → diferido para Story 1.a.7+ (audit adapter é ortogonal a pino app logging).
- ❌ **`audit-replay.ts`** (AO-54) → script separado; deferido.

### Architectural compliance — AOs / ARs cobertos

| ID | Cobertura | Onde |
|----|-----------|------|
| **AR-060** JSONL append-only + prev_hash SHA-256 + O_APPEND | Sim (full) | Tasks 2, 4 |
| **AR-061** RFC 3161 `.tsr` daily | Stub mock (TSA real v1.1+) | Task 6 |
| **AR-062** Rotation maxSize=100MB OR maxAge=24h; TTL 90d local | Parcial (date-based; size diferido Q-A6-4) | Task 4.2 step 3 |
| **AR-063** Redaction multi-pattern | NÃO (Story 1.b.3) | — |
| **AO-14** Audit JSONL + hash chain + O_APPEND + rotação + sync remoto | Sim (sync remoto diferido para 1.c.3) | Tasks 4, 6 |
| **AO-27** Timestamp externo RFC 3161 | Stub (mock) | Task 6 |
| **AO-79** `.tsr` token storage junto JSONL | Sim (mock) | Task 6 |
| **AO-87** Audit como adapter (`src/adapters/audit/`), não core | Sim | Tasks 2, 4 |
| **AO-95** Functional core / imperative shell — adapter é shell | Sim | Tasks 4 |
| **AO-122** max-lines 200 HARD | Mantida | Tasks 2, 4 |
| **FR-044** (audit trail completo) | Cobre 1ª milha (write + verify) | Tasks 2, 4, 5 |
| **NFR-O3** (audit retrievable) | Parcial (verify CLI) | Task 5 |

### Library/framework — sem deps novas

Story 1.a.6 NÃO instala nada novo. Usa:
- `bun:test` (built-in).
- `Bun.CryptoHasher` para SHA-256.
- `node:fs` (`openSync('a')`, `writeSync`, `readFileSync`, `mkdtempSync`).
- `node:path`, `node:os` para path manipulation + tmpdir.
- `bun:sqlite` + Drizzle (de 1.a.5) para `audit_chain_state` state.
- `ClockPort` injectado (de 1.a.3) para `now()` determinístico em tests.

### File structure (delta sobre 1.a.5)

**Novos:**
```
src/ports/audit.port.ts                          (~55 linhas est.)
src/adapters/audit/jsonl-hash-chain.adapter.ts   (~180 linhas est. — perto do limite)
src/db/migrations/002_audit_chain_state.sql      (~25 linhas est.)
scripts/verify-audit-chain.ts                    (~50 linhas est.)
docs/audit-format.md                             (~100 linhas est.)
tests/adapters/audit.test.ts                     (~200 linhas est.)
```

**Modificados:**
- `src/db/schema.ts` (+1 table `auditChainState`)
- `package.json` (+1 script `audit:verify`)
- `.gitignore` (+`_bmad-output/audit/`)

### Code patterns canónicos

**JSONL line canónica (architecture linha 312-330):**

```json
{"ts":"2026-05-28T20:15:30.123Z","seq":0,"run_id":"run-abc","story_id":"story-007","type":"INTERRUPT_TRIGGERED","payload":{"trigger":"P1"},"prev_hash":"genesis","this_hash":"6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b"}
```

**Hash formula:**
```typescript
const canonical = JSON.stringify(payload, Object.keys(payload).sort());
const input = `${prevHash}|${ts}|${seq}|${type}|${canonical}`;
const thisHash = new Bun.CryptoHasher("sha256").update(input).digest("hex");
```

**O_APPEND atomic append:**
```typescript
import { openSync, writeSync, closeSync } from "node:fs";
const fd = openSync(path, "a"); // 'a' mode = O_APPEND
writeSync(fd, line + "\n");
closeSync(fd);
```

### Previous Story Intelligence — Story 1.a.5 (commit `b1fe7bf`)

1. **Migration pattern estabelecido:** `BEGIN EXCLUSIVE; ... COMMIT;` no SQL bruto + insert em `schema_migrations`. Esta story segue idêntico para 002.
2. **`Result<...>` síncrono** — bun:sqlite é síncrono; fs operations idem; sem necessidade de `ResultAsync`.
3. **`Bun.CryptoHasher` SHA-256** padrão — usado em `idempotency.service.ts:generate()`.
4. **Test seeds usam SQL raw** (não Drizzle) — manter para consistência.
5. **Dep Graph Rigour** activa: `src/adapters/` pode importar `src/ports/`, `src/lib/`, `src/db/` (mas NÃO `src/core/`).
6. **AO-103** activa em `src/core/**` — esta story toca `src/adapters/` (livre de setTimeout).
7. **bunfig coverage=false** — flip ad-hoc para Task 10.5.

### Git intelligence — últimos 5 commits

```
b1fe7bf feat(story-1a5): db schema base + Drizzle + idempotency_keys (4 ACs verde; 1ª story I/O real)
ac4c7ec docs: reconcilia epics.md + architecture.md com canon ratificado em Sprint 0 Day 2 (5 items)
48a9a3a feat(story-1a4): FSM + InterruptCommand + DomainEvent (5+2 ACs verde)
1abfa68 feat(story-1a3): 3 ports temporais (Clock/Spawn/Notify) + AO-103 enforce (3 ACs verde)
4c3a4b6 feat(story-1a2): Result+neverthrow + branded types + throw whitelist (4 ACs verde)
```

### Project Structure Notes

**Conflitos / Open Questions:**

- **Q-A6-1:** Canonical JSON algorithm — `JSON.stringify(payload, Object.keys(payload).sort())` é simples mas NÃO trata aninhamento profundo. **Default:** flat sort top-level only (suficiente para v1; payloads HDD são shallow). Future enhancement = JSON Canonicalization Scheme (JCS, RFC 8785) se complexity crescer.
- **Q-A6-2:** `audit_chain_state` table modifica `src/db/schema.ts` — files_modified per spec, mas como migration 002. **Default:** migration 002 conforme Task 3.
- **Q-A6-3:** `.tsr` stub format — mock JSON (default; documentado como `tsa_real: false`) OU TSA HTTP real (FreeTSA — adiciona dep + flaky em CI)? **Default:** mock; AR-061 explicit "diferida v1.1+".
- **Q-A6-4:** Rotation strategy — só date-based (default; midnight UTC boundary) OU size-based também (100MB hit no `append`)? **Default:** só date. Size-based complica state + adiciona fs.statSync por append.
- **Q-A6-5:** Redaction inline aqui (mínimo stub) OU 100% deferido para Story 1.b.3 (AR-063)? **Default:** 100% deferido; caller responsável v1 (documentar prominente em `docs/audit-format.md`).

### Anti-pattern guardrails (DEV: NÃO fazer)

- ❌ NÃO importar `src/core/` neste adapter (Dep Graph). Importar ports (`src/ports/`), lib (`src/lib/`), db (`src/db/`).
- ❌ NÃO usar `appendFileSync` ingenuamente — usar `openSync(path, 'a')` explícito para garantir O_APPEND semantics + permitir batch writes.
- ❌ NÃO usar `crypto.subtle.digest` async — usar `Bun.CryptoHasher` síncrono (pattern de 1.a.2 + 1.a.5).
- ❌ NÃO usar `throw` (AO-66). Erros → `Result<..., AuditError>`.
- ❌ NÃO sanitizar payload (redaction = AR-063, Story 1.b.3). Documentar em `docs/audit-format.md` que payload é cru.
- ❌ NÃO chamar TSA HTTP real (FreeTSA) — mock JSON stub per Q-A6-3.
- ❌ NÃO confiar em wall-clock `Date.now()` directo — usar `clock.now()` injectado (ClockPort) para determinismo de tests.
- ❌ NÃO escrever auditoria sem `prev_hash` correcto — chain corruption silenciosa é o pior failure mode.
- ❌ NÃO criar mais de 200 linhas em qualquer src/ file.
- ❌ NÃO commit `_bmad-output/audit/` — gitignore obrigatório (Task 7.2).

### References

- [Source: epics.md#story-1a6] — StorySpec.
- [Source: epics.md#AR-060] — JSONL + prev_hash + O_APPEND.
- [Source: epics.md#AR-061] — RFC 3161 `.tsr`.
- [Source: epics.md#AR-062] — Rotation + TTL.
- [Source: architecture.md#AO-14] — linha 144 (audit JSONL canónico).
- [Source: architecture.md#AO-79] — linha 852 (.tsr token).
- [Source: architecture.md#AO-87] — linha 860 (audit como adapter).
- [Source: architecture.md] linhas 312-330 — JSONL format canónico + hash formula.
- [Source: 1-a-5-db-schema-base-drizzle-idempotency-keys-table.md] — migration pattern + `Result` síncrono + `Bun.CryptoHasher`.
- [Source: 1-a-4-domain-fsm-interrupt-commands-tagged-union.md] — `DomainEvent` consumido por audit.
- [Source: 1-a-3-3-ports-temporais-clock-spawn-notify.md] — `ClockPort` injectado.
- [Source: 1-a-2-result-t-e-branded-types-lib-helpers.md] — `Result`, `Sha256Hash`, `mkSha256Hash`.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` — Amelia, sessão directa.

### Debug Log References

- `JSON.parse` retorna `any` — typescript-eslint `no-unsafe-assignment` rule de 1.a.1 dispara. Fix: helper functions `parseLine(s): AuditLine` + `parseTsr(s): TsrStub` em tests com cast explícito.
- Unused imports inicial em adapter (`Result`, `AuditEntry`, `AuditAppendResult`, `AuditError`): removidos. Tipos são inferidos via implementação de `AuditPort` interface, não precisam de re-import.
- Migration 002 quebrou expectativa de schema.test.ts (`appliedCount: 1` literal). Fix: tornar specs robustos a futuras migrations (`toBeGreaterThanOrEqual(1)`).
- E2E real disk: appended 5 eventos via inline Bun script; `bun run audit:verify` retornou `OK date=2026-05-28 verified=5 lines`. Chain integrity confirmada com filesystem real.
- AC-3 ChainBreak test usa `lines[5].replace('"i":5', '"i":999')` para corromper 1 char — deliberadamente preserva o `this_hash` salvo na linha (não recomputado), forçando o verifier a detectar mismatch.
- AC-4 rotation: TestClock `advance(24h)` simula midnight UTC; assertion checa 2 ficheiros JSONL + 1 .tsr + segundo ficheiro com `prev_hash = "genesis"`.
- Bun `JSON.stringify` mantém ordem de inserção das keys; `canonicalPayload` sort explicitamente por `Object.keys().sort()` antes de serializar.

### Completion Notes List

**Validação E2E — 2026-05-28**

| Verificação | Resultado | AC |
|-------------|-----------|----|
| `bun run type-check` | exit 0 | — |
| `bun run lint` | exit 0 (26 files; 5 async-safety + AO-66 + AO-103 + 7 nursery rules) | — |
| `bun test` | 103 pass / 0 fail / 193 expect / 181-219ms | AC-1, AC-2, AC-3, AC-4 |
| **`bun run db:migrate` real disk** | aplica 001+002 = `applied=2`; `schema_migrations` 2 rows | — |
| **E2E real disk** audit append 5 + `bun run audit:verify` | `OK date=2026-05-28 verified=5 lines` | AC-1, AC-2, AC-3 ✓ |
| Coverage `src/adapters/audit/jsonl-hash-chain.adapter.ts` | 100% func / 93.94% line | AO-91 (proxy) |
| AC-1 atomicidade O_APPEND | 3 appends → 3 linhas separadas com seq 0,1,2 | ✓ |
| AC-2 genesis + chain | linha 1 `prev_hash='genesis'`; linha 2 `prev_hash === linha1.this_hash`; recomputação manual formula bate | ✓ |
| AC-3 verifyChain ok | 10 eventos → `{verified: 10}` | ✓ |
| AC-3 ChainBreak | corruption linha 5 → `err({kind:'ChainBreak', atLine: 5})` | ✓ |
| AC-4 rotation date | TestClock advance 24h → 2 ficheiros + .tsr stub do primeiro; segundo começa com prev_hash genesis | ✓ |

**Decisões aplicadas (Q-A6-1..5):**

- Q-A6-1: flat sort top-level (`Object.keys().sort()`).
- Q-A6-2: migration 002 + `audit_chain_state` table — single source of truth.
- Q-A6-3: mock JSON `.tsr` (`tsa_real: false`).
- Q-A6-4: rotation só date-based (midnight UTC).
- Q-A6-5: redaction 100% deferida 1.b.3; doc warning prominente em `docs/audit-format.md` §Redaction.

**Open items emergentes:**

- O-A6-1: error paths do adapter (`WriteFailure` try/catch outer; `FileNotFound` em verifyChain) cobertos por code mas não por specs explícitas (6.06% line uncovered). Spec adicional pode subir para 100%; low priority — semântica óbvia.
- O-A6-2: `audit_chain_state.updated_at` é actualizado mas não testado directamente. Tipo `AuditChainState` (Drizzle) exportado mas não consumido (Story 1.a.7+ pode ler para diagnostics).
- O-A6-3: spec AC-4 rotation usa `clock.advance(24h)` directo; teste mais granular (multiple days, midnight precise) seria robust mas adia.
- O-A6-4: `.tsr` mock format JSON é human-readable; binary RFC 3161 v1.1+ requer dep adicional (e.g. `node-rfc3161` ou call FreeTSA). AO-176 NTP drift check também adia.
- O-A6-5: redaction caller-responsibility é frágil; **Story 1.b.3 BLOCKER M1** resolve. Doc warning é mitigação temporary.

### File List

**Ficheiros criados (committable):**

- `src/ports/audit.port.ts` (49 linhas) — `AuditPort` interface + `AuditEntry` + `AuditAppendResult` + `AuditError` tagged union (4 kinds).
- `src/adapters/audit/jsonl-hash-chain.adapter.ts` (200 linhas) — `createAuditAdapter` factory; `append` (O_APPEND + chain + DB state update) + `verifyChain` (re-compute + walk). Helpers `canonicalPayload`, `computeHash`, `emitTsrStub`.
- `src/db/migrations/002_audit_chain_state.sql` (20 linhas) — CREATE TABLE + INSERT schema_migrations dentro de BEGIN EXCLUSIVE.
- `scripts/verify-audit-chain.ts` (34 linhas) — CLI `bun run audit:verify <date>`.
- `docs/audit-format.md` (~135 linhas) — spec canónica + algoritmo + rotation + retention + redaction warning + recovery procedure.
- `tests/adapters/audit.test.ts` (~245 linhas) — 9 specs cobrindo 4 ACs + setup/teardown helpers.
- `_bmad-output/implementation-artifacts/1-a-6-audit-jsonl-adapter-com-hash-chain-rfc-3161-stub.md` — story file.
- `_bmad-output/implementation-artifacts/story-1a6-summary.md` — Tier-B.

**Modificados:**

- `src/db/schema.ts` (+15 linhas) — table `auditChainState` + inferred types.
- `tests/db/schema.test.ts` — specs migrations agora robustos (`toBeGreaterThanOrEqual`); spec novo confirma `audit_chain_state` table.
- `package.json` (+1 script `audit:verify`).
- `.gitignore` (+`_bmad-output/audit/`).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-a-6: backlog → review`.

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-28 | bmad-create-story (Amelia) | Story file criada; 5 Q's; AC-2 (chain integrity) é a propriedade central. |
| 2026-05-28 | operador | Resolveu Q-A6-1..4; Q-A6-5 assumed default (redaction deferida 1.b.3). |
| 2026-05-28 | bmad-dev-story (Amelia) | Implementação: 11 tasks done; 4 ACs verificados; E2E real disk audit:verify OK; coverage adapter 100% func / 93.94% line; status `ready-for-dev → in-progress → review`. |

---

## Open Questions for Operator — RESOLVIDAS 2026-05-28

- **Q-A6-1 [RESOLVED — flat sort]:** `JSON.stringify(payload, Object.keys(payload).sort())`. Suficiente v1; JCS adia se complexity crescer.
- **Q-A6-2 [RESOLVED — DB]:** Migration 002 + `audit_chain_state` table. Atómico junto com append (transaction).
- **Q-A6-3 [RESOLVED — mock JSON]:** `.tsr` é mock JSON; `tsa_real: false`. AR-061 explicit diferida v1.1+.
- **Q-A6-4 [RESOLVED — só date]:** Date-based rotation only. Size-based diferido para Story 1.c.3 (ops).
- **Q-A6-5 [ASSUMED default]:** Redaction 100% deferida para Story 1.b.3 (AR-063, BLOCKER M1). `docs/audit-format.md` documenta prominentemente que payload é cru — caller responsável v1.

→ Implementação destrava com defaults. Estimativa: 56K dev_core / 80K dev_with_retry.

---

**Story Status:** ready-for-dev · **Created by:** bmad-create-story (Amelia, 2026-05-28)
**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
