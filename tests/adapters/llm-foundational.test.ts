/**
 * Story 1.a.10 — specs foundational LLM (AC-1..5).
 *
 * AC-1: LLMPort Dep Graph Rigour — port não importa adapters.
 * AC-2: AnthropicSDKAdapter Sonnet + Haiku ok + 401 Unauthorized + cache_control wiring.
 * AC-3: ClaudeCliAdapter spawn args (sem/com sessionId) + cache_read propagation.
 * AC-4: TestLLMAdapter fixture hit/miss.
 * AC-5: SessionId branded type-check enforcement (compile-error via @ts-expect-error).
 *
 * Network policy: mock-only. SDK `client` é injectado; CLI `spawn` é injectado.
 * Sem network calls em CI. Smoke real fica para dev local + 1.c.7 process.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicSDKAdapter } from "../../src/adapters/llm/anthropic-sdk.adapter.ts";
import {
  type ClaudeSpawn,
  type ClaudeSpawnResult,
  createClaudeCliAdapter,
} from "../../src/adapters/llm/claude-cli.adapter.ts";
import { mkSessionId, type SessionId } from "../../src/lib/branded.ts";
import { ResultAsync } from "../../src/lib/result.ts";
import type { LLMError, LLMPort, LLMRequest, LLMResult } from "../../src/ports/llm.port.ts";

const PORT_PATH = join(import.meta.dir, "..", "..", "src", "ports", "llm.port.ts");

// ────────────────────────────────────────────────────────────────────────────────
// AC-1: Dep Graph Rigour — port não importa adapters
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-1 LLMPort Dep Graph Rigour", () => {
  test("src/ports/llm.port.ts NÃO importa de src/adapters/", () => {
    const source = readFileSync(PORT_PATH, "utf8");
    const imports = source.match(/from\s+["']([^"']+)["']/g) ?? [];
    for (const imp of imports) {
      expect(imp).not.toContain("adapters/");
      expect(imp).not.toContain("src/adapters");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-2: AnthropicSDKAdapter — happy Haiku + Sonnet, 401, cache_control
// ────────────────────────────────────────────────────────────────────────────────

type MockMessage = {
  content: Array<{ type: "text"; text: string }>;
  usage: {
    input_tokens: number | null;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
};

type MockMessages = {
  create: (params: unknown) => Promise<MockMessage>;
};
type MockAnthropic = {
  messages: MockMessages;
};

function mockAnthropic(impl: MockMessages["create"]): MockAnthropic {
  return { messages: { create: impl } };
}

describe("AC-2 AnthropicSDKAdapter", () => {
  test("happy Haiku → ok com content + tokens", async () => {
    let capturedParams: unknown = null;
    const client = mockAnthropic((params: unknown) => {
      capturedParams = params;
      return Promise.resolve({
        content: [{ type: "text", text: "haiku response" }],
        usage: { input_tokens: 12, output_tokens: 5 },
      });
    });
    const adapter = createAnthropicSDKAdapter({
      apiKey: "sk-test",
      client: client as unknown as Anthropic,
    });
    const r = await adapter.invoke({
      role: "classifier",
      model: "claude-haiku-4-5",
      prompt: "test prompt",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.content).toBe("haiku response");
      expect(r.value.model).toBe("claude-haiku-4-5");
      expect(r.value.tokens.input).toBe(12);
      expect(r.value.tokens.output).toBe(5);
    }
    expect((capturedParams as { model: string }).model).toBe("claude-haiku-4-5");
  });

  test("happy Sonnet → ok com content + tokens", async () => {
    const client = mockAnthropic(() =>
      Promise.resolve({
        content: [{ type: "text", text: "sonnet response" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );
    const adapter = createAnthropicSDKAdapter({
      apiKey: "sk-test",
      client: client as unknown as Anthropic,
    });
    const r = await adapter.invoke({
      role: "dev",
      model: "claude-sonnet-4-6",
      prompt: "implement feature",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.content).toBe("sonnet response");
      expect(r.value.tokens.input).toBe(100);
    }
  });

  test("401 Unauthorized → err Unauthorized", async () => {
    const client = mockAnthropic(() =>
      Promise.reject(
        new Anthropic.AuthenticationError(
          401,
          { error: { message: "Invalid key" } },
          "401 Unauthorized",
          new Headers(),
        ),
      ),
    );
    const adapter = createAnthropicSDKAdapter({
      apiKey: "sk-bad",
      client: client as unknown as Anthropic,
    });
    const r = await adapter.invoke({ role: "classifier", model: "claude-haiku-4-5", prompt: "x" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("Unauthorized");
  });

  test("cache_control: true → messages array wrap com ephemeral marker", async () => {
    let captured: unknown = null;
    const client = mockAnthropic((params: unknown) => {
      captured = params;
      return Promise.resolve({
        content: [{ type: "text", text: "x" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });
    const adapter = createAnthropicSDKAdapter({
      apiKey: "sk-test",
      client: client as unknown as Anthropic,
    });
    await adapter.invoke({
      role: "dev",
      model: "claude-sonnet-4-6",
      prompt: "long prompt",
      cacheControl: true,
    });
    const p = captured as { messages: Array<{ content: Array<{ cache_control?: object }> }> };
    expect(p.messages[0]?.content[0]?.cache_control).toEqual({ type: "ephemeral" });
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-3: ClaudeCliAdapter — spawn args + session reuse + cache_read
// ────────────────────────────────────────────────────────────────────────────────

const VALID_SESSION_ID = "12345678-1234-4abc-9def-123456789abc";

function mkCliFixture(opts: { cacheRead?: number; sessionId?: string } = {}): ClaudeSpawnResult {
  const sid = opts.sessionId ?? VALID_SESSION_ID;
  const usage: Record<string, number> = { input_tokens: 50, output_tokens: 10 };
  if (opts.cacheRead !== undefined) usage["cache_read_input_tokens"] = opts.cacheRead;
  return {
    exitCode: 0,
    stdout: JSON.stringify({
      type: "result",
      result: "cli response",
      session_id: sid,
      usage,
    }),
    stderr: "",
  };
}

describe("AC-3 ClaudeCliAdapter", () => {
  test("sem sessionId → args NÃO contém --resume", async () => {
    let capturedArgs: ReadonlyArray<string> = [];
    const spawn: ClaudeSpawn = (args) => {
      capturedArgs = args;
      return Promise.resolve(mkCliFixture());
    };
    const adapter = createClaudeCliAdapter({ spawn });
    const r = await adapter.invoke({
      role: "dispatcher",
      model: "claude-sonnet-4-6",
      prompt: "p",
    });
    expect(r.isOk()).toBe(true);
    expect(capturedArgs).toEqual([
      "--print",
      "--output-format",
      "json",
      "--model",
      "claude-sonnet-4-6",
    ]);
  });

  test("com sessionId → args contém --resume <sid>", async () => {
    let capturedArgs: ReadonlyArray<string> = [];
    const spawn: ClaudeSpawn = (args) => {
      capturedArgs = args;
      return Promise.resolve(mkCliFixture());
    };
    const adapter = createClaudeCliAdapter({ spawn });
    const sidR = mkSessionId(VALID_SESSION_ID);
    if (sidR.isErr()) throw new Error("invalid test sid");
    await adapter.invoke({
      role: "dev",
      model: "claude-sonnet-4-6",
      prompt: "p",
      sessionId: sidR.value,
    });
    expect(capturedArgs).toContain("--resume");
    expect(capturedArgs).toContain(VALID_SESSION_ID);
  });

  test("cache_read_input_tokens propaga para LLMResult.tokens", async () => {
    const spawn: ClaudeSpawn = () => Promise.resolve(mkCliFixture({ cacheRead: 47000 }));
    const adapter = createClaudeCliAdapter({ spawn });
    const r = await adapter.invoke({
      role: "dev",
      model: "claude-sonnet-4-6",
      prompt: "p",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.tokens.cacheReadInputTokens).toBe(47000);
      expect(r.value.sessionId).toBe(VALID_SESSION_ID as SessionId);
    }
  });

  test("exit code != 0 → err ServerError", async () => {
    const spawn: ClaudeSpawn = () =>
      Promise.resolve({ exitCode: 2, stdout: "", stderr: "claude crashed" });
    const adapter = createClaudeCliAdapter({ spawn });
    const r = await adapter.invoke({
      role: "dev",
      model: "claude-sonnet-4-6",
      prompt: "p",
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.kind).toBe("ServerError");
      if (r.error.kind === "ServerError") expect(r.error.status).toBe(2);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-4: TestLLMAdapter — fixture hit/miss
// ────────────────────────────────────────────────────────────────────────────────

function createTestLLMAdapter(fixtures: Map<string, LLMResult>): LLMPort {
  return {
    invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError> {
      const key = `${req.role}:${req.prompt.slice(0, 40)}`;
      const fixture = fixtures.get(key);
      if (fixture !== undefined) {
        return ResultAsync.fromSafePromise(Promise.resolve(fixture));
      }
      const error: LLMError = { kind: "FixtureMissing", key };
      return ResultAsync.fromPromise(Promise.reject(new Error(JSON.stringify(error))), () => error);
    },
  };
}

describe("AC-4 TestLLMAdapter", () => {
  test("fixture exists → ok", async () => {
    const fixtures = new Map<string, LLMResult>();
    fixtures.set("classifier:hello", {
      content: "fixture-response",
      model: "claude-haiku-4-5",
      tokens: { input: 5, output: 3 },
    });
    const adapter = createTestLLMAdapter(fixtures);
    const r = await adapter.invoke({
      role: "classifier",
      model: "claude-haiku-4-5",
      prompt: "hello",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.content).toBe("fixture-response");
  });

  test("fixture missing → err FixtureMissing", async () => {
    const adapter = createTestLLMAdapter(new Map());
    const r = await adapter.invoke({
      role: "classifier",
      model: "claude-haiku-4-5",
      prompt: "unknown",
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("FixtureMissing");
  });
});

// ────────────────────────────────────────────────────────────────────────────────
// AC-5: SessionId branded type-check enforcement
// ────────────────────────────────────────────────────────────────────────────────

describe("AC-5 SessionId branded", () => {
  test("mkSessionId valida UUID v4", () => {
    const r = mkSessionId(VALID_SESSION_ID);
    expect(r.isOk()).toBe(true);
    const bad = mkSessionId("not-a-uuid");
    expect(bad.isErr()).toBe(true);
  });

  test("string literal não-branded → compile error (validado via @ts-expect-error)", () => {
    // @ts-expect-error — SessionId não aceita string literal sem mkSessionId / as cast.
    const _bad: SessionId = "raw-string";
    void _bad;
    // Se a directive falhar (porque NÃO houve erro), test falha em compile.
    // Em runtime, este test é vácuo — confirma apenas que @ts-expect-error foi
    // satisfeita pelo tsc.
    expect(true).toBe(true);
  });
});
