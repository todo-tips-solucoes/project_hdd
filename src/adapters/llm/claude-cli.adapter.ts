/**
 * `claude-cli.adapter.ts` — LLMPort impl via `claude --print` headless CLI.
 *
 * Story 1.a.10 (D-050 planning + overflow/fallback; D-052 validated em 1.c.7).
 *
 * **Scope:** Spawn `claude --print --output-format json --model <m> [--resume <sid>]`,
 * write prompt to stdin, parse JSON stdout. Caminho Max 20x (OAuth quota; R$0
 * marginal). Session reuse via `--resume` corta cache cost ~75% per D-044.
 *
 * **Output JSON shape (per `claude --print --output-format json`):**
 * ```json
 * { "type": "result", "result": "...", "session_id": "uuid-v4", "usage": {
 *     "input_tokens": N, "output_tokens": N,
 *     "cache_read_input_tokens": N?, "cache_creation_input_tokens": N?
 *   }
 * }
 * ```
 *
 * **Test strategy:** `spawn` é injectable (`ClaudeCliDeps.spawn`); tests passam
 * mock que retorna fixture sem invocar binário real. Smoke real fica para dev
 * local + 1.c.7 process.
 *
 * **AO-66:** sem throws. Erros mapped via `errAsync`. Exit code != 0 →
 * ServerError; JSON parse fail → ParseError; spawn fail → NetworkError.
 */

import { extractSessionIdFromCliJson } from "../../lib/llm-session-id.ts";
import { errAsync, okAsync, ResultAsync } from "../../lib/result.ts";
import type { LLMError, LLMPort, LLMRequest, LLMResult } from "../../ports/llm.port.ts";

export type ClaudeSpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Injectable spawn signature; default usa `Bun.spawn(["claude", ...args])`. */
export type ClaudeSpawn = (
  args: ReadonlyArray<string>,
  stdin: string,
) => Promise<ClaudeSpawnResult>;

export type ClaudeCliDeps = {
  readonly spawn?: ClaudeSpawn;
};

type CliJsonPayload = {
  readonly result?: string;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
    readonly cache_creation_input_tokens?: number;
  };
};

export function createClaudeCliAdapter(deps: ClaudeCliDeps = {}): LLMPort {
  const spawn = deps.spawn ?? defaultClaudeSpawn;

  return {
    invoke(req: LLMRequest): ResultAsync<LLMResult, LLMError> {
      const args = buildArgs(req);
      return ResultAsync.fromPromise(
        spawn(args, req.prompt),
        (cause): LLMError => ({ kind: "NetworkError", cause }),
      ).andThen((res) => parseSpawnResult(req.model, res));
    },
  };
}

function buildArgs(req: LLMRequest): ReadonlyArray<string> {
  const args = ["--print", "--output-format", "json", "--model", req.model];
  if (req.sessionId !== undefined) {
    args.push("--resume", req.sessionId);
  }
  return args;
}

function parseSpawnResult(model: string, res: ClaudeSpawnResult): ResultAsync<LLMResult, LLMError> {
  if (res.exitCode !== 0) {
    return errAsync({ kind: "ServerError", status: res.exitCode, message: res.stderr });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.stdout);
  } catch (cause) {
    return errAsync({ kind: "ParseError", cause });
  }
  const sidR = extractSessionIdFromCliJson(parsed);
  if (sidR.isErr()) return errAsync({ kind: "ParseError", cause: sidR.error });
  const payload = parsed as CliJsonPayload;
  const usage = payload.usage ?? {};
  const result: LLMResult = {
    content: payload.result ?? "",
    model,
    tokens: {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      ...(usage.cache_read_input_tokens !== undefined
        ? { cacheReadInputTokens: usage.cache_read_input_tokens }
        : {}),
      ...(usage.cache_creation_input_tokens !== undefined
        ? { cacheCreationInputTokens: usage.cache_creation_input_tokens }
        : {}),
    },
    sessionId: sidR.value,
  };
  return okAsync(result);
}

async function defaultClaudeSpawn(
  args: ReadonlyArray<string>,
  stdin: string,
): Promise<ClaudeSpawnResult> {
  const proc = Bun.spawn(["claude", ...args], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.stdin.write(stdin);
  await proc.stdin.end();
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}
