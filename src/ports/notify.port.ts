/**
 * `NotifyPort` — abstracção de outbound effects (WhatsApp, e-mail, heartbeat).
 *
 * Story 1.a.3 (AR-032, AO-71). Contrato mínimo; implementações reais entram em:
 *   * `whatsapp.adapter.ts` via clihelper (Story 3.1) — Interrupt + Summary.
 *   * `resend.adapter.ts` (Story 3.6) — fallback Summary via e-mail.
 *   * `healthchecks.adapter.ts` (Story 1.c.1) — Heartbeat.
 *
 * `NotifyEvent` é tagged union fechada (per Q-A3-3 resolved 2026-05-28); novos
 * kinds podem ser adicionados sem breaking change (tagged union acepta extensão).
 */

import type { RunId, StoryId } from "../lib/branded.ts";
import type { ResultAsync } from "../lib/result.ts";

export interface NotifyPort {
  notify(event: NotifyEvent): ResultAsync<void, NotifyError>;
}

export type NotifyEvent =
  | {
      readonly kind: "Interrupt";
      readonly trigger: "P1" | "S1" | "S2" | "S3";
      readonly runId: RunId;
      readonly storyId?: StoryId;
      readonly message: string;
    }
  | {
      readonly kind: "Heartbeat";
      readonly runId: RunId;
      readonly at: Date;
    }
  | {
      readonly kind: "Summary";
      readonly runId: RunId;
      readonly tier: "A" | "B";
      readonly bodyMarkdown: string;
    };

export type NotifyError =
  | { readonly kind: "Transient"; readonly cause: string }
  | { readonly kind: "Permanent"; readonly cause: string };
