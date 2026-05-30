/**
 * `start.command.ts` — `hdd-worker start [project]` (Story 2.1; extraído de 1.c.1).
 *
 * Arranca o worker daemon: `bootstrap()` (NÃO cliMode → arma shutdown + exige
 * sandbox image fail-closed) + serve Hono `/healthz` via `Bun.serve`. O systemd
 * chama `dist/hdd-worker start` (binário compilado). Bun sem `sd_notify` →
 * supervisão por `/healthz` polling (Type=simple).
 *
 * `[project]` (Q-2.1, opcional, default `projeto_hdd`) é forward-compatível: o
 * `bootstrap()` ainda usa o projeto fixo do seu default; o argumento entra na
 * mensagem de arranque e prepara o multi-project (Epic futuro).
 *
 * `serve`/`clock`/`bootEpochMs` injectáveis → testável sem abrir socket real.
 */

import type { Command } from "commander";
import { createSystemClockAdapter } from "../adapters/clock/system-clock.adapter.ts";
import { type BootError, type BootResult, bootstrap } from "../bootstrap.ts";
import type { Result } from "../lib/result.ts";
import type { ClockPort } from "../ports/clock.port.ts";
import { formatBootError } from "./boot-error.format.ts";
import { createHealthzApp } from "./healthz.handler.ts";

const DEFAULT_PORT = 8080;
const DEFAULT_PROJECT = "projeto_hdd";

type ServeFn = (opts: {
  port: number;
  fetch: (req: Request) => Response | Promise<Response>;
}) => unknown;

export type StartDeps = {
  readonly bootstrap?: () => Result<BootResult, BootError>;
  readonly serve?: ServeFn;
  readonly clock?: ClockPort;
  readonly bootEpochMs?: number;
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

export function registerStartCommand(program: Command, deps: StartDeps = {}): void {
  program
    .command("start [project]")
    .description("Arranca o worker daemon + serve /healthz (systemd Type=simple)")
    .option("--port <n>", "porta do /healthz (default PORT env ou 8080)")
    .action((project: string | undefined, opts: { port?: string }) => {
      const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
      const stderr = deps.stderr ?? ((s) => process.stderr.write(s));
      const exit = deps.exit ?? ((c) => process.exit(c));

      const boot = (deps.bootstrap ?? (() => bootstrap()))();
      if (boot.isErr()) {
        stderr(`${formatBootError(boot.error)}\n`);
        exit(1);
        return;
      }

      const { PORT } = process.env;
      const port = Number(opts.port ?? PORT ?? DEFAULT_PORT);
      const projectName = project ?? DEFAULT_PROJECT;
      const clock = deps.clock ?? createSystemClockAdapter();
      const bootEpochMs = deps.bootEpochMs ?? Date.now();
      const app = createHealthzApp({ clock, bootEpochMs });
      const serve = deps.serve ?? ((o: Parameters<ServeFn>[0]) => Bun.serve(o));
      serve({ port, fetch: app.fetch });
      stdout(`hdd-worker started (${projectName}) — /healthz on :${port}\n`);
    });
}
