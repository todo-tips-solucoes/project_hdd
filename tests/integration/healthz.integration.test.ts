/**
 * `healthz.integration.test.ts` — INTEGRAÇÃO REAL do /healthz (Story 1.c.1, D-053).
 *
 * Arranca um `Bun.serve` REAL numa porta efémera (port:0) e faz `fetch` HTTP
 * de verdade — prova o wiring Hono→Bun.serve→HTTP que o `hdd-worker start` usa.
 * Mock-only (app.request) não cobre o servidor real. Determinístico, sem deps
 * externas → corre sempre.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createSystemClockAdapter } from "../../src/adapters/clock/system-clock.adapter.ts";
import { createHealthzApp } from "../../src/cli/healthz.handler.ts";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  const app = createHealthzApp({ clock: createSystemClockAdapter(), bootEpochMs: Date.now() });
  server = Bun.serve({ port: 0, fetch: app.fetch }); // port 0 → efémera
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.stop(true); // fecha o servidor (não vaza porta)
});

describe("/healthz — servidor real (Bun.serve + fetch)", () => {
  test("GET /healthz real → 200 JSON { status:'ok', uptime>=0 }", async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test("rota desconhecida real → 404", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});
