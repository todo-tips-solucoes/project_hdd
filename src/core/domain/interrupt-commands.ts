/**
 * `interrupt-commands.ts` — tagged union dos Quick Reply payloads do operador.
 *
 * Story 1.a.4 (AC-4, AC-5). Contracto partilhado entre webhook parser (E3,
 * Story 3.4) e regra de interrupt (E4, Stories 4.x) sem coupling circular.
 *
 * Política Q-A4-2 (resolved 2026-05-28): match exacto literal. Whitespace
 * ou casing errado → `UnknownCommand`. Parser inbound (3.4) garante cleanup
 * upstream antes de invocar `parseInterruptCommand`.
 */

import { err, ok, type Result } from "../../lib/result.ts";

export type InterruptCommand =
  | { readonly kind: "P1Continuar" }
  | { readonly kind: "P1Pausar" }
  | { readonly kind: "FinAprovar" }
  | { readonly kind: "FinPedirMudancas" }
  | { readonly kind: "FinRejeitar" };

export type InterruptCommandKind = InterruptCommand["kind"];

export type InterruptCommandError = {
  readonly kind: "UnknownCommand";
  readonly received: string;
};

/** Mapping canónico payload Meta → kind interno. Exacto, case-sensitive. */
export const PAYLOAD_MAP: Readonly<Record<string, InterruptCommandKind>> = {
  p1_continuar_assim: "P1Continuar",
  p1_pausar_agora: "P1Pausar",
  fin_aprovar: "FinAprovar",
  fin_pedir_mudancas: "FinPedirMudancas",
  fin_rejeitar: "FinRejeitar",
};

/** Pure parser. Acepta exact string match contra PAYLOAD_MAP. */
export function parseInterruptCommand(
  raw: string,
): Result<InterruptCommand, InterruptCommandError> {
  const kind = PAYLOAD_MAP[raw];
  if (kind === undefined) {
    return err({ kind: "UnknownCommand", received: raw });
  }
  return ok({ kind });
}
