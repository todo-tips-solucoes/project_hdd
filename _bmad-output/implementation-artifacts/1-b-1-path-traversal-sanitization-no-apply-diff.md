# Story 1.b.1: Path traversal sanitization no apply-diff

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `Dev sub-agent`,
I want `apply-diff` que valida paths absolutos contra o workspace boundary (resolve + realpath + `startsWith`) antes de qualquer write,
so that diff gerado por LLM não consegue escrever fora do workspace nem via `../`, symlink, absolute, encoded ou null-byte (AO-158 + AO-165, DRB BLOCKER #3).

## Acceptance Criteria

1. **(binary — AO-158)** **Given** workspace boundary (e.g. `/var/lib/projeto_hdd`)
   **When** um write tem path `../../etc/passwd` OU `/etc/passwd` OU symlink-traversal (`<ws>/link → /etc`)
   **Then** retorna `err({ kind: 'PathTraversal', attempted: <path>, reason: <…> })` **e** emite audit event `type: "SecurityViolation"` — nenhum byte é escrito fora do workspace.

2. **(coverage — Pentest path-traversal suite, 15 payloads)** **Given** suite com 15 payloads cobrindo as 5 categorias (relative, absolute, encoded/Unicode, symlink, null-byte/control-char)
   **When** corro `bun run test:security` (alias para `tests/services/apply-diff.security.test.ts`)
   **Then** 15/15 payloads são rejeitados (zero falsos-negativos) e um path legítimo dentro do workspace é aceite (1 caso de controlo positivo).

3. **(binary — perf budget)** **Given** o benchmark do test suite de segurança
   **When** comparo o tempo de CI/`bun test` antes vs depois desta story
   **Then** ΔCI ≤ 10s (sanitização é hot-path por write; não pode introduzir overhead material).

4. **(binary — happy path)** **Given** path relativo legítimo dentro do workspace (e.g. `src/foo.ts`)
   **When** `applyDiff`/`safeWrite` é chamado
   **Then** retorna `ok(...)` com o caminho resolvido absoluto sob o workspace e o conteúdo é escrito; nenhum audit `SecurityViolation` é emitido.

## Tasks / Subtasks

- [x] **Task 1 — `src/lib/path-sanitize.ts` (lexical, síncrono, puro)** (AC: #1, #2)
  - [x] `sanitizeRelPath(workspaceRoot, candidate): Result<string, PathTraversalError>` — sem I/O.
  - [x] Rejeitar null byte (0x00 via `hasNullByte`) e control chars (<=0x1f, 0x7f via `hasControlChar`, por `charCodeAt` — sem embeber bytes no source) → `reason: 'null-byte'` / `'control-char'`.
  - [x] Decode-once percent + NFKC (`canonicalize`); rejeitar se a forma canónica introduzir escape/absolute/control → `reason: 'encoded'` (Q-B1-2).
  - [x] Rejeitar absolute paths (`isAbsolute` + `isWindowsAbsolute` para `C:`/`\\` em posix) → `reason: 'absolute'`.
  - [x] `resolve(root, candidate)` + assertion `=== root || startsWith(root + sep)` (AO-158). Falha → `reason: 'relative-escape'`. Resolve a forma LITERAL (não a decodificada).
  - [x] Devolver `ok(resolved)`. Sem `throw` (AO-66).
- [x] **Task 2 — `src/services/apply-diff.service.ts` (camada fs + audit)** (AC: #1, #4)
  - [x] Factory `createApplyDiffService(deps: { workspaceRoot, audit, clock })`.
  - [x] `applyWrite(relPath, contents): ResultAsync<{ path }, ApplyDiffError>`.
  - [x] Passo 1: `sanitizeRelPath` lexical → em `err`, `emitViolation` + propagar.
  - [x] Passo 2: **realpath anti-symlink (AO-165)** — `assertRealpathWithin` resolve o prefixo existente mais longo do alvo (incl. o próprio target) e reasserta o boundary canónico. Falha → `reason: 'symlink-escape'` + audit.
  - [x] Passo 3: write atómico (`mkdir -p` + `writeFile`) só após ambas as assertions.
  - [x] `emitViolation` → `audit.append({ ts: clock.now().toISOString(), type: "SecurityViolation", payload: { attempted, reason } })`.
- [x] **Task 3 — Serialização de file ops (AO-165, Q-B1-4 = agora)** (AC: #1)
  - [x] Promise-chain mutex por instância (`chain = next.then(noop,noop)`) — serializa `applyWrite` concorrentes; sobrevive a rejeições.
- [x] **Task 4 — `tests/services/apply-diff.security.test.ts` (Pentest suite)** (AC: #2, #4)
  - [x] 15 payloads (3×5 categorias) + 2 happy-path (write legítimo + serialização). Control chars via `String.fromCharCode`.
  - [x] Symlinks reais via `symlinkSync` em tmpdir (dir→/etc, dir→/tmp, target directo→/etc/hosts).
  - [x] Fake `AuditPort` em-memória; assert `SecurityViolation` por rejeição; `createTestClockAdapter`.
- [x] **Task 5 — alias `bun run test:security`** (AC: #2) — adicionado a `package.json`.
- [x] **Task 6 — gates**: `type-check` clean · `lint` exit 0 · `bun test` 172 pass/0 fail.
- [x] **Task 7 (FINAL) — Tier-B summary via generator (3ª dogfood)**: `scripts/generate-1b1-summary.ts` + `finalize()` (trim agressivo O-A9-5) → auto-commit `summary(story-1b1): ...`. Sprint-status `1-b-1 → review`.

## Dev Notes

### Big picture

Esta é a **1ª das 5 stories do Epic 1.b (Safety BLOCKERS)** e a **3ª das 4 Sprint-0 Hard Conditions do DRB** (C2 — AO-164/165/166). Path traversal é o vector #3 da matriz de composição AI-Safety+Pentester: qualquer string de path que atravesse a fronteira LLM→filesystem (output de diff, payload de skill BMAD, webhook) tem de ser sanitizada antes de tocar no disco. O alvo concreto é o `apply-diff` — o ponto onde código gerado por LLM é materializado no workspace.

### Scope delimitation (LER — evita over-build)

- **IN-SCOPE:** o **path-safety gate** do apply-diff (sanitização lexical + realpath + `startsWith` + audit `SecurityViolation`) e um entry-point fino `applyWrite(relPath, contents)` que escreve **só** depois das assertions. Cobre AO-158 (lexical) + AO-165 (realpath/control-char/serialização).
- **OUT-OF-SCOPE (stories futuras):** parsing completo de unified-diff/patch (hunks, context lines, fuzzy matching) — esta story valida o **destino** do write, não a gramática do diff; `tmpfs mount` do AO-165 (deployment/systemd, não código); docker `-v` arg injection (AO-174/PT-3 — story de sandbox 1.b.4). O nome do título "**no apply-diff**" significa: NÃO herdar path resolution do utilitário `apply-diff` de terceiros (vulnerável per PR-mortem); construímos a nossa própria gate.

### AO / requirement matrix

| Código | Obrigação | Onde nesta story |
|---|---|---|
| **AO-158** 🚨 BLOCKER | `path.resolve` + `startsWith` assertion antes de `writeFile` LLM-generated; falha = abort + P1 | `path-sanitize.ts` (lexical resolve+startsWith) + audit `SecurityViolation` |
| **AO-165** | per-run workspace check + **realpath** + reject control chars/null bytes + **serialização** file ops (+ tmpfs mount → out-of-scope) | `apply-diff.service.ts` realpath + Task 3 mutex + control-char reject em `path-sanitize.ts` |
| **AR-072 / NFR-S3** (epics-only codes) | rótulos epics-level; canon = AO-158/165 (lesson O-A6-6 — reconciliar em `docs:` futuro) | nota de reconciliação |
| **Pentest path-traversal suite** | 15 payloads, 5 categorias | `apply-diff.security.test.ts` (Task 4) |

> **⚠️ Divergência de numeração PT (apanhada na criação):** o epics StorySpec rotula este suite como "PT-2", mas `architecture.md:1972` define **PT-2 = egress firewall / `curl evil.com`** e **PT-3 = docker `-v` realpath + `../../../etc`**. O doc canónico `docs/pre-m1-pentest-tasks.md` ainda **não existe**. Resolução: implementar o suite de path-traversal (o que o AC descreve materialmente) independente do label numérico; criar follow-up para reconciliar a numeração PT quando o doc for materializado.

### Esboços de tipos

```ts
// src/lib/path-sanitize.ts
export type PathTraversalReason =
  | "relative-escape" | "absolute" | "control-char"
  | "null-byte" | "encoded" | "symlink-escape";

export type PathTraversalError = {
  readonly kind: "PathTraversal";
  readonly attempted: string;
  readonly reason: PathTraversalReason;
};

export function sanitizeRelPath(
  workspaceRoot: string,
  candidate: string,
): Result<string, PathTraversalError>; // síncrono, sem I/O

// src/services/apply-diff.service.ts
export type ApplyDiffError =
  | PathTraversalError
  | { readonly kind: "WriteFailure"; readonly cause: unknown };

export interface ApplyDiffService {
  applyWrite(relPath: string, contents: string): ResultAsync<{ path: string }, ApplyDiffError>;
}

export function createApplyDiffService(deps: {
  workspaceRoot: string;
  audit: AuditPort;
  clock: ClockPort;
}): ApplyDiffService;
```

### Previous story intelligence (Epic 1.a, 10/10 done)

- **1.a.6 (audit):** `AuditPort.append({ ts, type, payload })` síncrono → `Result<…, AuditError>`. `runId` é opcional — o adapter lê de `getRunContext()` (1.a.9). **Não** passar `runId` explícito a menos que fora de contexto. Eventos existentes são PascalCase (`ProcessStarted`/`ProcessStopped`) → `SecurityViolation` é consistente.
- **1.a.3 (clock):** `ClockPort.now()` → ISO string; `createTestClockAdapter` para tests determinísticos.
- **1.a.9 (run-context):** `withRunContext` propaga `runId` cross-async — o write/audit corre dentro do contexto do run.
- **1.a.2 (result/branded):** `Result<T,E>` síncrono de `src/lib/result.ts`; `ResultAsync` só onde há async genuíno (realpath/writeFile → `node:fs/promises`). `err`/`ok` re-exportados.
- **Padrão service:** `idempotency.service.ts` + `summary-generator.service.ts` usam **factory functions** com deps injectadas (não classes). Seguir.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** confiar só em `startsWith` lexical sem realpath — symlink escapa (`<ws>/link → /etc` resolve lexicalmente dentro do ws). AO-165 exige realpath.
- ❌ **NÃO** usar `startsWith(workspaceRoot)` sem `+ path.sep` — `/var/lib/projeto_hdd-evil` passaria. Usar `=== root || startsWith(root + sep)`.
- ❌ **NÃO** `throw` em path inválido — devolver `err` (AO-66; path malicioso é input esperado, não programmer error).
- ❌ **NÃO** escrever para disco antes de **ambas** as assertions (lexical + realpath) passarem (TOCTOU: validar o realpath do **pai** e escrever sem re-resolver via path arbitrário).
- ❌ **NÃO** ler workspace root de env dentro da lib — injectar via deps (testável com `mkdtempSync`).
- ❌ **NÃO** importar adapters em `src/lib/` ou `src/core/`; `apply-diff.service.ts` é shell layer (pode importar ports + lib).
- ❌ **NÃO** exceder `maxLines: 200` por ficheiro (Biome HARD em `src/**`) — split se necessário.

### Project Structure Notes

- `src/lib/path-sanitize.ts` (NEW, puro) · `src/services/apply-diff.service.ts` (NEW, shell) · `tests/services/apply-diff.security.test.ts` (NEW). `files_modified: package.json` (alias `test:security`). Alinhado com layout canónico (lib=puro, services=shell).
- `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` em vigor: cuidado com array access e optional fields (`reason: T | undefined` vs omitir).
- `process.env` não tocado nesta story (workspace root via deps).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.b.1] — StorySpec, ACs, files_created, blocked_by [1.a.3, 1.a.6].
- [Source: _bmad-output/planning-artifacts/architecture.md:1933] — AO-158 (resolve+startsWith antes de writeFile).
- [Source: _bmad-output/planning-artifacts/architecture.md:1945] — AO-165 (realpath + control chars + serialização + tmpfs).
- [Source: _bmad-output/planning-artifacts/architecture.md:1970-1978] — PT-1..PT-8 (divergência de numeração).
- [Source: _bmad-output/planning-artifacts/architecture.md:1993] — DRB C2 (AO-164/165/166 BLOCKER).
- [Source: src/ports/audit.port.ts] — AuditEntry/append.
- [Source: src/lib/run-context.ts] — getRunContext.

## Open Questions for Operator

- **Q-B1-1 (error model):** [RESOLVED — kind único `{ kind:'PathTraversal', attempted, reason }`] Operador delegou; escolha por melhor prática: uma falha de path é uma categoria de erro de domínio (idiom neverthrow, satisfaz AC literal, enriquece audit).
- **Q-B1-2 (encoded/Unicode aggressiveness):** [RESOLVED — decode-once percent + NFKC, rejeitar só se introduzir escape/control] Canonicalizar-depois-validar; O(n) desprezível; evita falsos-positivos em nomes legítimos.
- **Q-B1-3 (scope do apply-diff):** [RESOLVED — gate + `applyWrite(relPath, contents)` fino] YAGNI; nenhum AC testa gramática de diff; parser fica para story futura.
- **Q-B1-4 (serialização AO-165):** [RESOLVED — mutex/queue async in-process agora] AO-165 exige; promise-chain mutex minúsculo elimina TOCTOU; custo nulo (I/O-bound).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `bun run type-check` → 1 erro inicial: `ResultAsync.fromSafePromise(Promise<Result>)` não achata → trocado por `new ResultAsync(next)`. Clean depois.
- `bun run test:security` → 17 pass / 0 fail (15 payloads + 2 happy-path).
- `bun test` (full) → 172 pass / 0 fail (was 155; +17). Os "error: required option" são output esperado dos testes Commander (1.a.8), não falhas.
- `bun run lint` → exit 0 (21 infos `useLiteralKeys` pré-existentes; ficheiros novos limpos).
- Gotcha resolvido 2×: o Write tool inseria control chars literais quando eu os escrevia no source → resolvido detectando por `charCodeAt` (lib) e `String.fromCharCode` (tests), zero bytes de control no source.

### Completion Notes List

- **AO-158** (resolve + startsWith antes de write) e **AO-165** (realpath + control-char reject + serialização) ambos materializados. tmpfs mount do AO-165 fica out-of-scope (deployment/systemd).
- **Design 2-passagens** (Q-B1-2): detecção na forma canónica (decode+NFKC) + resolução na forma literal. Valida que `..%2fpasswd` (raw passa, decoded escapa) é apanhado como `encoded` — pattern confirmado por teste.
- **Boundary `+ sep`**: `=== root || startsWith(root + sep)` evita o bypass `/ws-evil` por prefix de `/ws`.
- **Anti-symlink**: `assertRealpathWithin` resolve o prefixo existente mais longo (incl. o próprio target) — apanha tanto symlink-dir-sob-o-link como target-é-symlink.
- **Mutex** (Q-B1-4): promise-chain por instância; `next.then(noop,noop)` mantém o mutex vivo após rejeições. Teste de 3 writes concorrentes verde.
- **Divergência PT apanhada**: epics diz "PT-2"; architecture tem PT-2=egress/PT-3=docker. Implementado o suite material; follow-up O-B1-1 reconcilia.

### File List

- `src/lib/path-sanitize.ts` (NEW, ~110 linhas — lexical puro)
- `src/services/apply-diff.service.ts` (NEW, ~135 linhas — fs + realpath + mutex + audit)
- `tests/services/apply-diff.security.test.ts` (NEW, ~165 linhas — 17 specs)
- `package.json` (MODIFIED — alias `test:security`)
- `scripts/generate-1b1-summary.ts` (NEW — dogfood summary generator)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED — 1-b-1 + epic-1b)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-29 | Story 1.b.1 criada (`ready-for-dev`); 4 Open Questions resolvidas pelo operador (delegadas → Recommended). |
| 2026-05-29 | Implementação completa: `path-sanitize.ts` + `apply-diff.service.ts` + suite de 17 specs; type-check/lint/test verdes; AO-158+AO-165 materializados. Status → `review`. |
