/**
 * `redaction.security.test.ts` — redaction multi-pattern (Story 1.b.3).
 *
 * AC1 (Authorization Bearer exacto), AC2 (9/9 categorias). Property test +
 * recursão + ausência de falsos-positivos.
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { MAX_FIELD_LEN, redactPayload, redactString } from "../../src/lib/redaction.ts";

describe("AC1 — Authorization Bearer (binary, exacto)", () => {
  test("Bearer sk-ant token → ***REDACTED*** preservando prefixo", () => {
    const out = redactString("Authorization: Bearer sk-ant-api03-AbC123xyz_TOKEN");
    expect(out).toBe("Authorization: Bearer ***REDACTED***");
  });
});

describe("AC2 — 9 categorias (coverage ≥9/9)", () => {
  const cases: ReadonlyArray<{ name: string; input: string; secret: string }> = [
    {
      name: "anthropic-key",
      input: "key=sk-ant-api03-SECRETvalue123456",
      secret: "sk-ant-api03-SECRETvalue123456",
    },
    {
      name: "bearer-token",
      input: "Bearer abcDEF123.ghiJKL456-mno",
      secret: "abcDEF123.ghiJKL456-mno",
    },
    {
      name: "basic-auth",
      input: "Authorization: Basic dXNlcjpwYXNzd29yZA==",
      secret: "dXNlcjpwYXNzd29yZA==",
    },
    { name: "wa_id 55*", input: "wa_id 5511987654321 confirmou", secret: "5511987654321" },
    { name: "phone-pt", input: "contacto +351 912 345 678 ok", secret: "+351 912 345 678" },
    { name: "phone-br", input: "ligar +55 11 98765-4321 agora", secret: "+55 11 98765-4321" },
    {
      name: "generic-secret",
      input: 'config password="hunter2supersecret"',
      secret: "hunter2supersecret",
    },
    {
      name: "env-var-leak",
      input: "ANTHROPIC_API_KEY=sk-xyz-leaked-value",
      secret: "sk-xyz-leaked-value",
    },
    {
      name: "n8n-verbose-body",
      input: `n8n body: ${"X".repeat(MAX_FIELD_LEN + 500)}`,
      secret: "X".repeat(MAX_FIELD_LEN + 500),
    },
  ];

  for (const c of cases) {
    test(`${c.name} → segredo removido`, () => {
      const out = redactString(c.input);
      expect(out.includes(c.secret)).toBe(false);
    });
  }

  test("9/9 categorias cobertas", () => {
    expect(cases).toHaveLength(9);
  });
});

describe("recursão + integridade do payload", () => {
  test("redige em profundidade (objecto→array→objecto), mantém keys", () => {
    const payload = {
      level: "info",
      auth: { header: "Bearer sk-ant-api03-DEEPsecret123456" },
      items: [{ token: "ghp_0123456789abcdefghijABCDEFGHIJ0123" }],
    };
    const out = redactPayload(payload) as typeof payload;
    expect(out.auth.header).toBe("Bearer ***REDACTED***");
    expect(out.items[0]?.token).not.toContain("ghp_0123456789");
    expect(Object.keys(out)).toEqual(["level", "auth", "items"]); // keys preservadas
  });

  test("não muta o input original", () => {
    const payload = { h: "Bearer sk-ant-api03-MUTAtest123456" };
    const snapshot = payload.h;
    redactPayload(payload);
    expect(payload.h).toBe(snapshot);
  });

  test("texto normal passa intacto (sem falsos-positivos)", () => {
    expect(redactString("a story about deploy and tokens of trust")).toBe(
      "a story about deploy and tokens of trust",
    );
  });
});

describe("size-cap (n8n-verbose-body)", () => {
  test("string > MAX_FIELD_LEN truncada com marcador", () => {
    const out = redactString("Y".repeat(MAX_FIELD_LEN + 100));
    expect(out.length).toBeLessThan(MAX_FIELD_LEN + 100);
    expect(out).toContain("[TRUNCATED");
  });
});

describe("property — anthropic key nunca sobrevive", () => {
  test("para qualquer sufixo, sk-ant-<suffix> é redigido", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9_-]{8,40}$/), (suffix) => {
        const out = redactString(`prefix sk-ant-${suffix} suffix`);
        return !out.includes(`sk-ant-${suffix}`);
      }),
    );
  });
});
