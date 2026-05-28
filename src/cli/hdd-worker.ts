/**
 * `hdd-worker.ts` — Commander root CLI entry point (minimal, Story 1.a.8).
 *
 * Story 1.a.8 (Q-A8-1 [RESOLVED — Commander root NOW]).
 *
 * **Scope desta story:** apenas o esqueleto Commander + register `review`
 * subcommand. Story 2.1 vai expandir com `start`, `stop`, `status`, etc. para
 * o worker daemon. O `main.ts` separado da 1.a.7 continua a ser o daemon entry
 * (não toca aqui).
 *
 * **CLI lifecycle:** invocado como `bun run src/cli/hdd-worker.ts <subcommand>`
 * OU via binário compilado `hdd-worker <subcommand>` após `bun build --compile`.
 *
 * `import.meta.main` guard permite import em tests sem auto-executar parse.
 */

import { Command } from "commander";
import { registerReviewCommand } from "./review.command.ts";

export function createCli(): Command {
  const program = new Command();
  program
    .name("hdd-worker")
    .description("HDD CLI (HORSE DRIVEN DEVELOPMENT) — Story 1.a.8 scope: review subcommand")
    .version("0.0.1");

  registerReviewCommand(program);

  return program;
}

if (import.meta.main) {
  void createCli().parseAsync(process.argv);
}
