/**
 * Story 3.2 — specs de leaky-bucket + circuit-breaker + withResilience.
 *
 * AC1 (property): 10 sends → 1º em t=0, último em t≥9s, espaçamento 1s (TestClockPort.advance).
 * AC3: 5 falhas consecutivas → CircuitOpen; sucesso reseta.
 * AC4 + Q-3.2-3: withResilience — CB aberto → CircuitOpen sem chamar inner; 429 não conta.
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { withResilience } from "../../src/adapters/whatsapp/clihelper.adapter.ts";
import { createCircuitBreaker } from "../../src/lib/circuit-breaker.ts";
import { createLeakyBucket } from "../../src/lib/leaky-bucket.ts";
import { errAsync, okAsync, type ResultAsync } from "../../src/lib/result.ts";
import type {
  OutboundNotifyError,
  OutboundNotifyPort,
  SendResult,
  SendTemplateInput,
} from "../../src/ports/outbound-notify.port.ts";

const INPUT: SendTemplateInput = { template: "hdd_heartbeat", queueId: "q" };

describe("AC1 — leaky bucket 1 req/s (property)", () => {
  test("N sends → 1º em t=0, i-ésimo em i·1000 (incl. 10→9s)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 12 }), async (count) => {
        const clock = createTestClockAdapter(new Date(0));
        const bucket = createLeakyBucket({ clock });
        const times: number[] = [];
        const pending = Array.from({ length: count }, () =>
          bucket.enqueue(() => {
            times.push(clock.now().getTime());
            return okAsync(true);
          }),
        );
        clock.advance((count - 1) * 1000);
        await Promise.all(pending);

        expect(times.length).toBe(count);
        expect(times[0]).toBe(0);
        expect(times[count - 1]).toBe((count - 1) * 1000);
        for (let i = 1; i < count; i++) expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBe(1000);
      }),
      { numRuns: 20 },
    );
  });

  test("AC1 explícito: 10 sends → último em t≥9s", async () => {
    const clock = createTestClockAdapter(new Date(0));
    const bucket = createLeakyBucket({ clock });
    const times: number[] = [];
    const pending = Array.from({ length: 10 }, () =>
      bucket.enqueue(() => {
        times.push(clock.now().getTime());
        return okAsync(true);
      }),
    );
    clock.advance(9000);
    await Promise.all(pending);
    expect(times[0]).toBe(0);
    expect(times[9]).toBeGreaterThanOrEqual(9000);
  });
});

describe("AC3 — circuit breaker (primitiva)", () => {
  test("5 falhas consecutivas → canPass falha com CircuitOpen+resetAt", () => {
    const clock = createTestClockAdapter(new Date(0));
    const cb = createCircuitBreaker({ clock });
    for (let i = 0; i < 5; i++) {
      expect(cb.canPass().isOk()).toBe(true);
      cb.recordFailure();
    }
    const gate = cb.canPass();
    expect(gate.isErr()).toBe(true);
    if (gate.isErr()) {
      expect(gate.error.kind).toBe("CircuitOpen");
      expect(gate.error.resetAt.getTime()).toBe(60_000); // now(0)+cooldown 60s
    }
  });
  test("sucesso reseta o contador (4 falhas + sucesso + 4 falhas → ainda fechado)", () => {
    const clock = createTestClockAdapter(new Date(0));
    const cb = createCircuitBreaker({ clock });
    for (let i = 0; i < 4; i++) cb.recordFailure();
    cb.recordSuccess();
    for (let i = 0; i < 4; i++) cb.recordFailure();
    expect(cb.canPass().isOk()).toBe(true);
  });
});

/** Inner OutboundNotifyPort fake que devolve sempre `err` + conta chamadas. */
function failingInner(error: OutboundNotifyError): {
  port: OutboundNotifyPort;
  calls: () => number;
} {
  let n = 0;
  const port: OutboundNotifyPort = {
    sendTemplate(): ResultAsync<SendResult, OutboundNotifyError> {
      n += 1;
      return errAsync(error);
    },
  };
  return { port, calls: () => n };
}

/** Clock imediato (setTimeout dispara já) — para testar o wrapping sem tempo real. */
const immediateClock = {
  now: () => new Date(0),
  setTimeout: (fn: () => void) => {
    fn();
    return () => {};
  },
  setInterval: () => () => {},
};

describe("AC4 + Q-3.2-3 — withResilience", () => {
  test("5 sends Transient esgotados → 6º devolve CircuitOpen sem chamar inner", async () => {
    const inner = failingInner({ kind: "Transient", cause: "5xx" });
    const resilient = withResilience(inner.port, { clock: immediateClock });
    for (let i = 0; i < 5; i++) await resilient.sendTemplate(INPUT);
    const callsBefore = inner.calls();
    const r = await resilient.sendTemplate(INPUT);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("CircuitOpen");
    expect(inner.calls()).toBe(callsBefore); // fail-fast: inner NÃO chamado
  });

  test("429 (RateLimited) NÃO conta para o CB (6º send ainda passa ao inner)", async () => {
    const inner = failingInner({ kind: "RateLimited", retryAfterMs: 0 });
    const resilient = withResilience(inner.port, { clock: immediateClock });
    for (let i = 0; i < 6; i++) {
      const r = await resilient.sendTemplate(INPUT);
      if (r.isErr())
        expect(r.error.kind).toBe("RateLimited"); // nunca CircuitOpen
      else throw new Error("esperava RateLimited");
    }
  });
});
