/**
 * `circuit-breaker.ts` — breaker `threshold` falhas consecutivas / `windowMs`.
 *
 * Story 3.2 (FR-027). `canPass()` falha-rápido com `CircuitOpen{resetAt}` enquanto
 * aberto. `recordFailure()` regista timestamp (filtrado à janela); ao atingir
 * `threshold` dentro da janela → abre até `now + cooldownMs`. `recordSuccess()`
 * reseta (consecutivas). Q-3.2-3: o caller decide o que conta como falha (429 não).
 * Tempo via `ClockPort` (injectado). Sem `throw` (AO-66).
 */

import type { ClockPort } from "../ports/clock.port.ts";
import { err, ok, type Result } from "./result.ts";

export type CircuitOpenError = { readonly kind: "CircuitOpen"; readonly resetAt: Date };

export type CircuitBreakerDeps = {
  readonly clock: ClockPort;
  /** Falhas consecutivas para abrir (default 5). */
  readonly threshold?: number;
  /** Janela onde as falhas contam (default 60s). */
  readonly windowMs?: number;
  /** Tempo aberto antes de voltar a deixar passar (default 60s). */
  readonly cooldownMs?: number;
};

export interface CircuitBreaker {
  canPass(): Result<true, CircuitOpenError>;
  recordFailure(): void;
  recordSuccess(): void;
}

export function createCircuitBreaker(deps: CircuitBreakerDeps): CircuitBreaker {
  const threshold = deps.threshold ?? 5;
  const windowMs = deps.windowMs ?? 60_000;
  const cooldownMs = deps.cooldownMs ?? 60_000;
  let failures: number[] = [];
  let openUntil = 0;

  return {
    canPass(): Result<true, CircuitOpenError> {
      const now = deps.clock.now().getTime();
      if (now < openUntil) return err({ kind: "CircuitOpen", resetAt: new Date(openUntil) });
      return ok(true);
    },
    recordFailure(): void {
      const now = deps.clock.now().getTime();
      failures = failures.filter((t) => now - t < windowMs);
      failures.push(now);
      if (failures.length >= threshold) openUntil = now + cooldownMs;
    },
    recordSuccess(): void {
      failures = [];
      openUntil = 0;
    },
  };
}
