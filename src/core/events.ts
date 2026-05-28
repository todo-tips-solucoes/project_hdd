/**
 * `events.ts` — Domain events tagged union (AR-036, D-04.19).
 *
 * Story 1.a.4. Catálogo canónico de eventos do sistema. Auditado em JSONL
 * (Story 1.a.6) e processado por handlers (Stories 4.x).
 *
 * Q-A4-3 (resolved 2026-05-28): `GateName` e `ParsedIntent` são stubs
 * conservadores nesta story. Refina-se quando NLP fallback (1.a.10) e
 * parser real (3.4 / 3.5) chegarem.
 *
 * Q-A4-4 (resolved): sem builder functions — caller constrói via object
 * literal `{ kind: 'RunStarted', runId, at: clock.now() }`.
 */

import type { RunId, StoryId } from "../lib/branded.ts";
import type { InterruptCommandKind } from "./domain/interrupt-commands.ts";

/** Stub: 3 gates principais do pipeline BMAD. Refina em 4.x quando handlers entram. */
export type GateName = "StoryToDev" | "DevToReview" | "ReviewToQA";

/** Stub MVP: intent parseada de mensagens inbound. Refina em 1.a.10 + 3.4 + 3.5. */
export type ParsedIntent =
  | { readonly kind: "Unknown"; readonly raw: string }
  | { readonly kind: "Interrupt"; readonly command: InterruptCommandKind };

export type DomainEvent =
  | { readonly kind: "RunStarted"; readonly runId: RunId; readonly at: Date }
  | {
      readonly kind: "StoryCompleted";
      readonly runId: RunId;
      readonly storyId: StoryId;
      readonly at: Date;
    }
  | {
      readonly kind: "InterruptTriggered";
      readonly runId: RunId;
      readonly trigger: "P1" | "S1" | "S2" | "S3";
      readonly at: Date;
    }
  | {
      readonly kind: "GateFailed";
      readonly runId: RunId;
      readonly gate: GateName;
      readonly reason: string;
      readonly at: Date;
    }
  | {
      readonly kind: "WhatsAppMessageSent";
      readonly runId: RunId;
      readonly templateName: string;
      readonly msgId: string;
      readonly at: Date;
    }
  | {
      readonly kind: "WhatsAppMessageReceived";
      readonly runId: RunId;
      readonly senderId: string;
      readonly intent: ParsedIntent;
      readonly at: Date;
    };

export type DomainEventKind = DomainEvent["kind"];
