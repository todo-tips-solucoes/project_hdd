/**
 * `logs.command.ts` — `hdd-worker logs [--tail n] [--date d]` (Story 2.1).
 *
 * Tail do audit JSONL. O `AuditPort` não expõe leitura → lê o ficheiro
 * directamente, com a MESMA convenção de path do adapter
 * (`<baseDir>/<project>/<date>.jsonl`). NÃO abre DB. ENOENT → "sem eventos"
 * (exit 0, gracioso). Resumo `<ts> <type> [<run_id>]` com fallback à linha crua.
 *
 * NOTA: se o layout de path do `jsonl-hash-chain.adapter.ts` mudar, alinhar aqui.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";

const DEFAULT_TAIL = 20;

export type LogsDeps = {
  readonly readFile?: (path: string) => string;
  readonly now?: () => Date;
  readonly baseDir?: string;
  readonly project?: string;
  readonly stdout?: (s: string) => void;
  readonly stderr?: (s: string) => void;
  readonly exit?: (code: number) => void;
};

export function registerLogsCommand(program: Command, deps: LogsDeps = {}): void {
  program
    .command("logs")
    .description("Tail do audit JSONL (eventos do worker)")
    .option("--tail <n>", "número de linhas finais", String(DEFAULT_TAIL))
    .option("--date <yyyy-mm-dd>", "dia do log (default hoje, UTC)")
    .action((opts: { tail?: string; date?: string }) => {
      runLogs(deps, opts);
    });
}

function runLogs(deps: LogsDeps, opts: { tail?: string; date?: string }): void {
  const stdout = deps.stdout ?? ((s) => process.stdout.write(s));
  const exit = deps.exit ?? ((c) => process.exit(c));
  const readFile = deps.readFile ?? ((p) => readFileSync(p, "utf8"));
  const baseDir = deps.baseDir ?? process.env["HDD_AUDIT_DIR"] ?? "_bmad-output/audit";
  const project = deps.project ?? process.env["HDD_PROJECT"] ?? "projeto_hdd";
  const date = opts.date ?? (deps.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const tail = Number(opts.tail ?? DEFAULT_TAIL);
  const path = join(baseDir, project, `${date}.jsonl`);

  let content: string;
  try {
    content = readFile(path);
  } catch {
    stdout(`sem eventos para ${date}\n`);
    exit(0);
    return;
  }

  const lines = content.split("\n").filter((l) => l.trim() !== "");
  for (const line of lines.slice(-tail)) {
    stdout(`${formatLine(line)}\n`);
  }
  exit(0);
}

function formatLine(line: string): string {
  try {
    const e = JSON.parse(line) as { ts?: string; type?: string; run_id?: string };
    const run = e.run_id !== undefined ? ` [${e.run_id}]` : "";
    return `${e.ts ?? "?"} ${e.type ?? "?"}${run}`;
  } catch {
    return line;
  }
}
