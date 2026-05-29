/**
 * `healthz.handler.ts` — endpoint Hono `/healthz` para supervisão externa.
 *
 * Story 1.c.1 (AR-020, NFR-P1, D-04.14). O Bun NÃO suporta `sd_notify` nativo
 * ([[project-hdd-bun-sd-notify-gotcha]]) → a saúde é exposta por HTTP e pollada
 * por Healthchecks.io (systemd `Type=simple`, sem `WatchdogSec`).
 *
 * Puro/injectável: recebe `clock` (ClockPort) + `bootEpochMs` → `uptime` em
 * segundos é determinístico em testes (avançar o test-clock). `app.request()`
 * permite unit-test sem servidor; `app.fetch` liga ao `Bun.serve` no `start`.
 */

import { Hono } from "hono";
import type { ClockPort } from "../ports/clock.port.ts";

export type HealthzDeps = {
  readonly clock: ClockPort;
  readonly bootEpochMs: number;
};

export function createHealthzApp(deps: HealthzDeps): Hono {
  const app = new Hono();
  app.get("/healthz", (c) => {
    const uptime = Math.floor((deps.clock.now().getTime() - deps.bootEpochMs) / 1000);
    return c.json({ status: "ok", uptime });
  });
  return app;
}
