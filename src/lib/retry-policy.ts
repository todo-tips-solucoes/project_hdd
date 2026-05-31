/**
 * `retry-policy.ts` — backoff exponencial + runner de retry (Story 3.2, D-04.7).
 *
 * `computeBackoffMs` é puro (testável por property): `base · 2^(attempt-1)` com
 * cap. `withRetry` corre `fn`, e em erro pergunta a `decide(error, attempt)` se
 * deve retry e com que delay (429 → `Retry-After`; 5xx → expo). Delays via
 * `ClockPort.setTimeout` (injectado → determinístico). Sem `throw` (AO-66).
 */

import type { ClockPort } from "../ports/clock.port.ts";
import { type Result, ResultAsync } from "./result.ts";

export type BackoffOptions = { readonly base: number; readonly cap: number };

/** `base · 2^(attempt-1)` capado a `cap`. `attempt` é 1-indexed. Puro. */
export function computeBackoffMs(attempt: number, opts: BackoffOptions): number {
  const raw = opts.base * 2 ** (attempt - 1);
  return Math.min(raw, opts.cap);
}

export type RetryDecision =
  | { readonly retry: false }
  | { readonly retry: true; readonly delayMs: number };

export type RetryOptions<E> = {
  readonly maxAttempts: number;
  readonly clock: ClockPort;
  /** Dado o erro + nº da tentativa (1-indexed), decide retry + delay. */
  readonly decide: (error: E, attempt: number) => RetryDecision;
};

function sleep(clock: ClockPort, ms: number): Promise<void> {
  return new Promise((resolve) => {
    clock.setTimeout(() => resolve(), ms);
  });
}

export function withRetry<T, E>(
  fn: () => ResultAsync<T, E>,
  opts: RetryOptions<E>,
): ResultAsync<T, E> {
  async function run(attempt: number): Promise<Result<T, E>> {
    const res = await fn();
    if (res.isOk() || attempt >= opts.maxAttempts) return res;
    const decision = opts.decide(res.error, attempt);
    if (!decision.retry) return res;
    await sleep(opts.clock, decision.delayMs);
    return run(attempt + 1);
  }
  return new ResultAsync(run(1));
}
