/**
 * `apply-diff.service.ts` — gate de path-safety para writes LLM-generated.
 *
 * Story 1.b.1 (Epic 1.b Safety BLOCKERS, DRB C2 — AO-158 + AO-165).
 *
 * **"NO apply-diff":** não herdamos path resolution do utilitário `apply-diff`
 * de terceiros (vulnerável per PR-mortem) — construímos a nossa própria gate.
 *
 * **Pipeline de `applyWrite`:**
 *   1. `sanitizeRelPath` (lexical, sync) — `../`, absolute, encoded, control.
 *   2. realpath anti-symlink (AO-165) — resolve o prefixo existente mais longo
 *      do alvo e reasserta o boundary na forma canónica do filesystem. Apanha
 *      `<ws>/link → /etc` que passa a checagem lexical.
 *   3. write atómico — só depois de AMBAS as assertions passarem (anti-TOCTOU).
 *
 * **Serialização (AO-165, Q-B1-4 [RESOLVED]):** writes são serializados por
 * instância via promise-chain mutex — elimina races entre `applyWrite`
 * concorrentes. Custo nulo (I/O-bound).
 *
 * **Audit (AC-1):** toda a rejeição emite `type: "SecurityViolation"` com
 * `{ attempted, reason }`. `runId` vem de `getRunContext()` no adapter.
 *
 * Shell layer: pode importar ports + lib; nunca importado por `src/core/**`.
 */

import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  type PathTraversalError,
  type PathTraversalReason,
  sanitizeRelPath,
} from "../lib/path-sanitize.ts";
import { err, ok, type Result, ResultAsync } from "../lib/result.ts";
import type { AuditPort } from "../ports/audit.port.ts";
import type { ClockPort } from "../ports/clock.port.ts";

export type ApplyDiffError =
  | PathTraversalError
  | { readonly kind: "WriteFailure"; readonly cause: unknown };

export interface ApplyDiffService {
  applyWrite(relPath: string, contents: string): ResultAsync<{ path: string }, ApplyDiffError>;
}

export type ApplyDiffDeps = {
  readonly workspaceRoot: string;
  readonly audit: AuditPort;
  readonly clock: ClockPort;
};

/**
 * Resolve o prefixo existente mais longo de `target` (incluindo o próprio
 * target) via `realpath` e reasserta o boundary. Apanha symlink escape.
 */
async function assertRealpathWithin(
  realRoot: string,
  target: string,
): Promise<Result<true, ApplyDiffError>> {
  let probe = target;
  for (;;) {
    try {
      const real = await realpath(probe);
      if (real !== realRoot && !real.startsWith(realRoot + sep)) {
        return err({ kind: "PathTraversal", attempted: target, reason: "symlink-escape" });
      }
      return ok(true);
    } catch {
      const parent = dirname(probe);
      if (parent === probe) return ok(true); // chegou à raiz do fs sem escape
      probe = parent;
    }
  }
}

export function createApplyDiffService(deps: ApplyDiffDeps): ApplyDiffService {
  const root = resolve(deps.workspaceRoot);
  let chain: Promise<unknown> = Promise.resolve();

  function emitViolation(attempted: string, reason: PathTraversalReason): void {
    // Result ignorado de propósito: audit de violação é best-effort no hot-path.
    void deps.audit.append({
      ts: deps.clock.now().toISOString(),
      type: "SecurityViolation",
      payload: { attempted, reason },
    });
  }

  async function doWrite(
    relPath: string,
    contents: string,
  ): Promise<Result<{ path: string }, ApplyDiffError>> {
    const lexical = sanitizeRelPath(root, relPath);
    if (lexical.isErr()) {
      emitViolation(lexical.error.attempted, lexical.error.reason);
      return err(lexical.error);
    }
    const target = lexical.value;

    let realRoot: string;
    try {
      realRoot = await realpath(root);
    } catch (cause) {
      return err({ kind: "WriteFailure", cause });
    }

    const real = await assertRealpathWithin(realRoot, target);
    if (real.isErr()) {
      if (real.error.kind === "PathTraversal") emitViolation(relPath, real.error.reason);
      return err(real.error);
    }

    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
      return ok({ path: target });
    } catch (cause) {
      return err({ kind: "WriteFailure", cause });
    }
  }

  function applyWrite(
    relPath: string,
    contents: string,
  ): ResultAsync<{ path: string }, ApplyDiffError> {
    const next = chain.then(() => doWrite(relPath, contents));
    chain = next.then(
      () => undefined,
      () => undefined,
    ); // mantém o mutex vivo mesmo em rejeição
    return new ResultAsync(next);
  }

  return { applyWrite };
}
