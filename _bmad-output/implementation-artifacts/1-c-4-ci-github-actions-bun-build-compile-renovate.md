# Story 1.c.4: CI GitHub Actions + bun build --compile + Renovate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want um workflow GitHub Actions que corre lint + type-check + test (incl. security suite) + `bun build --compile` + Docker pre-pull em <60s, com `release.yml` (artifact do binário) e Renovate para dependency updates,
so that toda push valida invariantes antes de merge e as dependências ficam actualizadas com PR automático (F9, AR-017, AR-111, D-04.11', NFR-P1).

## Acceptance Criteria

1. **(binary — CI jobs)** **Given** push numa branch / PR para `main`
   **When** o CI corre
   **Then** existem os steps/jobs: **lint**, **test**, **test:security** (explícito), **build:compile** (`bun build --compile`), **prepull:sandbox-image** — todos verdes. (AR-017)

2. **(binary — wall-clock <60s)** **Given** o CI a correr
   **When** se mede o wall-clock do caminho crítico
   **Then** o objectivo é **<60s** (AR-017). `scripts/measure-ci-time.sh` mede como proxy local (cronometra os comandos do gate) + documenta que o número autoritativo vem do GitHub Actions UI / `gh run`. (Sem push real no ambiente → proxy local + doc.)

3. **(binary — binário standalone)** **Given** `bun build --compile … --outfile dist/hdd-worker <entry>`
   **When** o binário corre numa VPS limpa sem Bun instalado
   **Then** o worker arranca em <30s (NFR-P1). Prova local: o build compila (rc=0, ~440ms) e o binário responde a `--help`/`--version` sem runtime Bun externo; `release.yml` faz upload do artifact (architecture.md:719).

## Tasks / Subtasks

- [x] **Task 1 — `.github/workflows/ci.yml` (MODIFY)** (AC: #1) — +step **Security suite** (`bun run test:security`) e **Build (compile standalone)** (`bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker` + smoke `./dist/hdd-worker --help`) ao job `build-and-test`, antes do verify-redaction. Jobs existentes preservados (secret-scan/security-suite/integration). bun-version 1.3.14 mantido.
- [x] **Task 2 — `.github/workflows/release.yml` (NEW)** (AC: #3) — trigger tag `v*` + `workflow_dispatch` (Q-C4-3); setup-bun → install → license-checker `--failOn GPL;AGPL;LGPL` → `bun build --compile` → smoke `--help` → `upload-artifact` `hdd-worker-<ref>`. Sem auto-deploy (1.c.5).
- [x] **Task 3 — `renovate.json` (NEW)** (AC: D-04.11') — `config:recommended` + schedule semanal; patch/pin/digest automerge; minor/major manual; vulnerability automerge; **runtime/binários (bun/setup-bun/litestream/rclone) nunca automerge como regra FINAL que vence até security** (estabilidade > velocidade). JSON válido.
- [x] **Task 4 — `scripts/measure-ci-time.sh` (NEW, +x)** (AC: #2) — proxy local (Q-C4-5): cronometra lint+type-check+test+test:security+build:compile via `$SECONDS`, por-step + total vs alvo 60s, doc autoritativo=GH UI. `set -euo pipefail`; `bash -n` OK; run real = **9s total**.
- [x] **Task 5 — entry-point do compile (Q-C4-2 = `src/cli/hdd-worker.ts`)** (AC: #3) — entry real usado em ci.yml + release.yml + measure-ci-time.sh. **`package.json` build e systemd confirmados intactos.** `dist/hdd-worker --help` rc=0 (binário standalone arranca).
- [x] **Task 6 — gates**: `bun run type-check` clean · `bun run lint` exit 0 (23 infos pré-existentes) · `bun test` **280 pass / 2 skip / 0 fail** · `bun build --compile` rc=0 (~440ms) + `--help` rc=0 · YAML válido (pyyaml: ci.yml + release.yml) · renovate.json JSON válido · `bash -n` measure-ci-time.sh OK · proxy 9s.
- [x] **Task 7 (FINAL) — Tier-B summary via generator (11ª dogfood)**: `scripts/generate-1c4-summary.ts` → `gen.finalize(input)` → auto-commit `summary(story-1c4): ...`. Sprint-status `1-c-4 → review`.

## Dev Notes

### Big picture

4ª story de operações do Epic 1.c. Formaliza o **gate de CI** (toda push valida invariantes) + **artifact reproduzível** do binário + **manutenção de dependências** (Renovate). Fecha o ciclo "código → validação automática → binário deployável" antes do deploy SSH (1.c.5) e dos runbooks (1.c.6).

### Scope delimitation (LER)

- **IN-SCOPE:** adicionar build:compile + test:security ao ci.yml; release.yml (artifact); renovate.json (D-04.11'); measure-ci-time.sh (proxy <60s).
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Auto-deploy** — deploy é manual via SSH restrito (Story 1.c.5; architecture.md:720). release.yml só produz artifact, não faz deploy.
  - **Medição autoritativa de <60s no GH Actions** — requer push real + leitura de tempos do GH (ambiente não tem). measure-ci-time.sh é proxy local; o número real verifica-se no GH Actions UI após o primeiro push (O-C4-*).
  - **Renovate dashboard/onboarding PR** — gerido pela Renovate App no GitHub após merge do renovate.json; não há acção local.
  - **actionlint** — não disponível no ambiente; validação YAML é parse pyyaml (syntax), não lint semântico de Actions.

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **AR-017** | CI <60s; jobs lint/test/test:security/build:compile/prepull | ci.yml + measure-ci-time.sh |
| **AR-111 / D-04.11'** | Renovate: patch automerge, minor/major manual, runtime/binários nunca, security imediato | renovate.json |
| **NFR-P1** | binário compilado arranca <30s sem Bun | build:compile + release.yml artifact |
| **architecture.md:718-720** | license-checker failOn GPL/AGPL/LGPL; artifact; deploy manual | release.yml |

### ⚠️ Estado real vs StorySpec (Q-C4-1 + Q-C4-2)

- **`ci.yml` JÁ EXISTE** (criado incrementalmente por 1.b.3/1.b.4/1.b.5 + retro Epic 1.b — convention rot benigno: infra-CI antecipada fora de uma story dedicada). O StorySpec lista-o em `files_created`, mas na prática é **MODIFY** (Q-C4-1). Jobs actuais: `build-and-test` (checkout/setup-bun 1.3.14/install/prepull/lint/type-check/test/verify-redaction), `secret-scan` (truffleHog), `security-suite` (pentest-report + artifact), `integration` (build sandbox + test:integration). **Gaps:** sem step `build:compile`; sem `test:security` explícito (o `bun test` global já corre tests/security, mas o AC pede o gate explícito).
- **Entry-point (Q-C4-2):** `package.json` build = `bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker` (decisão 1.c.1 — Commander root com `start`+`review`, serve /healthz). O StorySpec AC2 escreve `src/main.ts` (entry alternativo). Divergência a resolver — provável `src/cli/hdd-worker.ts` (o que de facto corre em produção via systemd).

### Current state dos ficheiros

- **`.github/workflows/ci.yml`** — ver acima. MODIFY: +build:compile +test:security; preservar o resto.
- **`package.json`** — `build`: `bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker` (rc=0, ~440ms, binário ~95MB); `test:security`: `bun test tests/security tests/services/apply-diff.security.test.ts`. `bun-version` 1.3.14. `dist/` gitignored.
- **`scripts/prepull-sandbox-image.sh`** — já usado no ci.yml (best-effort + real no job integration).

### Esboços

```yaml
# ci.yml — step a ADICIONAR ao job build-and-test (após Test):
      - name: Security suite (subset rápido)
        run: bun run test:security
      - name: Build (compile standalone)
        run: |
          bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker
          ./dist/hdd-worker --help
```

```json
// renovate.json (D-04.11')
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "packageRules": [
    { "matchUpdateTypes": ["patch"], "automerge": true },
    { "matchUpdateTypes": ["minor", "major"], "automerge": false },
    { "matchPackageNames": ["bun", "oven-sh/setup-bun"], "automerge": false },
    { "matchDatasources": ["github-releases"], "matchPackageNames": ["benbjohnson/litestream", "rclone/rclone"], "automerge": false },
    { "matchUpdateTypes": ["patch", "minor"], "matchDepTypes": ["security"], "automerge": true }
  ]
}
```

### Previous story intelligence

- **1.c.1 (build):** entry de compile = `src/cli/hdd-worker.ts` (não `src/main.ts`); `dist/hdd-worker` é o binário de produção (systemd ExecStart). NFR-P1 ≤30s por `--compile` (evita JIT).
- **1.c.3 (Renovate ref):** architecture.md:736 — Litestream binary nunca automerge; estender a rclone. Versões pinadas.
- **1.b.3/1.b.4/1.b.5:** os jobs do ci.yml vieram destas stories — NÃO partir verify-redaction/truffleHog/pentest/integration ao mexer.
- **`[[project-hdd-git-workflow-scope]]`:** push de `.github/workflows/*` exige scope `workflow` — **JÁ presente** (`gh auth status` confirma `workflow` no token). Push normal.
- **Gates (1.c.x):** lint exit 1 por FIXABLE → `lint:fix`; floating-promises são erro.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** reescrever o ci.yml do zero — é MODIFY incremental (preservar jobs 1.b; convention rot benigno mas o trabalho é real).
- ❌ **NÃO** adicionar auto-deploy ao release.yml (deploy é SSH manual — 1.c.5).
- ❌ **NÃO** pôr automerge em minor/major nem em Bun/Litestream/rclone (D-04.11').
- ❌ **NÃO** comitar `dist/` (gitignored; o binário é artifact de CI, não fonte).
- ❌ **NÃO** afirmar "<60s verificado" — o ambiente não corre GH Actions; measure-ci-time.sh é proxy, o número real fica como open item pós-push.
- ❌ **NÃO** usar `bun-version` divergente de 1.3.14 entre jobs.

### Project Structure Notes

- NEW: `.github/workflows/release.yml`, `renovate.json`, `scripts/measure-ci-time.sh`, `scripts/generate-1c4-summary.ts`.
- MODIFY: `.github/workflows/ci.yml` (Q-C4-1), possivelmente `package.json` (Q-C4-2 entry alignment), `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### References

- [Source: epics.md#Story-1.c.4] (linhas 1150-1173) — StorySpec, ACs, blocked_by [1.b.5].
- [Source: architecture.md:715-720] — license-checker + artifact + deploy manual.
- [Source: architecture.md:733-737] — Renovate D-04.11' (automerge policy).
- [Source: .github/workflows/ci.yml] — ficheiro MODIFY. [Source: package.json] — build/test:security scripts.

## Open Questions for Operator

- **Q-C4-1 (ci.yml: MODIFY vs rewrite):** [RESOLVED — **MODIFY incremental**] adicionar build:compile + test:security, preservar jobs 1.b (verify-redaction/truffleHog/pentest/integration).
- **Q-C4-2 (entry-point do compile):** [RESOLVED — **`src/cli/hdd-worker.ts`**] entry real de produção (1.c.1); StorySpec `src/main.ts` tratado como impreciso. **NÃO tocar `package.json` build nem systemd** (já correctos).
- **Q-C4-3 (trigger do release.yml):** [RESOLVED — **tag `v*` + `workflow_dispatch`**] release deliberado/versionado; sem ruído por commit.
- **Q-C4-4 (Renovate automerge em M0 solo-op):** [RESOLVED — **D-04.11' (automerge selectivo)**] patch automerge após CI green; minor/major manual; Bun/Litestream/rclone nunca; security imediato.
- **Q-C4-5 (measure-ci-time.sh):** [RESOLVED — **proxy local**] cronometra o gate localmente + doc que o número autoritativo é o GH Actions UI.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- `ci.yml` já existia (criado por 1.b.3-1.b.5) → MODIFY, não NEW (Q-C4-1).
- `bun run build` real: `src/cli/hdd-worker.ts` → `dist/hdd-worker` (~95MB, ~440ms, rc=0). `--help` rc=0 → smoke do CI/release passa.
- actionlint/yamllint ausentes → validação YAML via pyyaml (syntax). renovate.json via `json.load`.
- type-check clean; lint exit 0 (23 infos `useLiteralKeys` pré-existentes; nenhum ficheiro TS novo); 280 pass / 2 skip / 0 fail (sem regressão — só YAML/JSON/sh novos).
- `measure-ci-time.sh` run real: lint 5s / type-check 2s / test 2s / test:security 0s / build 0s → **total 9s** (alvo <60s, proxy local).
- gh token: scope `workflow` presente → push de `.github/workflows/*` normal.

### Completion Notes List

- **AR-017 (CI gate):** ci.yml ganha os 2 gates em falta — `test:security` explícito + `build:compile` (com smoke `--help`). Jobs 1.b preservados (verify-redaction, truffleHog, pentest, integration).
- **Q-C4-1:** ci.yml tratado como MODIFY incremental (convention rot benigno — infra-CI antecipada por stories 1.b). Sem rewrite.
- **Q-C4-2:** entry = `src/cli/hdd-worker.ts` (produção real); `package.json`/systemd intactos (StorySpec `src/main.ts` impreciso).
- **Q-C4-3:** release.yml dispara em tag `v*` + manual → artifact versionado; deploy continua SSH manual (1.c.5).
- **Q-C4-4 (D-04.11'):** automerge selectivo; **runtime/binários nunca automerge como regra final que vence até security** (interpretação consciente: estabilidade do runtime > velocidade do patch; um security-patch do Bun não deve auto-mergir sem revisão).
- **Q-C4-5:** measure-ci-time.sh é proxy local (9s); o número <60s autoritativo fica como open item pós-primeiro-push (GH Actions UI).
- **NFR-P1 (AC3):** binário compilado arranca standalone (`--help` rc=0); release.yml faz upload do artifact. Arranque <30s completo verifica-se no deploy real (depende de secrets).
- Sem deps novas; sem ficheiros TS; `dist/` gitignored.

### File List

- `.github/workflows/ci.yml` (MODIFY — +test:security +build:compile)
- `.github/workflows/release.yml` (NEW — artifact do binário, tag v*/dispatch)
- `renovate.json` (NEW — D-04.11' automerge policy)
- `scripts/measure-ci-time.sh` (NEW, +x — proxy local do <60s)
- `scripts/generate-1c4-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/1-c-4-ci-github-actions-bun-build-compile-renovate.md` (NEW — story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-30 | Story 1.c.4 criada (`ready-for-dev`); 5 Open Questions levantadas. Descoberto: ci.yml já existe (MODIFY, não NEW). |
| 2026-05-30 | Open Questions resolvidas: Q-C4-1=MODIFY incremental; Q-C4-2=src/cli/hdd-worker.ts (não tocar package.json/systemd); Q-C4-3=tag v*+workflow_dispatch; Q-C4-4=D-04.11' automerge selectivo; Q-C4-5=proxy local. |
| 2026-05-30 | Implementação completa: ci.yml +test:security +build:compile; release.yml (artifact); renovate.json (D-04.11'); measure-ci-time.sh (proxy 9s). YAML/JSON válidos; build --help rc=0; 280 pass/2 skip/0 fail; type-check/lint verdes. Summary auto-commit `82bf152`. Status → `review`. |
