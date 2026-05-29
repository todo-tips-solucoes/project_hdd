/**
 * Story 1.a.4 — specs para src/core/domain/interrupt-commands.ts.
 *
 * AC-4 (payloads conhecidos) + AC-5 (UnknownCommand).
 * Política Q-A4-2: match exacto literal (whitespace + casing strict).
 */

import { describe, expect, test } from "bun:test";
import { PAYLOAD_MAP, parseInterruptCommand } from "../../src/core/domain/interrupt-commands.ts";

describe("AC-4 payloads conhecidos → ok({kind})", () => {
  test("p1_continuar_assim → P1Continuar", () => {
    const r = parseInterruptCommand("p1_continuar_assim");
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toEqual({ kind: "P1Continuar" });
  });

  test("p1_pausar_agora → P1Pausar", () => {
    expect(parseInterruptCommand("p1_pausar_agora")._unsafeUnwrap()).toEqual({ kind: "P1Pausar" });
  });

  test("fin_aprovar → FinAprovar", () => {
    expect(parseInterruptCommand("fin_aprovar")._unsafeUnwrap()).toEqual({ kind: "FinAprovar" });
  });

  test("fin_pedir_mudancas → FinPedirMudancas", () => {
    expect(parseInterruptCommand("fin_pedir_mudancas")._unsafeUnwrap()).toEqual({
      kind: "FinPedirMudancas",
    });
  });

  test("fin_rejeitar → FinRejeitar", () => {
    expect(parseInterruptCommand("fin_rejeitar")._unsafeUnwrap()).toEqual({ kind: "FinRejeitar" });
  });
});

describe("AC-5 payloads desconhecidos → err({kind:'UnknownCommand'})", () => {
  test("string arbitrária", () => {
    const r = parseInterruptCommand("foo_bar");
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({ kind: "UnknownCommand", received: "foo_bar" });
  });

  test("string vazia", () => {
    expect(parseInterruptCommand("")._unsafeUnwrapErr()).toEqual({
      kind: "UnknownCommand",
      received: "",
    });
  });

  test("match exacto — whitespace EXTRA falha", () => {
    expect(parseInterruptCommand(" p1_continuar_assim ").isErr()).toBe(true);
    expect(parseInterruptCommand("p1_continuar_assim\n").isErr()).toBe(true);
  });

  test("match exacto — case-sensitivity strict", () => {
    expect(parseInterruptCommand("P1_CONTINUAR_ASSIM").isErr()).toBe(true);
    expect(parseInterruptCommand("Fin_Aprovar").isErr()).toBe(true);
  });
});

describe("PAYLOAD_MAP sanity", () => {
  test("contém exactamente 7 entradas (5 base + 2 Irrev Story 1.b.2)", () => {
    expect(Object.keys(PAYLOAD_MAP).length).toBe(7);
  });

  test("todos os values são kinds válidos", () => {
    const validKinds = new Set([
      "P1Continuar",
      "P1Pausar",
      "FinAprovar",
      "FinPedirMudancas",
      "FinRejeitar",
      "IrrevConfirmYes",
      "IrrevConfirmNo",
    ]);
    for (const v of Object.values(PAYLOAD_MAP)) {
      expect(validKinds.has(v)).toBe(true);
    }
  });
});
