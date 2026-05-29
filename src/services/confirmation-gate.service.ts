/**
 * `confirmation-gate.service.ts` — two-step confirmation de acções irreversíveis.
 *
 * Story 1.b.2 (Epic 1.b Safety BLOCKERS, DRB BLOCKER #2 — AO-155 + AO-164).
 *
 * O worker LLM-driven não pode executar uma acção destrutiva (deploy,
 * branch-delete, force-push, schema-drop, audit-purge) sem um humano no loop:
 *   - `requireConfirmation(action)` → emite código 6-char e devolve
 *     `err(ConfirmationRequired)`; o orquestrador envia o código via WhatsApp.
 *   - `confirm({ code, waId, approved })` → valida e autoriza/aborta.
 *   - bypass human-driven via CLI flag (`cliOverride`).
 *
 * **AO-164 (Q-B2-* [RESOLVED]):** código **6-char ambiguity-safe** (sem
 * `0/O/1/I/L`); **single-use** (consumido no `confirm`); **expira 60s** (via
 * `clock`); **tied `wa_id`**; **rate-limit 3 emissões/hora** por `waId`.
 *
 * Serviço síncrono (sem I/O) → `Result`, não `ResultAsync`. Estado in-process
 * por instância (Maps); persistência DB fica para a orquestração (Epic 4.x).
 *
 * Audit (PascalCase, 1.a.6): `ConfirmationRequired`, `IrreversibleActionConfirmed`,
 * `IrreversibleActionAborted`, `ConfirmationRateLimited`, `ConfirmationRejected`.
 */

import {
  type IrreversibleAction,
  isIrreversibleAction,
} from "../lib/irreversible-action-catalog.ts";
import { err, ok, type Result } from "../lib/result.ts";
import type { AuditPort } from "../ports/audit.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";

const CODE_TTL_MS = 60_000;
const RATE_WINDOW_MS = 3_600_000;
const RATE_MAX = 3;
const CODE_LEN = 6;
/** 31 chars — A-Z e 2-9 sem os ambíguos `0 O 1 I L` (Q-B2-4). */
const SAFE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type RequireOutcome = { readonly kind: "not-required" } | { readonly kind: "bypassed" };

export type ConfirmResult =
  | { readonly kind: "confirmed"; readonly action: IrreversibleAction }
  | { readonly kind: "aborted"; readonly action: IrreversibleAction };

export type ConfirmationError =
  | { readonly kind: "ConfirmationRequired"; readonly action: IrreversibleAction }
  | { readonly kind: "RateLimited"; readonly action: IrreversibleAction }
  | { readonly kind: "CodeInvalid" }
  | { readonly kind: "CodeExpired" }
  | { readonly kind: "WaIdMismatch" };

export interface ConfirmationGate {
  requireConfirmation(
    action: string,
    opts: { waId: string; cliOverride?: boolean },
  ): Result<RequireOutcome, ConfirmationError>;
  confirm(input: {
    code: string;
    waId: string;
    approved: boolean;
  }): Result<ConfirmResult, ConfirmationError>;
}

export type ConfirmationGateDeps = {
  readonly clock: ClockPort;
  readonly audit: AuditPort;
  /** Injectável p/ tests determinísticos; default usa `crypto.getRandomValues`. */
  readonly codeGen?: () => string;
};

type Pending = {
  readonly action: IrreversibleAction;
  readonly waId: string;
  readonly expiresAtMs: number;
};

function defaultCodeGen(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += SAFE_CHARSET[(bytes[i] ?? 0) % SAFE_CHARSET.length];
  }
  return out;
}

export function createConfirmationGate(deps: ConfirmationGateDeps): ConfirmationGate {
  const codeGen = deps.codeGen ?? defaultCodeGen;
  const pending = new Map<string, Pending>();
  const issuedByWaId = new Map<string, number[]>();

  function emit(type: string, payload: Readonly<Record<string, unknown>>): void {
    void deps.audit.append({ ts: deps.clock.now().toISOString(), type, payload });
  }

  function requireConfirmation(
    action: string,
    opts: { waId: string; cliOverride?: boolean },
  ): Result<RequireOutcome, ConfirmationError> {
    const irreversible = isIrreversibleAction(action);

    if (opts.cliOverride === true) {
      if (irreversible) {
        emit("IrreversibleActionConfirmed", { action, waId: opts.waId, via: "cli-override" });
      }
      return ok({ kind: "bypassed" });
    }

    if (!irreversible) return ok({ kind: "not-required" });

    const now = deps.clock.now().getTime();
    const recent = (issuedByWaId.get(opts.waId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      emit("ConfirmationRateLimited", { action, waId: opts.waId });
      return err({ kind: "RateLimited", action });
    }

    const code = codeGen();
    pending.set(code, { action, waId: opts.waId, expiresAtMs: now + CODE_TTL_MS });
    recent.push(now);
    issuedByWaId.set(opts.waId, recent);
    emit("ConfirmationRequired", { action, waId: opts.waId });
    return err({ kind: "ConfirmationRequired", action });
  }

  function confirm(input: {
    code: string;
    waId: string;
    approved: boolean;
  }): Result<ConfirmResult, ConfirmationError> {
    const p = pending.get(input.code);
    if (p === undefined) {
      emit("ConfirmationRejected", { reason: "CodeInvalid", waId: input.waId });
      return err({ kind: "CodeInvalid" });
    }
    const now = deps.clock.now().getTime();
    if (now > p.expiresAtMs) {
      pending.delete(input.code); // expirado → cleanup
      emit("ConfirmationRejected", { reason: "CodeExpired", action: p.action });
      return err({ kind: "CodeExpired" });
    }
    if (p.waId !== input.waId) {
      // NÃO consumir: preserva o código para o operador legítimo (anti-DoS).
      emit("ConfirmationRejected", { reason: "WaIdMismatch", action: p.action });
      return err({ kind: "WaIdMismatch" });
    }
    pending.delete(input.code); // válido → single-use consume
    if (!input.approved) {
      emit("IrreversibleActionAborted", { action: p.action, waId: input.waId });
      return ok({ kind: "aborted", action: p.action });
    }
    emit("IrreversibleActionConfirmed", { action: p.action, waId: input.waId, via: "two-step" });
    return ok({ kind: "confirmed", action: p.action });
  }

  return { requireConfirmation, confirm };
}
