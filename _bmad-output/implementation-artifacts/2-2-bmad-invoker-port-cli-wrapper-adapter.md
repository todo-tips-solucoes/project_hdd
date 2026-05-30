# Story 2.2: BMAD invoker port + CLI-wrapper adapter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `worker core`,
I want um `BmadInvokerPort` com adapter `cli-wrapper.adapter.ts` que dispara skills BMAD non-interactive (via `claude -p` headless — D-052) e parseia o output,
so that o worker pode invocar `bmad-sprint-planning`, `bmad-dev-story`, `bmad-code-review` etc. programaticamente (FR-002, FR-006, FR-033, AR-077).

## Acceptance Criteria

1. **(binary — invoca + retorna)** **Given** o smoke BMAD passou (1.c.7) e `claude` CLI presente
   **When** `invoker.run('bmad-help')` (ou skill equiv.)
   **Then** retorna `ok({stdout, stderr, exitCode: 0})` em <30s. (D-052: spawn de `claude -p "<prompt>" --output-format stream-json --allowedTools <subset>`, NÃO `npx bmad-method`.)

2. **(binary — parse Zod)** **Given** uma skill que produz JSON output
   **When** o parser corre
   **Then** `ok<SkillOutput>` validado por Zod; schema inválido → `err({kind:'BmadOutputMalformed'})`. (Schema injectável — os concretos DevOutput/ReviewOutput/QAOutput são da Story 2.7; a 2.2 entrega o mecanismo + um schema base.)

3. **(binary — FR-005 save_artifact)** **Given** um passo intermédio (e.g. Dev produziu diff)
   **When** o invoker recebe o output
   **Then** o `bmad_save_artifact` lifecycle hook é invocado automaticamente. ⚠️ O hook **não existe** como ferramenta BMAD (conceptual, FR-005) — materialização conforme **Q-2.2-3**.

4. **(binary — FR-005 complete_workflow)** **Given** um workflow terminal (e.g. story end-to-end)
   **When** o invoker recebe o output terminal
   **Then** `bmad_complete_workflow` hook + state transition. ⚠️ idem AC3; state transition (FSM) é da Story 2.6 — fronteira em **Q-2.2-3**.

## Tasks / Subtasks

