/**
 * `healthz.test.ts` — unit (mock-only) do handler /healthz (Story 1.c.1).
 *
 * Usa `app.request()` do Hono (sem servidor) + `createTestClockAdapter` para
 * uptime determinístico. A versão de integração real (Bun.serve + fetch) está
 * em `tests/integration/healthz.integration.test.ts` (D-053).
 */

import { describe, expect, test } from "bun:test";
import { createTestClockAdapter } from "../../src/adapters/clock/test-clock.adapter.ts";
import { createHealthzApp } from "../../src/cli/healthz.handler.ts";

const BOOT = new Date("2026-05-29T12:00:00.000Z");

describe("/healthz handler", () => {
  test("GET /healthz → 200 { status:'ok', uptime:0 } no arranque", async () => {
    const clock = createTestClockAdapter(BOOT);
    const app = createHealthzApp({ clock, bootEpochMs: BOOT.getTime() });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(body.uptime).toBe(0);
  });

  test("uptime cresce com o relógio", async () => {
    const clock = createTestClockAdapter(BOOT);
    const app = createHealthzApp({ clock, bootEpochMs: BOOT.getTime() });
    clock.advance(42_000); // +42s
    const res = await app.request("/healthz");
    const body = (await res.json()) as { uptime: number };
    expect(body.uptime).toBe(42);
  });

  test("rota desconhecida → 404", async () => {
    const clock = createTestClockAdapter(BOOT);
    const app = createHealthzApp({ clock, bootEpochMs: BOOT.getTime() });
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
  });
});
