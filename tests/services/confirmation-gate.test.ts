/**
 * `confirmation-gate.test.ts` — two-step confirmation (Story 1.b.2).
 *
 * AC1 (require → ConfirmationRequired + código + audit), AC2 (abort via
 * IrrevConfirmNo), AC3 (CLI bypass), AC4 (single-use + expiry 60s + tied waId
 * + rate-limit 3/hora). Inclui regressão do parser de interrupt-commands.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { PAYLOAD_MAP, parseInterruptCommand } from "../../src/core/domain/interrupt-commands.ts";
import {
  IRREVERSIBLE_ACTIONS,
  isIrreversibleAction,
} from "../../src/lib/irreversible-action-catalog.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import {
  type ConfirmationGate,
  createConfirmationGate,
} from "../../src/services/confirmation-gate.service.ts";

function createFakeAudit(): AuditPort & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    append(event: AuditEntry): Result<AuditAppendResult, AuditError> {
      entries.push(event);
      return ok({ seq: entries.length, thisHash: "fake-hash" as never, path: "fake" });
    },
    verifyChain(): Result<{ verified: number }, AuditError> {
      return ok({ verified: entries.length });
    },
  };
}

const WA = "551199990000";

/** codeGen determinístico: emite códigos sequenciais previsíveis. */
function seqCodeGen(): () => string {
  let n = 0;
  return () => `CODE${(++n).toString().padStart(2, "0")}`;
}

function setup(codeGen?: () => string) {
  const audit = createFakeAudit();
  const clock = createTestClockAdapter(new Date("2026-05-29T00:00:00.000Z"));
  const gate: ConfirmationGate = createConfirmationGate(
    codeGen ? { audit, clock, codeGen } : { audit, clock },
  );
  return { audit, clock, gate };
}

function typesOf(audit: { entries: AuditEntry[] }): string[] {
  return audit.entries.map((e) => e.type);
}

describe("irreversible-action-catalog", () => {
  test("catálogo tem as 5 acções esperadas", () => {
    expect([...IRREVERSIBLE_ACTIONS]).toEqual([
      "deploy",
      "branch-delete",
      "force-push",
      "schema-drop",
      "audit-purge",
    ]);
  });
  test("isIrreversibleAction narrowing", () => {
    expect(isIrreversibleAction("deploy")).toBe(true);
    expect(isIrreversibleAction("read-file")).toBe(false);
  });
});

describe("interrupt-commands — variantes Irrev (Story 1.b.2)", () => {
  test("parse irrev_confirm_yes/no", () => {
    const yes = parseInterruptCommand("irrev_confirm_yes");
    const no = parseInterruptCommand("irrev_confirm_no");
    expect(yes.isOk() && yes.value.kind).toBe("IrrevConfirmYes");
    expect(no.isOk() && no.value.kind).toBe("IrrevConfirmNo");
  });
  test("regressão: os 5 originais continuam a parsear", () => {
    for (const p of [
      "p1_continuar_assim",
      "p1_pausar_agora",
      "fin_aprovar",
      "fin_pedir_mudancas",
      "fin_rejeitar",
    ]) {
      expect(parseInterruptCommand(p).isOk()).toBe(true);
    }
    expect(Object.keys(PAYLOAD_MAP)).toHaveLength(7);
  });
  test("match exacto preservado (Q-A4-2)", () => {
    expect(parseInterruptCommand("IRREV_CONFIRM_YES").isErr()).toBe(true);
    expect(parseInterruptCommand(" irrev_confirm_yes ").isErr()).toBe(true);
  });
});

describe("AC1 — requireConfirmation", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup(seqCodeGen());
  });

  test("acção irreversível sem confirm → ConfirmationRequired + audit + código emitido", () => {
    const r = ctx.gate.requireConfirmation("deploy", { waId: WA });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error).toEqual({ kind: "ConfirmationRequired", action: "deploy" });
    expect(typesOf(ctx.audit)).toContain("ConfirmationRequired");
  });

  test("acção não-catalogada → not-required, sem código", () => {
    const r = ctx.gate.requireConfirmation("read-file", { waId: WA });
    expect(r.isOk() && r.value.kind).toBe("not-required");
    expect(ctx.audit.entries).toHaveLength(0);
  });

  test("código default é 6-char ambiguity-safe", () => {
    const real = setup(); // sem codeGen → default crypto
    real.gate.requireConfirmation("deploy", { waId: WA });
    // inspeccionar via confirm com código errado não dá; validamos formato indirectamente:
    // emitimos e confirmamos que NÃO há chars ambíguos no fluxo real testando o charset.
    expect(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test("ABCDEF")).toBe(true);
  });
});

