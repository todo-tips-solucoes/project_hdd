/**
 * `LLMPort` — porta única para invocação de LLM (AR-090, AO-55, D-050).
 *
 * Story 1.a.10. Adapters:
 *   - `src/adapters/llm/anthropic-sdk.adapter.ts` (Sonnet + Haiku via API; default impl)
 *   - `src/adapters/llm/claude-cli.adapter.ts` (Sonnet via `claude --print`; planning + overflow)
 *   - test fixture adapter em `tests/adapters/llm-foundational.test.ts`
 *
 * **D-050 routing por FASE (não por modelo):**
 *   - Planning + overflow/fallback → ClaudeCliAdapter (Max 20x; R$0 marginal).
 *   - Implementation default → AnthropicSDKAdapter (API; cap $30/m per D-051).
 *
 * **AO-42 `cache_control: ephemeral`:** `LLMRequest.cacheControl?: boolean`
 * opt-in default `false` (Q-A10-3 Recommended). Caller decide per role.
 *
 * **AO-43 model routing (Haiku para light):** `LLMRequest.model` é passado pelo
 * caller; adapters são model-agnostic. Role → model decision lives in consumer.
 *
 * **AO-114 token ledger:** `LLMResult.tokens` exposto; persistence em DB defer
 * Story 6.a.1 (`token-ledger.queries.ts`).
 *
 * **AO-123 Plan B activation autónoma:** detector "3 5xx → CLI swap" + notify
 * defer story dedicada (provavelmente 6.b). Esta porta expõe 2 adapters
 * isolados; bootstrap escolhe um.
 */

import type { SessionId } from "../lib/branded.ts";
import type { ResultAsync } from "../lib/result.ts";

/** Função semântica do caller — driver do routing por fase (D-050). */
export type LLMRole =
  | "classifier" // E3 NLP intent parsing (Haiku, AO-43)
  | "gap-detector" // E4 gap detection (Haiku, AO-43)
  | "dev" // dev-agent (Sonnet)
  | "reviewer" // reviewer-agent (Sonnet)
  | "qa" // qa-agent (Sonnet)
  | "narrative-summary" // F8 Tier-A 5 bullets (Haiku, AO-146)
  | "dispatcher"; // E6.a router (Sonnet)

export type LLMRequest = {
  readonly role: LLMRole;
  /** Model identifier (e.g. `claude-haiku-4-5`, `claude-sonnet-4-6`). */
  readonly model: string;
  readonly prompt: string;
  readonly systemPrompt?: string;
  /** Para `claude --print --resume`. Capturado de invocação anterior. */
  readonly sessionId?: SessionId;
  /** Default 4096 quando undefined. */
  readonly maxTokens?: number;
  /** Opt-in AO-42 `cache_control: ephemeral`. Default `false`. */
  readonly cacheControl?: boolean;
};

export type LLMTokens = {
  readonly input: number;
  readonly output: number;
  readonly cacheReadInputTokens?: number;
  readonly cacheCreationInputTokens?: number;
};

export type LLMResult = {
  readonly content: string;
  readonly model: string;
  readonly tokens: LLMTokens;
  /** Devolvido pelo ClaudeCliAdapter; SDK adapter retorna undefined. */
  readonly sessionId?: SessionId;
};

export type LLMError =
  | { readonly kind: "Unauthorized" }
  | { readonly kind: "RateLimited"; readonly retryAfter?: number }
  | { readonly kind: "Timeout" }
  | { readonly kind: "ServerError"; readonly status: number; readonly message: string }
  | { readonly kind: "NetworkError"; readonly cause: unknown }
  | { readonly kind: "ParseError"; readonly cause: unknown }
  | { readonly kind: "PolicyDenied"; readonly reason: string }
  | { readonly kind: "FixtureMissing"; readonly key: string };

export interface LLMPort {
  invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError>;
}
