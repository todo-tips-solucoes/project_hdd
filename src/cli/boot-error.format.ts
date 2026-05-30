/**
 * `boot-error.format.ts` — formatador único de `BootError` (Story 2.1, Q-2.1-3).
 *
 * Consolidado a partir das cópias duplicadas em `hdd-worker.ts` e `main.ts` (e
 * agora reutilizado por `status.command.ts`). Switch exaustivo — ao adicionar
 * uma variante a `BootError`, o `tsc` força actualizar AQUI (um só sítio).
 */

import type { BootError } from "../bootstrap.ts";

export function formatBootError(e: BootError): string {
  switch (e.kind) {
    case "BootEnvInvalid":
      return e.inner.formatted;
    case "BootDbFailure":
      return `db init failed: ${String(e.cause)}`;
    case "BootMigrationFailure":
      return `migration failed: ${JSON.stringify(e.inner)}`;
    case "BootAuditFailure":
      return `audit init failed: ${JSON.stringify(e.inner)}`;
    case "BootSandboxImageMissing":
      return `sandbox image missing: ${e.image} — corre scripts/prepull-sandbox-image.sh`;
  }
}
