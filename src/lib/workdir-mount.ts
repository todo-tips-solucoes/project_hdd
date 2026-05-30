/**
 * `workdir-mount.ts` — isolamento de workdir por sub-agente + handoff explícito.
 *
 * Story 2.3 (FR-004, AR-039, NFR-R3). Cada sub-agente (Dev / Review / QA) corre
 * num workdir próprio (Q-2.3-2 [RESOLVED — temp efémero `mkdtempSync`]) passado
 * como `opts.cwd` ao `BmadInvokerPort`. A troca de artefactos entre workdirs só
 * acontece via `handoffArtifact(from, to, paths)` — NÃO por fs access directo
 * (AC2). Cada path é validado com `sanitizeRelPath` (1.b.1) contra AMBOS os
 * boundaries (origem e destino); `../`/absoluto/encoded → `err(PathTraversal)`.
 *
 * Camada `lib` pura: importa apenas `path-sanitize`/`result` + `node:fs`. Sem
 * `throw` (AO-66) — falha de setup/IO é `Result`, não programmer error.
 */

import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type PathTraversalError, sanitizeRelPath } from "./path-sanitize.ts";
import { err, ok, type Result } from "./result.ts";

export type SubAgentRole = "dev" | "review" | "qa";

export type WorkdirHandle = {
  readonly role: SubAgentRole;
  /** Path absoluto do workdir isolado (raiz do boundary de path-safety). */
  readonly path: string;
};

export type WorkdirError = { readonly kind: "WorkdirSetupFailed"; readonly cause: unknown };

export type HandoffError =
  | PathTraversalError
  | { readonly kind: "WriteFailure"; readonly cause: unknown };

/**
 * Cria um workdir temporário efémero para `role` sob `os.tmpdir()`. O directório
 * é a raiz do boundary — qualquer write/handoff é validado contra ele. Limpeza
 * via `cleanupWorkdir`. `mkdtempSync` pode falhar (disco/perm) → `Result`.
 */
export function createWorkdir(
  role: SubAgentRole,
  prefix = "hdd-subagent",
): Result<WorkdirHandle, WorkdirError> {
  try {
    const path = mkdtempSync(join(tmpdir(), `${prefix}-${role}-`));
    return ok({ role, path });
  } catch (cause) {
    return err({ kind: "WorkdirSetupFailed", cause });
  }
}

/**
 * Copia `paths` (relativos) do workdir `from` para o workdir `to`. Único canal
 * de troca de artefactos entre sub-agentes (AC2). Cada path é validado contra os
 * dois boundaries com `sanitizeRelPath` — traversal/absoluto/encoded é rejeitado
 * ANTES de qualquer I/O. Devolve os paths absolutos escritos em `to`.
 */
export function handoffArtifact(
  from: string,
  to: string,
  paths: ReadonlyArray<string>,
): Result<ReadonlyArray<string>, HandoffError> {
  const copied: string[] = [];
  for (const rel of paths) {
    const src = sanitizeRelPath(from, rel);
    if (src.isErr()) return err(src.error);
    const dst = sanitizeRelPath(to, rel);
    if (dst.isErr()) return err(dst.error);
    try {
      mkdirSync(dirname(dst.value), { recursive: true });
      copyFileSync(src.value, dst.value);
      copied.push(dst.value);
    } catch (cause) {
      return err({ kind: "WriteFailure", cause });
    }
  }
  return ok(copied);
}

/** Remove o workdir e o seu conteúdo (best-effort; `force` evita ENOENT). */
export function cleanupWorkdir(handle: WorkdirHandle): void {
  rmSync(handle.path, { recursive: true, force: true });
}
