/**
 * `fsm.ts` — Finite State Machine do worker HDD (domain layer puro).
 *
 * Story 1.a.4 (AR-035, AO-2 reconciliada, AO-68, AO-95, D-04.17). Funções
 * 100% puras: caller passa estado + evento, recebe `Result<{to}, FsmError>`.
 * Persistência em SQLite (AO-40) é Story 1.a.5; queue de triggers durante
 * PAUSED (AO-2) é Story 4.x.
 *
 * **7 estados (Q-A4-1 resolved 2026-05-28 → lowercase epics.md AC; `gate_blocked`
 * adicionado na Story 2.4 — Q-2.4-1, gate Story→Dev não-terminal):**
 *
 * Eventos extra (não na tabela abaixo): `GateBlocked` (running→gate_blocked,
 * 2.4) e `OperatorPaused` (running→paused_for_interrupt, pause operador — 2.6).
 *
 * | from \\ event              | StartRun | InterruptP1/S1/S2/S3 | OperatorResponded | OperatorPausedReview | OperatorApproved | OperatorRejected | WindowExhausted | Fail   |
 * |----------------------------|----------|----------------------|-------------------|----------------------|------------------|------------------|-----------------|--------|
 * | idle                       | running  | —                    | —                 | —                    | —                | —                | —               | —      |
 * | running                    | —        | paused_for_interrupt | —                 | paused_awaiting_review | —              | —                | paused_window_exhausted | failed |
 * | paused_for_interrupt       | —        | —                    | running           | —                    | —                | —                | —               | —      |
 * | paused_awaiting_review     | —        | —                    | —                 | —                    | running          | failed           | —               | —      |
 * | paused_window_exhausted    | —        | —                    | running           | —                    | —                | —                | —               | —      |
 * | failed (terminal)          | —        | —                    | —                 | —                    | —                | —                | —               | —      |
 */

import { err, ok, type Result } from "../lib/result.ts";

export type FsmState =
  | "idle"
  | "running"
  | "paused_for_interrupt"
  | "paused_awaiting_review"
  | "paused_window_exhausted"
  | "gate_blocked"
  | "failed";

export const ALL_STATES: ReadonlyArray<FsmState> = [
  "idle",
  "running",
  "paused_for_interrupt",
  "paused_awaiting_review",
  "paused_window_exhausted",
  "gate_blocked",
  "failed",
];

export type FsmEvent =
  | { readonly kind: "StartRun" }
  | { readonly kind: "InterruptP1" }
  | { readonly kind: "InterruptS1" }
  | { readonly kind: "InterruptS2" }
  | { readonly kind: "InterruptS3" }
  | { readonly kind: "OperatorResponded" }
  | { readonly kind: "OperatorPaused" }
  | { readonly kind: "OperatorPausedReview" }
  | { readonly kind: "OperatorApproved" }
  | { readonly kind: "OperatorRejected" }
  | { readonly kind: "WindowExhausted" }
  | { readonly kind: "GateBlocked" }
  | { readonly kind: "Fail" };

export type FsmEventKind = FsmEvent["kind"];

export const ALL_EVENT_KINDS: ReadonlyArray<FsmEventKind> = [
  "StartRun",
  "InterruptP1",
  "InterruptS1",
  "InterruptS2",
  "InterruptS3",
  "OperatorResponded",
  "OperatorPaused",
  "OperatorPausedReview",
  "OperatorApproved",
  "OperatorRejected",
  "WindowExhausted",
  "GateBlocked",
  "Fail",
];

export type FsmError = {
  readonly kind: "IllegalTransition";
  readonly from: FsmState;
  readonly event: FsmEventKind;
};

/** Transition table — only legal transitions are listed; missing pairs → IllegalTransition. */
export const TRANSITION_TABLE: Readonly<Record<FsmState, Partial<Record<FsmEventKind, FsmState>>>> =
  {
    idle: {
      StartRun: "running",
    },
    running: {
      InterruptP1: "paused_for_interrupt",
      InterruptS1: "paused_for_interrupt",
      InterruptS2: "paused_for_interrupt",
      InterruptS3: "paused_for_interrupt",
      OperatorPaused: "paused_for_interrupt",
      OperatorPausedReview: "paused_awaiting_review",
      WindowExhausted: "paused_window_exhausted",
      GateBlocked: "gate_blocked",
      Fail: "failed",
    },
    paused_for_interrupt: {
      OperatorResponded: "running",
    },
    paused_awaiting_review: {
      OperatorApproved: "running",
      OperatorRejected: "failed",
    },
    paused_window_exhausted: {
      OperatorResponded: "running",
    },
    gate_blocked: {
      // Story 2.4: gate Story→Dev falhou. Não-terminal: re-dispatch após
      // correct-course (OperatorResponded→running). Fail → failed.
      OperatorResponded: "running",
      Fail: "failed",
    },
    failed: {
      // terminal — sem transições
    },
  };

/** Pure transition function — no I/O, no side effects. */
export function transition(from: FsmState, event: FsmEvent): Result<{ to: FsmState }, FsmError> {
  const to = TRANSITION_TABLE[from][event.kind];
  if (to === undefined) {
    return err({ kind: "IllegalTransition", from, event: event.kind });
  }
  return ok({ to });
}
