/**
 * `leaky-bucket.ts` — fila interna que serializa tasks a `ratePerSec` (Story 3.2).
 *
 * Constraint clihelper: **1 req/s** (AO-45/FR-025). Modelo `nextSlot`: a 1ª task
 * corre em `now`, a i-ésima em `now + i·intervalMs`. Usa `ClockPort.setTimeout`
 * (injectado) → determinístico em testes via `TestClockPort.advance` (AO-103
 * proíbe `setTimeout` global). FIFO single-queue; preserva o `Result` da task.
 */

import type { ClockPort } from "../ports/clock.port.ts";
import { type Result, ResultAsync } from "./result.ts";

export type LeakyBucketDeps = {
  readonly clock: ClockPort;
  /** Default 1 (1 req/s). */
  readonly ratePerSec?: number;
};

export interface LeakyBucket {
  /** Enfileira `task`; corre quando o próximo slot abrir. Devolve o `Result` da task. */
  enqueue<T, E>(task: () => ResultAsync<T, E>): ResultAsync<T, E>;
}

export function createLeakyBucket(deps: LeakyBucketDeps): LeakyBucket {
  const intervalMs = 1000 / (deps.ratePerSec ?? 1);
  let nextSlot = 0;

  return {
    enqueue<T, E>(task: () => ResultAsync<T, E>): ResultAsync<T, E> {
      const now = deps.clock.now().getTime();
      const at = Math.max(now, nextSlot);
      nextSlot = at + intervalMs;
      const delay = at - now;
      const promise = new Promise<Result<T, E>>((resolve) => {
        deps.clock.setTimeout(() => {
          void task().then((res: Result<T, E>) => resolve(res));
        }, delay);
      });
      return new ResultAsync(promise);
    },
  };
}
