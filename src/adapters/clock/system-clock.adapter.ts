/**
 * `SystemClockAdapter` — wrapper sobre globais reais (`globalThis.setTimeout`,
 * `setInterval`, `Date`). Implementação de produção do `ClockPort`.
 *
 * Story 1.a.3 (AR-032; factory function pattern per architecture linha 904).
 *
 * Nota AO-103: adapters PODEM usar `globalThis.setTimeout` directamente
 * (são a implementação real do port). A ESLint rule restringe apenas `src/core/**`.
 */

import type { ClockPort } from "../../ports/clock.port.ts";

export const createSystemClockAdapter = (): ClockPort => ({
  now: () => new Date(),

  setTimeout: (fn, ms) => {
    const handle = globalThis.setTimeout(fn, ms);
    return () => {
      globalThis.clearTimeout(handle);
    };
  },

  setInterval: (fn, ms) => {
    const handle = globalThis.setInterval(fn, ms);
    return () => {
      globalThis.clearInterval(handle);
    };
  },
});
