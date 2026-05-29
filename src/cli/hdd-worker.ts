/**
 * `hdd-worker.ts` — Commander root CLI entry point.
 *
 * Story 1.a.8 (root + `review`) · Story 1.c.1 (`start` daemon + `/healthz`).
 *
 * **`start` (1.c.1):** launcher daemon canónico — `bootstrap()` (daemon, NÃO
 * cliMode → arma shutdown + ProcessStarted + exige sandbox image fail-closed,
 * Q-C1-4) + serve Hono `/healthz` via `Bun.serve`. O systemd chama
 * `dist/hdd-worker start` (binário compilado de ESTE ficheiro — Q-C1-2). O Bun
 * não tem `sd_notify` → supervisão por `/healthz` polling, não `Type=notify`.
 *
 * `import.meta.main` guard permite import em tests sem auto-executar parse.
 */

import { Command } from "commander";
import { createSystemClockAdapter } from "../adapters/clock/system-clock.adapter.ts";
import { type BootError, bootstrap } from "../bootstrap.ts";
import { createHealthzApp } from "./healthz.handler.ts";
import { registerReviewCommand } from "./review.command.ts";

const DEFAULT_PORT = 8080;

function formatBootError(e: BootError): string {
  switch (e.kind) {
    case "BootEnvInvalid":
      return e.inner.formatted;
    case "BootDbFailure":
      return `db init failed: ${String(e.cause)}`;
    case "BootMigrationFailure":
      return `migration failed: ${JSON.stringify(e.inner)}`;
    case "BootAuditFailure":
      return `audit init failed: ${JSON.stringify(e.inner)}`;
    case "BootSandboxImageMissing":
      return `sandbox image missing: ${e.image} — corre scripts/prepull-sandbox-image.sh`;
  }
}

export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Arranca o worker daemon + serve /healthz (systemd Type=simple)")
    .option("--port <n>", "porta do /healthz (default PORT env ou 8080)")
    .action((opts: { port?: string }) => {
      const boot = bootstrap();
      if (boot.isErr()) {
        process.stderr.write(`${formatBootError(boot.error)}\n`);
        process.exit(1);
      }
      const { PORT } = process.env;
      const port = Number(opts.port ?? PORT ?? DEFAULT_PORT);
      const app = createHealthzApp({
        clock: createSystemClockAdapter(),
        bootEpochMs: Date.now(),
      });
      Bun.serve({ port, fetch: app.fetch });
      process.stdout.write(`hdd-worker started — /healthz on :${port}\n`);
    });
}

export function createCli(): Command {
  const program = new Command();
  program
    .name("hdd-worker")
    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — review + start daemon")
    .version("0.0.1");

  registerReviewCommand(program);
  registerStartCommand(program);

  return program;
}

if (import.meta.main) {
  void createCli().parseAsync(process.argv);
}
