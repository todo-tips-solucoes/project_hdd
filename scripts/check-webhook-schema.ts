/**
 * `check-webhook-schema.ts` — Day-7 escalation gate (Story 1.b.5, AC3 / PM-5 / AO-86).
 *
 * NÃO-BLOQUEANTE (exit 0 sempre): o valor é forçar uma decisão consciente sobre
 * o `webhook-mock`. Se o schema clihelper inbound real já chegou (marker
 * `docs/clihelper-webhook-schema.json`) → `webhook-mock=false` + confirma.
 * Senão → regista `[OPEN]` em readiness + mantém `webhook-mock=true`.
 *
 * Flag-store: `_bmad-output/feature-flags.json` (simples). Sem deps externas.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const REPO = "/var/lib/projeto_hdd";
const MARKER = join(REPO, "docs", "clihelper-webhook-schema.json");
const FLAGS = join(REPO, "_bmad-output", "feature-flags.json");
const READINESS = join(REPO, "_bmad-output", "planning-artifacts", "readiness-open-items.md");

function readFlags(): Record<string, unknown> {
  if (!existsSync(FLAGS)) return {};
  try {
    return JSON.parse(readFileSync(FLAGS, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeFlags(flags: Record<string, unknown>): void {
  mkdirSync(dirname(FLAGS), { recursive: true });
  writeFileSync(FLAGS, `${JSON.stringify(flags, null, 2)}\n`);
}

const date = new Date().toISOString().slice(0, 10);
const flags = readFlags();

if (existsSync(MARKER)) {
  flags["webhook-mock"] = false;
  writeFlags(flags);
  console.log(`OK: schema clihelper presente (${MARKER}) → webhook-mock=false. Mock pode ser removido.`);
} else {
  flags["webhook-mock"] = true;
  writeFlags(flags);
  mkdirSync(dirname(READINESS), { recursive: true });
  const line = `- [OPEN] ${date} — schema clihelper inbound real ainda não recebido (AO-86/PM-5); webhook-mock=true mantido. Re-correr \`bun run check:webhook-schema\` quando o schema chegar.\n`;
  const prev = existsSync(READINESS) ? readFileSync(READINESS, "utf8") : "# Readiness — Open Items\n\n";
  writeFileSync(READINESS, prev.includes(line.trim()) ? prev : `${prev}${line}`);
  console.log(`[OPEN]: schema clihelper ausente → webhook-mock=true mantido; registado em ${READINESS}.`);
}

process.exit(0);
