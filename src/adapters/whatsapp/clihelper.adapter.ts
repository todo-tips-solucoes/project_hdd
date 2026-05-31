/**
 * `clihelper.adapter.ts` — `OutboundNotifyPort` via app proprietário clihelper.
 *
 * Story 3.1 (D-033, FR-020..023). Adapter HTTP **nu**: valida o body (Zod) →
 * (dry-run? loga : POST com `Authorization`) → mapeia status/erro para
 * `OutboundNotifyError`. Endpoint derivado de `vars` (Q-3.1-3). `HttpPort`
 * injectável (fake nos testes, `Bun.fetch` em produção — Q-3.1-4).
 *
 * NÃO faz leaky-bucket / retry / circuit breaker (Story 3.2 envolve este adapter)
 * nem computa idempotency key (pareia com retry → 3.2). Só outbound (inbound = n8n).
 */

import { createHash } from "node:crypto";
import { createCircuitBreaker } from "../../lib/circuit-breaker.ts";
import { createLeakyBucket } from "../../lib/leaky-bucket.ts";
import { errAsync, okAsync, type Result, ResultAsync } from "../../lib/result.ts";
import { type BackoffOptions, computeBackoffMs, withRetry } from "../../lib/retry-policy.ts";
import { getRunContext } from "../../lib/run-context.ts";
import type { ClockPort } from "../../ports/clock.port.ts";
import type {
  OutboundNotifyError,
  OutboundNotifyPort,
  SendResult,
  SendTemplateInput,
} from "../../ports/outbound-notify.port.ts";
import { type ClihelperBody, clihelperBodySchema } from "./payload-schema.ts";

const PATH_BASE = "/principal/apis/mensagem/api-oficial-mensagem-template";

export type ClihelperConfig = {
  readonly baseUrl: string;
  readonly token: string;
  readonly dryRun: boolean;
  /** Destino (telefone do operador) + metadata do ticket clihelper. */
  readonly number: string;
  readonly name: string;
  readonly openTicket: boolean;
};

export type HttpRequest = {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

export type HttpResponse = {
  readonly status: number;
  readonly body: string;
  readonly headers?: Readonly<Record<string, string>>;
};

export type HttpError = { readonly kind: "Transient" | "Permanent"; readonly cause: string };

export interface HttpPort {
  post(req: HttpRequest): ResultAsync<HttpResponse, HttpError>;
}

export type ClihelperDeps = {
  readonly http: HttpPort;
  readonly log?: (line: string) => void;
};

/** `…-template` (com variáveis) vs `…-template-sem-variavel` (sem) — Q-3.1-3. */
function selectEndpoint(baseUrl: string, hasVars: boolean): string {
  const root = baseUrl.replace(/\/+$/, "");
  return `${root}${PATH_BASE}${hasVars ? "" : "-sem-variavel"}/`;
}

function buildBody(config: ClihelperConfig, input: SendTemplateInput): ClihelperBody {
  const entries = Object.entries(input.vars ?? {});
  return {
    number: config.number,
    name: config.name,
    language: "pt_BR",
    openTicket: config.openTicket,
    queueId: input.queueId,
    template: [
      { name: input.template, parameters: entries.map(([key, value]) => ({ key, value })) },
    ],
  };
}

/** Status HTTP → `OutboundNotifyError` (429→RateLimited, 5xx→Transient, 4xx→Permanent). */
function mapStatus(
  res: HttpResponse,
  endpoint: string,
): ResultAsync<SendResult, OutboundNotifyError> {
  if (res.status >= 200 && res.status < 300) {
    return okAsync({ endpoint, dryRun: false, status: res.status });
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers?.["retry-after"] ?? res.headers?.["Retry-After"] ?? 0);
    return errAsync({ kind: "RateLimited", retryAfterMs: retryAfter * 1000 });
  }
  if (res.status >= 500) return errAsync({ kind: "Transient", cause: `HTTP ${res.status}` });
  return errAsync({ kind: "Permanent", cause: `HTTP ${res.status}` });
}

