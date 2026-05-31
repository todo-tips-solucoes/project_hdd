# Story 2.7: DevOutput / ReviewOutput / QAOutput schemas concretos

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `BMAD invoker`,
I want schemas Zod concretos para `DevOutput`, `ReviewOutput`, `QAOutput` em `src/ports/sub-agent-outputs.port.ts`,
so that o parsing do output dos sub-agents é type-safe e desvios do BMAD CLI são detectados em runtime.

## Acceptance Criteria

1. **(binary — SchemaDrift)** **Given** o schema `DevOutput` definido conforme Architecture Step 06
   **When** o Dev sub-agent retorna JSON com um campo extra inesperado
   **Then** o Zod em `strict` mode rejeita, mapeado para `err({kind:'SchemaDrift', field:<field>})` (campo = a chave não reconhecida).

2. **(binary — enum rejeitado)** **Given** o schema `ReviewOutput` com `verdict` enumerado (valores conforme **Q-2.7-1**)
   **When** o sub-agent retorna um `verdict` fora do enum (e.g. `'unsure'`)
   **Then** o schema rejeita.

3. **(binary — happy path + QAOutput)** **Given** JSON conforme a cada schema (Dev/Review/QA, Architecture Step 06)
   **When** o parse corre
   **Then** retorna `ok<DevOutput|ReviewOutput|QAOutput>` com os tipos inferidos; `QAOutput` com `verdict`/campos próprios valida igualmente.

4. **(binary — adapter usa schemas)** **Given** o `cli-wrapper.adapter` (2.2)
   **When** invoca um sub-agent tipado
   **Then** usa os schemas concretos (Q-2.7-2) — o `runParsed` genérico passa a ter wrappers/uso tipado, sem alterar `BmadError`/`bmad-invoker.port`.

## Tasks / Subtasks

