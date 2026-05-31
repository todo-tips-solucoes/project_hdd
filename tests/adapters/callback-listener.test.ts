/**
 * Story 3.4 — specs do callback-listener (Quick Reply parsing + drop-at-ingress).
 *
 * `app.request("/callback", …)` (sem socket). Fake AuditPort + TestClock.
 * AC1: webhook-mock → 200 + warning AO-86. AC2: p1_continuar_assim + wa_id
 * allowed → InboundCommand{P1Continuar,...}. AC3: wa_id não-allowed → 200 +
 * UnauthorizedInbound, não processa. + Bearer token + malformado.
 */

import { describe, expect, test } from "bun:test";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import {
  type CallbackDeps,
  createCallbackApp,
} from "../../src/adapters/whatsapp/callback-listener.adapter.ts";
import { ok, type Result } from "../../src/lib/result.ts";
import type {
  AuditAppendResult,
  AuditEntry,
  AuditError,
  AuditPort,
} from "../../src/ports/audit.port.ts";
import type { InboundCommand } from "../../src/ports/inbound-command.port.ts";

function fakeAudit(): AuditPort & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    append(e: AuditEntry): Result<AuditAppendResult, AuditError> {
      entries.push(e);
      return ok({ seq: entries.length, thisHash: "h" as never, path: "p" });
    },
    verifyChain(): Result<{ verified: number }, AuditError> {
      return ok({ verified: 0 });
    },
  };
}

const clock = createTestClockAdapter(new Date("2026-05-31T10:00:00.000Z"));
const WA = "5511999999999";

function setup(over: Partial<CallbackDeps> = {}): {
  app: ReturnType<typeof createCallbackApp>;
  audit: AuditPort & { entries: AuditEntry[] };
  commands: InboundCommand[];
} {
  const audit = fakeAudit();
  const commands: InboundCommand[] = [];
  const app = createCallbackApp({
    audit,
    clock,
    allowedWaIds: [WA],
    webhookMock: false,
    onCommand: (cmd) => commands.push(cmd),
    ...over,
  });
  return { app, audit, commands };
}

function post(
  app: ReturnType<typeof createCallbackApp>,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return app.request("/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("AC2 — Quick Reply parse", () => {
  test("p1_continuar_assim + wa_id allowed → InboundCommand{P1Continuar}", async () => {
    const { app, commands } = setup();
    const res = await post(app, {
      wa_id: WA,
      payload: "p1_continuar_assim",
      runId: "run-9",
      storyId: "s-3",
    });
    expect(res.status).toBe(200);
    expect(commands.length).toBe(1);
    const cmd = commands[0];
    if (cmd === undefined) throw new Error("sem comando");
    expect(cmd.kind).toBe("P1Continuar");
    expect(cmd.waId).toBe(WA);
    expect(cmd.runId).toBe("run-9");
    expect(cmd.storyId).toBe("s-3");
  });

  test("button não-mapeado (p1_mudar_rumo, O-3.3-1) → UnknownCommand, não processa", async () => {
    const { app, audit, commands } = setup();
    await post(app, { wa_id: WA, payload: "p1_mudar_rumo" });
    expect(commands.length).toBe(0);
    expect(audit.entries.some((e) => e.type === "UnknownCommand")).toBe(true);
  });
});

describe("AC3 — drop-at-ingress (wa_id não-allowlisted)", () => {
  test("wa_id não-allowed → 200 + UnauthorizedInbound, não processa", async () => {
    const { app, audit, commands } = setup();
    const res = await post(app, { wa_id: "5500000000000", payload: "p1_continuar_assim" });
    expect(res.status).toBe(200); // não 401 (não vazar)
    expect(commands.length).toBe(0);
    expect(audit.entries.some((e) => e.type === "UnauthorizedInbound")).toBe(true);
  });
});

describe("AC1 — webhook-mock (AO-86)", () => {
  test("mock=true → 200 + warning InboundSchemaPending [OPEN AO-86]", async () => {
    const { app, audit } = setup({ webhookMock: true });
    const res = await post(app, { wa_id: WA, payload: "p1_continuar_assim" });
    expect(res.status).toBe(200);
    const w = audit.entries.find((e) => e.type === "InboundSchemaPending");
    expect(w).toBeDefined();
    expect(String(w?.payload["note"])).toContain("[OPEN AO-86]");
  });
});

describe("auth + malformado", () => {
  test("Bearer token errado → 200 + UnauthorizedInbound (sem processar)", async () => {
    const { app, commands } = setup({ n8nToken: "good-token" });
    const res = await post(
      app,
      { wa_id: WA, payload: "p1_continuar_assim" },
      { Authorization: "Bearer wrong" },
    );
    expect(res.status).toBe(200);
    expect(commands.length).toBe(0);
  });

  test("Bearer token correcto → processa", async () => {
    const { app, commands } = setup({ n8nToken: "good-token" });
    await post(
      app,
      { wa_id: WA, payload: "p1_continuar_assim" },
      { Authorization: "Bearer good-token" },
    );
    expect(commands.length).toBe(1);
  });

  test("body sem wa_id → 200 + drop (MalformedPayload)", async () => {
    const { app, commands } = setup();
    const res = await post(app, { payload: "p1_continuar_assim" });
    expect(res.status).toBe(200);
    expect(commands.length).toBe(0);
  });
});
