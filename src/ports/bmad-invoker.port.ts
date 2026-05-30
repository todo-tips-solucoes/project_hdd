/**
 * `BmadInvokerPort` — invocação programática de skills BMAD (Story 2.2).
 *
 * D-052 (ratificado): o adapter (`cli-wrapper.adapter.ts`) faz spawn de
 * `claude -p "<prompt>" --output-format stream-json --verbose --allowedTools <subset>`,
 * NÃO `npx bmad-method` (sem skill runner — provado pelo smoke 1.c.7). Ver
 * `[[project-hdd-d052-claude-headless-invoker]]`.
 *
 * Lifecycle hooks FR-005 (Q-2.2-3): `bmad_save_artifact`/`bmad_complete_workflow`
 * NÃO existem como ferramenta BMAD — são pontos de extensão (`BmadLifecycleHooks`)
 * materializados pelo caller (impl de referência = audit event). O wiring de
 * state-transition (FSM) é da Story 2.6; o RunContext isolado é da Story 2.3.
 */

import type { ZodType } from "zod";
import type { ResultAsync } from "../lib/result.ts";
import type { SpawnError } from "./spawn.port.ts";

export type BmadResult = {
  /** stdout bruto do `claude -p` (stream-json JSONL). */
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  /** `.result` extraído do evento terminal `type:"result"`. */
  readonly result: string;
};

export type BmadError =
  | SpawnError // Transient | Permanent (propagado do SpawnPort, AR-038)
  | { readonly kind: "BmadOutputMalformed"; readonly detail: string }
  | { readonly kind: "BmadFailed"; readonly result: string }; // evento result com is_error:true

export type BmadInvokeOptions = {
  /** allowedTools restrito por skill (least-privilege, Q-2.2-1). */
  readonly allowedTools?: ReadonlyArray<string>;
  readonly timeoutMs?: number;
  readonly cwd?: string;
  /** true → invocação é o fim de um workflow (dispara onComplete, AC4). */
  readonly terminal?: boolean;
};

/** Pontos de extensão FR-005 (Q-2.2-3). Impl de referência emite audit event. */
export type BmadLifecycleHooks = {
  readonly onArtifact?: (skill: string, r: BmadResult) => void;
  readonly onComplete?: (skill: string, r: BmadResult) => void;
};

export interface BmadInvokerPort {
  /** Invoca a skill e devolve o output (AC1). */
  run(skill: string, opts?: BmadInvokeOptions): ResultAsync<BmadResult, BmadError>;
  /** Invoca + valida o JSON de `.result` com Zod (AC2). */
  runParsed<T>(
    skill: string,
    schema: ZodType<T>,
    opts?: BmadInvokeOptions,
  ): ResultAsync<T, BmadError>;
}