- [x] **Task 1 — `src/ports/sub-agent-outputs.port.ts` (NEW)** (AC: #1-#3) — 3 schemas Zod `.strict()` (Q-2.7-3) conforme Architecture Step 06: `devOutputSchema` (extended, 13 campos), `reviewOutputSchema` (verdict formal AO-106 + `reviewIssueSchema`), `qaOutputSchema` (12 campos Round 2). Tipos inferidos `DevOutput`/`ReviewOutput`/`QAOutput`/`ReviewIssue`. Nested objects também `.strict()`. 122 linhas.
- [x] **Task 2 — `SchemaDrift` parse helper (AC: #1)** — `SubAgentOutputError = SchemaDrift{field} | SchemaInvalid{detail}` + `parseSubAgentOutput<T>(schema, raw)`. Issue Zod `unrecognized_keys` → `SchemaDrift{field: keys[0]}`; outros → `SchemaInvalid{detail}`. No port. Sem `throw`.
- [x] **Task 3 — `src/adapters/bmad/cli-wrapper.adapter.ts` (MODIFY — use schemas)** (AC: #4) — Q-2.7-2: importa os 3 schemas; `runParsed` extraído p/ const; `CliWrapperInvoker extends BmadInvokerPort` + wrappers `runDevOutput`/`runReviewOutput`/`runQaOutput` que delegam em `runParsed`. `BmadError`/`bmad-invoker.port` **intactos**.
- [x] **Task 4 — `tests/ports/sub-agent-schemas.test.ts` (NEW)** (AC: #1-#3) — AC1 SchemaDrift{field} (top-level + nested); AC2 verdict 'unsure'/'pass' reject + 4 verdicts formais aceites; AC3 happy path 3 schemas + lineCount string→SchemaInvalid + retryOwnership enum; AC4 wrappers do adapter (fake spawn). 10 specs.
- [x] **Task 5 — gates**: type-check clean · lint exit 0 · `bun test` 351 pass / 3 skip / 0 fail (+10) · integração 16 pass / 3 skip.
- [x] **Task 6 (FINAL) — Tier-B summary (20ª dogfood)**: `scripts/generate-27-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-2-7): …` (`c854657`, Tier-B **523 words** ≤715). `workflowId: "story-2-7"`. Sprint-status `2-7 → review`. **Fecha o Epic 2 (7/7).**

## Dev Notes

### Big picture

Última story do Epic 2: dá tipos concretos ao mecanismo de parse da 2.2. A 2.2 entregou `runParsed<T>(skill, schema)` com schema **injectável** + um base; a 2.7 define os 3 schemas **formais** (Architecture Step 06, AR-050/051/052) e liga-os ao adapter. Resultado: o output de Dev/Review/QA é validado em runtime e desvios do BMAD CLI (campos extra, enums inválidos) são apanhados como `SchemaDrift`/rejeição em vez de propagarem silenciosamente.

### Reuso (NÃO reinventar)

- **`cli-wrapper.adapter.ts`** (2.2): `runParsed<T>(skill, schema, opts): ResultAsync<T, BmadError>` já valida JSON com Zod (`safeParse` → `BmadOutputMalformed`). A 2.7 fornece os schemas concretos + wrappers tipados. **NÃO** mexer em `bmad-invoker.port.ts`/`BmadError` (fora de files_modified).
- **`bmad-invoker.port.ts`** (2.2): `BmadError` union, `runParsed`. **Architecture Step 06** (`architecture.md` ~1036, 1689-1735): shapes formais de DevOutput/ReviewOutput/QAOutput.
- **zod** (já dep): `.strict()` → issue `unrecognized_keys` (com `keys`); `z.enum` → `invalid_enum_value`. `z.infer<typeof schema>` p/ os tipos.
- **`Result`** (neverthrow). Padrão: ports em `src/ports/*.port.ts`. `branded.ts` (`StoryId`) — schema usa `z.string()` (branding aplicado na construção, não no parse).

### Fronteiras (o que NÃO fazer aqui)

- **Story 2.3 (sub-agent-runner):** tem um `devOutputSchema` **base** local (`{files:[{path,contents}]}`). A 2.7 **não** modifica a 2.3 (`files_modified` só lista cli-wrapper). O schema concreto da 2.7 é o canónico do port; a reconciliação (2.3 importar o concreto) fica como open item (Q-2.7-4). NÃO tocar `sub-agent-runner.service.ts`.
- **Pipeline runtime:** quem consome os schemas (gates 2.4/2.5, FSM 2.6) já existe; a 2.7 só entrega os contratos. **Não** re-wire o pipeline.
- **P1 trigger criteria / gap detector** (architecture 1040-1070): lógica de decisão sobre o `ReviewOutput` é de Epic 4/5 — a 2.7 só define o **schema**, não a lógica.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-2.7-1 [RESOLVED — (a) seguir a arquitectura]:** `verdict = 'APPROVED'|'APPROVED_WITH_WARNINGS'|'REJECTED'|'BLOCKED_P1'` (Step 05/06, AO-106; alinha com os 6 P1-trigger criteria). O literal `pass|fail-gap|fail-bug` da AC2 do epics era um esboço superado. AC2 ("rejeita `unsure`") continua válida. **Divergência registada em AI-S0-4.**
- **Q-2.7-2 [RESOLVED — (a) helper no port + wrappers tipados]:** `parseSubAgentOutput<T>(schema, raw)` (no port) mapeia `unrecognized_keys → SchemaDrift{field}` (testado directamente, AC1); o adapter ganha `runDevOutput`/`runReviewOutput`/`runQaOutput` via `runParsed`. `BmadError`/`bmad-invoker.port` **intactos**.
- **Q-2.7-3 [RESOLVED — (a) shape completa do Step 06]:** DevOutput extended (campos QA Round 2), QAOutput completo, ReviewOutput completo; todos `.strict()`; `storyId: z.string()`.
- **Q-2.7-4 [RESOLVED — (a) deferir]:** a 2.3 mantém o seu `devOutputSchema` base; a 2.7 entrega o concreto no port. **NÃO** tocar `sub-agent-runner.service.ts`. Reconciliação = open item O-2.7-1 (story futura).

### Project Structure Notes

- `files_created`: `src/ports/sub-agent-outputs.port.ts`, `tests/ports/sub-agent-schemas.test.ts`. `files_modified`: `src/adapters/bmad/cli-wrapper.adapter.ts`.
- A arquitectura sugeria 3 ficheiros (`dev-output.port.ts`/`reviewer.port.ts`/`qa-output.port.ts`); o epics consolida num só `sub-agent-outputs.port.ts` — seguir o epics (1 ficheiro). Biome `maxLines:200` HARD → se os 3 schemas + helper passarem 200 linhas, **dividir** (registar como divergência). `ao_subset`: AR-050, AR-051, AR-052.
- **Divergência Q-2.7-1** (verdict spec vs arquitectura) a registar em `readiness-open-items.md` (AI-S0-4).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.7] (linhas 1415-1432 — StorySpec + ACs)
- [Source: _bmad-output/planning-artifacts/architecture.md] (1036 ReviewOutput · 1689-1714 DevOutput extended · 1716-1733 QAOutput · AR-050/051/052)
- [Source: src/adapters/bmad/cli-wrapper.adapter.ts] (2.2 — runParsed + safeParse) · [Source: src/ports/bmad-invoker.port.ts] (BmadError — NÃO tocar)
- [Source: src/services/sub-agent-runner.service.ts] (2.3 — base devOutputSchema; NÃO tocar)
- [Source: tests/adapters/bmad-invoker.test.ts] (padrão de teste de schema com zod)
- Story anterior: `_bmad-output/implementation-artifacts/2-6-...md` · readiness-open-items.md (AI-S0-4)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0.
- `bun test` → 351 pass / 3 skip / 0 fail (era 341; +10). `bmad-invoker.test.ts` (2.2) intacto (BmadError/runParsed inalterados).
- `bun run test:integration` → 16 pass / 3 skip.

### Completion Notes List

- **AC1 (SchemaDrift):** schemas `.strict()` (incl. nested) → campo extra produz issue `unrecognized_keys`; `parseSubAgentOutput` mapeia para `SchemaDrift{field}` (1ª chave). Testado top-level e aninhado.
- **AC2 (verdict):** `verdict:'unsure'` **e** `verdict:'pass'` (esboço epics) ambos rejeitados; os 4 verdicts formais (`APPROVED|APPROVED_WITH_WARNINGS|REJECTED|BLOCKED_P1`) aceites. Segue a arquitectura (Q-2.7-1=a).
- **AC3:** Dev/Review/QA válidos → `ok<T>`; tipo errado (`lineCount:'x'`) → `SchemaInvalid` (não Drift); enums (`retryOwnership`, `dbIsolationPattern`) validados.
- **AC4 (adapter):** `CliWrapperInvoker extends BmadInvokerPort` + `runDevOutput`/`runReviewOutput`/`runQaOutput` via `runParsed` — usam os schemas concretos. `BmadError` intacto (Q-2.7-2=a).
- **Q-2.7-1 (conflito):** verdict segue a arquitectura; divergência vs epics-AC registada em `readiness-open-items.md` (AI-S0-4).
- **Q-2.7-4:** a 2.3 (`devOutputSchema` base) **não** foi tocada; reconciliação = O-2.7-1 (futura).
- **Fecha o Epic 2 (7/7).** Sem deps novas.

### File List

- `src/ports/sub-agent-outputs.port.ts` (NEW)
- `src/adapters/bmad/cli-wrapper.adapter.ts` (MODIFY — wrappers tipados + extends)
- `tests/ports/sub-agent-schemas.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/2-7-devoutput-reviewoutput-qaoutput-schemas-concretos.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 2-7)
- `_bmad-output/planning-artifacts/readiness-open-items.md` (divergência Q-2.7-1)
- `scripts/generate-27-summary.ts` (NEW — Task 6, dogfood)
