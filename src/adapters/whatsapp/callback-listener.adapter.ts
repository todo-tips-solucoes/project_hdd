/**
 * `callback-listener.adapter.ts` — `POST /callback` (Hono) inbound (Story 3.4).
 *
 * Recebe callbacks via n8n (`[[project-hdd-n8n-topology]]`, Q-3.4-1): n8n é o
 * trust boundary (trata o X-Hub-Signature da Meta); o HDD confia via Bearer
 * token. Fluxo: auth → audit `InboundCallback` (raw; o audit adapter redige
 * pre-write, 1.b.3 — Q-3.4-4) → `wa_id` allowlist (drop-at-ingress) →
 * `parseInterruptCommand`. **Sempre 200** (AC3: não vazar 401). Padrão Hono de
 * `healthz.handler` (testável via `app.request`).
 */

import { Hono } from "hono";
import { parseInterruptCommand } from "../../core/domain/interrupt-commands.ts";
import type { AuditPort } from "../../ports/audit.port.ts";
import type { ClockPort } from "../../ports/clock.port.ts";
import type { InboundCommand, InboundCommandHandler } from "../../ports/inbound-command.port.ts";
import { parseCallback } from "./callback-schema.ts";

export type CallbackDeps = {
  readonly audit: AuditPort;
  readonly clock: ClockPort;
  readonly allowedWaIds: ReadonlyArray<string>;
  /** Sob AO-86 (schema real não recebido) emite warning `[OPEN AO-86]`. */
  readonly webhookMock: boolean;
  /** Bearer token de n8n (Q-3.4-1). Se ausente, não exige auth (dev). */
  readonly n8nToken?: string;
  readonly onCommand?: InboundCommandHandler;
};

function asRecord(v: unknown): Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : { raw: String(v) };
}

export function createCallbackApp(deps: CallbackDeps): Hono {
  /** Best-effort; runId explícito evita `RunIdMissing` (o adapter redige pre-write). */
  function emit(type: string, payload: Readonly<Record<string, unknown>>, runId?: string): void {
    void deps.audit.append({
      ts: deps.clock.now().toISOString(),
      runId: runId ?? "inbound",
      type,
      payload,
    });
  }

  const app = new Hono();
  app.post("/callback", async (c) => {
    if (
      deps.n8nToken !== undefined &&
      c.req.header("Authorization") !== `Bearer ${deps.n8nToken}`
    ) {
      emit("UnauthorizedInbound", { reason: "bad-token" });
      return c.body(null, 200); // não vazar (AC3)
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.body(null, 200);
    }

    // Raw ao audit — a redaction é pre-write no adapter (AC4, Q-3.4-4).
    const rec = asRecord(body);
    emit("InboundCallback", rec, typeof rec["runId"] === "string" ? rec["runId"] : undefined);
    if (deps.webhookMock) emit("InboundSchemaPending", { note: "[OPEN AO-86]" });

    const parsed = parseCallback(body);
    if (parsed.isErr()) return c.body(null, 200); // drop-at-ingress
    const { wa_id, payload, runId, storyId } = parsed.value;

    if (!deps.allowedWaIds.includes(wa_id)) {
      emit("UnauthorizedInbound", { waId: wa_id }, runId); // adapter redige wa_id
      return c.body(null, 200); // AC3: 200, não processa
    }

    if (payload !== undefined) {
      const cmd = parseInterruptCommand(payload);
      if (cmd.isOk()) {
        const inbound: InboundCommand = {
          ...cmd.value,
          waId: wa_id,
          ...(runId !== undefined ? { runId } : {}),
          ...(storyId !== undefined ? { storyId } : {}),
        };
        deps.onCommand?.(inbound);
        return c.json({ ok: true }, 200);
      }
      emit("UnknownCommand", { received: payload }, runId); // → NLP fallback (3.5)
    }
    return c.body(null, 200);
  });

  return app;
}
