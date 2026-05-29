/**
 * `redaction.ts` — filtro multi-pattern de redaction de secrets (AO-160/166/175).
 *
 * Story 1.b.3 (Epic 1.b Safety BLOCKERS, DRB BLOCKER #3). Camada pura, sem I/O.
 * Aplicado pelo audit adapter ANTES do write no JSONL (never-store-raw-tokens).
 *
 * **Princípio:** substitui apenas o segredo por `***REDACTED***` (Q-B3-1),
 * preservando prefixos estruturais (`Bearer `/`Basic `) via capture group para
 * o audit continuar legível. Recursivo sobre valores (string/array/objecto),
 * mantém keys, não muta o input.
 *
 * **n8n-verbose-body (Q-B3-2):** strings > `MAX_FIELD_LEN` são truncadas com
 * marcador — defesa contra disk-exhaustion (AP-3) e secrets escondidos em
 * bodies enormes não-padrão.
 *
 * Sem `throw` (AO-66). Patterns lineares (sem backtracking aninhado → sem ReDoS).
 */

const RED = "***REDACTED***";
export const MAX_FIELD_LEN = 2048;

export type RedactionPattern = {
  readonly name: string;
  readonly re: RegExp;
  readonly repl: string;
};

/** Ordem importa pouco (sweeps independentes convergem); mais-específico primeiro. */
export const REDACTION_PATTERNS: ReadonlyArray<RedactionPattern> = [
  { name: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{8,}/g, repl: RED },
  { name: "github-token", re: /\bghp_[A-Za-z0-9]{20,}\b/g, repl: RED },
  { name: "aws-akia", re: /\bAKIA[0-9A-Z]{16}\b/g, repl: RED },
  { name: "bearer-token", re: /(Bearer\s+)[A-Za-z0-9._~+/=-]+/g, repl: `$1${RED}` },
  { name: "basic-auth", re: /(Basic\s+)[A-Za-z0-9+/=]{4,}/g, repl: `$1${RED}` },
  {
    name: "generic-secret",
    re: /((?:secret|token|password|passwd|api[_-]?key)["']?\s*[:=]\s*["']?)([^\s"',}]+)/gi,
    repl: `$1${RED}`,
  },
  {
    name: "env-var-leak",
    re: /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))=(\S+)/g,
    repl: `$1=${RED}`,
  },
  { name: "phone-pt", re: /\+351\s?9\d{2}\s?\d{3}\s?\d{3}/g, repl: RED },
  { name: "phone-br", re: /\+55\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/g, repl: RED },
  { name: "wa-id", re: /\b55\d{10,11}\b/g, repl: RED },
];

/** Aplica todos os patterns + size-cap a uma string. */
export function redactString(s: string): string {
  let out = s;
  for (const p of REDACTION_PATTERNS) {
    out = out.replace(p.re, p.repl);
  }
  if (out.length > MAX_FIELD_LEN) {
    const overflow = out.length - MAX_FIELD_LEN;
    out = `${out.slice(0, MAX_FIELD_LEN)}…[TRUNCATED ${overflow} bytes]`;
  }
  return out;
}

/** Redige recursivamente; mantém keys; devolve cópia (sem mutar o input). */
export function redactValue(v: unknown): unknown {
  if (typeof v === "string") return redactString(v);
  if (Array.isArray(v)) return v.map(redactValue);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = redactValue(val);
    }
    return out;
  }
  return v;
}

/** Entry point para o audit adapter: redige o payload completo. */
export function redactPayload(
  p: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return redactValue(p) as Readonly<Record<string, unknown>>;
}
