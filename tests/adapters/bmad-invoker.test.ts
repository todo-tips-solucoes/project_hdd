/**
 * Story 2.2 — specs do cli-wrapper.adapter (BmadInvokerPort).
 *
 * Fake SpawnPort (determinístico) com o formato REAL do stream-json do
 * `claude -p` (sondado: evento terminal `type:"result"` com `.result`/`is_error`).
 * Cobre AC1 (run), AC2 (runParsed + BmadOutputMalformed), AC3/AC4 (hooks),
 * e propagação de SpawnError.
 */

import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createCliWrapperAdapter } from "../../src/adapters/bmad/cli-wrapper.adapter.ts";
import { errAsync, okAsync } from "../../src/lib/result.ts";
import type { SpawnError, SpawnPort, SpawnResult } from "../../src/ports/spawn.port.ts";

type SpyCall = { cmd: string; args: string[] };

function spySpawn(
  stdout: string,
  opts: { exitCode?: number; fail?: SpawnError } = {},
): { port: SpawnPort; calls: SpyCall[] } {
  const calls: SpyCall[] = [];
  const port: SpawnPort = {
    spawn(cmd, args) {
      calls.push({ cmd, args: [...args] });
      if (opts.fail !== undefined) return errAsync(opts.fail);
      const r: SpawnResult = { stdout, stderr: "", exitCode: opts.exitCode ?? 0 };
      return okAsync(r);
    },
  };
  return { port, calls };
}

// Formato real do stream-json (system init + evento result terminal).
function streamJson(result: string, isError = false): string {
  return [
    JSON.stringify({ type: "system", subtype: "init", session_id: "s1" }),
    JSON.stringify({ type: "assistant", message: { role: "assistant" } }),
    JSON.stringify({ type: "result", subtype: "success", is_error: isError, result }),
  ].join("\n");
}

describe("AC1 — run invoca claude -p e devolve o result", () => {
  test("run('bmad-help') → ok com .result + args corretos (D-052)", async () => {
    const { port, calls } = spySpawn(streamJson("BMAD help output"));
    const invoker = createCliWrapperAdapter({ spawn: port, claudeBin: "claude" });
    const r = await invoker.run("bmad-help", { allowedTools: ["Read"] });
    expect(r.isOk()).toBe(true);
    if (r.isErr()) throw new Error(JSON.stringify(r.error));
    expect(r.value.result).toBe("BMAD help output");
    expect(r.value.exitCode).toBe(0);
    // D-052: claude -p ... --output-format stream-json --verbose --allowedTools
    const call = calls[0];
    if (call === undefined) throw new Error("spawn não invocado");
    expect(call.cmd).toBe("claude");
    expect(call.args).toContain("-p");
    expect(call.args).toContain("--output-format");
    expect(call.args).toContain("stream-json");
    expect(call.args).toContain("--verbose");
    expect(call.args).toContain("Read"); // allowedTools restrito
    expect(call.args.join(" ")).toContain("bmad-help");
  });

  test("evento result com is_error:true → BmadFailed", async () => {
    const { port } = spySpawn(streamJson("falhou", true));
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.run("bmad-x");
    if (r.isOk()) throw new Error("esperava err");
    expect(r.error.kind).toBe("BmadFailed");
  });

  test("stream-json sem evento result → BmadOutputMalformed", async () => {
    const { port } = spySpawn('{"type":"system","subtype":"init"}');
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.run("bmad-x");
    if (r.isOk()) throw new Error("esperava err");
    expect(r.error.kind).toBe("BmadOutputMalformed");
  });

  test("SpawnError Permanent (binário ausente) é propagado", async () => {
    const fail: SpawnError = {
      kind: "Permanent",
      cause: { kind: "BinaryNotFound", bin: "claude" },
    };
    const { port } = spySpawn("", { fail });
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.run("bmad-help");
    if (r.isOk()) throw new Error("esperava err");
    expect(r.error.kind).toBe("Permanent");
  });
});

describe("AC2 — runParsed valida o JSON de .result com Zod", () => {
  const schema = z.object({ verdict: z.string(), count: z.number() });

  test("JSON válido → ok<T>", async () => {
    const { port } = spySpawn(streamJson(JSON.stringify({ verdict: "approved", count: 3 })));
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.runParsed("bmad-code-review", schema);
    if (r.isErr()) throw new Error(JSON.stringify(r.error));
    expect(r.value.verdict).toBe("approved");
    expect(r.value.count).toBe(3);
  });

  test("JSON não conforme ao schema → BmadOutputMalformed", async () => {
    const { port } = spySpawn(streamJson(JSON.stringify({ verdict: "x" }))); // falta count
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.runParsed("bmad-code-review", schema);
    if (r.isOk()) throw new Error("esperava err");
    expect(r.error.kind).toBe("BmadOutputMalformed");
  });

  test(".result que não é JSON → BmadOutputMalformed", async () => {
    const { port } = spySpawn(streamJson("texto livre, não JSON"));
    const invoker = createCliWrapperAdapter({ spawn: port });
    const r = await invoker.runParsed("bmad-x", schema);
    if (r.isOk()) throw new Error("esperava err");
    expect(r.error.kind).toBe("BmadOutputMalformed");
  });
});

describe("AC3/AC4 — lifecycle hooks FR-005 (Q-2.2-3)", () => {
  test("onArtifact dispara sempre; onComplete só com terminal:true", async () => {
    const artifacts: string[] = [];
    const completes: string[] = [];
    const hooks = {
      onArtifact: (skill: string) => artifacts.push(skill),
      onComplete: (skill: string) => completes.push(skill),
    };
    const { port } = spySpawn(streamJson("ok"));
    const invoker = createCliWrapperAdapter({ spawn: port, hooks });

    await invoker.run("bmad-dev-story"); // passo intermédio (AC3)
    expect(artifacts).toEqual(["bmad-dev-story"]);
    expect(completes).toEqual([]);

    await invoker.run("bmad-dev-story", { terminal: true }); // workflow terminal (AC4)
    expect(artifacts).toEqual(["bmad-dev-story", "bmad-dev-story"]);
    expect(completes).toEqual(["bmad-dev-story"]);
  });
});