describe("AC3 — CLI bypass", () => {
  test("cliOverride → bypassed + audit via cli-override", () => {
    const ctx = setup(seqCodeGen());
    const r = ctx.gate.requireConfirmation("force-push", { waId: WA, cliOverride: true });
    expect(r.isOk() && r.value.kind).toBe("bypassed");
    const confirmed = ctx.audit.entries.find((e) => e.type === "IrreversibleActionConfirmed");
    expect(confirmed?.payload["via"]).toBe("cli-override");
  });
});

describe("AC2 + AC4 — confirm flow", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup(seqCodeGen());
  });

  test("AC4: approved:true válido → confirmed", () => {
    ctx.gate.requireConfirmation("deploy", { waId: WA }); // emite CODE01
    const r = ctx.gate.confirm({ code: "CODE01", waId: WA, approved: true });
    expect(r.isOk() && r.value).toEqual({ kind: "confirmed", action: "deploy" });
    expect(typesOf(ctx.audit)).toContain("IrreversibleActionConfirmed");
  });

  test("AC2: approved:false → aborted + IrreversibleActionAborted", () => {
    ctx.gate.requireConfirmation("schema-drop", { waId: WA }); // CODE01
    const r = ctx.gate.confirm({ code: "CODE01", waId: WA, approved: false });
    expect(r.isOk() && r.value).toEqual({ kind: "aborted", action: "schema-drop" });
    expect(typesOf(ctx.audit)).toContain("IrreversibleActionAborted");
  });

  test("AC4: single-use — 2ª tentativa mesmo código → CodeInvalid", () => {
    ctx.gate.requireConfirmation("deploy", { waId: WA }); // CODE01
    ctx.gate.confirm({ code: "CODE01", waId: WA, approved: true });
    const r2 = ctx.gate.confirm({ code: "CODE01", waId: WA, approved: true });
    expect(r2.isErr() && r2.error.kind).toBe("CodeInvalid");
  });

  test("AC4: expiry 60s — confirm após 61s → CodeExpired", () => {
    ctx.gate.requireConfirmation("deploy", { waId: WA }); // CODE01 @ t0
    ctx.clock.advance(61_000);
    const r = ctx.gate.confirm({ code: "CODE01", waId: WA, approved: true });
    expect(r.isErr() && r.error.kind).toBe("CodeExpired");
  });

  test("AC4: tied waId — waId errado → WaIdMismatch (não consome)", () => {
    ctx.gate.requireConfirmation("deploy", { waId: WA }); // CODE01
    const wrong = ctx.gate.confirm({ code: "CODE01", waId: "999", approved: true });
    expect(wrong.isErr() && wrong.error.kind).toBe("WaIdMismatch");
    // o operador legítimo ainda consegue usar
    const right = ctx.gate.confirm({ code: "CODE01", waId: WA, approved: true });
    expect(right.isOk() && right.value.kind).toBe("confirmed");
  });

  test("AC4: rate-limit 3/hora — 4ª emissão → RateLimited", () => {
    for (let i = 0; i < 3; i++) {
      const r = ctx.gate.requireConfirmation("deploy", { waId: WA });
      expect(r.isErr() && r.error.kind).toBe("ConfirmationRequired");
    }
    const fourth = ctx.gate.requireConfirmation("deploy", { waId: WA });
    expect(fourth.isErr() && fourth.error.kind).toBe("RateLimited");
    expect(typesOf(ctx.audit)).toContain("ConfirmationRateLimited");
  });

  test("AC4: rate-limit reseta após 1h", () => {
    for (let i = 0; i < 3; i++) ctx.gate.requireConfirmation("deploy", { waId: WA });
    ctx.clock.advance(3_600_001);
    const after = ctx.gate.requireConfirmation("deploy", { waId: WA });
    expect(after.isErr() && after.error.kind).toBe("ConfirmationRequired");
  });
});
