# Story 1.b.3: Audit redaction multi-pattern

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `audit adapter`,
I want um filtro de redaction multi-pattern (Anthropic key, Bearer/Basic/Authorization, `wa_id`, números de telefone, generic secret, env-var leak, n8n verbose body) aplicado **antes** do write no JSONL,
so that o audit nunca fica com secrets em plain-text — mesmo que código LLM-generated faça log directo (AO-160 + AO-166, DRB BLOCKER).

## Acceptance Criteria

1. **(binary — AO-160/AO-166)** **Given** um event payload que contém `Authorization: Bearer sk-ant-api03-xxx...`
   **When** `audit.append` corre
   **Then** a linha JSONL escrita contém `Authorization: Bearer ***REDACTED***` (o token nunca toca o disco).

2. **(coverage ≥9/9)** **Given** fixtures com 9 categorias de secret
   **When** corro `bun test tests/lib/redaction.security.test.ts`
   **Then** 9/9 redigidas: `anthropic-key`, `bearer-token`, `basic-auth`, `wa_id 55*`, `phone-pt`, `phone-br`, `generic-secret`, `env-var-leak`, `n8n-verbose-body`.

3. **(binary)** **Given** o hash-chain do audit
   **When** a redaction é aplicada
   **Then** o `this_hash` é computado sobre o payload **já redigido** (chain reflecte os bytes realmente escritos; `verifyChain` continua verde — sem regressão nos testes 1.a.6).

