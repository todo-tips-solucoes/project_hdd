/**
 * `env.ts` — Zod schema sobre `process.env` (D-04.5', AO-52).
 *
 * Story 1.a.7 (Q-A7-1 [RESOLVED — Minimal]). Schema actual contém apenas
 * `ANTHROPIC_API_KEY`. Outras env vars (HDD_DB_PATH, HDD_AUDIT_DIR, …) entram
 * em stories futuras quando consumidas — defaults hardcoded em `bootstrap.ts`
 * por agora.
 *
 * Fail-closed em missing/empty/whitespace-only via `.trim().min(1)`. Mensagem
 * "ANTHROPIC_API_KEY required" é substring AC-1 binary.
 *
 * Returns `Result<Env, EnvValidationError>` — síncrono (Zod safeParse é sync).
 * Sem `throw` (AO-66 categoria #3 boot-time failure permitida mas preferimos
 * `process.exit(1)` directo em `main.ts`).
 */

import { z } from "zod";
import { err, ok, type Result } from "./result.ts";

const REQUIRED_MSG = "ANTHROPIC_API_KEY required";

export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string({ error: () => REQUIRED_MSG })
    .trim()
    .min(1, REQUIRED_MSG),
});

export type Env = z.infer<typeof EnvSchema>;

export type EnvValidationError = {
  readonly kind: "EnvValidationError";
  readonly issues: ReadonlyArray<{ readonly path: string; readonly message: string }>;
  readonly formatted: string;
};

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Result<Env, EnvValidationError> {
  const parsed = EnvSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issues = parsed.error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
  const formatted = issues.map((i) => i.message).join("; ");
  return err({ kind: "EnvValidationError", issues, formatted });
}
