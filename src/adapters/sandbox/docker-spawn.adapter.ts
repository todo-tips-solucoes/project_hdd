/**
 * `docker-spawn.adapter.ts` — SandboxPort via `docker run` endurecido (1.b.4).
 *
 * Constrói um comando docker **inescapável por construção** e invoca-o pelo
 * `SpawnPort` (1.a.3). Hardening (AR-015, AO-47, Pentest PT-1):
 *   --network=none            exfiltração de rede impossível (AC1)
 *   --user 65534:65534        non-root (nobody)
 *   --cap-drop=ALL            sem capabilities
 *   --security-opt no-new-privileges
 *   --read-only               root fs imutável
 *   --pids-limit 128          anti fork-bomb
 *   --memory 512m             anti memory-exhaustion
 *   --rm                      sem state residual
 *
 * Mount declarado: `--mount type=bind,src=<dir>,dst=/work,ro` (rw só opt-in).
 * `mountDir` é validado contra arg-injection (`:`/`,`/espaços/`..`) — AO-174.
 *
 * **Boot check (AC2):** `checkSandboxImageSync` usa `Bun.spawnSync docker image
 * inspect` (síncrono, timeout curto) — mantém `bootstrap()` sync e fail-closed.
 *
 * Mock-only nos testes (spawn spy); docker real fica para 1.b.5/integração.
 */

import { err, errAsync, ok, type Result, type ResultAsync } from "../../lib/result.ts";
import type {
  SandboxError,
  SandboxImageMissing,
  SandboxPort,
  SandboxResult,
  SandboxRunRequest,
} from "../../ports/sandbox.port.ts";
import type { SpawnPort } from "../../ports/spawn.port.ts";

export const SANDBOX_IMAGE = "hdd-sandbox:0.0.1";
const SANDBOX_USER = "65534:65534"; // nobody:nogroup
const DEFAULT_TIMEOUT_MS = 30_000;
const IMAGE_CHECK_TIMEOUT_MS = 400;

/** `true` se `mountDir` é seguro para o `--mount` (sem injection nem traversal). */
export function isSafeMountDir(mountDir: string): boolean {
  if (mountDir.includes(":") || mountDir.includes(",") || /\s/.test(mountDir)) return false;
  if (mountDir.includes("..")) return false;
  return mountDir.startsWith("/"); // bind exige path absoluto
}

/** Constrói os args do `docker run` endurecido. `mountDir` assumido já validado. */
export function buildDockerArgs(req: SandboxRunRequest, image: string): string[] {
  const args: string[] = [
    "run",
    "--rm",
    "--network=none",
    "--user",
    SANDBOX_USER,
    "--cap-drop=ALL",
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--pids-limit",
    "128",
    "--memory",
    "512m",
  ];
  if (req.mountDir !== undefined) {
    const mode = req.mountWritable === true ? "rw" : "ro";
    args.push("--mount", `type=bind,src=${req.mountDir},dst=/work,${mode}`);
  }
  args.push(image, "sh", "-c", req.script);
  return args;
}

/** Verificação síncrona fail-closed da image pre-pulled (AC2, <500ms). */
export function checkSandboxImageSync(image: string): Result<true, SandboxImageMissing> {
  try {
    const proc = Bun.spawnSync(["docker", "image", "inspect", image], {
      timeout: IMAGE_CHECK_TIMEOUT_MS,
      stdout: "ignore",
      stderr: "ignore",
    });
    if (proc.exitCode === 0) return ok(true);
  } catch {
    // docker ausente / timeout → fail-closed abaixo
  }
  return err({ kind: "SandboxImageMissing", image });
}

export function createDockerSandboxAdapter(deps: { spawn: SpawnPort; image: string }): SandboxPort {
  return {
    runInSandbox(req: SandboxRunRequest): ResultAsync<SandboxResult, SandboxError> {
      if (req.mountDir !== undefined && !isSafeMountDir(req.mountDir)) {
        return errAsync({ kind: "UnsafeMount", mountDir: req.mountDir });
      }
      const args = buildDockerArgs(req, deps.image);
      return deps.spawn.spawn("docker", args, { timeoutMs: req.timeoutMs ?? DEFAULT_TIMEOUT_MS });
    },
  };
}