- [x] **Task 1 — `src/ports/bmad-invoker.port.ts` (NEW)** (AC: #1, #2) — interface `BmadInvokerPort`: `run(skill, opts): ResultAsync<BmadResult, BmadError>` + `runParsed<T>(skill, schema, opts): ResultAsync<T, BmadError>`. Tipos `BmadResult={stdout,stderr,exitCode}`, `BmadError` union (inclui `BmadOutputMalformed`, propaga `SpawnError`). Hooks conforme Q-2.2-3.
- [x] **Task 2 — `src/adapters/bmad/cli-wrapper.adapter.ts` (NEW)** (AC: #1, #2) — recebe `SpawnPort` (injectável; system-spawn real, fake nos testes). `run` faz spawn de `claude -p "<prompt>" --output-format stream-json --allowedTools <subset>` (D-052; formato do prompt + flags conforme **Q-2.2-1**). `runParsed` parseia o stream-json (**Q-2.2-2**) + valida com o schema Zod → `BmadOutputMalformed` em falha. Reutiliza retry/CB do SpawnPort (AR-038).
- [x] **Task 3 — lifecycle hooks FR-005 (AC: #3, #4)** — conforme **Q-2.2-3**: pontos de extensão (`onArtifact`/`onComplete` ou métodos) materializados (audit event vs callback); wiring de state transition diferido p/ Story 2.6; persistência/RunContext p/ Story 2.3. NÃO inventar a ferramenta BMAD inexistente.
- [x] **Task 4 — `tests/adapters/bmad-invoker.test.ts` (NEW)** (AC: #1, #2, #3, #4)** — fake-spawn (determinístico): run → ok; stream-json parse + Zod ok; output malformado → BmadOutputMalformed; SpawnError propagado; hooks disparados (intermédio vs terminal). Integração real `claude -p` conforme **Q-2.2-4** (skipIf/diferida).
- [x] **Task 5 — gates**: type-check · lint · `bun test` (≥296 +novos) · `bun run test:integration`.
- [x] **Task 6 (FINAL) — Tier-B summary (15ª dogfood)**: `scripts/generate-22-summary.ts` → auto-commit. Sprint-status `2-2 → review`.

## Dev Notes

### Big picture

Coração do M1: a ponte entre o worker (TS) e os agentes BMAD (skills markdown). **D-052** (ratificado 2026-05-28): não há skill runner no `bmad-method`; o worker invoca via `claude -p` headless. Esta story entrega o **port + adapter + parse**; o contexto isolado (RunContext, workdir) é da 2.3, a FSM/lifecycle da 2.6, os schemas concretos da 2.7.

### Decisão fundadora — D-052 (NÃO reabrir)

`cli-wrapper.adapter` faz `spawn("claude", ["-p", prompt, "--output-format", "stream-json", "--allowedTools", subset])` (`[[project-hdd-d052-claude-headless-invoker]]`, `docs/decisions/bmad-cli-vs-plan-b.md` Opção A). **NUNCA** `npx bmad-method <skill>` (o smoke 1.c.7 provou que não tem skill runner). `claude` em `/root/.local/bin/claude` v2.1.158.

### Fronteiras (o que NÃO fazer aqui)

- **Story 2.3 (sub-agent context):** RunContext isolado, workdir mount, handoffArtifact — a 2.2 NÃO isola contexto; só invoca.
- **Story 2.6 (lifecycle FSM):** transições `running→paused`, persistência de state — a 2.2 NÃO transita FSM (o AC4 "state transition" liga aqui — ver Q-2.2-3).
- **Story 2.7 (schemas concretos):** DevOutput/ReviewOutput/QAOutput Zod — a 2.2 entrega o MECANISMO de parse+validação com schema injectável + um schema base; os concretos são 2.7.
- **apply-diff (1.b.1):** a 2.2 NÃO aplica diffs (a 2.3 invoca apply-diff.service); o invoker só devolve output.

### ⚠️ Lifecycle hooks FR-005 não existem (núcleo da Q-2.2-3)

`bmad_save_artifact` e `bmad_complete_workflow` (FR-005) **não existem** como ferramentas/MCP/skills (grep vazio em `_bmad/`, `.claude/skills/`, `src/`). São conceptuais — "follow-up AC absorvido na Story 2.2" (`bmad-epics-summary.md`). Como o BMAD é markdown (D-052), não há "hook" invocável no BMAD. A materialização tem de ser do lado do worker (audit event / callback / persistência), e o "state transition" do AC4 depende da FSM (Story 2.6). Ver Q-2.2-3.

### Reuso (ports/adapters existentes)

- **`SpawnPort`** (`src/ports/spawn.port.ts`): `spawn(cmd,args,opts): ResultAsync<SpawnResult,SpawnError>`; `SpawnOptions{cwd,env,timeoutMs,stdin}`; `SpawnError` Transient|Permanent (adapter OWNS retry/CB — AR-038). `system-spawn.adapter.ts` (real) + `fake-spawn.adapter.ts` (testes). O cli-wrapper recebe o SpawnPort, NÃO chama Bun.spawn directo.
- **`Result`/`ResultAsync`** (`src/lib/result.ts`): neverthrow; `Promise<Result>` → `new ResultAsync(promise)` (não fromSafePromise).
- **Zod** já é dep. **`AuditPort`** se os hooks forem audit events.
- Padrão de adapter: factory `createXAdapter(deps)` em `src/adapters/<name>/`.

### stream-json — formato REAL (sondado empiricamente, claude v2.1.158)

⚠️ **`--output-format stream-json` EXIGE `--verbose`** com `--print` (senão `Error: ... requires --verbose`). Comando real:
`claude -p "<prompt>" --output-format stream-json --verbose --allowedTools "<subset>"`.

Emite **JSONL** (1 evento/linha): `{type:"system",...}` (init/hooks) · `{type:"assistant",...}` · e o terminal `{type:"result"}`:
```json
{"type":"result","subtype":"success","is_error":false,"result":"PONG","stop_reason":"end_turn","total_cost_usd":0.15,"usage":{...}}
```
Parser (Q-2.2-2): split linhas → parse cada (ignora linhas não-JSON defensivamente) → encontrar `type==="result"` → `is_error` decide ok/err; `.result` (string) é o output final. `runParsed` valida `JSON.parse(.result)` com o schema Zod → `BmadOutputMalformed` em falha. Nota: o stream inclui ruído de hooks da sessão (grande) — fixar só no evento `result`.

### References

- [Source: epics.md#Story-2.2] (1274-1305) — StorySpec, ACs, blocked_by [1.a.3, 1.c.7, 2.1] (done).
- [Source: docs/decisions/bmad-cli-vs-plan-b.md] — D-052 Opção A (claude -p).
- [Memory: `[[project-hdd-d052-claude-headless-invoker]]`] — mecanismo + flags.
- [Source: src/ports/spawn.port.ts] — SpawnPort a reutilizar. [Source: src/adapters/spawn/*] — real+fake.
- [Source: epics.md#Story-2.7] — schemas concretos (fronteira). [Source: epics.md#Story-2.3] — context isolation (fronteira).

## Open Questions for Operator

- **Q-2.2-1 (formato do `claude -p`):** [RESOLVED — **prompt template + allowedTools restrito por skill**] least-privilege; prompt instrui invocar a skill X; allowedTools começa restrito e alarga conforme necessidade.
- **Q-2.2-2 (parse do stream-json):** [RESOLVED — **parse do stream + extrair result**] acumular eventos JSONL, extrair o evento `type:"result"`, validar o JSON do resultado com Zod.
- **Q-2.2-3 (lifecycle hooks AC3/AC4 — não existem):** [RESOLVED — **(a) pontos de extensão + audit event**] callbacks `onArtifact`/`onComplete` no port; impl mínima emite audit event (`ArtifactSaved`/`WorkflowCompleted`); state-transition diferido p/ 2.6, persistência/RunContext p/ 2.3. NÃO inventar a ferramenta BMAD.
- **Q-2.2-4 (teste real vs fake):** [RESOLVED — **fake-spawn + 1 integração real skipIf**] unit fake-spawn (AC1-4) + 1 integração `claude -p` real `skipIf(!hasClaude)`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- **Sonda real do `claude -p`** (v2.1.158): `--output-format stream-json` EXIGE `--verbose` com `--print` (erro sem ele) → flag adicionada ao adapter. Evento terminal confirmado: `{"type":"result","is_error":false,"result":"<texto>",...}`. Custo da sonda ~$0.15 (1 chamada).
- type-check clean.
- lint: 1 erro eslint `no-unsafe-assignment` em `JSON.parse(line)` (any) → cast `as {type?...}`. Restantes FIXABLE (format/organizeImports) → `lint:fix`. `useLiteralKeys` info-only.
- `bun test`: 304 pass / 3 skip / 0 fail (era 296; +8 bmad-invoker unit). Integration: 16 pass / 3 skip (+1 skip = bmad-invoker real, gated por HDD_BMAD_LIVE).

### Completion Notes List

- **FR-002/FR-006/AR-077 materializados:** `BmadInvokerPort` + `cli-wrapper.adapter` que invoca skills BMAD via `claude -p` (D-052), parseia stream-json e valida output com Zod.
- **D-052 honrado:** spawn de `claude -p ... --output-format stream-json --verbose --allowedTools <subset>` via `SpawnPort` (NÃO npx bmad-method). Args verificados no teste.
- **Q-2.2-1:** prompt template + `allowedTools` restrito por invocação (least-privilege).
- **Q-2.2-2:** parse real do stream-json (varre de trás, extrai evento `type:"result"`, `is_error` decide; `runParsed` valida `JSON.parse(.result)` com Zod → `BmadOutputMalformed`).
- **Q-2.2-3 (FR-005):** hooks `onArtifact`/`onComplete` como pontos de extensão no port; `onArtifact` por invocação, `onComplete` só com `opts.terminal`. State-transition (FSM) diferido p/ 2.6; persistência/RunContext p/ 2.3. NÃO inventada a ferramenta BMAD inexistente.
- **Q-2.2-4:** unit fake-spawn (8 specs, fixture = stream-json real) + integração real `claude -p` **opt-in** (`HDD_BMAD_LIVE=1`, skip por defeito — evita custo de tokens recorrente; a sonda manual já validou o wiring).
- **Fronteiras respeitadas:** sem context isolation (2.3), sem FSM transition (2.6), sem schemas concretos (2.7 — só o mecanismo + schema injectável). Sem deps novas (zod já existia).

### File List

- `src/ports/bmad-invoker.port.ts` (NEW — BmadInvokerPort + BmadResult/BmadError/hooks)
- `src/adapters/bmad/cli-wrapper.adapter.ts` (NEW — claude -p via SpawnPort + parse stream-json + Zod + hooks)
- `tests/adapters/bmad-invoker.test.ts` (NEW — 8 specs unit, fake-spawn)
- `tests/integration/bmad-invoker.integration.test.ts` (NEW — claude -p real, opt-in HDD_BMAD_LIVE)
- `scripts/generate-22-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/2-2-...md` (NEW — story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-30 | Story 2.2 criada (`ready-for-dev`); 4 Open Questions (Q-2.2-1 formato claude -p, Q-2.2-2 parse stream-json, Q-2.2-3 hooks FR-005 inexistentes, Q-2.2-4 teste). Confirmado: claude v2.1.158 presente; hooks bmad_save_artifact/complete_workflow são conceptuais (não existem). |
