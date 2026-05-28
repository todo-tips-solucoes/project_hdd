/**
 * `TestClockAdapter` — clock determinístico para testes. Não usa globais reais.
 *
 * Story 1.a.3 (AR-032; AC-2 binary).
 *
 * Manipulação manual do tempo via `advance(ms)` — dispara callbacks agendados
 * cujo `fireAt <= now+ms`. Intervals re-registam após disparo. Wall-clock
 * total dos testes <50ms tipicamente, sem `setTimeout` real.
 *
 * Edge case: callbacks que invocam `setTimeout`/`setInterval` durante o disparo
 * são respeitados na MESMA chamada `advance(ms)` se `fireAt` ainda chegar ao
 * target. Garantido pelo loop `while (next)`.
 */

import type { ClockPort } from "../../ports/clock.port.ts";

export interface TestClockPort extends ClockPort {
  /** Avança o relógio em `ms` milissegundos e dispara todos os callbacks pendentes em ordem. */
  advance(ms: number): void;
}

type Scheduled = {
  fireAt: number;
  fn: () => void;
  recurring?: number;
};

export const createTestClockAdapter = (initial: Date = new Date(0)): TestClockPort => {
  let now = initial.getTime();
  const scheduled: Scheduled[] = [];

  const port: TestClockPort = {
    now: () => new Date(now),

    setTimeout: (fn, ms) => {
      const entry: Scheduled = { fireAt: now + ms, fn };
      scheduled.push(entry);
      return () => {
        const i = scheduled.indexOf(entry);
        if (i >= 0) scheduled.splice(i, 1);
      };
    },

    setInterval: (fn, ms) => {
      const entry: Scheduled = { fireAt: now + ms, fn, recurring: ms };
      scheduled.push(entry);
      return () => {
        const i = scheduled.indexOf(entry);
        if (i >= 0) scheduled.splice(i, 1);
      };
    },

    advance(ms) {
      const target = now + ms;
      while (true) {
        const due = scheduled.filter((s) => s.fireAt <= target).sort((a, b) => a.fireAt - b.fireAt);
        const next = due[0];
        if (!next) break;
        now = next.fireAt;
        const idx = scheduled.indexOf(next);
        if (idx >= 0) scheduled.splice(idx, 1);
        next.fn();
        if (next.recurring !== undefined) {
          scheduled.push({ fireAt: now + next.recurring, fn: next.fn, recurring: next.recurring });
        }
      }
      now = target;
    },
  };

  return port;
};
