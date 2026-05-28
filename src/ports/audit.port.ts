/**
 * `AuditPort` — interface tamper-evident audit trail (AR-060, AO-14, AO-87).
 *
 * Story 1.a.6. Adapter real: `src/adapters/audit/jsonl-hash-chain.adapter.ts`.
 *
 * **Atomicidade por linha:** `O_APPEND` syscall garante que appends
 * concorrentes não cortam linhas (até PIPE_BUF ≈ 4KB; payloads HDD
 * tipicamente são <1KB).
 *
 * **Chain integrity:** `this_hash = SHA-256(prev_hash || ts || seq || type
 * || canonical(payload))` per architecture linha 328. Primeira linha do
 * ficheiro tem `prev_hash = "genesis"`.
 *
 * **Redaction:** AR-063 / AO-160-166 são responsabilidade do CALLER em v1.
 * Story 1.b.3 adicionará middleware de redaction automática.
 *
 * **Correlation IDs (Story 1.a.9):** `runId` e `storyId` são opcionais. Quando
 * não passados em `AuditEntry`, o adapter lê de `getRunContext()`
 * (AsyncLocalStorage via `src/lib/run-context.ts`). Se NEM explicit NEM
 * contexto fornecidos, `append()` devolve `err({kind: "RunIdMissing"})`.
 * Explicit em AuditEntry sempre tem precedência sobre context.
 */

import type { Sha256Hash } from "../lib/branded.ts";
import type { Result } from "../lib/result.ts";

export type AuditEntry = {
  readonly ts: string; // ISO 8601 UTC
  /** Opcional desde 1.a.9; quando ausente o adapter lê de `getRunContext()`. */
  readonly runId?: string;
  readonly storyId?: string;
  readonly type: string; // e.g. 'INTERRUPT_TRIGGERED', 'STORY_STARTED'
  readonly payload: Readonly<Record<string, unknown>>;
};

export type AuditAppendResult = {
  readonly seq: number;
  readonly thisHash: Sha256Hash;
  readonly path: string;
};

export type AuditError =
  | { readonly kind: "WriteFailure"; readonly cause: unknown }
  | {
      readonly kind: "ChainBreak";
      readonly atLine: number;
      readonly expected: string;
      readonly actual: string;
    }
  | { readonly kind: "FileNotFound"; readonly path: string }
  | { readonly kind: "ParseFailure"; readonly atLine: number; readonly cause: unknown }
  | { readonly kind: "RunIdMissing" };

export interface AuditPort {
  append(event: AuditEntry): Result<AuditAppendResult, AuditError>;
  verifyChain(date: string): Result<{ verified: number }, AuditError>;
}