4. **(binary — CI gate)** **Given** `scripts/verify-redaction.ts` + step truffleHog no `ci.yml`
   **When** correm sobre uma fixture com secrets injectadas + scan ao log directory
   **Then** `verify-redaction.ts` exit 0 (zero leaks) e o step truffleHog corre em CI.
   **And** ΔCI ≤ 10s.

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/redaction.ts` (puro)** (AC: #1, #2) — `REDACTION_PATTERNS` (10: 9 categorias + ghp_/AKIA AO-175); `redactString` (sweep + size-cap `…[TRUNCATED n bytes]`); `redactValue` recursivo sem mutação; `redactPayload` entry. Replacement uniforme `***REDACTED***`.
- [x] **Task 2 — `src/adapters/audit/jsonl-hash-chain.adapter.ts` (MODIFY)** (AC: #1, #3) — `redactPayload(event.payload)` antes de `computeHash`; hash E line ambos do redigido. Correlation IDs/rotation/O_APPEND/verifyChain preservados.
- [x] **Task 3 — `tests/lib/redaction.security.test.ts`** (AC: #1, #2) — 16 specs: AC1 exacto + 9/9 categorias + recursão + no-mutate + no-false-positive + size-cap + property (fast-check).
- [x] **Task 4 — Regressão `tests/adapters/audit.test.ts`** (AC: #3) — append com Bearer sk-ant + wa_id → segredo ausente do ficheiro + linha redigida + verifyChain verde. Specs 1.a.6 verdes.
- [x] **Task 5 — `scripts/verify-redaction.ts`** (AC: #4) — fixture 9 categorias + nested → scan 9 assinaturas → exit 0 (0 leaks).
- [x] **Task 6 — `.github/workflows/ci.yml` (CREATE)** (AC: #4) — workflow: setup-bun + install + lint/type-check/test + `verify-redaction.ts` + job truffleHog.
- [x] **Task 7 — gates**: type-check clean · lint exit 0 · `bun test` 205 pass/0 fail.
- [x] **Task 8 (FINAL) — Tier-B summary via generator (5ª dogfood)**: `scripts/generate-1b3-summary.ts` + `finalize()` → auto-commit `summary(story-1b3): ...`. Sprint-status `1-b-3 → review`.

## Dev Notes

### Big picture

3ª das 5 stories do Epic 1.b e **DRB BLOCKER #3** (AO-160 + AO-166). O audit é tamper-evident (1.a.6), mas hoje **delega a redaction ao caller** (docstring do adapter: "Redaction NÃO implementada aqui → Story 1.b.3"). Esta story fecha esse buraco: a redaction passa a ser aplicada **dentro** do adapter, antes de qualquer byte tocar o disco, garantindo `never-store-raw-tokens` mesmo que um caller LLM-generated esqueça de sanitizar.

### Scope delimitation (LER)

- **IN-SCOPE:** biblioteca de redaction pura (9+ patterns) + wiring no audit adapter pre-write + hash sobre redigido + script de verificação + workflow CI com truffleHog.
- **OUT-OF-SCOPE (stories/deployment futuros):**
  - R2 `publicAccessBlock` (AO-160 metade-deployment) — runbook/infra, não código.
  - Pino transport interceptando TODAS as mensagens (AO-175) — logging infra, story de observabilidade.
  - Validação de backup destinations + periodic ACL audit (AO-166 cauda) — runbook.
  - `state.db` cached-fields redaction (AO-166) — o gate aqui é o JSONL; DB redaction é story dedicada se necessário.

### AO / requirement matrix

| Código | Obrigação | Onde nesta story |
|---|---|---|
| **AO-160** 🚨 BLOCKER | Audit-redactor middleware (+ R2 publicAccessBlock → out-of-scope) | `redaction.ts` + wiring no adapter |
| **AO-166** | Redaction multi-pattern (header + error msg) + never-store-raw-tokens | redaction pre-write + hash sobre redigido (AC3) |
| **AO-175** | Value-based patterns `sk-ant-`, `ghp_`, `AKIA`, S3 secret | incluídos na tabela de patterns |
| **AR-063 / NFR-S2** (epics-only) | rótulos epics-level; canon = AO-160/166/175 (O-A6-6) | nota reconciliação |
| **Pentest PT-3** (label) | scan truffleHog + fixture de secrets | `verify-redaction.ts` + ci.yml |

> **Nota numeração PT (recorrente, ver O-B1-1):** epics rotula este "PT-3" mas `architecture.md:1973` define PT-3 = docker `-v`. Label material implementado; reconciliação no follow-up O-B1-1.

### Current state do ficheiro MODIFY (audit adapter)

- `append(event)`: resolve runId (1.a.9) → lê `audit_chain_state` → rotation/.tsr → `computeHash(prevHash, ts, seq, type, payload)` → escreve `line` (O_APPEND) → UPDATE state. **O delta desta story:** inserir `redactPayload(event.payload)` e usar o resultado tanto no `computeHash` como na `line`. Tudo o resto preservado.
- `computeHash` usa `canonicalPayload` (sort top-level keys). Redigir antes não quebra a canonicalização (apenas muda valores string).
- `verifyChain` re-computa o hash a partir do payload **escrito** (já redigido) → continua consistente porque hash e payload escritos são ambos do redigido (AC3).

### Esboços de tipos

```ts
// src/lib/redaction.ts
export type RedactionPattern = { readonly name: string; readonly re: RegExp; readonly repl: string };
export const REDACTION_PATTERNS: ReadonlyArray<RedactionPattern>;
export function redactString(s: string): string;
export function redactValue(v: unknown): unknown;
export function redactPayload(p: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>>;
```

### Previous story intelligence (1.b.1 + 1.b.2 + 1.a.6)

- **1.b.1/1.b.2:** factory pattern, fake `AuditPort` em-memória, `String.fromCharCode`/`charCodeAt` para evitar control-char corruption no Write (irrelevante aqui), property tests com fast-check (4.8.0 já instalado).
- **1.a.6 (audit):** o adapter real é `createAuditAdapter({ db, baseDir, project, clock })`; tests usam `:memory:` + `mkdtempSync` + `createTestClockAdapter` + `applyMigrations`. **Reusar o harness de `tests/adapters/audit.test.ts`** (linha 50-58) para a regressão.
- **1.a.10 bug:** `current_date` SQL keyword quoting — não tocar nessa query.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** redigir o `type` do evento (enum interno controlado) nem `runId`/`storyId` (correlation, não-secret) — só o `payload`.
- ❌ **NÃO** computar o hash sobre o payload cru e depois redigir a `line` (criaria mismatch hash≠conteúdo e quebraria `verifyChain`). Redigir **primeiro**, hash e line ambos do redigido (AC3).
- ❌ **NÃO** mutar `event.payload` in-place — devolver cópia (o caller pode reusar o objecto).
- ❌ **NÃO** usar regex catastróficas (ReDoS) — patterns lineares, sem backtracking aninhado; testar com input grande.
- ❌ **NÃO** falsos-positivos agressivos que reduzam o audit a `***REDACTED***` ilegível — patterns ancorados a assinaturas concretas.
- ❌ **NÃO** depender de truffleHog instalado localmente (pode não estar neste ambiente) — `verify-redaction.ts` é o gate autoritativo local; truffleHog corre em GH Actions.
- ❌ **NÃO** exceder `maxLines: 200` (Biome HARD em `src/**`) — se a tabela de patterns crescer, manter conciso.

### Project Structure Notes

- `src/lib/redaction.ts` (NEW, puro) · `tests/lib/redaction.security.test.ts` (NEW) · `scripts/verify-redaction.ts` (NEW) · `src/adapters/audit/jsonl-hash-chain.adapter.ts` (MODIFY) · `tests/adapters/audit.test.ts` (MODIFY — +regressão) · `.github/workflows/ci.yml` (CREATE — não existia).
- `noUncheckedIndexedAccess`: cuidado em `match`/capture-group access e recursão sobre arrays.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.b.3] — StorySpec, ACs, files, blocked_by [1.a.6].
- [Source: _bmad-output/planning-artifacts/architecture.md:1935] — AO-160 (redactor middleware + R2).
- [Source: _bmad-output/planning-artifacts/architecture.md:1946] — AO-166 (multi-pattern + never-store-raw).
- [Source: _bmad-output/planning-artifacts/architecture.md:1965] — AO-175 (value-based patterns sk-ant-/ghp_/AKIA).
- [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts] — ficheiro MODIFY (append pre-write).
- [Source: src/ports/audit.port.ts:14] — docstring "Redaction → Story 1.b.3".

## Open Questions for Operator

- **Q-B3-1 (replacement token):** [RESOLVED — uniforme `***REDACTED***`] AC1 literal; sem leak do tipo de segredo.
- **Q-B3-2 (n8n-verbose-body):** [RESOLVED — size-cap + truncar] String > `MAX_FIELD_LEN` (~2KB) → `…[TRUNCATED <n> bytes]`; cobre AP-3.
- **Q-B3-3 (hash sobre redigido):** [RESOLVED — sobre redigido] hash e line ambos do redigido; never-store-raw AO-166; verifyChain verde.
- **Q-B3-4 (CI / truffleHog):** [RESOLVED — ci.yml + script gate] criar `.github/workflows/ci.yml` mínimo; `verify-redaction.ts` gate local; truffleHog em GH Actions.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `bun run type-check` → clean à 1ª.
- `bun test tests/lib/redaction.security.test.ts` → 16 pass.
- `bun run scripts/verify-redaction.ts` → exit 0 (9 assinaturas, 0 leaks).
- `bun test` (full) → 205 pass / 0 fail (was 188; +17: 16 redaction + 1 audit regressão).
- `bun run lint` → exit 1 inicial: (a) format (lint:fix), (b) **noUnusedVariables** `covered` (leftover de contagem manual) → removido; a contagem 9/9 já é assert separado (`expect(cases).toHaveLength(9)`). Depois exit 0 (23 infos `useLiteralKeys` pré-existentes, info-only).

### Completion Notes List

- **AO-160 + AO-166 + AO-175** materializados: redaction multi-pattern aplicada no audit adapter ANTES do hash+write (never-store-raw-tokens). 10 patterns (anthropic, ghp_, AKIA, bearer, basic, generic-secret, env-var, phone-pt, phone-br, wa_id) + size-cap n8n.
- **AC3 (crítico):** hash computado sobre o payload **redigido** → `verifyChain` continua coerente (hash e bytes escritos do mesmo redigido). Specs 1.a.6 verdes sem alteração.
- **Decisão de robustez:** `redactValue` devolve cópia (não muta `event.payload` — o caller pode reusar). Patterns lineares (sem ReDoS).
- **CI criado de raiz** (`.github/workflows/ci.yml` não existia): inclui o gate `verify-redaction.ts` + job truffleHog. truffleHog não corre localmente (gate local autoritativo = o script).
- **Scope:** R2 publicAccessBlock (AO-160 deployment), pino transport (AO-175), backup/ACL audit (AO-166 cauda) ficam out-of-scope (runbooks/observabilidade).

### File List

- `src/lib/redaction.ts` (NEW, ~95L)
- `src/adapters/audit/jsonl-hash-chain.adapter.ts` (MODIFY — redact pre-write)
- `tests/lib/redaction.security.test.ts` (NEW, 16 specs)
- `tests/adapters/audit.test.ts` (MODIFY — +1 regressão)
- `scripts/verify-redaction.ts` (NEW — CI/local gate)
- `.github/workflows/ci.yml` (NEW — 1º workflow CI do repo)
- `scripts/generate-1b3-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.b.3 criada (`ready-for-dev`); 4 Open Questions resolvidas (todas Recommended). |
| 2026-05-29 | Implementação completa: `redaction.ts` (10 patterns + size-cap) + wiring no audit adapter (hash sobre redigido) + 16 specs + regressão audit + `verify-redaction.ts` + `ci.yml` (1º CI do repo). type-check/lint/test verdes (205 pass). AO-160/166/175 materializados. Status → `review`. |
