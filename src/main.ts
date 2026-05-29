/**
 * `main.ts` — top-level entry point do hdd-worker.
 *
 * Story 1.a.7 (Q-A7-5 [RESOLVED — process.exit(1) directo]).
 *
 * Em err do `bootstrap()`, escreve a mensagem amigável para stderr e chama
 * `process.exit(1)`. NÃO usa `throw` — `process.exit` é syscall, não atinge
 * o lint `no-restricted-syntax: ThrowStatement` (AO-66).
 *
 * Em ok, escreve "hdd-worker started" para stdout. O processo mantém-se vivo
 * via os listeners SIGTERM/SIGINT armed pelo `createShutdownHandler.arm()`
 * (standard Node.js behaviour: process não termina enquanto há listeners
 * registados em event emitters).
 *
 * `import.meta.main` guard permite import do `bootstrap` em tests sem
 * auto-executar este bloco.
 */

import { type BootError, bootstrap } from "./bootstrap.ts";

function formatBootError(e: BootError): string {
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

if (import.meta.main) {
  const result = bootstrap();
  if (result.isErr()) {
    process.stderr.write(`${formatBootError(result.error)}\n`);
    process.exit(1);
  }
  process.stdout.write("hdd-worker started\n");
}
