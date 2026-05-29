/**
 * Branded types + factory functions + assertion helpers.
 *
 * Story 1.a.2 (AR-033, AO-70 + AO-66 itens #1 e #2).
 *
 * 4 branded types canónicos (architecture.md linhas 627-632); cada um construído
 * APENAS via factory `mk*(s)` que valida o formato e devolve `Result<Brand, BrandError>`.
 * Atribuir literal `string` directamente a uma destas variáveis falha em tsc
 * (compile-time nominal typing).
 *
 * Os 2 throws abaixo (`assertNever`, `assertInvariant`) são whitelistados em
 * `docs/conventions/errors.md` (AO-66 itens #1 e #2). Qualquer outro `throw`
 * em `src/**` é bloqueado pela ESLint rule `no-restricted-syntax`.
 */

import { err, ok, type Result } from "./result.ts";

// ── 4 branded types canónicos (architecture.md linhas 627-632) ────────────────

export type RunId = string & { readonly _brand: "RunId" };
export type StoryId = string & { readonly _brand: "StoryId" };
export type Sha256Hash = string & { readonly _brand: "Sha256Hash" };
export type IdempotencyKey = string & { readonly _brand: "IdempotencyKey" };
/** Story 1.a.10 — claude --print session_id (UUID v4). */
export type SessionId = string & { readonly _brand: "SessionId" };

// ── BrandError tagged union ────────────────────────────────────────────────────

export type BrandError = {
  readonly kind: "InvalidFormat";
  readonly brand: "RunId" | "StoryId" | "Sha256Hash" | "IdempotencyKey" | "SessionId";
  readonly input: string;
  readonly reason: string;
};

// ── Regex canónicos ────────────────────────────────────────────────────────────

/** UUID v4 RFC 4122 (lowercase). */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** StoryId: `<epic-num>-<sub>-<story-num>-<slug>` (e.g. `1-a-2-result-t-e-branded-types`). */
const STORY_ID_RE = /^[0-9]+-[a-z]-[0-9]+-[a-z0-9-]+$/;

/** SHA-256 hex lowercase, 64 chars. */
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

// ── Factory functions ──────────────────────────────────────────────────────────

export function mkRunId(s: string): Result<RunId, BrandError> {
  if (!UUID_V4_RE.test(s)) {
    return err({
      kind: "InvalidFormat",
      brand: "RunId",
      input: s,
      reason: "expected UUID v4 lowercase",
    });
  }
  return ok(s as RunId);
}

export function mkStoryId(s: string): Result<StoryId, BrandError> {
  if (!STORY_ID_RE.test(s)) {
    return err({
      kind: "InvalidFormat",
      brand: "StoryId",
      input: s,
      reason: "expected '<epic>-<sub>-<num>-<slug>' format",
    });
  }
  return ok(s as StoryId);
}

export function mkSha256Hash(s: string): Result<Sha256Hash, BrandError> {
  if (!SHA256_HEX_RE.test(s)) {
    return err({
      kind: "InvalidFormat",
      brand: "Sha256Hash",
      input: s,
      reason: "expected 64-char lowercase hex",
    });
  }
  return ok(s as Sha256Hash);
}

export function mkSessionId(s: string): Result<SessionId, BrandError> {
  // claude --print --output-format json retorna session_id em UUID v4 lowercase
  // (validado pelo D-052 smoke da Story 1.c.7).
  if (!UUID_V4_RE.test(s)) {
    return err({
      kind: "InvalidFormat",
      brand: "SessionId",
      input: s,
      reason: "expected UUID v4 lowercase (claude --print session_id format)",
    });
  }
  return ok(s as SessionId);
}

export function mkIdempotencyKey(s: string): Result<IdempotencyKey, BrandError> {
  // Acepta UUID v4 OU hex 64 (sha256) — escolha do caller per use-case.
  if (!UUID_V4_RE.test(s) && !SHA256_HEX_RE.test(s)) {
    return err({
      kind: "InvalidFormat",
      brand: "IdempotencyKey",
      input: s,
      reason: "expected UUID v4 or 64-char lowercase hex",
    });
  }
  return ok(s as IdempotencyKey);
}

// ── Assertion helpers (AO-66 whitelist #1 e #2) ────────────────────────────────

/**
 * Discriminated union exhaustiveness check. Compile-time + runtime safety net.
 *
 * Usage: no `default:` branch de um switch sobre tagged union, escrever
 * `assertNever(value)`. Se faltar um `case`, o tsc avisa porque `value` não
 * será tipo `never`.
 *
 * @example
 *   type E = { kind: "A" } | { kind: "B" };
 *   const x: E = ...;
 *   switch (x.kind) {
 *     case "A": return ...;
 *     case "B": return ...;
 *     default: assertNever(x);   // tsc erro se faltar case; throw em runtime
 *   }
 */
export function assertNever(x: never): never {
  // allow-throw: AO-66 #1 — discriminated union exhaustiveness
  // eslint-disable-next-line no-restricted-syntax -- AO-66 whitelist item #1
  throw new Error(`assertNever reached with value: ${JSON.stringify(x)}`);
}

/**
 * Domain invariant check. Last-resort para erros de programador detectados em
 * runtime — bugs, não condições de operação válidas.
 *
 * Use sparingly: em código de domínio puro onde a violação significa "estado
 * impossível" (não "input inválido do utilizador"). Inputs externos validam-se
 * com Zod / factory functions retornando Result, não com `assertInvariant`.
 */
export function assertInvariant(cond: boolean, msg: string): asserts cond {
  if (!cond) {
    // allow-throw: AO-66 #2 — pure domain invariant violated (bug)
    // eslint-disable-next-line no-restricted-syntax -- AO-66 whitelist item #2
    throw new Error(`Invariant violated: ${msg}`);
  }
}
