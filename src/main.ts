/**
 * `main.ts` — entry point alternativo; delega para o CLI Commander.
 *
 * Story 2.1 (Q-2.1-1 — unificar entry, fecha O-C1-1): em vez de um `bootstrap()`
 * implícito (que não servia `/healthz` nem subcomandos), delega para `createCli()`
 * — o MESMO entry que o `build` compila e o systemd corre via `dist/hdd-worker`.
 * Assim `bun src/main.ts` mostra `--help` e o daemon arranca com `start`, sem
 * divergência entre `dev` e produção.
 *
 * `import.meta.main` guard permite import em tests sem auto-executar parse.
 */

import { createCli } from "./cli/hdd-worker.ts";

if (import.meta.main) {
  void createCli().parseAsync(process.argv);
}
