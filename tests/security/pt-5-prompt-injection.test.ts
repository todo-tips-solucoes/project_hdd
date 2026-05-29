/**
 * PT-5 — Prompt-injection rebuff (Story 1.b.5).
 *
 * Não existe ainda um LLM-handler que recuse instruções semanticamente (Epic 4).
 * O rebuff ESTRUTURAL disponível: mesmo que o LLM seja injectado para executar
 * uma acção irreversível (deploy/force-push/...), a confirmation gate (1.b.2)
 * NÃO a deixa correr sem confirmação humana explícita. A injecção não faz
 * bypass da gate. Rebuff semântico (classificador) → Epic 4.
 */

import { describe, expect, test } from "bun:test";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type { AuditAppendResult, AuditError, AuditPort } from "../../src/ports/audit.port.ts";
import { createConfirmationGate } from "../../src/services/confirmation-gate.service.ts";

function fakeAudit(): AuditPort {
  return {
    append(): Result<AuditAppendResult, AuditError> {
      return ok({ seq: 1, thisHash: "h" as never, path: "p" });
    },
    verifyChain(): Result<{ verified: number }, AuditError> {
      return ok({ verified: 0 });
    },
  };
}

describe("PT-5 prompt-injection rebuff (estrutural)", () => {
  const gate = () =>
    createConfirmationGate({
      audit: fakeAudit(),
      clock: createTestClockAdapter(new Date("2026-05-29T00:00:00Z")),
    });

  test("acção irreversível 'injectada' NÃO executa sem confirmation", () => {
    // Simula o LLM injectado a tentar disparar deploy directamente.
    const r = gate().requireConfirmation("deploy", { waId: "5511999990000" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("ConfirmationRequired");
  });

  test("código de confirmação inventado pela injecção é inválido", () => {
    const g = gate();
    g.requireConfirmation("force-push", { waId: "5511999990000" });
    const r = g.confirm({ code: "FAKE99", waId: "5511999990000", approved: true });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("CodeInvalid");
  });

  test("bypass só via cliOverride humano explícito (não acessível ao LLM)", () => {
    const r = gate().requireConfirmation("deploy", { waId: "cli", cliOverride: true });
    expect(r.isOk() && r.value.kind).toBe("bypassed");
  });
});
