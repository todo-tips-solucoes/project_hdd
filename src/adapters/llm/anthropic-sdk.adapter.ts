/**
 * `anthropic-sdk.adapter.ts` — LLMPort impl via `@anthropic-ai/sdk`.
 *
 * Story 1.a.10 (AO-55, AO-42, AO-43; D-050 implementation default).
 *
 * **Scope:** SDK direct calls. Serve Sonnet (impl autónoma) + Haiku (light:
 * gap-detector, classifier, narrative-summary AO-43). Caller passa `req.model`;
 * adapter é model-agnostic.
 *
 * **AO-42 cache_control:** `req.cacheControl === true` → wrap prompt em
 * `[{type: "text", text, cache_control: {type: "ephemeral"}}]`. Default off
 * (Q-A10-3 opt-in).
 *
 * **Error mapping:** SDK `APIError` subclasses (AuthenticationError 401,
 * RateLimitError 429, InternalServerError 5xx). Tudo o resto cai em
 * NetworkError ou ParseError.
 *
 * **Cost cap D-051:** $30/m enforced PELO CONSUMER, não aqui. Adapter expõe
 * tokens; budget monitor (Story 6.a) decide pause.
 *
 * **Plan B (AO-123):** swap autónomo (3 5xx → CLI fallback) NÃO implementado
 * aqui. Bootstrap escolhe SDK ou CLI; swap logic em story dedicada.
 *
 * **Test strategy:** `client` é injectable (`AnthropicSDKDeps.client`); tests
 * passam mock Anthropic-shape. Real-network smoke fica para dev local manual.
 */

import Anthropic from "@anthropic-ai/sdk";
import { errAsync, okAsync, ResultAsync } from "../../lib/result.ts";
import type { LLMError, LLMPort, LLMRequest, LLMResult } from "../../ports/llm.port.ts";

const DEFAULT_MAX_TOKENS = 4096;

export type AnthropicSDKDeps = {
  readonly apiKey: string;
  /** Injectable para tests. Default `new Anthropic({ apiKey })`. */
  readonly client?: Anthropic;
};

export function createAnthropicSDKAdapter(deps: AnthropicSDKDeps): LLMPort {
  const client: Anthropic = deps.client ?? new Anthropic({ apiKey: deps.apiKey });

  return {
    invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError> {
      const messages = buildMessages(req);
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: req.model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
      };
      if (req.systemPrompt !== undefined) params.system = req.systemPrompt;

      return ResultAsync.fromPromise(client.messages.create(params), mapAnthropicError).andThen(
        (resp) => {
          const parsed = mapAnthropicResponse(req.model, resp);
          return parsed === null
            ? errAsync({ kind: "ParseError" as const, cause: "no text block in response" })
            : okAsync(parsed);
        },
      );
    },
  };
}

function buildMessages(req: LLMRequest): Anthropic.MessageParam[] {
  if (req.cacheControl === true) {
    return [
      {
        role: "user",
        content: [{ type: "text", text: req.prompt, cache_control: { type: "ephemeral" } }],
      },
    ];
  }
  return [{ role: "user", content: req.prompt }];
}

function mapAnthropicResponse(model: string, resp: Anthropic.Message): LLMResult | null {
  const firstBlock = resp.content[0];
  if (firstBlock === undefined || firstBlock.type !== "text") return null;

  const cacheRead = resp.usage.cache_read_input_tokens;
  const cacheCreate = resp.usage.cache_creation_input_tokens;

  return {
    content: firstBlock.text,
    model,
    tokens: {
      input: resp.usage.input_tokens ?? 0,
      output: resp.usage.output_tokens,
      ...(cacheRead !== null && cacheRead !== undefined ? { cacheReadInputTokens: cacheRead } : {}),
      ...(cacheCreate !== null && cacheCreate !== undefined
        ? { cacheCreationInputTokens: cacheCreate }
        : {}),
    },
  };
}

function mapAnthropicError(raw: unknown): LLMError {
  if (raw instanceof Anthropic.AuthenticationError) return { kind: "Unauthorized" };
  if (raw instanceof Anthropic.RateLimitError) {
    const retryHeader = raw.headers?.get?.("retry-after");
    const retryAfter =
      retryHeader !== null && retryHeader !== undefined ? Number(retryHeader) : undefined;
    return retryAfter !== undefined && Number.isFinite(retryAfter)
      ? { kind: "RateLimited", retryAfter }
      : { kind: "RateLimited" };
  }
  if (raw instanceof Anthropic.APIError) {
    const status = typeof raw.status === "number" ? raw.status : 0;
    if (status === 408 || status === 504) return { kind: "Timeout" };
    const message = raw.message;
    return { kind: "ServerError", status, message };
  }
  return { kind: "NetworkError", cause: raw };
}
