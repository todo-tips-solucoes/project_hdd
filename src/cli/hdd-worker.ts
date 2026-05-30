/**
 * `hdd-worker.ts` — Commander root CLI entry point.
 *
 * Story 1.a.8 (root + `review`) · Story 1.c.1 (`start` daemon + `/healthz`) ·
 * Story 2.1 (scaffold completo: status/logs + stubs pause/resume + entry unificado).
 *
 * Cada subcomando vive no seu ficheiro (`registerXCommand(program, deps)`) —
 * Biome maxLines 200 + testabilidade. Ordem do `--help`: start, pause, resume,
 * status, logs, review.
 *
 * **Fronteira Story 2.6:** `pause`/`resume` são STUBS aqui (aparecem no `--help`,
 * mas a lógica FSM/lifecycle é da Story 2.6, que os substitui por ficheiros
 * próprios). NÃO implementar lifecycle nesta story.
 *
 * `import.meta.main` guard permite import em tests sem auto-executar parse.
 */

import { Command } from "commander";
import { registerLogsCommand } from "./logs.command.ts";
import { registerReviewCommand } from "./review.command.ts";
import { registerStartCommand } from "./start.command.ts";
import { registerStatusCommand } from "./status.command.ts";

export type StubDeps = {
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

/** Regista um subcomando placeholder que aparece no --help mas difere a lógica. */
export function registerStubCommand(
  program: Command,
  spec: { readonly name: string; readonly description: string; readonly hint: string },
  deps: StubDeps = {},
): void {
  program
    .command(spec.name)
    .description(spec.description)
    .action(() => {
      (deps.stderr ?? ((s) => process.stderr.write(s)))(`${spec.hint}\n`);
      (deps.exit ?? ((c) => process.exit(c)))(1);
    });
}

export function createCli(): Command {
  const program = new Command();
  program
    .name("hdd-worker")
    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — operação do worker")
    .version("0.0.1");

  registerStartCommand(program);
  registerStubCommand(program, {
    name: "pause",
    description: "Pausa o worker (Story 2.6 — lifecycle)",
    hint: "pause: diferido para a Story 2.6 (worker lifecycle)",
  });
  registerStubCommand(program, {
    name: "resume",
    description: "Retoma o worker (Story 2.6 — lifecycle)",
    hint: "resume: diferido para a Story 2.6 (worker lifecycle)",
  });
  registerStatusCommand(program);
  registerLogsCommand(program);
  registerReviewCommand(program);

  return program;
}

if (import.meta.main) {
  void createCli().parseAsync(process.argv);
}
