/**
 * `callback-schema.ts` — Zod minimal schema drop-at-ingress do `/callback`.
 *
 * Story 3.4 (Q-3.4-2). O schema inbound REAL ainda não foi recebido (AO-86 /
 * O-B5-3) → sob `webhookMock` toleramos o resto (`.passthrough()` = z.unknown());
 * mas extraímos sempre o **mínimo** que o HDD precisa: `wa_id` (allowlist),
 * `payload` (quick-reply string), `runId`/`storyId` (correlation). `wa_id` em
 * falta → `MalformedPayload` (drop). Camada pura, sem I/O, sem `throw` (AO-66).
 */

import { z } from "zod";
import { err, ok, type Result } from "../../lib/result.ts";

export const minimalInboundSchema = z
  .object({
    wa_id: z.string().min(1),
    payload: z.string().optional(),
    runId: z.string().optional(),
    storyId: z.string().optional(),
  })
  .passthrough(); // resto = z.unknown() (drop-at-ingress sob mock — AO-86)

export type MinimalInbound = z.infer<typeof minimalInboundSchema>;

export type CallbackParseError = { readonly kind: "MalformedPayload"; readonly detail: string };

/** Valida o body; extrai o mínimo. `wa_id` ausente/vazio → `MalformedPayload`. */
export function parseCallback(body: unknown): Result<MinimalInbound, CallbackParseError> {
  const r = minimalInboundSchema.safeParse(body);
  if (!r.success) return err({ kind: "MalformedPayload", detail: r.error.message });
  return ok(r.data);
}
