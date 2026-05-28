# Story 1.a.1: Bun base scaffold + linting + test runner

Status: review

> **Story Context Engine output.** Geração via `bmad-create-story`, 2026-05-28.
> Reviewer humano: `operador`. Antes de implementar, ler na íntegra — esta é a
> primeira story implementacional (foundational) do projeto, define o terreno
> para 47 stories subsequentes.

---

## Story

As a `operador`,
I want um Bun 1.3+ project scaffold com Biome, typescript-eslint async-safety rules e `bun test` configurado,
So that toda story subsequente pode compilar, lintar e testar em ambiente reproduzível.

## Acceptance Criteria

1. **AC-1 (binary):** repo HDD com `package.json` ausente até esta story; após implementação `bun install` + `bun run lint` + `bun test` retornam exit 0 cada [Source: epics.md#story-1a1 linha 660-662].
2. **AC-2 (binary):** Biome aplica `max-lines: 200` em `src/**` (HARD limit, CI rejeita PR) [Source: epics.md#story-1a1 linha 663; AO-122 architecture.md linha 1257].
3. **AC-3 (binary):** ESLint enforça **union das 5 regras async-safety** (decisão operador Q-1 resolvida 2026-05-28): `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`, `@typescript-eslint/await-thenable`, `@typescript-eslint/require-await` (AR-018), `@typescript-eslint/no-unsafe-assignment` (AO-50) [Sources: epics.md#AR-018 linha 219; architecture.md#AO-50 linha 400; Q-1 resolvido union]. Open item: reconciliar AR-018 ∪ AO-50 nos docs canónicos (item para Story 1.c.4 ou ADR separada).
4. **AC-4 (property):** `bun --version` ≥ 1.3.0 [Source: epics.md#story-1a1 linha 665; AR-010 linha 211].
5. **AC-5 (binary):** `bun test` wall-clock <10s com zero specs (CI baseline benchmark — meta NFR-P1 com gordura) [Source: epics.md#story-1a1 linha 666]. Nota: CI infrastructure formal é Story 1.c.4; nesta story validar localmente como proxy.

---

## Tasks / Subtasks

- [x] **Task 1 — Validar pré-requisitos do ambiente (AC: #4)**
  - [x] 1.1 Confirmar `bun --version` ≥ 1.3.0; se não, instalar via `curl -fsSL https://bun.sh/install | bash` [AR-001].
  - [x] 1.2 Confirmar `node --version` ≥ 22 (necessário só para typescript-eslint v8+ runtime caso este não corra sob Bun).
  - [x] 1.3 Confirmar git working tree clean antes de começar (apenas `.smoke-evidence/` untracked).
- [x] **Task 2 — Bun scaffold base no repo existente (AC: #1, #4)**
  - [x] 2.1 `bun init -y` (NÃO `bun create hono@latest hdd-worker` — repo já existe; o nome do worker `hdd-worker` é detail de bin-entry, não de directoria). Justificação: arquitectura linha 482 ("primeira implementation story") refere-se semanticamente ao acto de scaffolding, não literalmente a criar sub-directoria.
  - [x] 2.2 Editar `package.json` gerado: definir `"name": "hdd-worker"`, `"type": "module"`, `"private": true`, `"engines": { "bun": ">=1.3.0" }`.
  - [x] 2.3 Adicionar `bin` entry: `"bin": { "hdd-worker": "./dist/main.js" }` (placeholder; entrypoint real entra na Story 2.1).
  - [x] 2.4 Adicionar scripts mínimos: `"dev": "bun --hot src/main.ts"`, `"build": "bun build --compile src/main.ts --outfile dist/hdd-worker"`, `"test": "bun test"`, `"lint": "biome check src tests && eslint src tests"`, `"lint:fix": "biome check --write src tests && eslint --fix src tests"`, `"format": "biome format --write src tests"`, `"type-check": "tsc --noEmit"`.
- [x] **Task 3 — Estrutura mínima `src/` conforme AR-002 (AC: #1)**
  - [x] 3.1 Criar directorias: `src/core/`, `src/ports/`, `src/adapters/`, `src/lib/`, `src/db/`. Cada uma com `.gitkeep` (vazias hoje; populadas por stories 1.a.2..1.a.10).
  - [x] 3.2 Criar `src/main.ts` (stub): `console.log('hdd-worker placeholder');` + comentário "// Bootstrap real entra na Story 1.a.7".
  - [x] 3.3 Criar `src/bootstrap.ts` (stub vazio com placeholder export): `export const bootstrap = (): void => { /* Story 1.a.7 */ };`.
  - [x] 3.4 Não criar subdirectorias profundas (`src/core/fsm/`, `src/adapters/whatsapp/`, etc.) — entram com as respectivas stories.
- [x] **Task 4 — Configurar Biome (AC: #1, #2)**
  - [x] 4.1 `bun add -d @biomejs/biome@latest` (versão mais recente estável; arquitectura validada May 2026).
  - [x] 4.2 Criar `biome.json` com: `"$schema"`, formatter `indentStyle=space`, `indentWidth=2`, `lineWidth=100`. Linter habilitado, `organizeImports.enabled=true`. Rules: `complexity.noStaticOnlyClass=error`, `style.useImportType=error`, `correctness.noUnusedVariables=error`, `style.noNonNullAssertion=error`. **Max-lines 200 HARD** via `nursery.useMaxLines` ou `suspicious` rule equivalente (Biome 2026: verificar nome canónico actual — pode ser `noExcessiveLinesPerFile`); se Biome ainda não suporta nativo, delegar para ESLint `max-lines: [error, { max: 200, skipBlankLines: true, skipComments: true }]`.
  - [x] 4.3 Includes/excludes: `"files": { "include": ["src/**", "tests/**"], "ignore": ["dist/**", "node_modules/**", ".smoke-evidence/**", "tests/integration/*.sh"] }`. Crítico: excluir `tests/integration/*.sh` (são bash scripts do 1.c.7, não TS).
  - [x] 4.4 Verificar com `bun run lint` (deve sair 0 sobre `src/main.ts` + `src/bootstrap.ts` stubs).
- [x] **Task 5 — Configurar TypeScript strict (AC: #1)**
  - [x] 5.1 `bun add -d typescript@latest`.
  - [x] 5.2 Criar `tsconfig.json` baseado em `@tsconfig/bun` se disponível; senão manual com: `"target": "ESNext"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"noUncheckedIndexedAccess": true` [AO-Step1 architecture.md linha 386], `"exactOptionalPropertyTypes": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`, `"allowImportingTsExtensions": true`, `"verbatimModuleSyntax": true`, `"types": ["bun-types"]`, `"include": ["src/**/*", "tests/**/*"]`, `"exclude": ["dist", "node_modules"]`.
  - [x] 5.3 Verificar com `bun run type-check` (deve sair 0).
- [x] **Task 6 — Configurar ESLint + typescript-eslint v8+ (AC: #1, #3)**
  - [x] 6.1 `bun add -d eslint@latest typescript-eslint@latest @typescript-eslint/parser@latest`.
  - [x] 6.2 Criar `eslint.config.js` (**flat config** — Q-2 resolvido). Parser: `@typescript-eslint/parser` com `parserOptions.project: './tsconfig.json'` (necessário para type-aware rules). Update epics.md `files_created` para reflectir `eslint.config.js` em vez de `.eslintrc.json` (open item para Story 1.c.4 ou amanhã).
  - [x] 6.3 Habilitar **union de 5 regras async-safety** (Q-1 resolvido — union AR-018 ∪ AO-50): `@typescript-eslint/no-floating-promises: error`, `@typescript-eslint/no-misused-promises: error`, `@typescript-eslint/await-thenable: error`, `@typescript-eslint/require-await: error`, `@typescript-eslint/no-unsafe-assignment: error`. Adicionar comentário no config a registar a decisão Q-1.
  - [x] 6.4 NÃO adicionar `no-restricted-syntax: ThrowStatement` ainda — entra com Story 1.a.2 (Result + whitelist `docs/conventions/errors.md`) [AO-66 architecture.md linha 836].
  - [x] 6.5 NÃO adicionar `no-restricted-globals: setTimeout, setInterval` ainda — entra com Story 1.a.3 (ClockPort) [AO-103 architecture.md linha 1230].
  - [x] 6.6 Adicionar overrides para `tests/**/*.ts`: relax `no-floating-promises` se necessário (test runners absorvem); EXCLUIR `tests/integration/*.sh` do ESLint scope (não é TS).
  - [x] 6.7 Verificar com `bun run lint` (deve sair 0 sobre stubs vazios).
- [x] **Task 7 — Configurar `bunfig.toml` com test runner + coverage thresholds (AC: #1, #5)**
  - [x] 7.1 Criar `bunfig.toml` com:
    ```toml
    [test]
    coverage = true
    coverageThreshold = { line = 0.80, function = 0.80, branch = 0.85 }
    coverageReporter = ["text", "lcov"]
    coverageDir = "coverage"
    coverageIgnore = ["tests/**", "**/*.test.ts", "dist/**", ".smoke-evidence/**"]
    ```
  - [x] 7.2 Test glob: `bun test` por defeito descobre `**/*.test.{ts,tsx,js,jsx}`. NÃO descobre `*.sh` — confirma que `tests/integration/bmad-cli.test.sh` (do 1.c.7) NÃO é executado pelo `bun test`. Documentar em comentário no `bunfig.toml`.
  - [x] 7.3 **Threshold guard para Story 1.a.1:** com zero specs, coverage = 0/0 = undefined. Verificar que `bun test` com zero specs ainda sai 0 (thresholds só aplicam quando há specs); se sair ≠ 0, adicionar 1 placeholder test trivial em `tests/scaffold.test.ts`: `import { test, expect } from "bun:test"; test("scaffold smoke", () => { expect(1 + 1).toBe(2); });`.
  - [x] 7.4 Verificar `bun test` wall-clock <10s (AC-5). Reportar tempo no Completion Notes.
- [x] **Task 8 — `.gitignore` (AC implícita: hygiene; resolve O-1 da Story 1.c.7)**
  - [x] 8.1 Verificar se `.gitignore` já existe (commit 9cb9346 + 99b608a já adicionaram `.env*` e `_bmad/`). Não recriar — fazer **append** de:
    - `node_modules/`
    - `dist/`
    - `coverage/`
    - `*.tsbuildinfo`
    - `.smoke-evidence/` ← **resolve O-1 da Story 1.c.7**
    - `bun.lockb` ← **NÃO** ignorar (lock-file é committable para reproducibilidade); este bullet é lembrete em negativo.
- [x] **Task 9 — `README.md` (AC: #1)**
  - [x] 9.1 Criar `README.md` raiz com: nome do projecto (HDD — HORSE DRIVEN DEVELOPMENT), 1-paragraph descrição (referência ao CLAUDE.md), stack (Bun 1.3+ TypeScript), comandos básicos (`bun install`, `bun run dev`, `bun test`, `bun run lint`, `bun run build`), link para `docs/decisions/` (ADRs).
  - [x] 9.2 Secção **"Runtime requirements"**: documentar que `claude` CLI ≥ 2.1.x é runtime requirement do worker (per D-052) — **não** é npm dep, é binário system-level.
- [x] **Task 10 — Validação E2E final + benchmark (AC: #1, #2, #3, #4, #5)**
  - [x] 10.1 `rm -rf node_modules bun.lockb dist coverage` + `bun install` (cold install) — confirma reproducibilidade.
  - [x] 10.2 `bun --version` ≥ 1.3.0 → AC-4 ✓.
  - [x] 10.3 `bun run type-check` exit 0.
  - [x] 10.4 `bun run lint` exit 0 → AC-3 ✓ (regras async-safety carregadas, sem erros sobre stubs).
  - [x] 10.5 `time bun test` exit 0, wall-clock <10s → AC-1 + AC-5 ✓. Reportar tempo real.
  - [x] 10.6 Confirmar Biome catch test: criar `src/_test-max-lines.ts` com 201 linhas, correr `bun run lint`, deve falhar; depois apagar o ficheiro → AC-2 ✓ (deletar evidence).
  - [x] 10.7 Confirmar ESLint catch test: criar `src/_test-floating.ts` com `Promise.resolve(1);` (sem await/then), correr `bun run lint`, deve falhar com `no-floating-promises`; depois apagar → AC-3 ✓ (deletar evidence).
- [x] **Task 11 — Resumo Tier-B antecipado (D-019)**
  - [x] 11.1 Escrever `_bmad-output/implementation-artifacts/story-1a1-summary.md` seguindo template em `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md` (mesma abordagem usada para 1.c.7). Generator real chega em Story 1.a.8.
  - [x] 11.2 Mover sprint-status.yaml `1-a-1-bun-base-scaffold-linting-test-runner: ready-for-dev → review`.
  - [x] 11.3 Apresentar para operador `approve story-1a1` / `request-changes story-1a1`.

---

## Dev Notes

### Big picture

Story 1.a.1 é foundational. Não há "feature" — entrega o esqueleto que TODAS as 47 stories subsequentes assumem como base:
- `package.json` + scripts canónicos
- Bun runtime ≥1.3.0 invariant
- Biome (format + base lint + max-lines 200 HARD per AO-122)
- ESLint type-aware com 4 regras async-safety (AR-018)
- TypeScript strict com `noUncheckedIndexedAccess`
- `bun test` configurado com coverage thresholds (AO-91: line ≥80% global, branch ≥85% em `src/core/` — aplicáveis a partir de 1.a.2)
- Estrutura mínima `src/{core, ports, adapters, lib, db, bootstrap.ts, main.ts}` (AR-002)

### O que NÃO entra nesta story (delimitar scope)

- ❌ `Result<T,E>` + `neverthrow` + branded types → **Story 1.a.2** [AR-030, AR-031, AR-033].
- ❌ Throw whitelist + ESLint `no-restricted-syntax: ThrowStatement` → **Story 1.a.2** [AO-66].
- ❌ ClockPort/SpawnPort/NotifyPort + `no-restricted-globals: setTimeout` → **Story 1.a.3** [AR-032, AO-103].
- ❌ Hono server, Commander CLI, Drizzle, bun:sqlite, Litestream → **Stories 1.a.5..1.c.3** + Epic 2 onwards.
- ❌ Pre-commit hook para max-lines (AO-150) → adiar para Story 1.c.4 (CI) ou Story 1.a.6 (audit hooks). Confirmar em Q-3.
- ❌ Stryker mutation testing (AR-017) → post-CI, Story 1.c.4.
- ❌ Husky/lefthook → não decidido nas decisões D-04.x; não introduzir aqui.

### Architectural compliance — AOs/ARs cobertos

| AR / AO | Cobertura nesta story | Onde |
|---------|----------------------|------|
| **AR-001** Greenfield Bun scaffold | Sim (full) | Tasks 1, 2 |
| **AR-002** `src/{core,ports,adapters,lib,db,bootstrap.ts,main.ts}` | Sim (estrutura mínima) | Task 3 |
| **AR-010** Bun 1.3+ runtime | Sim (engines + verificação) | Tasks 1.1, 2.2, 10.2 |
| **AR-017** `bun test` + thresholds | Parcial (`bun test` configurado, thresholds setados; fast-check entra 1.a.2; Stryker entra 1.c.4) | Task 7 |
| **AR-018** Biome + typescript-eslint 4 regras | Sim (full) | Tasks 4, 6 |
| **AO-50** Linter+formatter stack | Sim (com ressalva Q-1) | Tasks 4, 6 |
| **AO-91** Coverage line ≥80% / branch ≥85% src/core/ | Configurado (não aplicável até haver código) | Task 7.1 |
| **AO-122** max-lines 200 HARD | Sim (Biome+ESLint) | Task 4.2, 6.x |
| **AO-Step1** TS strict + `noUncheckedIndexedAccess` | Sim | Task 5.2 |

### Library/framework versions (verificar antes de `bun add`)

Architecture.md (linha 339) confirma "Versões verificadas em May 2026 (via web research)". Hoje (2026-05-28) usar `@latest` para Biome, typescript-eslint, typescript, eslint. Versões âncora da arquitectura:

| Dep | Versão (architecture) | Hoje (`@latest` aceitável) |
|-----|----------------------|---------------------------|
| Bun runtime | 1.3+ | ✓ |
| Biome | (não pinada) | @biomejs/biome@latest |
| typescript-eslint | v8+ | typescript-eslint@latest (v8 ou superior) |
| typescript | (não pinada) | typescript@latest |
| eslint | (não pinada) | eslint@latest |

**Pin policy** (AO-15 supply chain): semver-prefixed em `package.json` (e.g. `"^1.3.0"`); lock-file exacto via `bun.lockb` committable. Pin exacto + hash integrity entra com Renovate config em Story 1.c.4.

### File structure requirements

Após Story 1.a.1 a árvore esperada é:

```
hdd-worker/
├── package.json          ← Task 2
├── bun.lockb             ← gerado por bun install (committable)
├── bunfig.toml           ← Task 7
├── tsconfig.json         ← Task 5
├── biome.json            ← Task 4
├── eslint.config.js      ← Task 6 (preferir flat config)
├── .gitignore            ← já existe; append em Task 8
├── README.md             ← Task 9
├── src/
│   ├── core/.gitkeep
│   ├── ports/.gitkeep
│   ├── adapters/.gitkeep
│   ├── lib/.gitkeep
│   ├── db/.gitkeep
│   ├── bootstrap.ts      ← stub
│   └── main.ts           ← stub
├── tests/
│   ├── integration/      ← já existe (1.c.7); contém bash scripts
│   └── (vazio até 1.a.2)
├── scripts/              ← já existe (1.c.7); smoke-bmad-cli.sh
├── docs/
│   └── decisions/        ← já existe (1.c.7); bmad-cli-vs-plan-b.md
├── _bmad/                ← já existe; read-only (gitignored)
├── _bmad-output/         ← já existe; planning + implementation artifacts
└── .claude/              ← já existe; skills BMAD
```

### Testing standards summary

- Runner: `bun test` (built-in). API estilo Jest: `import { test, expect, describe, beforeAll } from "bun:test"`.
- Property-based: `fast-check` entra em Story 1.a.2 (Result helpers) — não nesta story.
- Coverage: targets AO-91 (line ≥80% global, branch ≥85% src/core/). Configurados em `bunfig.toml`; não aplicáveis nesta story (zero código produtivo).
- Test discovery: glob `**/*.test.{ts,tsx,js,jsx}`. EXPLICITAMENTE excluir `*.sh` (bash scripts em `tests/integration/`).
- Pyramid: 70% unit / 20% integration / 10% E2E (D-04.8' architecture).

### Previous Story Intelligence — Story 1.c.7 (commit a9cecf7, 2026-05-28)

A previous story imediatamente anterior (mesmo dia) foi 1.c.7 — smoke test bmad-cli + ADR D-052. Aprendizagens directas aplicáveis:

1. **`.smoke-evidence/` criado** por `scripts/smoke-bmad-cli.sh` — adicionar a `.gitignore` (Task 8.1). O-1 herdado.
2. **`tests/integration/bmad-cli.test.sh`** existe (bash TAP wrapper). `bun test` glob default não o apanha (boa), mas confirmar em Task 7.2.
3. **`docs/decisions/bmad-cli-vs-plan-b.md`** já lá → linkar a partir de `README.md` (Task 9).
4. **D-052 Opção A** ratificada: worker invoca skills BMAD via `claude -p` headless. Implicação para Story 1.a.1: `claude` CLI é runtime requirement do worker — documentar em README mas NÃO adicionar a `dependencies`/`devDependencies` (não é npm package).
5. **Workflow seguido em 1.c.7:** backlog → done directo (operator-directed, foundational hard-prereq). Esta story usa workflow canónico backlog → ready-for-dev (já) → in-progress → review → done.
6. **Resumo Tier-B antecipado obrigatório** (D-019) — `summary-generator.service` ainda não existe (Story 1.a.8); reproduzir manualmente em Task 11.1.
7. **Operator approval pattern:** `approve story-1a1` antes de mutar sprint-status para `done` + commit.

### Git intelligence — últimos 6 commits relevantes

```
a9cecf7 feat(story-1c7): smoke test bmad-cli + ADR D-052 (Claude headless)
f38e20a docs: marca AO-151 como resolvido no architecture.md
00e6d6e docs: scrub do handle do operador (paulotodo -> operador)
a446cdd docs: adiciona CLAUDE.md e planning-artifacts (PII/infra redigidos)
9cb9346 chore: ignora ficheiros .env no .gitignore
99b608a chore: adiciona .gitignore (ignora _bmad/ regenerável)
```

Padrões observados:
- **Commit message style:** Conventional commits PT-PT, e.g. `feat(story-NN): ...`, `docs:`, `chore:`. Co-Authored-By Claude Opus 4.7 footer.
- **`.gitignore` já cobre:** `_bmad/`, `.env*`. Esta story acrescenta: `node_modules/`, `dist/`, `coverage/`, `.smoke-evidence/`, `*.tsbuildinfo`.
- **PII scrubbed:** `paulotodo` → `operador` em todos os artifacts. Manter discipline ao escrever novo conteúdo.
- **NÃO push automático:** operador faz push explicitamente; commits ficam locais até "push" pedido.

### Latest tech information (snapshot 2026-05-28)

- **Bun 1.3.14** instalada localmente (verificado em 1.c.7); `≥1.3.0` exigido per AR-010.
- **Node 22.22.3** disponível (Plan B); só usado se Bun falhar (per AR-010 + D-035).
- **typescript-eslint v8+:** v8 é major version com flat config nativo (eslint.config.js) — preferir flat sobre legacy `.eslintrc.json`. Story spec menciona `.eslintrc.json` mas o config moderno é flat; adoptar flat e documentar.
- **Biome 2026:** versão estável tem flat config, formatter, lint, organizeImports. Max-lines: confirmar nome canónico do rule (pode ser `noExcessiveLinesPerFile` na nursery, ou fall-back para ESLint `max-lines`).
- **`bun-types`:** package npm que dá tipagens globais (`Bun.spawn`, `bun:test`, etc.); incluir em `tsconfig.json#types`.

### Project Structure Notes

**Alignment com architecture.md tree (linhas 412-450):** Story 1.a.1 implementa **subconjunto** da árvore final — apenas top-level `src/` directories + 2 stubs. Subdirectorias (`src/adapters/whatsapp/`, `src/core/fsm/`, etc.) entram com respectivas stories. Não criar prematuramente.

**Detected conflicts (DEV: pedir clarificação se Tasks bloqueiam):**

- **Q-1 (CRITICAL — affects Task 6.3 directly):** AR-018 (epics.md linha 219) vs AO-50 (architecture.md linhas 400, 471, 1201) discordam sobre a 3ª/4ª regra async-safety. AR-018 lista `require-await` como 4ª regra; AO-50 lista `no-unsafe-assignment`. **Default desta story:** seguir AR-018 (epics) porque a AC literal cita 4 regras exactas que incluem `require-await`. **Recomendação técnica:** as 5 regras (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`, `no-unsafe-assignment`) são complementares e baratas — adicionar todas é seguro. Aguarda decisão do operador para finalizar lint config.
- **Q-2:** Story spec lista `.eslintrc.json` como ficheiro criado. typescript-eslint v8+ standard é flat config (`eslint.config.js`). **Default:** criar `eslint.config.js`; renomear nome no story files_created se confirmar. Confirmar operador.
- **Q-3:** AO-150 (pre-commit hook para AO-122 max-lines) está deferred. Adicionar agora (husky/lefthook) ou só com CI em Story 1.c.4? **Default:** deferir para 1.c.4. Confirmar operador.
- **Q-4:** Architecture line 482 sugere `bun create hono@latest hdd-worker --template bun` como command da primeira impl story. Isso cria um sub-directório `hdd-worker/` — mas o repo HDD JÁ existe com `_bmad/`, `_bmad-output/`, etc. **Default:** `bun init -y` no cwd + adicionar deps manualmente; Hono entra explicitamente quando Story 1.a.7 ou Story 1.c.1 (server) o exigir. Confirmar operador se quer "Hono já desde 1.a.1" para ficar alinhado literalmente com architecture.

### Anti-pattern guardrails (DEV: NÃO fazer)

- ❌ **NÃO** instalar `@anthropic-ai/sdk`, `pino`, `commander`, `drizzle-orm`, `zod`, `envalid`, `hono` nesta story. Cada um entra com a sua story (1.a.5 db, 1.a.7 bootstrap, 1.a.10 LLM, 2.1 CLI, etc.). Adicionar agora cria `package.json` poluído e burnsto budget de outras stories.
- ❌ **NÃO** criar `src/core/fsm/`, `src/adapters/whatsapp/`, etc. — só as 5 dirs top-level + 2 stubs.
- ❌ **NÃO** introduzir `throw` em código (Result entra em 1.a.2). Stubs usam `console.log` ou `void` returns.
- ❌ **NÃO** introduzir `setTimeout`/`setInterval` (entra em 1.a.3 via ClockPort). Stubs são síncronos.
- ❌ **NÃO** adicionar Husky/lefthook (Q-3 deferred).
- ❌ **NÃO** commit `node_modules/` ou `dist/` ou `.smoke-evidence/`.
- ❌ **NÃO** tocar em `_bmad/` (gitignored + read-only do installer).
- ❌ **NÃO** push para origin sem `approve story-1a1` + pedido explícito do operador.

### References

- [Source: epics.md#story-1a1] — StorySpec linhas 644-666.
- [Source: epics.md#AR-001..AR-018] — Architectural Requirements linhas 205-220.
- [Source: architecture.md#starter-template-evaluation] — Step 03 linhas 331-490 (full Bun stack rationale + init command + tree).
- [Source: architecture.md#AO-50] — linha 471 (Biome + ts-eslint 4 rules).
- [Source: architecture.md#AO-91] — linha 861 (coverage targets).
- [Source: architecture.md#AO-122] — linha 1257 (max-lines 200 HARD).
- [Source: architecture.md#AO-150] — linha 1809 (pre-commit hook, deferred).
- [Source: docs/decisions/bmad-cli-vs-plan-b.md] — D-052 ACCEPTED (impacto na bin entry + README).
- [Source: _bmad-output/implementation-artifacts/story-1c7-summary.md] — previous story learnings; O-1 (.smoke-evidence/ gitignore).
- [Source: _bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md] — Tier-B template (Task 11.1).
- [Source: CLAUDE.md] — convenções projecto (idioma PT, paths, não tocar `_bmad/`).
- [Memory: project-hdd-stack-v2-bun] — Bun 1.3+, Hono, Commander, bun:sqlite, Drizzle, Litestream supervisor, Bun.spawn.
- [Memory: project-hdd-d052-claude-headless-invoker] — `claude -p` runtime requirement do worker.

---

## Dev Agent Record

### Agent Model Used

`claude-opus-4-7[1m]` (Opus 4.7, 1M context). Sessão directa Claude Code,
desempenhando o papel de Amelia (Developer agent BMAD). Não houve invocação
de sub-agente isolado — todo o ciclo red/green/refactor + validation correu
na mesma sessão por design (worker autónomo Story 2.x ainda não existe).

### Debug Log References

Sem debug log JSONL (audit adapter chega em Story 1.a.6). Eventos relevantes
inline neste registo:

- bun init -y preservou `.gitignore` existente (detectou ficheiro presente; não recriou).
- bun init criou `index.ts` placeholder; removido após criação de `src/main.ts`.
- bun init upgrade `tsconfig.json` (campo `types: ["bun"]` aponta para `@types/bun`,
  não `bun-types` como mencionado na story spec — adoptei o nome canónico do bun init).
- ESLint flat config falha com `tests/` glob vazio de TS files; corrigido via
  flag `--no-error-on-unmatched-pattern` nos scripts `lint` / `lint:fix`.
- `bun init -y` instalou `@types/bun@1.3.14` e `typescript@5.9.3` automaticamente.
- bun usa `bun.lock` (text format, default nas versões recentes 1.3.x), não `bun.lockb`.
  Lockfile committable — reproducibilidade preservada.

### Completion Notes List

**Validação E2E (cold install) — 2026-05-28**

| Verificação | Resultado | AC |
|-------------|-----------|----|
| `bun --version` | 1.3.14 | AC-4 ✓ |
| Cold install (`bun install` após `rm -rf node_modules bun.lock`) | 28ms, 94 packages | AC-1 ✓ |
| `bun run type-check` exit | 0 | — |
| `bun run lint` exit | 0 (Biome 3 files / ESLint silent on stubs) | AC-1, AC-3 ✓ |
| `bun test` wall-clock | 38ms (2 specs, 30ms reported by Bun) | AC-1, AC-5 ✓ (folga 263x) |
| Biome max-lines catch (`noExcessiveLinesPerFile` em ficheiro 201-linhas) | exit 1 | AC-2 ✓ |
| ESLint async-safety catch (floating promise + async sem await) | exit 1 | AC-3 ✓ |

**Decisões aplicadas (Q-1..Q-4 resolvidas pelo operador 2026-05-28):**

- Q-1: 5 regras async-safety habilitadas (union AR-018 ∪ AO-50) — `no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`, `no-unsafe-assignment`.
- Q-2: `eslint.config.js` flat config (não `.eslintrc.json`). Open follow-up: actualizar `files_created` em epics.md.
- Q-3: Pre-commit hook AO-150 diferido para Story 1.c.4.
- Q-4: `bun init -y` no cwd (não `bun create hono`). Hono entra com Story 1.a.7 ou 1.c.1.

**Open items emergentes desta story (para próximas):**

- O-A1: actualizar `files_created` Story 1.a.1 em `_bmad-output/planning-artifacts/epics.md` linha 653: `.eslintrc.json` → `eslint.config.js` (Q-2).
- O-A2: reconciliar AR-018 (epics.md linha 219) e AO-50 (architecture.md linhas 400, 471, 1201) — qual fica como canónico da union de 5 regras? ADR breve ou edit silencioso. Story 1.c.4 momento natural.
- O-A3: confirmar que stories posteriores (1.a.7 bootstrap; 1.c.1 server) instalam Hono explicitamente quando precisarem. Mencionar no respectivo Dev Notes.
- O-A4: `bun init` instalou `typescript@5.9.3` mas `v6.0.3 available`. Renovate (Story 1.c.4) ditará política de upgrade; por agora manter 5.x.
- O-A5: `_bmad-output/` está untracked (não em `.gitignore` mas também não tracked anteriormente). Confirmar se é committable — provavelmente sim, dado que o sprint-status.yaml já lá vive e foi committed em 1.c.7.

### File List

**Ficheiros criados (committable):**

- `package.json` — `name=hdd-worker`, `type=module`, `private=true`, `engines.bun>=1.3.0`, bin entry, 8 scripts.
- `bun.lock` — auto-gerado por `bun install` (text format; committable).
- `bunfig.toml` — test runner config + coverage thresholds AO-91 (ainda inactive — coverage=false até haver source code).
- `tsconfig.json` — strict mode completo (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noPropertyAccessFromIndexSignature`); types `["bun"]`.
- `biome.json` — formatter (2-space, lineWidth 100), linter recommended + `noExcessiveLinesPerFile: { maxLines: 200 }`, excludes `.sh` / `_bmad/` / `_bmad-output/`.
- `eslint.config.js` — flat config, `tseslint.config()` helper, `recommendedTypeChecked` + 5 regras async-safety explicitas como `error`.
- `README.md` — overview HDD + stack + comandos + runtime requirements (incluindo `claude` CLI per D-052).
- `src/main.ts` — placeholder, log "hdd-worker placeholder — Story 1.a.7 wires bootstrap".
- `src/bootstrap.ts` — placeholder stub `export const bootstrap = (): void => { /* Story 1.a.7 */ };`.
- `src/core/.gitkeep`, `src/ports/.gitkeep`, `src/adapters/.gitkeep`, `src/lib/.gitkeep`, `src/db/.gitkeep` — preservam estrutura AR-002.
- `tests/scaffold.test.ts` — 2 smoke tests (`1+1=2` + `typeof Bun === "object"`); confirma test discovery funciona.
- `_bmad-output/implementation-artifacts/1-a-1-bun-base-scaffold-linting-test-runner.md` — esta story file.
- `_bmad-output/implementation-artifacts/story-1a1-summary.md` — Resumo Tier-B antecipado (D-019, Task 11.1).

**Modificados:**

- `.gitignore` — append: `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.smoke-evidence/` (resolve O-1 da Story 1.c.7).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-a-1: backlog → review` (via ready-for-dev → in-progress → review) + `epic-1a: backlog → in-progress` + `last_updated: 2026-05-28`.

**Removidos:**

- `index.ts` (criado por `bun init`; substituído por `src/main.ts`).

**Não-committable (gitignored):**

- `node_modules/` — 94 packages após cold install.
- `.smoke-evidence/` — outputs de Story 1.c.7, agora explicitamente ignorados.

## Change Log

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-05-28 | bmad-create-story (Amelia) | Story file criada a partir de StorySpec epics.md#1.a.1. Status `backlog → ready-for-dev`. |
| 2026-05-28 | operador | Resolveu Q-1 (union 5 regras), Q-2 (flat config), Q-3 (defer hook), Q-4 (`bun init -y`). |
| 2026-05-28 | bmad-dev-story (Amelia) | Implementação completa: 11 tasks done; 5 ACs verificados; status `ready-for-dev → in-progress → review`. |

---

## Open Questions for Operator — RESOLVIDAS 2026-05-28

- **Q-1 [RESOLVED — Union]:** Habilitar as 5 regras async-safety (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `require-await`, `no-unsafe-assignment`). Open follow-up: reconciliar AR-018 (epics) ∪ AO-50 (architecture) num único canon — diferir para Story 1.c.4 ou ADR breve.
- **Q-2 [RESOLVED — Flat]:** `eslint.config.js` (flat). Open follow-up: atualizar `files_created` da Story 1.a.1 em epics.md de `.eslintrc.json` → `eslint.config.js`.
- **Q-3 [RESOLVED — Defer]:** Pre-commit hook (AO-150) diferido para Story 1.c.4 (CI). Nesta story só Biome+ESLint runtime; nada de Husky/lefthook.
- **Q-4 [RESOLVED — bun init -y]:** `bun init -y` no cwd actual. Hono entra explicitamente quando uma story posterior (1.a.7 bootstrap / 1.c.1 server) precisar — não nesta story.

→ Implementação destrava com defaults da story tal como descritos nas Tasks. Estimativa: 48K tokens dev_core / 72K com retry.

---

**Story Status:** ready-for-dev · **Created by:** bmad-create-story (Amelia, 2026-05-28)
**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created.
