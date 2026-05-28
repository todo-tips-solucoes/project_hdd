/**
 * `SpawnPort` — abstracção de subprocess injection (D-04.3' + AR-032).
 *
 * Story 1.a.3 (AR-032, AR-038, AO-71).
 *
 * **AR-038:** adapter OWNS retry+CB; core service recebe `Result` final.
 * O tipo `SpawnError` distingue `Transient` (retry-able pelo adapter) de
 * `Permanent` (propagar até ao core / surface user). Caller escolhe a policy
 * apropriada via tipo do erro.
 *
 * Implementações reais:
 *   * `system-spawn.adapter.ts` (Story 1.b.4 — Bun.spawn sandbox)
 *   * `fake-spawn.adapter.ts` (Story 1.a.3 — para testes)
 */

import type { ResultAsync } from "../lib/result.ts";

export interface SpawnPort {
  /**
   * Spawn de subprocess. Retorna `ResultAsync<SpawnResult, SpawnError>`.
   *
   * - Sucesso: `ok({ stdout, stderr, exitCode })` quando exit code é qualquer
   *   valor (incluindo ≠0; caller decide se é erro semântico).
   * - `Transient`: timeout, recurso temporariamente indisponível — adapter
   *   pode retry.
   * - `Permanent`: binário ausente, killed por signal não-recuperável — core
   *   surface ao operador.
   */
  spawn(
    cmd: string,
    args: ReadonlyArray<string>,
    opts: SpawnOptions,
  ): ResultAsync<SpawnResult, SpawnError>;
}

export type SpawnOptions = {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  readonly stdin?: string;
};

export type SpawnResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type SpawnErrorCause =
  | { readonly kind: "Timeout" }
  | { readonly kind: "BinaryNotFound"; readonly bin: string }
  | { readonly kind: "NonZeroExit"; readonly exitCode: number; readonly stderr: string }
  | { readonly kind: "Killed"; readonly signal: string };

export type SpawnError =
  | { readonly kind: "Transient"; readonly cause: SpawnErrorCause }
  | { readonly kind: "Permanent"; readonly cause: SpawnErrorCause };
