/**
 * `SandboxPort` — execução isolada de código LLM-generated (AR-015, AO-47).
 *
 * Story 1.b.4 (Epic 1.b Safety). Abstrai a execução sandboxed sobre o
 * `SpawnPort` (1.a.3). Implementação real: `docker-spawn.adapter.ts`
 * (`docker run --rm --network=none` + hardening). Tests usam um spawn spy.
 *
 * **Threat-model:** código gerado por LLM não pode (a) exfiltrar pela rede
 * (`--network=none`), (b) escalar privilégios (non-root + cap-drop +
 * no-new-privileges), (c) tocar o host fora do mount declarado read-only.
 */

import type { ResultAsync } from "../lib/result.ts";
import type { SpawnError } from "./spawn.port.ts";

export type SandboxRunRequest = {
  /** Comando/script passado ao entrypoint do container (`sh -c <script>`). */
  readonly script: string;
  /** Host dir a montar em `/work` (validado contra traversal antes do bind). */
  readonly mountDir?: string;
  /** `false` (default) → mount read-only; `true` → read-write (opt-in). */
  readonly mountWritable?: boolean;
  readonly timeoutMs?: number;
};

export type SandboxResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type SandboxImageMissing = { readonly kind: "SandboxImageMissing"; readonly image: string };

/** mountDir com `:`/`,`/espaços/`..` — anti arg-injection no `--mount` (AO-174). */
export type UnsafeMount = { readonly kind: "UnsafeMount"; readonly mountDir: string };

export type SandboxError = SpawnError | SandboxImageMissing | UnsafeMount;

export interface SandboxPort {
  runInSandbox(req: SandboxRunRequest): ResultAsync<SandboxResult, SandboxError>;
}
