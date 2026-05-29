/**
 * `path-sanitize.ts` — sanitização lexical de paths contra traversal (AO-158).
 *
 * Story 1.b.1 (Epic 1.b Safety BLOCKERS, DRB C2). Camada **pura e síncrona**:
 * sem I/O. A verificação anti-symlink (realpath) vive em
 * `src/services/apply-diff.service.ts` porque toca o filesystem.
 *
 * **Defesa em duas passagens (Q-B1-2 [RESOLVED]):**
 *   1. Forma canónica — percent-decode uma vez + normalização Unicode NFKC.
 *      Detecta `../` escondido em `%2e%2e%2f`, fullwidth `．．／`, overlong, etc.
 *      Se a forma canónica escapa o boundary → reject `reason: 'encoded'`.
 *   2. Forma literal — o caminho realmente escrito. Tem de estar dentro do
 *      boundary por si só. Devolvemos o resolvido da forma LITERAL (não a
 *      decodificada) para não mis-resolver nomes legítimos tipo `my%20file.ts`.
 *
 * **Boundary assertion (AO-158):** `resolved === root || resolved.startsWith(root + sep)`.
 * O `+ sep` é crítico — sem ele `/ws-evil` passaria por prefix match de `/ws`.
 *
 * **Control chars:** detectados por code-point (`charCodeAt`), sem embeber bytes
 * de control no source — null byte (0x00) e C0/DEL (<=0x1f, 0x7f).
 *
 * Sem `throw` (AO-66): path malicioso é input esperado, não programmer error.
 */

import { isAbsolute, resolve, sep } from "node:path";
import { err, ok, type Result } from "./result.ts";

export type PathTraversalReason =
  | "relative-escape"
  | "absolute"
  | "control-char"
  | "null-byte"
  | "encoded"
  | "symlink-escape";

export type PathTraversalError = {
  readonly kind: "PathTraversal";
  readonly attempted: string;
  readonly reason: PathTraversalReason;
};

/** `true` se `s` contém o null byte (0x00). */
function hasNullByte(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 0x00) return true;
  }
  return false;
}

/** `true` se `s` contém qualquer control char C0 (<=0x1f) ou DEL (0x7f). */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

function fail(attempted: string, reason: PathTraversalReason): Result<never, PathTraversalError> {
  return err({ kind: "PathTraversal", attempted, reason });
}

/** Drive letter (`C:`) ou UNC (`\\srv`) — `isAbsolute` posix não os apanha. */
function isWindowsAbsolute(p: string): boolean {
  return /^[a-zA-Z]:/.test(p) || p.startsWith("\\\\");
}

/** Decode percent + NFKC. `null` se o percent-encoding for malformado. */
function canonicalize(input: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    return null; // `%` solto ou sequência inválida → tratado como ataque encoded
  }
  return decoded.normalize("NFKC");
}

function escapesBoundary(root: string, candidate: string): boolean {
  const resolved = resolve(root, candidate);
  return resolved !== root && !resolved.startsWith(root + sep);
}

/**
 * Valida `candidate` (path relativo) contra `workspaceRoot`. Devolve o caminho
 * absoluto resolvido (forma literal) em caso de sucesso. Síncrono, sem I/O.
 */
export function sanitizeRelPath(
  workspaceRoot: string,
  candidate: string,
): Result<string, PathTraversalError> {
  // 1. null byte (truncation attack) — prioridade máxima
  if (hasNullByte(candidate)) return fail(candidate, "null-byte");
  // 2. restantes control chars
  if (hasControlChar(candidate)) return fail(candidate, "control-char");

  const root = resolve(workspaceRoot);

  // 3. forma canónica (decode + NFKC) — passagem de DETECÇÃO
  const canonical = canonicalize(candidate);
  if (canonical === null) return fail(candidate, "encoded");
  if (canonical !== candidate) {
    if (hasNullByte(canonical) || hasControlChar(canonical)) {
      return fail(candidate, "encoded");
    }
    if (isAbsolute(canonical) || isWindowsAbsolute(canonical) || escapesBoundary(root, canonical)) {
      return fail(candidate, "encoded");
    }
  }

  // 4. forma literal — passagem de RESOLUÇÃO (o caminho realmente escrito)
  if (isAbsolute(candidate) || isWindowsAbsolute(candidate)) return fail(candidate, "absolute");
  if (escapesBoundary(root, candidate)) return fail(candidate, "relative-escape");

  return ok(resolve(root, candidate));
}
