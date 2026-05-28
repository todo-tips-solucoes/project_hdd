/**
 * Story 1.a.2 — specs para src/lib/result.ts.
 *
 * AC-2: ≥85% branch coverage sobre result.ts.
 * AC-3: property test `pipe(ok(x), fn1, fn2) ≡ fn2(fn1(x))` em arbitraries.
 *
 * Test files isentos da throw whitelist (AO-104 override em eslint.config.js).
 */

import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { err, fromPromise, mapTransient, ok, pipe, sequence, tap } from "../../src/lib/result.ts";

// ────────────────────────────────────────────────────────────────────────────────
// pipe
// ────────────────────────────────────────────────────────────────────────────────

describe("pipe", () => {
  test("zero fns returns initial Result unchanged", () => {
    const r = pipe(ok<number, string>(42));
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe(42);
  });

  test("single fn applied to ok value", () => {
    const r = pipe(ok<number, string>(1), (n) => ok(n + 1));
    expect(r._unsafeUnwrap()).toBe(2);
  });

  test("multiple fns chained", () => {
    const r = pipe(
      ok<number, string>(1),
      (n) => ok(n + 1),
      (n) => ok(n * 2),
    );
    expect(r._unsafeUnwrap()).toBe(4);
  });

  test("first err short-circuits", () => {
    let called = false;
    const r = pipe(
      ok<number, string>(1),
      () => err("boom"),
      (n) => {
        called = true;
        return ok(n + 1);
      },
    );
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("boom");
    expect(called).toBe(false);
  });

  test("initial err short-circuits before any fn runs", () => {
    let called = false;
    const r = pipe(err<number, string>("initial"), (n) => {
      called = true;
      return ok(n);
    });
    expect(r._unsafeUnwrapErr()).toBe("initial");
    expect(called).toBe(false);
  });

  // AC-3: property test — lift composition law.
  // pipe(ok(x), lift(fn1), lift(fn2)) ≡ ok(fn2(fn1(x)))
  test("AC-3 property: pipe(ok(x), lift(fn1), lift(fn2)) ≡ ok(fn2(fn1(x)))", () => {
    fc.assert(
      fc.property(fc.integer(), (x) => {
        const fn1 = (n: number): number => n + 1;
        const fn2 = (n: number): number => n * 2;
        const lhs = pipe(
          ok<number, string>(x),
          (v) => ok(fn1(v)),
          (v) => ok(fn2(v)),
        )._unsafeUnwrap();
        const rhs = fn2(fn1(x));
        return lhs === rhs;
      }),
      { numRuns: 100 },
    );
  });

  test("AC-3 property: identity also holds on strings", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const fn1 = (x: string): string => `${x}!`;
        const fn2 = (x: string): string => x.toUpperCase();
        const lhs = pipe(
          ok<string, string>(s),
          (v) => ok(fn1(v)),
          (v) => ok(fn2(v)),
        )._unsafeUnwrap();
        return lhs === fn2(fn1(s));
      }),
      { numRuns: 50 },
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// fromPromise
// ────────────────────────────────────────────────────────────────────────────────

describe("fromPromise", () => {
  test("resolved promise → ok", async () => {
    const r = await fromPromise(Promise.resolve(7), (e) => `wrapped: ${String(e)}`);
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe(7);
  });

  test("rejected promise → err with mapper applied", async () => {
    const r = await fromPromise(
      Promise.reject(new Error("boom")),
      (raw) => `caught: ${String(raw)}`,
    );
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("caught: Error: boom");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// sequence
// ────────────────────────────────────────────────────────────────────────────────

describe("sequence", () => {
  test("empty array → ok([])", () => {
    const r = sequence<number, string>([]);
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual([]);
  });

  test("all ok → ok([values])", () => {
    const r = sequence<number, string>([ok(1), ok(2), ok(3)]);
    expect(r._unsafeUnwrap()).toEqual([1, 2, 3]);
  });

  test("first err short-circuits", () => {
    const r = sequence<number, string>([ok(1), err("bad"), ok(3)]);
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toBe("bad");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// tap
// ────────────────────────────────────────────────────────────────────────────────

describe("tap", () => {
  test("ok value triggers sideEffect and preserves Result", () => {
    const captured: { v: number | null } = { v: null };
    const r = tap(ok<number, string>(5), (v) => {
      captured.v = v;
    });
    expect(captured.v).toBe(5);
    expect(r._unsafeUnwrap()).toBe(5);
  });

  test("err value does NOT trigger sideEffect", () => {
    let called = false;
    const r = tap(err<number, string>("nope"), () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(r._unsafeUnwrapErr()).toBe("nope");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// mapTransient
// ────────────────────────────────────────────────────────────────────────────────

describe("mapTransient", () => {
  test("err is mapped via mapper", () => {
    const r = mapTransient(err<number, string>("timeout"), (e) => ({
      kind: "Transient" as const,
      reason: e,
    }));
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({ kind: "Transient", reason: "timeout" });
  });

  test("ok passes through unchanged", () => {
    const r = mapTransient(ok<number, string>(42), () => ({
      kind: "Transient" as const,
      reason: "never",
    }));
    expect(r._unsafeUnwrap()).toBe(42);
  });
});
