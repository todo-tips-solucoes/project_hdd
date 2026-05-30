/**
 * `story-spec-validator.ts` — validação pura da completude de uma story spec.
 *
 * Story 2.4 (FR-050, AR-054). Camada `lib` pura/síncrona: dado um `StorySpec`
 * estruturado, decide se está bem-formed para o Der arrancar. As regras (Q-2.4-2
 * [RESOLVED — strings + regex]):
 *   1. `acceptanceCriteria` não vazio                         → 'no AC defined'
 *   2. ≥1 AC com Given … When … Then                          → 'no Given/When/Then'
 *   3. `filesCreated` não vazio                               → 'no files_created'
 *   4. `aoSubset` não vazio                                   → 'no ao_subset'
 * Primeira regra falhada curto-circuita. O parser markdown→StorySpec é de outra
 * story — aqui o `StorySpec` é input já estruturado. Sem I/O, sem `throw` (AO-66).
 */

import { err, ok, type Result } from "./result.ts";

export type StorySpec = {
  readonly storyId: string;
  readonly acceptanceCriteria: ReadonlyArray<string>;
  readonly filesCreated: ReadonlyArray<string>;
  readonly aoSubset: ReadonlyArray<string>;
};

export type StorySpecInvalidReason =
  | "no AC defined"
  | "no Given/When/Then"
  | "no files_created"
  | "no ao_subset";

export type StorySpecInvalid = {
  readonly kind: "StorySpecInvalid";
  readonly reason: StorySpecInvalidReason;
};

/** Given … When … Then numa única AC (case-insensitive, span de newlines). */
const GIVEN_WHEN_THEN = /Given[\s\S]+When[\s\S]+Then/i;

/** `true` se a AC contém a tríade Given/When/Then (BDD). */
export function hasGivenWhenThen(ac: string): boolean {
  return GIVEN_WHEN_THEN.test(ac);
}

/** Valida a completude da spec; primeiro defeito curto-circuita. */
export function validateStorySpec(spec: StorySpec): Result<StorySpec, StorySpecInvalid> {
  if (spec.acceptanceCriteria.length === 0) {
    return err({ kind: "StorySpecInvalid", reason: "no AC defined" });
  }
  if (!spec.acceptanceCriteria.some(hasGivenWhenThen)) {
    return err({ kind: "StorySpecInvalid", reason: "no Given/When/Then" });
  }
  if (spec.filesCreated.length === 0) {
    return err({ kind: "StorySpecInvalid", reason: "no files_created" });
  }
  if (spec.aoSubset.length === 0) {
    return err({ kind: "StorySpecInvalid", reason: "no ao_subset" });
  }
  return ok(spec);
}
