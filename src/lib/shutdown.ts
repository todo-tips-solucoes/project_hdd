/**
 * `shutdown.ts` — graceful SIGTERM/SIGINT handler (D-04.16 shutdown order).
 *
 * Story 1.a.7 (Q-A7-4 [RESOLVED — Yes emit ProcessStopped]).
 *
 * Esta story implementa 3-de-5 passos do canon D-04.16 shutdown (worker loop
 * drain + Hono graceful ficam fora — 2.1 e 1.c.1 respectivamente):
 *   1. emit "ProcessStopped" audit event (Q-A7-4 Yes).
 *   2. `db.close()` (síncrono bun:sqlite).
 *   3. `process.exit(0)`.
 *
 * **Re-entrance safety:** dois SIGTERMs em rápida sucessão → apenas uma sequência
 * de cleanup; o segundo é no-op.
 *
 * **AO-103 nota:** este ficheiro vive em `src/lib/` (fora do ban
 * `no-restricted-globals` que só aplica a `src/core/**`). `process.on()` e
 * `process.exit()` são consumidos directamente — não há setTimeout/Interval.
 *
 * **Best-effort audit append:** se `audit.append({ ProcessStopped })` falhar,
 * ignoramos o erro e prosseguimos com `db.close()` + exit. Falha de audit no
 * shutdown não deve bloquear o exit (caller não pode fazer nada útil).
 */

import type { Database } from "bun:sqlite";
import type { AuditPort } from "../ports/audit.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";

export type ShutdownDeps = {
  readonly db: Database;
  readonly audit: AuditPort;
  readonly clock: ClockPort;
  readonly bootRunId: string;
  readonly emitStoppedEvent?: boolean;
};

export type ShutdownHandle = {
  /** Instala listeners SIGTERM+SIGINT; retorna função de unarm (test cleanup). */
  readonly arm: () => () => void;
  /** Dispara cleanup sequence + exit(0). Idempotente. */
  readonly trigger: (reason: string) => void;
  /** True após primeiro trigger; útil em tests + introspecção. */
  readonly isShuttingDown: () => boolean;
};

export function createShutdownHandler(deps: ShutdownDeps): ShutdownHandle {
  let shuttingDown = false;

  const trigger = (reason: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (deps.emitStoppedEvent === true) {
      const r = deps.audit.append({
        ts: deps.clock.now().toISOString(),
        runId: deps.bootRunId,
        type: "ProcessStopped",
        payload: { reason },
      });
      // Best-effort: ignorar AuditError (já estamos a sair; nada útil a fazer).
      void r;
    }

    deps.db.close();
    process.exit(0);
  };

  const arm = (): (() => void) => {
    const onSig = (sig: NodeJS.Signals): void => {
      trigger(`signal:${sig}`);
    };
    process.on("SIGTERM", onSig);
    process.on("SIGINT", onSig);
    return () => {
      process.off("SIGTERM", onSig);
      process.off("SIGINT", onSig);
    };
  };

  return {
    arm,
    trigger,
    isShuttingDown: () => shuttingDown,
  };
}
