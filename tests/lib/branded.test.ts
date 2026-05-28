/**
 * Story 1.a.2 — specs para src/lib/branded.ts.
 *
 * AC-4: branded types impedem atribuição directa de `string` literal
 * (verificado via `@ts-expect-error` em ficheiro próprio — ver tests/lib/branded.tsc.test.ts).
 *
 * Test files isentos da throw whitelist (AO-104 override em eslint.config.js).
 */

import { describe, expect, test } from "bun:test";
import {
  assertInvariant,
  assertNever,
  mkIdempotencyKey,
  mkRunId,
  mkSha256Hash,
  mkStoryId,
} from "../../src/lib/branded.ts";

// Sample valids (UUID v4 / hex / story-id / etc.)
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_STORY = "1-a-2-result-t-e-branded-types-lib-helpers";
const VALID_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// ────────────────────────────────────────────────────────────────────────────────
// mkRunId
// ────────────────────────────────────────────────────────────────────────────────

describe("mkRunId", () => {
  test("aceita UUID v4 válido", () => {
    const r = mkRunId(VALID_UUID);
    expect(r.isOk()).toBe(true);
  });

  test("rejeita string não-UUID", () => {
    const r = mkRunId("abc");
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr()).toEqual({
      kind: "InvalidFormat",
      brand: "RunId",
      input: "abc",
      reason: "expected UUID v4 lowercase",
    });
  });

  test("rejeita UUID com versão errada (v1 em vez de v4)", () => {
    // v1 has '1' instead of '4' in the 13th char
    const r = mkRunId("550e8400-e29b-11d4-a716-446655440000");
    expect(r.isErr()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// mkStoryId
// ────────────────────────────────────────────────────────────────────────────────

describe("mkStoryId", () => {
  test("aceita story-id válido", () => {
    expect(mkStoryId(VALID_STORY).isOk()).toBe(true);
    expect(mkStoryId("1-a-1-bun-base-scaffold").isOk()).toBe(true);
  });

  test("rejeita formato inválido", () => {
    expect(mkStoryId("not-a-story-id").isErr()).toBe(true);
    expect(mkStoryId("1-a-2").isErr()).toBe(true); // sem slug
    expect(mkStoryId("UPPERCASE-fail").isErr()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// mkSha256Hash
// ────────────────────────────────────────────────────────────────────────────────

describe("mkSha256Hash", () => {
  test("aceita hex 64 chars lowercase", () => {
    expect(mkSha256Hash(VALID_SHA256).isOk()).toBe(true);
  });

  test("rejeita hex com tamanho errado (63 chars)", () => {
    expect(mkSha256Hash(VALID_SHA256.slice(0, 63)).isErr()).toBe(true);
  });

  test("rejeita hex com uppercase", () => {
    expect(mkSha256Hash(VALID_SHA256.toUpperCase()).isErr()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// mkIdempotencyKey (UUID OR sha256)
// ────────────────────────────────────────────────────────────────────────────────

describe("mkIdempotencyKey", () => {
  test("aceita UUID v4", () => {
    expect(mkIdempotencyKey(VALID_UUID).isOk()).toBe(true);
  });

  test("aceita sha256 hex 64 chars", () => {
    expect(mkIdempotencyKey(VALID_SHA256).isOk()).toBe(true);
  });

  test("rejeita string que não é UUID nem hex 64", () => {
    expect(mkIdempotencyKey("random-stuff").isErr()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// assertNever
// ────────────────────────────────────────────────────────────────────────────────

describe("assertNever", () => {
  test("throws em runtime quando chamado (caso impossível em código bem-tipado)", () => {
    // Em código correcto este caminho é unreachable; aqui forçamos via cast para
    // verificar que a função efectivamente lança. Test files isentos AO-104.
    expect(() => assertNever("unexpected" as never)).toThrow(/assertNever reached/);
  });

  test("é exhaustiveness check para tagged union", () => {
    type E = { kind: "A" } | { kind: "B" };
    const handle = (x: E): string => {
      switch (x.kind) {
        case "A":
          return "a";
        case "B":
          return "b";
        default:
          return assertNever(x);
      }
    };
    expect(handle({ kind: "A" })).toBe("a");
    expect(handle({ kind: "B" })).toBe("b");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// assertInvariant
// ────────────────────────────────────────────────────────────────────────────────

describe("assertInvariant", () => {
  test("não lança quando condição true", () => {
    expect(() => assertInvariant(true, "ok")).not.toThrow();
  });

  test("lança quando condição false, com mensagem", () => {
    expect(() => assertInvariant(false, "estado X impossível")).toThrow(
      /Invariant violated: estado X imposs/,
    );
  });
});
