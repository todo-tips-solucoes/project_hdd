/**
 * `llm-session-id.ts` — parsing helpers para `claude --print` JSON output.
 *
 * Story 1.a.10 (D-052 + D-050 ClaudeCliAdapter).
 *
 * **Scope minimal:** helper puro que extrai `session_id` do JSON parsed e valida
 * via `mkSessionId`. NÃO persiste mapping em DB — caller (ou Story 6.a.1) faz
 * persistência se quiser; este file é apenas parsing.
 *
 * **Spec do output (per D-052 smoke 1.c.7):**
 * ```json
 * { "type": "result", "result": "...", "session_id": "uuid-v4", "usage": {...} }
 * ```
 */

import { mkSessionId, type SessionId } from "./branded.ts";
import { err, ok, type Result } from "./result.ts";

export type SessionIdParseError = {
  readonly kind: "SessionIdParseError";
  readonly reason: string;
  readonly raw?: unknown;
};

/**
 * Extract + validate `session_id` from `claude --print --output-format json`
 * parsed object. Devolve `ok(SessionId)` ou `err({SessionIdParseError})`.
 */
export function extractSessionIdFromCliJson(
  parsed: unknown,
): Result<SessionId, SessionIdParseError> {
  if (typeof parsed !== "object" || parsed === null) {
    return err({ kind: "SessionIdParseError", reason: "parsed is not an object", raw: parsed });
  }
  const obj = parsed as Record<string, unknown>;
  const raw = obj["session_id"];
  if (typeof raw !== "string") {
    return err({
      kind: "SessionIdParseError",
      reason: "session_id missing or not a string",
      raw,
    });
  }
  const sidR = mkSessionId(raw);
  if (sidR.isErr()) {
    return err({
      kind: "SessionIdParseError",
      reason: `session_id format invalid: ${sidR.error.reason}`,
      raw,
    });
  }
  return ok(sidR.value);
}
