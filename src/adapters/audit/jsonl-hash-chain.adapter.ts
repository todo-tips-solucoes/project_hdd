/**
 * `jsonl-hash-chain.adapter.ts` — tamper-evident audit JSONL adapter.
 *
 * Story 1.a.6 (AR-060, AR-061, AR-062, AO-14, AO-79, AO-87).
 *
 * Implementa AuditPort:
 *   - `append`: append-atomic 1 linha por evento via O_APPEND syscall
 *     (`fs.openSync(path, 'a')`). Chain integrity via SHA-256 do prev_hash.
 *   - `verifyChain`: re-computa todos os hashes do JSONL diário e valida.
 *
 * **Rotation:** date-based apenas v1 (Q-A6-4). Midnight UTC boundary detecta
 * via `clock.now().toISOString().slice(0,10)`. Quando date muda emite
 * `<old-date>.tsr` (mock JSON stub per Q-A6-3) e reset seq+hash genesis.
 *
 * **State persistence:** `audit_chain_state` table (migration 002). Lido +
 * actualizado em cada append() numa transaction atómica.
 *
 * **Redaction:** NÃO implementada aqui (AR-063 → Story 1.b.3). Caller v1
 * é responsável por sanitizar payload. Doc warning em docs/audit-format.md.
 */

