/**
 * PT-8 — Rate-limit bypass (Story 1.b.5). Compõe a defesa de 1.b.2.
 *
 * Verifica que o rate-limit de emissão de códigos (3/hora por wa_id) não é
 * contornável: 4ª emissão → RateLimited; wa_id diferente tem contador próprio;
 * reset após 1h.
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

describe("PT-8 rate-limit bypass", () => {
  test("4ª emissão/hora por wa_id → RateLimited", () => {
    const clock = createTestClockAdapter(new Date("2026-05-29T00:00:00Z"));
    const gate = createConfirmationGate({ audit: fakeAudit(), clock });
    for (let i = 0; i < 3; i++) {
      expect(gate.requireConfirmation("deploy", { waId: "55A" }).isErr()).toBe(true);
    }
    const fourth = gate.requireConfirmation("deploy", { waId: "55A" });
    expect(fourth.isErr() && fourth.error.kind).toBe("RateLimited");
  });

  test("wa_id diferente NÃO partilha o contador (sem bypass por spoof de número)", () => {
    const clock = createTestClockAdapter(new Date("2026-05-29T00:00:00Z"));
    const gate = createConfirmationGate({ audit: fakeAudit(), clock });
    for (let i = 0; i < 3; i++) gate.requireConfirmation("deploy", { waId: "55A" });
    const other = gate.requireConfirmation("deploy", { waId: "55B" });
    expect(other.isErr() && other.error.kind).toBe("ConfirmationRequired");
  });

  test("reset após 1h", () => {
    const clock = createTestClockAdapter(new Date("2026-05-29T00:00:00Z"));
    const gate = createConfirmationGate({ audit: fakeAudit(), clock });
    for (let i = 0; i < 3; i++) gate.requireConfirmation("deploy", { waId: "55A" });
    clock.advance(3_600_001);
    const after = gate.requireConfirmation("deploy", { waId: "55A" });
    expect(after.isErr() && after.error.kind).toBe("ConfirmationRequired");
  });
});
