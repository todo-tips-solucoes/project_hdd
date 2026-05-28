/**
 * `idempotency.service.ts` — commit-state-before-side-effect (AO-3, AO-89).
 *
 * Story 1.a.5. Service shell-layer (não core): pode importar `src/db/`
 * e tipos drizzle. Caller injecta `db` (raw bun:sqlite Database) para
 * transactions atómicas.
 *
 * **Formula (AO-89, Q-A5-2 generic):**
 *   `SHA-256(runId + "|" + storyId + "|" + operation + "|" + seqLocal)`
 *
 * WhatsApp adapter passa `template_name` como valor de `operation`
 * (AO-39 case especial).
 */

import type { Database } from "bun:sqlite";
import type { Sha256Hash } from "../lib/branded.ts";
import { err, ok, type Result } from "../lib/result.ts";

export type GenerateParams = {
  readonly runId: string;
  readonly storyId: string;
  readonly operation: string;
  readonly seqLocal: number;
};

export type CommitParams = {
  readonly key: Sha256Hash;
  readonly storyId: string;
  readonly sideEffect: string;
  readonly resultRef?: string | null;
};

export type CommitResult = {
  readonly alreadyCommitted: boolean;
  readonly resultRef: string | null;
};

export type IdempotencyError = {
  readonly kind: "DbWriteFailure";
  readonly cause: unknown;
};

export type IdempotencyService = {
  generate(params: GenerateParams): Sha256Hash;
  commitBeforeSideEffect(params: CommitParams): Result<CommitResult, IdempotencyError>;
};

export function createIdempotencyService(deps: { db: Database }): IdempotencyService {
  return {
    generate({ runId, storyId, operation, seqLocal }) {
      const input = `${runId}|${storyId}|${operation}|${seqLocal}`;
      const hasher = new Bun.CryptoHasher("sha256");
      hasher.update(input);
      // SHA-256 hex sempre 64 chars lowercase; satisfaz Sha256Hash brand
      // (validação runtime via mkSha256Hash possível mas redundante aqui —
      // input controlado).
      return hasher.digest("hex") as Sha256Hash;
    },
    commitBeforeSideEffect({ key, storyId, sideEffect, resultRef }) {
      try {
        const existing = deps.db
          .query<{ result_ref: string | null }, [string]>(
            "SELECT result_ref FROM idempotency_keys WHERE key = ?",
          )
          .get(key);

        if (existing !== null) {
          return ok({ alreadyCommitted: true, resultRef: existing.result_ref });
        }

        deps.db
          .query(
            "INSERT INTO idempotency_keys (key, story_id, side_effect, executed_at, result_ref) VALUES (?, ?, ?, datetime('now'), ?)",
          )
          .run(key, storyId, sideEffect, resultRef ?? null);

        return ok({ alreadyCommitted: false, resultRef: resultRef ?? null });
      } catch (cause) {
        return err({ kind: "DbWriteFailure", cause });
      }
    },
  };
}