import type { Database } from "bun:sqlite";
import { closeSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from "node:fs";
import { join } from "node:path";
import type { Sha256Hash } from "../../lib/branded.ts";
import { redactPayload } from "../../lib/redaction.ts";
import { err, ok } from "../../lib/result.ts";
import { getRunContext } from "../../lib/run-context.ts";
import type { AuditPort } from "../../ports/audit.port.ts";
import type { ClockPort } from "../../ports/clock.port.ts";

type ChainStateRow = {
  current_date: string;
  last_seq: number;
  last_hash: string;
};

function canonicalPayload(payload: Readonly<Record<string, unknown>>): string {
  // Q-A6-1: flat sort top-level keys. Sufficient v1; JCS deferred.
  const keys = Object.keys(payload).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = payload[k];
  return JSON.stringify(sorted);
}

function computeHash(
  prev: string,
  ts: string,
  seq: number,
  type: string,
  payload: Readonly<Record<string, unknown>>,
): Sha256Hash {
  const input = `${prev}|${ts}|${seq}|${type}|${canonicalPayload(payload)}`;
  return new Bun.CryptoHasher("sha256").update(input).digest("hex") as Sha256Hash;
}

function emitTsrStub(jsonlPath: string, tsrPath: string, tsLocal: string): void {
  const content = readFileSync(jsonlPath);
  const sha = new Bun.CryptoHasher("sha256").update(content).digest("hex");
  const stub = {
    stub_version: 1,
    covered_file: jsonlPath,
    covered_sha256: sha,
    ts_local: tsLocal,
    tsa_real: false,
    note: "TSA real diferida v1.1+ per AR-061",
  };
  const fd = openSync(tsrPath, "w");
  writeSync(fd, JSON.stringify(stub, null, 2));
  closeSync(fd);
}

export function createAuditAdapter(deps: {
  db: Database;
  baseDir: string;
  project: string;
  clock: ClockPort;
}): AuditPort {
  const projectDir = join(deps.baseDir, deps.project);
  mkdirSync(projectDir, { recursive: true });

  const jsonlPath = (date: string): string => join(projectDir, `${date}.jsonl`);
  const tsrPath = (date: string): string => join(projectDir, `${date}.tsr`);

  return {
    append(event) {
      // Story 1.a.9: resolve correlation IDs (explicit > context > error).
      const ctx = getRunContext();
      const runId = event.runId ?? ctx?.runId;
      if (runId === undefined) return err({ kind: "RunIdMissing" });
      const storyId = event.storyId ?? ctx?.storyId;

      try {
        const now = deps.clock.now();
        const date = now.toISOString().slice(0, 10);
        const nowIso = now.toISOString();

        // Lê estado actual (cria se ausente).
        // BUG FIX Story 1.a.10 (2026-05-29): `current_date` é built-in SQL
        // function em SQLite (devolve TODAY). Em SELECT sem quoting, SQLite
        // resolve para a função built-in em vez da coluna → false rotation
        // trigger. Quoting força resolução para coluna.
        let state = deps.db
          .query<ChainStateRow, [string]>(
            'SELECT "current_date", last_seq, last_hash FROM audit_chain_state WHERE project_id = ?',
          )
          .get(deps.project);

        if (state === null) {
          deps.db
            .query(
              "INSERT INTO audit_chain_state (project_id, current_date, last_seq, last_hash, updated_at) VALUES (?, ?, 0, 'genesis', ?)",
            )
            .run(deps.project, date, nowIso);
          state = { current_date: date, last_seq: 0, last_hash: "genesis" };
        }

        // Rotation: date mudou → emite .tsr da anterior + reset
        let prevHash = state.last_hash;
        let seq = state.last_seq;
        if (state.current_date !== date) {
          const oldPath = jsonlPath(state.current_date);
          try {
            statSync(oldPath);
            emitTsrStub(oldPath, tsrPath(state.current_date), nowIso);
          } catch {
            // ficheiro pode não existir se nada foi appended naquele dia
          }
          prevHash = "genesis";
          seq = 0;
        }

        // Story 1.b.3 (AO-160/166): redige secrets ANTES de hash + write
        // (never-store-raw-tokens). Hash e line ambos do payload redigido (AC3).
        const safePayload = redactPayload(event.payload);
        const thisHash = computeHash(prevHash, event.ts, seq, event.type, safePayload);
        const line = JSON.stringify({
          ts: event.ts,
          seq,
          run_id: runId,
          story_id: storyId ?? null,
          type: event.type,
          payload: safePayload,
          prev_hash: prevHash,
          this_hash: thisHash,
        });

        const path = jsonlPath(date);
        const fd = openSync(path, "a"); // 'a' = O_APPEND atomic
        writeSync(fd, `${line}\n`);
        closeSync(fd);

        deps.db
          .query(
            "UPDATE audit_chain_state SET current_date = ?, last_seq = ?, last_hash = ?, updated_at = ? WHERE project_id = ?",
          )
          .run(date, seq + 1, thisHash, nowIso, deps.project);

        return ok({ seq, thisHash, path });
      } catch (cause) {
        return err({ kind: "WriteFailure", cause });
      }
    },

    verifyChain(date) {
      const path = jsonlPath(date);
      let content: string;
      try {
        content = readFileSync(path, "utf8");
      } catch {
        return err({ kind: "FileNotFound", path });
      }

      const lines = content.split("\n").filter((l) => l.length > 0);
      let prevHash = "genesis";
      for (let i = 0; i < lines.length; i++) {
        let parsed: {
          ts: string;
          seq: number;
          type: string;
          payload: Record<string, unknown>;
          prev_hash: string;
          this_hash: string;
        };
        try {
          parsed = JSON.parse(lines[i] ?? "") as typeof parsed;
        } catch (cause) {
          return err({ kind: "ParseFailure", atLine: i, cause });
        }
        if (parsed.prev_hash !== prevHash) {
          return err({
            kind: "ChainBreak",
            atLine: i,
            expected: prevHash,
            actual: parsed.prev_hash,
          });
        }
        const expected = computeHash(
          parsed.prev_hash,
          parsed.ts,
          parsed.seq,
          parsed.type,
          parsed.payload,
        );
        if (expected !== parsed.this_hash) {
          return err({
            kind: "ChainBreak",
            atLine: i,
            expected,
            actual: parsed.this_hash,
          });
        }
        prevHash = parsed.this_hash;
      }
      return ok({ verified: lines.length });
    },
  };
}
