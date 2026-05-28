/**
 * Story 1.a.4 — specs para src/core/fsm.ts.
 *
 * AC-1 + AC-2 + AC-3 (property test totalidade).
 * Test files isentos da throw whitelist + max-lines (AO-104, biome override).
 */

import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import {
  ALL_EVENT_KINDS,
  ALL_STATES,
  type FsmState,
  TRANSITION_TABLE,
  transition,
} from "../../src/core/fsm.ts";

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: transições válidas
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 transições válidas (happy path)", () => {
  test("idle → StartRun → running", () => {
    const r = transition("idle", { kind: "StartRun" });
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ to: "running" });
  });

  test("running → InterruptP1 → paused_for_interrupt", () => {
    const r = transition("running", { kind: "InterruptP1" });
    expect(r._unsafeUnwrap()).toEqual({ to: "paused_for_interrupt" });
  });

  test("running → InterruptS1/S2/S3 → paused_for_interrupt", () => {
    for (const kind of ["InterruptS1", "InterruptS2", "InterruptS3"] as const) {
      const r = transition("running", { kind });
      expect(r._unsafeUnwrap()).toEqual({ to: "paused_for_interrupt" });
    }
  });

  test("running → OperatorPausedReview → paused_awaiting_review", () => {
    const r = transition("running", { kind: "OperatorPausedReview" });
    expect(r._unsafeUnwrap()).toEqual({ to: "paused_awaiting_review" });
  });

  test("running → WindowExhausted → paused_window_exhausted", () => {
    const r = transition("running", { kind: "WindowExhausted" });
    expect(r._unsafeUnwrap()).toEqual({ to: "paused_window_exhausted" });
  });

  test("running → Fail → failed", () => {
    const r = transition("running", { kind: "Fail" });
    expect(r._unsafeUnwrap()).toEqual({ to: "failed" });
  });

  test("paused_for_interrupt → OperatorResponded → running", () => {
    const r = transition("paused_for_interrupt", { kind: "OperatorResponded" });
    expect(r._unsafeUnwrap()).toEqual({ to: "running" });
  });

  test("paused_awaiting_review → OperatorApproved → running", () => {
    const r = transition("paused_awaiting_review", { kind: "OperatorApproved" });
    expect(r._unsafeUnwrap()).toEqual({ to: "running" });
  });

  test("paused_awaiting_review → OperatorRejected → failed", () => {
    const r = transition("paused_awaiting_review", { kind: "OperatorRejected" });
    expect(r._unsafeUnwrap()).toEqual({ to: "failed" });
  });

  test("paused_window_exhausted → OperatorResponded → running", () => {
    const r = transition("paused_window_exhausted", { kind: "OperatorResponded" });
    expect(r._unsafeUnwrap()).toEqual({ to: "running" });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: transições inválidas
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-2 transições inválidas", () => {
  test("idle → Fail (sem mediação) → IllegalTransition", () => {
    const r = transition("idle", { kind: "Fail" });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({
      kind: "IllegalTransition",
      from: "idle",
      event: "Fail",
    });
  });

  test("idle → OperatorApproved → IllegalTransition", () => {
    const r = transition("idle", { kind: "OperatorApproved" });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().from).toBe("idle");
    expect(r._unsafeUnwrapErr().event).toBe("OperatorApproved");
  });

  test("failed → StartRun (terminal não aceita transições) → IllegalTransition", () => {
    const r = transition("failed", { kind: "StartRun" });
    expect(r.isErr()).toBe(true);
  });

  test("running → StartRun (auto-loop não permitido) → IllegalTransition", () => {
    const r = transition("running", { kind: "StartRun" });
    expect(r.isErr()).toBe(true);
  });

  test("paused_for_interrupt → OperatorApproved (errado canal) → IllegalTransition", () => {
    const r = transition("paused_for_interrupt", { kind: "OperatorApproved" });
    expect(r.isErr()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3: property test totalidade
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-3 property: transition é total (Result sempre, nunca throw)", () => {
  test("para todo (state, eventKind), transition retorna Result válido", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATES),
        fc.constantFrom(...ALL_EVENT_KINDS),
        (s: FsmState, k) => {
          const r = transition(s, { kind: k });
          // Total: ou ok com target válido, ou err com kind IllegalTransition correcto.
          if (r.isOk()) {
            return ALL_STATES.includes(r._unsafeUnwrap().to);
          }
          const e = r._unsafeUnwrapErr();
          return e.kind === "IllegalTransition" && e.from === s && e.event === k;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// Sanity da tabela
// ────────────────────────────────────────────────────────────────────────────────

describe("TRANSITION_TABLE sanity", () => {
  test("contém exactamente os 6 estados como chaves", () => {
    expect(Object.keys(TRANSITION_TABLE).sort()).toEqual([...ALL_STATES].sort());
  });

  test("todos os targets são estados válidos (no orphan target)", () => {
    for (const fromState of ALL_STATES) {
      const events = TRANSITION_TABLE[fromState];
      for (const target of Object.values(events)) {
        if (target !== undefined) {
          expect(ALL_STATES).toContain(target);
        }
      }
    }
  });

  test("failed é terminal (zero transições outgoing)", () => {
    expect(Object.keys(TRANSITION_TABLE.failed).length).toBe(0);
  });
});
