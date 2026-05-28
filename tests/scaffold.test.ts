// Scaffold smoke test — confirma que o test runner descobre specs em tests/**
// e que o Bun runtime + tsconfig compilam ficheiros TS. Story 1.a.2 substitui
// este placeholder pelos primeiros specs reais (Result + branded types).

import { expect, test } from "bun:test";

test("scaffold runtime smoke", () => {
  expect(1 + 1).toBe(2);
});

test("Bun runtime is present", () => {
  expect(typeof Bun).toBe("object");
});
