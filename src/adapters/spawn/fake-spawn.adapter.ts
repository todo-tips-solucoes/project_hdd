/**
 * `FakeSpawnAdapter` — fake SpawnPort para testes de contracto.
 *
 * Story 1.a.3 (Q-A3-1 resolved: adicionar para AC-3 timeout test). Real
 * adapter `Bun.spawn` chega em Story 1.b.4 (sandbox); este fake permite
 * validar o contrato do port (e.g. timeout → Transient) sem implementação
 * real. Real adapter de 1.b.4 deve passar nos mesmos testes.
 *
 * Cenários suportados (`defaultBehavior`):
 *   * `'success'` → retorna `ok({ stdout, stderr, exitCode: 0 })`
 *   * `'timeout'` → retorna `err({ kind: 'Transient', cause: { kind: 'Timeout' } })`
 *   * `'binary-not-found'` → `err({ kind: 'Permanent', cause: { kind: 'BinaryNotFound', bin } })`
 *   * `'non-zero-exit'` → `err({ kind: 'Permanent', cause: { kind: 'NonZeroExit', exitCode, stderr } })`
 */

import { errAsync, okAsync, type ResultAsync } from "../../lib/result.ts";
import type { SpawnError, SpawnOptions, SpawnPort, SpawnResult } from "../../ports/spawn.port.ts";

export type FakeSpawnBehavior = "success" | "timeout" | "binary-not-found" | "non-zero-exit";

export type FakeSpawnConfig = {
  readonly defaultBehavior: FakeSpawnBehavior;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
};

export const createFakeSpawnAdapter = (cfg: FakeSpawnConfig): SpawnPort => ({
  spawn(
    cmd: string,
    _args: ReadonlyArray<string>,
    _opts: SpawnOptions,
  ): ResultAsync<SpawnResult, SpawnError> {
    switch (cfg.defaultBehavior) {
      case "success":
        return okAsync({
          stdout: cfg.stdout ?? "",
          stderr: cfg.stderr ?? "",
          exitCode: cfg.exitCode ?? 0,
        });
      case "timeout":
        return errAsync({ kind: "Transient", cause: { kind: "Timeout" } });
      case "binary-not-found":
        return errAsync({
          kind: "Permanent",
          cause: { kind: "BinaryNotFound", bin: cmd },
        });
      case "non-zero-exit":
        return errAsync({
          kind: "Permanent",
          cause: {
            kind: "NonZeroExit",
            exitCode: cfg.exitCode ?? 1,
            stderr: cfg.stderr ?? "",
          },
        });
    }
  },
});
