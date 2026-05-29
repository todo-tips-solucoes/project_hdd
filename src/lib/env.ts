/**
 * `env.ts` — Zod schema sobre `process.env` (D-04.5', AO-52) + perm-check do
 * EnvironmentFile de secrets (Story 1.c.2, NFR-S1/AR-019/D-04.6').
 *
 * Story 1.a.7: schema mínimo (`ANTHROPIC_API_KEY`). Story 1.c.2: +`CLIHELPER_TOKEN`
 * **required** (Q-C2-1, decisão do operador) + `checkSecretsFilePerms`.
 *
 * Fail-closed em missing/empty/whitespace-only via `.trim().min(1)`. Mensagens
 * "<VAR> required" são substrings de AC binary.
 *
 * Returns `Result<…>` — síncrono. Sem `throw` (AO-66).
 */

import { statSync } from "node:fs";
import { z } from "zod";
import { err, ok, type Result } from "./result.ts";

const REQUIRED_MSG = "ANTHROPIC_API_KEY required";
const CLIHELPER_REQUIRED_MSG = "CLIHELPER_TOKEN required";

export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string({ error: () => REQUIRED_MSG })
    .trim()
    .min(1, REQUIRED_MSG),
  CLIHELPER_TOKEN: z
    .string({ error: () => CLIHELPER_REQUIRED_MSG })
    .trim()
    .min(1, CLIHELPER_REQUIRED_MSG),
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

export type SecretsError =
  | { readonly kind: "SecretsFileMissing"; readonly path: string }
  | { readonly kind: "SecretsFileInsecure"; readonly path: string; readonly mode: string };

/**
 * Verifica que o EnvironmentFile de secrets não é acessível a group/world
 * (Story 1.c.2, AC-1; NFR-S1). Rejeita se `mode & 0o077 !== 0` (permite 0600 /
 * 0400; Q-C2-4). `statFn` injectável para tests. Sem `throw` (AO-66).
 *
 * Defesa-em-profundidade: o gate primário é o `ExecStartPre` do systemd; esta
 * função é o equivalente in-code, testável e reutilizável.
 */
export function checkSecretsFilePerms(
  path: string,
  statFn: (p: string) => { mode: number } = statSync,
): Result<true, SecretsError> {
  let mode: number;
  try {
    mode = statFn(path).mode;
  } catch {
    return err({ kind: "SecretsFileMissing", path });
  }
  const perm = mode & 0o777;
  if ((perm & 0o077) !== 0) {
    return err({ kind: "SecretsFileInsecure", path, mode: perm.toString(8).padStart(4, "0") });
  }
  return ok(true);
}
