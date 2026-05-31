/**
 * Story 3.1 — specs do clihelper.adapter (OutboundNotifyPort).
 *
 * Fake HttpPort (spy: captura url/headers/body). Sem rede real — integração real
 * fica para quando os templates Meta estiverem aprovados (D-053).
 *
 * AC1: send → POST ao endpoint certo + Authorization + body válido.
 * AC2: NOTIFY_DRY_RUN → 0 POSTs, log presente (sem values de vars / token).
 * AC3: com vars vs sem vars → endpoints distintos (sem-variavel).
 * AC4: payload inválido → err(PayloadInvalid), 0 POSTs.
 * + status HTTP: 5xx→Transient, 4xx→Permanent, 429→RateLimited; erro http propagado.
 */

import { describe, expect, test } from "bun:test";
import {
  type ClihelperConfig,
  createClihelperAdapter,
  type HttpError,
  type HttpPort,
  type HttpRequest,
  type HttpResponse,
} from "../../src/adapters/whatsapp/clihelper.adapter.ts";
import { errAsync, okAsync } from "../../src/lib/result.ts";

const CONFIG: ClihelperConfig = {
  baseUrl: "https://clihelper.example.com/",
  token: "secret-token-xyz",
  dryRun: false,
  number: "5511999999999",
  name: "Operador",
  openTicket: true,
};

function spyHttp(
  opts: { status?: number; headers?: Record<string, string>; fail?: HttpError } = {},
): {
  http: HttpPort;
  calls: HttpRequest[];
} {
  const calls: HttpRequest[] = [];
  const http: HttpPort = {
    post(req) {
      calls.push(req);
      if (opts.fail !== undefined) return errAsync(opts.fail);
      const r: HttpResponse = {
        status: opts.status ?? 200,
        body: "{}",
        ...(opts.headers !== undefined ? { headers: opts.headers } : {}),
      };
      return okAsync(r);
    },
  };
  return { http, calls };
}

describe("AC1 — send template", () => {
  test("POST ao endpoint + Authorization + body pt_BR válido", async () => {
    const { http, calls } = spyHttp({ status: 200 });
    const notify = createClihelperAdapter(CONFIG, { http });
    const r = await notify.sendTemplate({
      template: "hdd_interrupt_p1",
      vars: { story: "3-1", trigger: "P1" },
      queueId: "q-7",
    });
    expect(r.isOk()).toBe(true);
    const call = calls[0];
    if (call === undefined) throw new Error("http não invocado");
    expect(call.url).toBe(
      "https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template/",
    );
    expect(call.headers["Authorization"]).toBe("secret-token-xyz");
    const body = JSON.parse(call.body) as {
      language: string;
      queueId: string;
      template: unknown[];
    };
    expect(body.language).toBe("pt_BR");
    expect(body.queueId).toBe("q-7");
    expect(body.template.length).toBe(1);
  });
});

describe("AC2 — dry-run", () => {
  test("NOTIFY_DRY_RUN → 0 POSTs + log sem values de vars/token", async () => {
    const { http, calls } = spyHttp();
    const logs: string[] = [];
    const notify = createClihelperAdapter(
      { ...CONFIG, dryRun: true },
      { http, log: (l) => logs.push(l) },
    );
    const r = await notify.sendTemplate({
      template: "hdd_summary_finalization",
      vars: { secret: "NÃO-DEVE-APARECER" },
      queueId: "q-1",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value.dryRun).toBe(true);
    expect(calls.length).toBe(0); // nenhum POST real
    expect(logs.length).toBe(1);
    expect(logs[0]).toContain("[NOTIFY_DRY_RUN]");
    expect(logs[0]).not.toContain("NÃO-DEVE-APARECER"); // value redacted
    expect(logs[0]).not.toContain("secret-token-xyz"); // token nunca logado
  });
});

describe("AC3 — selecção de endpoint (vars vs sem-variavel)", () => {
  test("sem vars → endpoint -sem-variavel", async () => {
    const { http, calls } = spyHttp();
    const notify = createClihelperAdapter(CONFIG, { http });
    await notify.sendTemplate({ template: "hdd_heartbeat", queueId: "q-2" });
    expect(calls[0]?.url).toContain("api-oficial-mensagem-template-sem-variavel/");
  });
  test("vars vazio ({}) → também -sem-variavel", async () => {
    const { http, calls } = spyHttp();
    const notify = createClihelperAdapter(CONFIG, { http });
    await notify.sendTemplate({ template: "hdd_heartbeat", vars: {}, queueId: "q-3" });
    expect(calls[0]?.url).toContain("-sem-variavel/");
  });
  test("com vars → endpoint com variável (não -sem-variavel)", async () => {
    const { http, calls } = spyHttp();
    const notify = createClihelperAdapter(CONFIG, { http });
    await notify.sendTemplate({ template: "hdd_interrupt_s1", vars: { x: "1" }, queueId: "q-4" });
    expect(calls[0]?.url).not.toContain("-sem-variavel");
  });
});

describe("AC4 + status — fail-closed e mapeamento de erros", () => {
  test("body inválido (number vazio na config) → PayloadInvalid, 0 POSTs", async () => {
    const { http, calls } = spyHttp();
    const notify = createClihelperAdapter({ ...CONFIG, number: "" }, { http });
    const r = await notify.sendTemplate({ template: "t", vars: { a: "b" }, queueId: "q" });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.kind).toBe("PayloadInvalid");
    expect(calls.length).toBe(0); // não envia lixo ao clihelper
  });
  test("5xx → Transient", async () => {
    const { http } = spyHttp({ status: 503 });
    const r = await createClihelperAdapter(CONFIG, { http }).sendTemplate({
      template: "t",
      vars: { a: "b" },
      queueId: "q",
    });
    if (r.isErr()) expect(r.error.kind).toBe("Transient");
    else throw new Error("esperava Transient");
  });
  test("4xx → Permanent", async () => {
    const { http } = spyHttp({ status: 400 });
    const r = await createClihelperAdapter(CONFIG, { http }).sendTemplate({
      template: "t",
      vars: { a: "b" },
      queueId: "q",
    });
    if (r.isErr()) expect(r.error.kind).toBe("Permanent");
    else throw new Error("esperava Permanent");
  });
  test("429 com Retry-After → RateLimited(retryAfterMs)", async () => {
    const { http } = spyHttp({ status: 429, headers: { "retry-after": "5" } });
    const r = await createClihelperAdapter(CONFIG, { http }).sendTemplate({
      template: "t",
      vars: { a: "b" },
      queueId: "q",
    });
    if (r.isErr() && r.error.kind === "RateLimited") expect(r.error.retryAfterMs).toBe(5000);
    else throw new Error("esperava RateLimited");
  });
  test("erro de transporte (Permanent) propagado", async () => {
    const { http } = spyHttp({ fail: { kind: "Permanent", cause: "DNS" } });
    const r = await createClihelperAdapter(CONFIG, { http }).sendTemplate({
      template: "t",
      vars: { a: "b" },
      queueId: "q",
    });
    if (r.isErr()) expect(r.error.kind).toBe("Permanent");
    else throw new Error("esperava Permanent");
  });
});
