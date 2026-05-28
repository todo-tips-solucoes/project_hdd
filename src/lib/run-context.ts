/**
 * `run-context.ts` — correlation IDs cross-async via AsyncLocalStorage.
 *
 * Story 1.a.9 (D-04.4', AO-72, AR-039, Q-A9-1..4 [RESOLVED — Recommended]).
 *
 * **Big picture:** propaga `runId/storyId/traceId` automaticamente a TODO log e
 * audit event sem ter de passar como argumento explícito. Substitui o pattern
 * 1.a.7/1.a.8 onde `bootRunId` era passado explicit em cada `audit.append()`.
 *
 * **AsyncLocalStorage API:** wrap `node:async_hooks.AsyncLocalStorage` numa
 * interface mínima — `withRunContext(ctx, fn)`, `getRunContext()`,
 * `requireRunContext()`. Funciona em Bun 1.3.14 (smoke validated).
 *
 * **Isolation semantics:** cada `storage.run(ctx, fn)` cria um novo store frame
 * isolado. 2 chamadas concorrentes via `Promise.all` preservam contexto
 * independente (AC-2). Async await chains propagam o store frame
 * automaticamente via Node async_hooks tracking.
 *
 * **AO-66 nota:** `requireRunContext()` throws ao ser chamado fora de
 * `withRunContext` (programmer error, categoria #1). Anotado inline.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type RunContext = {
  readonly runId: string;
  readonly storyId?: string;
  /** Placeholder OpenTelemetry trace context (Q-A9-2 Recommended). Zero cost agora. */
  readonly traceId?: string;
};

const storage = new AsyncLocalStorage<RunContext>();

/**
 * Executa `fn` com `ctx` activo. Qualquer chamada `getRunContext()` durante a
 * execução de `fn` (incluindo após `await`) retorna `ctx`. Devolve o valor de
 * `fn` (sync) ou `Promise<T>` (async); error throws propagam normalmente.
 */
export function withRunContext<T>(ctx: RunContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Retorna o contexto activo, ou `undefined` se fora de qualquer `withRunContext`. */
export function getRunContext(): RunContext | undefined {
  return storage.getStore();
}

/**
 * Retorna o contexto activo; throws se chamado fora de `withRunContext`.
 * Útil em call-sites que SABEM dever estar em contexto (e.g. adapters
 * em código de produção wrapped sempre por bootstrap).
 */
export function requireRunContext(): RunContext {
  const ctx = storage.getStore();
  if (ctx === undefined) {
    // allow-throw: AO-66 #1 — programmer error (caller misuse fora de withRunContext).
    // eslint-disable-next-line no-restricted-syntax -- AO-66 #1
    throw new Error("requireRunContext called outside withRunContext");
  }
  return ctx;
}
