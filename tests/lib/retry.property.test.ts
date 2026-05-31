/**
 * Story 3.2 — specs de retry-policy (computeBackoffMs property + withRetry).
 *
 * AC2: 429 → retry após Retry-After; 5xx → expo (2s base, cap 60s, max 5); 4xx → sem retry.
 * Clock spy de disparo imediato (regista os `ms`) → testa COUNT + delays sem tempo real.
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { errAsync, okAsync } from "../../src/lib/result.ts";
import { computeBackoffMs, withRetry } from "../../src/lib/retry-policy.ts";
import type { ClockPort } from "../../src/ports/clock.port.ts";

type TestErr = { kind: "Transient" | "Permanent" | "RateLimited"; retryAfterMs?: number };

/** Clock que dispara `setTimeout` imediatamente e regista os `ms` pedidos. */
function spyClock(): { clock: ClockPort; delays: number[] } {
  const delays: number[] = [];
  const clock: ClockPort = {
    now: () => new Date(0),
    setTimeout: (fn, ms) => {
      delays.push(ms);
      fn();
      return () => {};
    },
    setInterval: () => () => {},
  };
  return { clock, delays };
}

const decide = (e: TestErr, attempt: number) => {
  if (e.kind === "RateLimited") return { retry: true as const, delayMs: e.retryAfterMs ?? 0 };
  if (e.kind === "Transient")
    return {
      retry: true as const,
      delayMs: computeBackoffMs(attempt, { base: 2000, cap: 60_000 }),
    };
  return { retry: false as const };
};

describe("computeBackoffMs (property)", () => {
  test("attempt=1 → base; monótono não-decrescente; nunca > cap", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (attempt) => {
        const v = computeBackoffMs(attempt, { base: 2000, cap: 60_000 });
        expect(v).toBeLessThanOrEqual(60_000);
        expect(v).toBeGreaterThanOrEqual(2000);
        if (attempt > 1) {
          expect(v).toBeGreaterThanOrEqual(
            computeBackoffMs(attempt - 1, { base: 2000, cap: 60_000 }),
          );
        }
      }),
      { numRuns: 30 },
    );
  });
  test("sequência conhecida: 2000,4000,8000,16000,32000,60000(cap)", () => {
    const seq = [1, 2, 3, 4, 5, 6].map((a) => computeBackoffMs(a, { base: 2000, cap: 60_000 }));
    expect(seq).toEqual([2000, 4000, 8000, 16000, 32000, 60_000]);
  });
});

describe("withRetry — AC2", () => {
  test("429 → retry após Retry-After (5s)", async () => {
    const { clock, delays } = spyClock();
    let n = 0;
    const r = await withRetry<string, TestErr>(
      () => {
        n += 1;
        return n === 1 ? errAsync({ kind: "RateLimited", retryAfterMs: 5000 }) : okAsync("ok");
      },
      { maxAttempts: 5, clock, decide },
    );
    expect(r.isOk()).toBe(true);
    expect(delays[0]).toBe(5000); // honra Retry-After
    expect(n).toBe(2);
  });

  test("5xx → expo (2s,4s,8s,16s) até esgotar max 5", async () => {
    const { clock, delays } = spyClock();
    let n = 0;
    const r = await withRetry<string, TestErr>(
      () => {
        n += 1;
        return errAsync({ kind: "Transient" });
      },
      { maxAttempts: 5, clock, decide },
    );
    expect(r.isErr()).toBe(true);
    expect(n).toBe(5); // 5 tentativas
    expect(delays).toEqual([2000, 4000, 8000, 16000]); // 4 esperas entre tentativas
  });

  test("4xx (Permanent) → sem retry (1 tentativa)", async () => {
    const { clock, delays } = spyClock();
    let n = 0;
    const r = await withRetry<string, TestErr>(
      () => {
        n += 1;
        return errAsync({ kind: "Permanent" });
      },
      { maxAttempts: 5, clock, decide },
    );
    expect(r.isErr()).toBe(true);
    expect(n).toBe(1);
    expect(delays.length).toBe(0);
  });
});