/** Idempotency key AO-39: `SHA-256(runId||storyId||template||seq)` (Q-3.2-1). */
function idempotencyKey(template: string, seq: number): string {
  const ctx = getRunContext();
  const material = `${ctx?.runId ?? ""}||${ctx?.storyId ?? ""}||${template}||${seq}`;
  return createHash("sha256").update(material).digest("hex");
}

export function createClihelperAdapter(
  config: ClihelperConfig,
  deps: ClihelperDeps,
): OutboundNotifyPort {
  const log = deps.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  let seq = 0;

  function sendTemplate(input: SendTemplateInput): ResultAsync<SendResult, OutboundNotifyError> {
    const hasVars = input.vars !== undefined && Object.keys(input.vars).length > 0;
    const endpoint = selectEndpoint(config.baseUrl, hasVars);

    const parsed = clihelperBodySchema.safeParse(buildBody(config, input));
    if (!parsed.success) {
      return errAsync({ kind: "PayloadInvalid", detail: parsed.error.message });
    }

    if (config.dryRun) {
      // Redaction por omissão: não loga values de `vars` nem o token (AC2).
      log(
        `[NOTIFY_DRY_RUN] POST ${endpoint} template=${input.template} queueId=${input.queueId} vars=${Object.keys(input.vars ?? {}).length}`,
      );
      return okAsync({ endpoint, dryRun: true });
    }

    seq += 1;
    return deps.http
      .post({
        url: endpoint,
        method: "POST",
        headers: {
          Authorization: config.token,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey(input.template, seq),
        },
        body: JSON.stringify(parsed.data),
      })
      .mapErr((e): OutboundNotifyError => ({ kind: e.kind, cause: e.cause }))
      .andThen((res) => mapStatus(res, endpoint));
  }

  return { sendTemplate };
}

export type ResilienceConfig = {
  readonly clock: ClockPort;
  readonly ratePerSec?: number;
  readonly maxAttempts?: number;
  readonly backoff?: BackoffOptions;
};

/**
 * Envolve um `OutboundNotifyPort` com circuit breaker + leaky bucket + retry
 * (Story 3.2, Q-3.2-3). Ordem: `CB.canPass` (open → CircuitOpen, sem enqueue) →
 * `bucket.enqueue` (1 req/s) → `withRetry` (429→Retry-After, 5xx→expo). Conta
 * falha do CB só em send esgotado Transient/Permanent (429 NÃO conta); ok reseta.
 */
export function withResilience(
  inner: OutboundNotifyPort,
  cfg: ResilienceConfig,
): OutboundNotifyPort {
  const bucket = createLeakyBucket({ clock: cfg.clock, ratePerSec: cfg.ratePerSec ?? 1 });
  const cb = createCircuitBreaker({ clock: cfg.clock });
  const backoff = cfg.backoff ?? { base: 2000, cap: 60_000 };
  const maxAttempts = cfg.maxAttempts ?? 5;

  async function runAndRecord(
    input: SendTemplateInput,
  ): Promise<Result<SendResult, OutboundNotifyError>> {
    const res = await bucket.enqueue(() =>
      withRetry(() => inner.sendTemplate(input), {
        maxAttempts,
        clock: cfg.clock,
        decide: (e, attempt) => {
          if (e.kind === "RateLimited") return { retry: true, delayMs: e.retryAfterMs };
          if (e.kind === "Transient")
            return { retry: true, delayMs: computeBackoffMs(attempt, backoff) };
          return { retry: false };
        },
      }),
    );
    if (res.isOk()) cb.recordSuccess();
    else if (res.error.kind === "Transient" || res.error.kind === "Permanent") cb.recordFailure();
    return res;
  }

  function sendTemplate(input: SendTemplateInput): ResultAsync<SendResult, OutboundNotifyError> {
    const gate = cb.canPass();
    if (gate.isErr()) return errAsync(gate.error); // CircuitOpen — fail-fast, sem POST
    return new ResultAsync(runAndRecord(input));
  }

  return { sendTemplate };
}
