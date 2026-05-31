/**
 * `OutboundNotifyPort` — porta única de saída de mensagens (transporte).
 *
 * Story 3.1 (FR-020..023, AR-100). Camada de **transporte**: `sendTemplate`
 * envia um template clihelper (POST). Distinto do `NotifyPort` (1.a.3), que é a
 * camada de **domínio** (`notify(Interrupt|Summary|Heartbeat)`) — Q-3.1-1=(a): o
 * mapper NotifyEvent→template é story posterior. Adapter swappable (Telegram,
 * Signal v1.1+); a impl. da 3.1 é `clihelper.adapter.ts`.
 *
 * O leaky-bucket 1 req/s + retry + circuit breaker são da Story 3.2 (envolvem
 * este port). A idempotency key (AO-39) pareia com o retry → também 3.2.
 */

import type { ResultAsync } from "../lib/result.ts";

export type SendTemplateInput = {
  /** Nome do template UTILITY (e.g. `hdd_interrupt_p1`). Validação dos 6 = Story 3.3. */
  readonly template: string;
  /** Variáveis named (Q-3.1-2). Vazio/ausente → endpoint `-sem-variavel` (Q-3.1-3). */
  readonly vars?: Readonly<Record<string, string>>;
  readonly queueId: string;
};

export type OutboundNotifyError =
  | { readonly kind: "Transient"; readonly cause: string }
  | { readonly kind: "Permanent"; readonly cause: string }
  | { readonly kind: "RateLimited"; readonly retryAfterMs: number }
  | { readonly kind: "PayloadInvalid"; readonly detail: string };

export type SendResult = {
  readonly endpoint: string;
  readonly dryRun: boolean;
  readonly status?: number;
};

export interface OutboundNotifyPort {
  sendTemplate(input: SendTemplateInput): ResultAsync<SendResult, OutboundNotifyError>;
}
