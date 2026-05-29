/**
 * PT-3 — Redaction (Story 1.b.5). Compõe a defesa de 1.b.3.
 *
 * Verifica que os patterns de secret são redigidos e que texto normal passa
 * intacto (sem falsos-positivos).
 */

import { describe, expect, test } from "bun:test";
import { redactPayload, redactString } from "../../src/lib/redaction.ts";

describe("PT-3 redaction", () => {
  const secrets: ReadonlyArray<[string, string]> = [
    ["sk-ant-api03-PT3secret1234567890", "anthropic-key"],
    ["Authorization: Bearer abc.def-ghi", "bearer"],
    ['password="hunter2supersecret"', "generic"],
    ["5511987654321", "wa_id"],
  ];

  for (const [input, label] of secrets) {
    test(`secret redigido: ${label}`, () => {
      expect(redactString(input)).toContain("***REDACTED***");
    });
  }

  test("payload aninhado redigido em profundidade", () => {
    const out = redactPayload({ a: { b: ["Bearer sk-ant-api03-DEEP1234567890"] } }) as {
      a: { b: string[] };
    };
    expect(out.a.b[0]).not.toContain("sk-ant-api03-DEEP");
  });

  test("texto normal sem falsos-positivos", () => {
    expect(redactString("deploy the worker and review tokens of trust")).toBe(
      "deploy the worker and review tokens of trust",
    );
  });
});
