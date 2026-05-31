/**
 * Story 3.3 — specs do template-catalog (catálogo + parseSubmissionState + evaluateM1).
 *
 * AC1/AC3: catálogo tem os 6 nomes; m1Required nos 3 certos; buttons reais do doc.
 * AC2: 3 m1Required approved → M1 met; falta 1 → not met (lista os que faltam).
 * Estado com template desconhecido / status inválido → rejeitado.
 */

import { describe, expect, test } from "bun:test";
import {
  evaluateM1,
  M1_REQUIRED,
  parseSubmissionState,
  TEMPLATE_CATALOG,
  TEMPLATE_NAMES,
} from "../../src/lib/template-catalog.ts";

describe("AC3 — catálogo fiel", () => {
  test("6 nomes exactos", () => {
    expect([...TEMPLATE_NAMES]).toEqual([
      "hdd_interrupt_p1",
      "hdd_interrupt_s1",
      "hdd_interrupt_s2",
      "hdd_summary_finalization",
      "hdd_heartbeat",
      "hdd_release_final",
    ]);
  });
  test("m1Required exactamente nos 3 mínimos", () => {
    expect([...M1_REQUIRED]).toEqual([
      "hdd_interrupt_p1",
      "hdd_summary_finalization",
      "hdd_heartbeat",
    ]);
  });
  test("cada template tem 3 buttons com payloads do doc (não do PAYLOAD_MAP 1.a.4)", () => {
    for (const name of TEMPLATE_NAMES) {
      expect(TEMPLATE_CATALOG[name].buttons.length).toBe(3);
    }
    expect(TEMPLATE_CATALOG.hdd_interrupt_p1.buttons.map((b) => b.payload)).toEqual([
      "p1_continuar_assim",
      "p1_mudar_rumo",
      "p1_ver_detalhes",
    ]);
    expect(TEMPLATE_CATALOG.hdd_summary_finalization.buttons.map((b) => b.payload)).toEqual([
      "fin_aprovar",
      "fin_rever",
      "fin_bloquear",
    ]);
  });
});

describe("parseSubmissionState", () => {
  test("estado válido parcial → ausentes default 'pending'", () => {
    const r = parseSubmissionState({ hdd_interrupt_p1: "approved" });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.hdd_interrupt_p1).toBe("approved");
      expect(r.value.hdd_heartbeat).toBe("pending");
    }
  });
  test("chaves `_`-prefixadas (comentários) ignoradas", () => {
    expect(parseSubmissionState({ _comment: "x", hdd_heartbeat: "submitted" }).isOk()).toBe(true);
  });
  test("template desconhecido → InvalidSubmissionState", () => {
    const r = parseSubmissionState({ hdd_unknown: "approved" });
    if (r.isErr()) expect(r.error.kind).toBe("InvalidSubmissionState");
    else throw new Error("esperava err");
  });
  test("status inválido → InvalidSubmissionState", () => {
    const r = parseSubmissionState({ hdd_interrupt_p1: "maybe" });
    expect(r.isErr()).toBe(true);
  });
  test("não-objecto → InvalidSubmissionState", () => {
    expect(parseSubmissionState("nope").isErr()).toBe(true);
  });
});

describe("AC2 — evaluateM1", () => {
  const allPending = parseSubmissionState({})._unsafeUnwrap();

  test("tudo pending → not met, faltam os 3", () => {
    const m1 = evaluateM1(allPending);
    expect(m1.met).toBe(false);
    expect(m1.missing.length).toBe(3);
  });
  test("3 m1Required approved → met (mesmo com s1/s2/release pending)", () => {
    const state = parseSubmissionState({
      hdd_interrupt_p1: "approved",
      hdd_summary_finalization: "approved",
      hdd_heartbeat: "approved",
    })._unsafeUnwrap();
    const m1 = evaluateM1(state);
    expect(m1.met).toBe(true);
    expect(m1.missing.length).toBe(0);
  });
  test("falta 1 dos 3 → not met (lista o que falta)", () => {
    const state = parseSubmissionState({
      hdd_interrupt_p1: "approved",
      hdd_summary_finalization: "approved",
      hdd_heartbeat: "submitted",
    })._unsafeUnwrap();
    const m1 = evaluateM1(state);
    expect(m1.met).toBe(false);
    expect(m1.missing).toEqual(["hdd_heartbeat"]);
  });
});
