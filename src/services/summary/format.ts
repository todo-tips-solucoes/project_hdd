/**
 * `format.ts` — helpers de formatação Markdown para summary-generator.
 *
 * Story 1.a.8 (F8 FR-070..076).
 *
 * Funções puras: input estruturado → string Markdown. Nenhum I/O.
 * Mantidas fora de `summary-generator.service.ts` para respeitar Biome
 * 200-line cap e isolar lógica testável.
 */

import type {
  SummaryDecision,
  SummaryFile,
  SummaryFinding,
  SummaryMetric,
  SummaryNextStep,
  SummaryOpenItem,
} from "./types.ts";

const EMPTY_PLACEHOLDER = "_(nenhum)_";

export function formatFileList(items: ReadonlyArray<SummaryFile>): string {
  if (items.length === 0) return EMPTY_PLACEHOLDER;
  return items
    .map((it) => {
      const pathPart = it.path !== undefined ? ` (\`${it.path}\`)` : "";
      return `- **${it.artifact}**${pathPart} — ${it.description}`;
    })
    .join("\n");
}

export function formatDecisions(decisions: ReadonlyArray<SummaryDecision>): string {
  if (decisions.length === 0) return EMPTY_PLACEHOLDER;
  const header =
    "| # | Decisão | Razão / Trade-off | ID |\n|---|---------|-------------------|----|";
  const rows = decisions.map(
    (d) => `| ${d.n} | ${escapePipe(d.decision)} | ${escapePipe(d.reason)} | ${d.id ?? "—"} |`,
  );
  return `${header}\n${rows.join("\n")}`;
}

export function formatTradeoffs(tradeoffs: ReadonlyArray<string>): string {
  if (tradeoffs.length === 0) return EMPTY_PLACEHOLDER;
  return tradeoffs.map((t) => `- ${t}`).join("\n");
}

export function formatOpenItems(items: ReadonlyArray<SummaryOpenItem>): string {
  if (items.length === 0) return EMPTY_PLACEHOLDER;
  return items.map((it) => `- **${it.id}:** ${it.description}`).join("\n");
}

export function formatReviewerFindings(findings: SummaryFinding | undefined): string {
  if (findings === undefined) return EMPTY_PLACEHOLDER;
  const lines: string[] = [`- **Verdict:** ${findings.verdict}`];
  if (findings.resolved.length > 0) {
    lines.push(`- **Resolvido:** ${findings.resolved.join("; ")}`);
  }
  if (findings.deferred.length > 0) {
    lines.push(`- **Diferido:** ${findings.deferred.join("; ")}`);
  }
  return lines.join("\n");
}

export function formatMetrics(metrics: ReadonlyArray<SummaryMetric>): string {
  if (metrics.length === 0) return EMPTY_PLACEHOLDER;
  return metrics.map((m) => `- **${m.key}:** ${m.value}`).join("\n");
}

export function formatNextSteps(steps: ReadonlyArray<SummaryNextStep>): string {
  if (steps.length === 0) return EMPTY_PLACEHOLDER;
  return steps.map((s) => `${s.n}. ${s.description}`).join("\n");
}

/**
 * Conta palavras (split por whitespace + filter empty). HTML comments
 * `<!-- ... -->` são strip antes do count.
 */
export function countWords(text: string): number {
  const stripped = text.replace(/<!--[\s\S]*?-->/g, " ");
  const matches = stripped.match(/\S+/g);
  return matches?.length ?? 0;
}

/**
 * Substitui `{{key}}` literal por valor em template. Não regex — evita
 * escape de meta-chars. Vars não presentes ficam intactas (operador detecta).
 */
export function renderTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}
