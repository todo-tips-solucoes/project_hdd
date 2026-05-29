/**
 * `irreversible-action-catalog.ts` — catálogo de acções irreversíveis (AO-155).
 *
 * Story 1.b.2 (Epic 1.b Safety BLOCKERS, DRB #2). Lista fechada de acções que
 * exigem two-step confirmation antes de o worker LLM-driven as executar.
 *
 * Camada pura: sem I/O, sem deps. Fonte única da verdade consumida pelo
 * `confirmation-gate.service.ts`.
 */

export const IRREVERSIBLE_ACTIONS = [
  "deploy",
  "branch-delete",
  "force-push",
  "schema-drop",
  "audit-purge",
] as const;

export type IrreversibleAction = (typeof IRREVERSIBLE_ACTIONS)[number];

/** Type guard — `true` (e narrowing) se `s` for uma acção irreversível catalogada. */
export function isIrreversibleAction(s: string): s is IrreversibleAction {
  return (IRREVERSIBLE_ACTIONS as readonly string[]).includes(s);
}
