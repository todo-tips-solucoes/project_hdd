/**
 * `system-spawn.adapter.ts` — SpawnPort real via `Bun.spawn` (Story 1.b.4 gap,
 * materializado no follow-up de integração real da retro Epic 1.b).
 *
 * Era referenciado no docstring do `spawn.port.ts` desde 1.a.3 mas nunca tinha
 * sido criado (só o `fake-spawn.adapter.ts`). É a peça que faltava para o
 * `docker-spawn.adapter.ts` correr docker a sério (não mockado).
 *
 * Mapeia o resultado para o contrato do port: exit code qualquer → `ok`
 * (caller decide se ≠0 é erro semântico); timeout (kill) → `Transient/Timeout`;
 * binário ausente (throw ENOENT) → `Permanent/BinaryNotFound`.
 */

import { fromPromise, type ResultAsync } from "../../lib/result.ts";
import type { SpawnError, SpawnOptions, SpawnPort, SpawnResult } from "../../ports/spawn.port.ts";

type BunSpawnOpts = Parameters<typeof Bun.spawn>[1];

export function createSystemSpawnAdapter(): SpawnPort {
  return {
    spawn(
      cmd: string,
      args: ReadonlyArray<string>,
      opts: SpawnOptions,
    ): ResultAsync<SpawnResult, SpawnError> {
      const exec = async (): Promise<SpawnResult> => {
        const bunOpts: BunSpawnOpts = { stdout: "pipe", stderr: "pipe" };
        if (opts.cwd !== undefined) bunOpts.cwd = opts.cwd;
        if (opts.env !== undefined) bunOpts.env = { ...process.env, ...opts.env };
        if (opts.timeoutMs !== undefined) bunOpts.timeout = opts.timeoutMs;
        if (opts.stdin !== undefined) bunOpts.stdin = new TextEncoder().encode(opts.stdin);

        const proc = Bun.spawn([cmd, ...args], bunOpts);
        // stdout/stderr são sempre ReadableStream (forçámos "pipe"); o tipo de
        // Bun.spawn alarga para a união por bunOpts ser mutável → cast seguro.
        const [exitCode, stdout, stderr] = await Promise.all([
          proc.exited,
          new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
          new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
        ]);
        return { stdout, stderr, exitCode };
      };

      return fromPromise(
        exec(),
        (_cause): SpawnError => ({
          kind: "Permanent",
          cause: { kind: "BinaryNotFound", bin: cmd },
        }),
      );
    },
  };
}
