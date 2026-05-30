/**
 * `cli-wrapper.adapter.ts` — `BmadInvokerPort` via `claude -p` headless (Story 2.2, D-052).
 *
 * Spawn de `claude -p "<prompt>" --output-format stream-json --verbose
 * --allowedTools <subset>` através do `SpawnPort` (injectável → fake nos testes,
 * system-spawn em produção; o SpawnPort OWNS retry/CB — AR-038). Parseia o
 * stream-json (JSONL), extrai o evento terminal `type:"result"` e (runParsed)
 * valida `.result` com Zod. Hooks FR-005 (Q-2.2-3): onArtifact por invocação,
 * onComplete quando `opts.terminal` (state-transition real fica p/ Story 2.6).
 */

import type { ZodType } from "zod";
import { err, ok, type Result } from "../../lib/result.ts";
import type {
  BmadError,
  BmadInvokeOptions,
  BmadInvokerPort,
  BmadLifecycleHooks,
  BmadResult,
} from "../../ports/bmad-invoker.port.ts";
import type { SpawnOptions, SpawnPort } from "../../ports/spawn.port.ts";

const CLAUDE_BIN = "claude";
const DEFAULT_TIMEOUT_MS = 30_000;

export type CliWrapperDeps = {
  readonly spawn: SpawnPort;
  readonly hooks?: BmadLifecycleHooks;
  readonly claudeBin?: string;
};

function buildPrompt(skill: string): string {
  return `Executa a skill BMAD '${skill}' de forma não-interactiva. Devolve apenas o output da skill.`;
}

function buildArgs(skill: string, opts?: BmadInvokeOptions): string[] {
  const allowed = (opts?.allowedTools ?? []).join(",");
  return [
    "-p",
    buildPrompt(skill),
    "--output-format",
    "stream-json",
    "--verbose",
    "--allowedTools",
    allowed,
  ];
}

/** Extrai o evento terminal `type:"result"` do stream-json (varre de trás p/ frente). */
function extractResult(stdout: string): Result<{ result: string; isError: boolean }, BmadError> {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line === undefined || line.trim() === "") continue;
    let ev: { type?: string; result?: unknown; is_error?: boolean };
    try {
      ev = JSON.parse(line) as { type?: string; result?: unknown; is_error?: boolean };
    } catch {
      continue; // linha não-JSON (ruído) — ignora
    }
    if (ev.type === "result") {
      if (typeof ev.result !== "string") {
        return err({
          kind: "BmadOutputMalformed",
          detail: "evento result sem campo 'result' string",
        });
      }
      return ok({ result: ev.result, isError: ev.is_error === true });
    }
  }
  return err({ kind: "BmadOutputMalformed", detail: "sem evento type:'result' no stream-json" });
}

export function createCliWrapperAdapter(deps: CliWrapperDeps): BmadInvokerPort {
  const bin = deps.claudeBin ?? CLAUDE_BIN;

  const run = (skill: string, opts?: BmadInvokeOptions) => {
    const spawnOpts: SpawnOptions = {
      timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      ...(opts?.cwd !== undefined ? { cwd: opts.cwd } : {}),
    };
    return deps.spawn
      .spawn(bin, buildArgs(skill, opts), spawnOpts)
      .andThen((sr): Result<BmadResult, BmadError> => {
        const ext = extractResult(sr.stdout);
        if (ext.isErr()) return err(ext.error);
        if (ext.value.isError) return err({ kind: "BmadFailed", result: ext.value.result });
        const result: BmadResult = {
          stdout: sr.stdout,
          stderr: sr.stderr,
          exitCode: sr.exitCode,
          result: ext.value.result,
        };
        deps.hooks?.onArtifact?.(skill, result); // FR-005 save_artifact (AC3)
        if (opts?.terminal === true) deps.hooks?.onComplete?.(skill, result); // FR-005 complete_workflow (AC4)
        return ok(result);
      });
  };

  return {
    run,
    runParsed<T>(skill: string, schema: ZodType<T>, opts?: BmadInvokeOptions) {
      return run(skill, opts).andThen((r): Result<T, BmadError> => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.result);
        } catch {
          return err({ kind: "BmadOutputMalformed", detail: "'.result' não é JSON válido" });
        }
        const v = schema.safeParse(parsed);
        if (!v.success) return err({ kind: "BmadOutputMalformed", detail: v.error.message });
        return ok(v.data);
      });
    },
  };
}
