/**
 * `inbound-command.port.ts` — comando inbound tipado (Story 3.4, FR-024, AR-101).
 *
 * O listener `/callback` (via n8n — `[[project-hdd-n8n-topology]]`) produz um
 * `InboundCommand`: o `InterruptCommand` parseado (`interrupt-commands.ts`, 1.a.4)
 * enriquecido com correlation (`waId`, `runId?`, `storyId?`). O worker (Epic 4)
 * consome via `InboundCommandHandler`. NÃO redefine os comandos — reusa 1.a.4.
 */

import type { InterruptCommand } from "../core/domain/interrupt-commands.ts";

export type InboundCommand = InterruptCommand & {
  readonly waId: string;
  readonly runId?: string;
  readonly storyId?: string;
};

export type InboundCommandError =
  | { readonly kind: "UnauthorizedInbound"; readonly waId: string }
  | { readonly kind: "MalformedPayload"; readonly detail: string }
  | { readonly kind: "UnknownCommand"; readonly received: string };

/** Callback que o worker fornece ao listener para reagir a um comando válido. */
export type InboundCommandHandler = (cmd: InboundCommand) => void;
