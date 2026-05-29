# Story 1.b.2: Two-step confirmation acções irreversíveis

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want que toda acção irreversível (deploy, branch-delete, force-push, schema-drop, audit-purge) exija two-step confirmation via WhatsApp Quick Reply (código 6-char single-use) OU CLI `--i-really-mean-it`,
so that o worker LLM-driven não pode executar uma destrutiva sem aprovação humana explícita (AO-155 + AO-164, DRB BLOCKER #2).

## Acceptance Criteria

1. **(binary — AO-155/AO-164)** **Given** catálogo `IRREVERSIBLE_ACTIONS = ['deploy','branch-delete','force-push','schema-drop','audit-purge']`
   **When** o worker tenta `deploy` sem confirmation
   **Then** retorna `err({ kind: 'ConfirmationRequired', action: 'deploy' })`, emite audit event (`ConfirmationRequired`), gera um código 6-char alphanumeric single-use (expira 60s, tied `wa_id`) e a FSM fica em `paused_for_interrupt` aguardando Quick Reply `IrrevConfirmYes`.

2. **(binary)** **Given** worker em `paused_for_interrupt` aguardando confirmation de `deploy`
   **When** chega payload `IrrevConfirmNo`
   **Then** a acção é abortada, emite audit event `IrreversibleActionAborted`, e a FSM retoma (`OperatorResponded → running`) **sem** executar a acção.

3. **(binary)** **Given** CLI flag `--i-really-mean-it`
   **When** o operador invoca a acção com a flag (`cliOverride = true`)
   **Then** o 2-step WhatsApp é bypassed (CLI já é human-driven) e a acção é autorizada (audit `IrreversibleActionConfirmed` com `via: 'cli-override'`).
   **And** ΔCI ≤ 10s.

4. **(binary — AO-164 propriedades do código)** **Given** um código emitido
   **When** o operador responde `IrrevConfirmYes` com o código correcto dentro de 60s e do `wa_id` certo
   **Then** retorna `ok({ kind: 'confirmed', action })`, consome o código (single-use — 2ª tentativa falha), e respeita rate-limit (≤3 emissões/hora por `wa_id`; a 4ª → `err({ kind: 'RateLimited' })`).

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/irreversible-action-catalog.ts` (puro)** (AC: #1) — 5 acções + `IrreversibleAction` + `isIrreversibleAction` type guard.
- [x] **Task 2 — `src/core/domain/interrupt-commands.ts` (MODIFY)** (AC: #1, #2) — +`IrrevConfirmYes`/`IrrevConfirmNo` no union + `irrev_confirm_yes`/`irrev_confirm_no` no PAYLOAD_MAP; 5 base + parser exacto Q-A4-2 preservados.
- [x] **Task 3 — `src/services/confirmation-gate.service.ts` (shell)** (AC: #1–4)
  - [x] Factory `createConfirmationGate({ clock, audit, codeGen? })`; síncrono (`Result`).
  - [x] `requireConfirmation`: cliOverride→bypassed+audit; não-catalogada→not-required; rate-limit→RateLimited; normal→gera código + pending + `ConfirmationRequired`.
  - [x] `confirm`: CodeInvalid/CodeExpired(cleanup)/WaIdMismatch(não consome, anti-DoS); válido consome single-use; approved false→aborted, true→confirmed.
  - [x] codeGen default 6-char ambiguity-safe (charset 31 chars, sem 0/O/1/I/L) via `crypto.getRandomValues`; injectável.
- [x] **Task 4 — `tests/services/confirmation-gate.test.ts`** (AC: #1–4) — 16 specs cobrindo AC1-4 + catálogo + parser regression. Fake AuditPort + `createTestClockAdapter.advance` p/ expiry/rate-window.
- [x] **Task 5 — gates**: type-check clean · lint exit 0 · `bun test` 188 pass/0 fail.
- [x] **Task 6 (FINAL) — Tier-B summary via generator (4ª dogfood)**: `scripts/generate-1b2-summary.ts` + `finalize()` → auto-commit `summary(story-1b2): ...`. Sprint-status `1-b-2 → review`.

## Dev Notes

### Big picture

2ª das 5 stories do Epic 1.b e **DRB BLOCKER #2** (AO-155 + AO-164). Vector de composição AI-Safety: um worker LLM-driven não pode executar acções destrutivas (deploy, force-push, drops) sem um humano no loop. A defesa é um *gate* de confirmação two-step: o worker pede → operador confirma via WhatsApp Quick Reply com código de uso único → só então a acção corre. Alternativa human-driven: CLI flag explícita.

### Scope delimitation (LER)

- **IN-SCOPE:** catálogo de acções irreversíveis + serviço de gate puro de lógica (geração/validação de código, single-use, expiry 60s, tied `wa_id`, rate-limit 3/hora, bypass CLI) + variantes de interrupt-command + audit events. Cobre AO-155 + AO-164.
- **OUT-OF-SCOPE (stories futuras):**
  - Wiring real na FSM e na orquestração do worker (Epic 4.x) — esta story NÃO modifica `src/core/fsm.ts`; reusa os estados/eventos existentes (`paused_for_interrupt` ← `InterruptS*`, `OperatorResponded → running`).
  - O subcommand `hdd-worker deploy` em si (Story 2.x expande o CLI) — AC3 é satisfeito ao nível do serviço via flag `cliOverride`; o teste exercita a flag, não um subcommand novo.
  - Envio do código via WhatsApp (NotifyPort, E3/F3) — o serviço devolve `ConfirmationRequired`; quem envia é o orquestrador.

### AO / requirement matrix

| Código | Obrigação | Onde nesta story |
|---|---|---|
| **AO-155** 🚨 BLOCKER | Two-step confirmation acções irreversíveis (Quick Reply + código sessão único) | `confirmation-gate.service.ts` + interrupt variants |
| **AO-164** | Código **6-char alphanumeric** (não 4-digit); **single-use**; **expira 60s**; **tied `wa_id`**; **rate-limit 3/hora** | `requireConfirmation`/`confirm` + tests AC4 |
| **AR-071** (epics-only) | rótulo epics-level; canon = AO-155/164 (lesson O-A6-6) | nota reconciliação |

### Esboços de tipos

```ts
// src/lib/irreversible-action-catalog.ts
export const IRREVERSIBLE_ACTIONS = [
  "deploy", "branch-delete", "force-push", "schema-drop", "audit-purge",
] as const;
export type IrreversibleAction = (typeof IRREVERSIBLE_ACTIONS)[number];
export function isIrreversibleAction(s: string): s is IrreversibleAction;

// src/services/confirmation-gate.service.ts
export type RequireOutcome =
  | { readonly kind: "not-required" }
  | { readonly kind: "bypassed" };
export type ConfirmResult =
  | { readonly kind: "confirmed"; readonly action: IrreversibleAction }
  | { readonly kind: "aborted"; readonly action: IrreversibleAction };
export type ConfirmationError =
  | { readonly kind: "ConfirmationRequired"; readonly action: IrreversibleAction }
  | { readonly kind: "RateLimited"; readonly action: IrreversibleAction }
  | { readonly kind: "CodeInvalid" }
  | { readonly kind: "CodeExpired" }
  | { readonly kind: "WaIdMismatch" };

export interface ConfirmationGate {
  requireConfirmation(
    action: string,
    opts: { waId: string; cliOverride?: boolean },
  ): Result<RequireOutcome, ConfirmationError>;
  confirm(input: {
    code: string; waId: string; approved: boolean;
  }): Result<ConfirmResult, ConfirmationError>;
}
```

### Previous story intelligence (1.b.1 + Epic 1.a)

- **1.b.1 (acabada de fazer):** factory functions com deps injectadas; **fake `AuditPort` em-memória** para tests (grava entries; assert `type`); `createTestClockAdapter` p/ tempo determinístico; gotcha do Write tool com control chars (irrelevante aqui — sem control chars).
- **1.a.6 (audit):** `audit.append({ ts, type, payload })` síncrono → `Result`; `runId` opcional (lê de `getRunContext()`). Eventos PascalCase (`ProcessStarted`) → `ConfirmationRequired`/`IrreversibleActionConfirmed`/`IrreversibleActionAborted` consistentes.
- **1.a.3 (clock):** `ClockPort.now(): Date`; `createTestClockAdapter(initial)` — avançar relógio p/ testar expiry 60s e janela rate-limit.
- **1.a.4 (interrupt-commands):** union + `PAYLOAD_MAP` + `parseInterruptCommand` exacto (Q-A4-2). Esta story estende o union/map; NÃO altera o parser.
- **1.a.2 (result/branded):** `Result<T,E>` síncrono. O gate é todo síncrono (sem fetch/spawn) → `Result`, não `ResultAsync`.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** modificar `src/core/fsm.ts` — fora de scope; reusar estados/eventos existentes.
- ❌ **NÃO** usar `Math.random()` para o código — não-determinístico e fraco; usar `crypto` (e injectar `codeGen` nos tests).
- ❌ **NÃO** deixar código reutilizável (single-use): consumir do store em qualquer desfecho válido (yes, no, ou validação).
- ❌ **NÃO** comparar expiry com `Date.now()` global — usar `deps.clock.now()` (AO-103 spirit + testabilidade).
- ❌ **NÃO** `throw` em input inválido (código errado/expirado é input esperado) — devolver `err` (AO-66).
- ❌ **NÃO** quebrar os 5 interrupt-commands existentes nem a regra exacta de parse.
- ❌ **NÃO** exceder `maxLines: 200` por ficheiro (Biome HARD em `src/**`).

### Project Structure Notes

- `src/lib/irreversible-action-catalog.ts` (NEW, puro) · `src/services/confirmation-gate.service.ts` (NEW, shell) · `tests/services/confirmation-gate.test.ts` (NEW) · `src/core/domain/interrupt-commands.ts` (MODIFY — +2 variantes, +2 map entries).
- `exactOptionalPropertyTypes`: `cliOverride?: boolean` e `codeGen?` — usar spread-conditional ou aceitar `undefined` explícito ao construir.
- `noUncheckedIndexedAccess`: cuidado com lookups em Maps/arrays.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.b.2] — StorySpec, ACs, files, blocked_by [1.a.4, 1.a.6, 1.a.8].
- [Source: _bmad-output/planning-artifacts/architecture.md:1930] — AO-155 (two-step confirmation BLOCKER).
- [Source: _bmad-output/planning-artifacts/architecture.md:1944] — AO-164 (6-char, single-use, 60s, tied wa_id, 3/hora).
- [Source: src/core/domain/interrupt-commands.ts] — union + PAYLOAD_MAP a estender.
- [Source: src/core/fsm.ts] — paused_for_interrupt / OperatorResponded (NÃO modificar).
- [Source: src/ports/audit.port.ts, src/ports/clock.port.ts] — deps.

## Open Questions for Operator

- **Q-B2-1 (store keying):** [RESOLVED — por código] Pending indexado pelo código 6-char; 1 pending por código; single-use consume; lookup directo no `confirm()`.
- **Q-B2-2 (rate-limit):** [RESOLVED — emissões de código] Contar códigos emitidos na última hora por `waId`; 4ª emissão → `RateLimited` (AO-164 literal).
- **Q-B2-3 (bypass CLI):** [RESOLVED — flag no serviço agora] `cliOverride` em `requireConfirmation`; subcommand `hdd-worker deploy` diferido p/ Story 2.x.
- **Q-B2-4 (charset do código):** [RESOLVED — ambiguity-safe] 6-char maiúsculas excluindo `0/O/1/I/L` (Crockford-ish); ~31^6 combos.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `bun run type-check` → clean à 1ª.
- `bun test tests/services/confirmation-gate.test.ts` → 16 pass / 0 fail.
- `bun test` (full) → inicialmente 186 pass / **2 fail**: o teste pré-existente `tests/core/interrupt-commands.test.ts` (`PAYLOAD_MAP sanity`) cravava 5 entradas + set de 5 kinds. Actualizado p/ 7 entradas + 2 novos kinds (regressão legítima da MODIFY). Depois 188 pass / 0 fail.
- `bun run lint` → exit 1 inicial (organizeImports + format FIXABLE) → `lint:fix` → exit 0 (22 infos `useLiteralKeys` pré-existentes/`payload["via"]`, info-only).

### Completion Notes List

- **AO-155 + AO-164** materializados: 6-char ambiguity-safe, single-use, expiry 60s (via clock), tied `wa_id`, rate-limit 3 emissões/hora.
- **Sem alterar a FSM** (scope): reusa `paused_for_interrupt`/`OperatorResponded`. Wiring real é Epic 4.x.
- **AC3 (CLI)** ao nível do serviço via `cliOverride` (Q-B2-3); subcommand `hdd-worker deploy` diferido p/ Story 2.x.
- **Decisão de segurança não-óbvia:** `WaIdMismatch` **não consome** o código (anti-DoS — um atacante com `wa_id` errado não pode queimar o código do operador legítimo); `CodeExpired` faz cleanup; sucesso/abort consomem.
- **Rate-limit por emissões** (Q-B2-2): janela deslizante de 1h por `waId`; reseta naturalmente (testado com `advance(3_600_001)`).
- **Charset** 31 chars (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`) — ~31^6 ≈ 887M combos, >> 4-digit.

### File List

- `src/lib/irreversible-action-catalog.ts` (NEW, ~25L)
- `src/services/confirmation-gate.service.ts` (NEW, ~150L)
- `src/core/domain/interrupt-commands.ts` (MODIFY, +2 variantes +2 map entries)
- `tests/services/confirmation-gate.test.ts` (NEW, 16 specs)
- `tests/core/interrupt-commands.test.ts` (MODIFY — sanity 5→7 + 2 kinds)
- `scripts/generate-1b2-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.b.2 criada (`ready-for-dev`); 4 Open Questions resolvidas (todas Recommended). |
| 2026-05-29 | Implementação completa: catálogo + confirmation-gate + interrupt variants + 16 specs; regressão `PAYLOAD_MAP sanity` actualizada 5→7; type-check/lint/test verdes (188 pass). AO-155+AO-164 materializados. Status → `review`. |
