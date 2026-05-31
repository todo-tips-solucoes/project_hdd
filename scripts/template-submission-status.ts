/**
 * `template-submission-status.ts` — checklist de submissão dos templates (Story 3.3).
 *
 * Lê o estado manual (`template-submission-status.json`) + o catálogo tipado;
 * imprime o estado por template e avalia o **M1 threshold** (3 m1Required
 * aprovados). Gate-able: exit 0 = M1 met; exit 1 = not met / estado inválido
 * (Q-3.3-3). "Manual, sem API" (AC1). Sem spawn → paths via `import.meta.dir`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  evaluateM1,
  parseSubmissionState,
  TEMPLATE_CATALOG,
  TEMPLATE_NAMES,
} from "../src/lib/template-catalog.ts";

const STATE_PATH = join(
  dirname(import.meta.dir),
  "_bmad-output/planning-artifacts/template-submission-status.json",
);

const ICON: Record<string, string> = {
  approved: "✅",
  submitted: "⏳",
  rejected: "❌",
  pending: "·",
};

function main(): number {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch (cause) {
    process.stderr.write(`FAIL: não consegui ler ${STATE_PATH} (${String(cause)})\n`);
    return 1;
  }

  const parsed = parseSubmissionState(raw);
  if (parsed.isErr()) {
    process.stderr.write(`FAIL: estado inválido — ${parsed.error.detail}\n`);
    return 1;
  }
  const state = parsed.value;

  process.stdout.write("Templates UTILITY — estado de submissão (Meta via clihelper):\n\n");
  for (const name of TEMPLATE_NAMES) {
    const spec = TEMPLATE_CATALOG[name];
    const status = state[name];
    const req = spec.m1Required ? " [M1]" : "";
    process.stdout.write(`  ${ICON[status] ?? "?"} ${name} — ${status}${req}\n`);
  }

  const m1 = evaluateM1(state);
  process.stdout.write("\n");
  if (m1.met) {
    process.stdout.write("PASS: M1 minimum viable threshold MET (3/3 templates M1 aprovados)\n");
    return 0;
  }
  process.stdout.write(`FAIL: M1 not met — faltam aprovados: ${m1.missing.join(", ")}\n`);
  return 1;
}

process.exit(main());
