> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

---

<!--
  Tier-B template — briefing 600-900 palavras, target ≤715 para folga.

  Story 1.a.8 (F8 FR-070..076, D-019, AO-146 defer p/ Tier-A).
  Renderizado por `summaryGenerator.finalize()` em src/services/summary-generator.service.ts.

  Anti-padrões a EVITAR (per finalization-summary-templates canon):
    × "Foi feito muito trabalho" — usar ARTEFACTOS como prova
    × Listas FR sem dizer o que ficou diferente — mostrar CONSEQUÊNCIA, não actividade
    × "Várias decisões foram tomadas" — enumerá-las (tabela)
    × Tier-B sem Trade-offs — sinal de processo low-judgment
    × "Tudo correu bem" — preferir verdict formal (ready-to-merge etc.)

  Mantém: artefactos como prova, decisões enumeradas, trade-offs narrativos,
  open items distintos das próximas etapas.
-->
---
workflowId: story-1c4
workflowName: Story 1.c.4 — CI GitHub Actions + bun build --compile + Renovate
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.4 — CI GitHub Actions + bun build --compile + Renovate · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

4ª story de operações do Epic 1.c — gate de CI + artifact reproduzível + manutenção de deps. Descoberta: ci.yml já existia (criado por 1.b.3-1.b.5) → MODIFY, não NEW. Fecha o ciclo código→validação→binário antes do deploy SSH (1.c.5). AR-017/AR-111/D-04.11'/NFR-P1.

## O que foi feito

- **.github/workflows/ci.yml** — MODIFY: +step test:security +step build:compile (bun build --compile src/cli/hdd-worker.ts + smoke --help); jobs 1.b preservados.
- **.github/workflows/release.yml** — NEW: tag v*/dispatch → license-checker (failOn GPL/AGPL/LGPL) + compile + upload-artifact; sem auto-deploy.
- **renovate.json** — NEW: patch automerge; minor/major manual; vulnerability automerge; runtime/binários NUNCA (regra final, vence security).
- **scripts/measure-ci-time.sh** — NEW: proxy local do <60s (9s real); número autoritativo = GH Actions UI.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | ci.yml MODIFY incremental (não rewrite). | Já existia (1.b.3-1.b.5); convention rot benigno; preservar verify-redaction/truffleHog/pentest/integration. | Q-C4-1 |
| 2 | Entry compile = src/cli/hdd-worker.ts. | Entry real de produção (1.c.1); StorySpec src/main.ts impreciso; package.json/systemd intactos. | Q-C4-2 |
| 3 | release.yml em tag v* + workflow_dispatch. | Release deliberado/versionado; deploy continua SSH manual (1.c.5). | Q-C4-3 |
| 4 | Renovate D-04.11'; runtime nunca automerge vence security. | Estabilidade do runtime > velocidade do patch; security-patch do Bun não auto-mergir sem revisão. | Q-C4-4 |

## Trade-offs aplicados

- StorySpec dizia ci.yml 'created' + entry src/main.ts; realidade = MODIFY + src/cli/hdd-worker.ts. Fidelidade ao estado/produção > literal do spec.
- measure-ci-time.sh é proxy local (9s), não o wall-clock real do CI — o número <60s autoritativo só se confirma no GH Actions UI após o 1º push (open item honesto, sem afirmar 'verificado').

## Open items deferidos

- **O-C4-1:** Confirmar <60s no GH Actions UI após o 1º push (proxy local = 9s, mas CI inclui setup-bun/install/jobs paralelos).
- **O-C4-2:** Validar license-checker no GH real (compat com node_modules do bun); ajustar se a ferramenta falhar.
- **O-C4-3:** Renovate App tem de estar instalada no repo GitHub para o renovate.json ter efeito (onboarding PR).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 280 pass / 2 skip / 0 fail (sem regressão; só YAML/JSON/sh novos)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes; 0 TS novo)
- **Build:** bun build --compile rc=0 (~440ms); dist/hdd-worker --help rc=0
- **CI proxy:** 9s local (alvo <60s; autoritativo GH UI)
- **Deps adicionadas:** 0

## Próximos passos sugeridos

1. Operador aprova `approve story-1c4` → marco done + commit `feat(story-1c4): CI build:compile + release.yml + Renovate (AR-017/D-04.11')`. Push TOCA .github/workflows → scope workflow já presente (push normal); confirmar tempos no GH Actions UI após push (O-C4-1).
2. Sprint 0: 20/22 done. Epic 1.c: 5/7. Próxima: 1.c.5 (SSH restricted deploy — blocked_by 1.c.4 agora resolvido).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c4` · Pedir alterações: `hdd-worker review request-changes story-1c4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c4 --reason "<razão>"`


---

<!--
  Tier-C template — full briefing, sem limite estricto de palavras.

  Story 1.a.8 (F8 FR-070..076, D-019). Superset do Tier-B + diff opcional.

  Renderizado por `summaryGenerator.finalize()`. Tier-C inclui git diff
  unified dentro de fence ```diff (Q-A8-3 Recommended); side-by-side fica
  para v1.1+. Quando `diffAgainst` é undefined, a section "Diff" exibe
  "(no diff requested)" como placeholder.
-->
---
workflowId: story-1c4
workflowName: Story 1.c.4 — CI GitHub Actions + bun build --compile + Renovate
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.4 — CI GitHub Actions + bun build --compile + Renovate

### Contexto detalhado

4ª story de operações do Epic 1.c — gate de CI + artifact reproduzível + manutenção de deps. Descoberta: ci.yml já existia (criado por 1.b.3-1.b.5) → MODIFY, não NEW. Fecha o ciclo código→validação→binário antes do deploy SSH (1.c.5). AR-017/AR-111/D-04.11'/NFR-P1.

### O que foi feito (verbose)

- **.github/workflows/ci.yml** — MODIFY: +step test:security +step build:compile (bun build --compile src/cli/hdd-worker.ts + smoke --help); jobs 1.b preservados.
- **.github/workflows/release.yml** — NEW: tag v*/dispatch → license-checker (failOn GPL/AGPL/LGPL) + compile + upload-artifact; sem auto-deploy.
- **renovate.json** — NEW: patch automerge; minor/major manual; vulnerability automerge; runtime/binários NUNCA (regra final, vence security).
- **scripts/measure-ci-time.sh** — NEW: proxy local do <60s (9s real); número autoritativo = GH Actions UI.

### Full file list

- **.github/workflows/ci.yml** — MODIFY: +step test:security +step build:compile (bun build --compile src/cli/hdd-worker.ts + smoke --help); jobs 1.b preservados.
- **.github/workflows/release.yml** — NEW: tag v*/dispatch → license-checker (failOn GPL/AGPL/LGPL) + compile + upload-artifact; sem auto-deploy.
- **renovate.json** — NEW: patch automerge; minor/major manual; vulnerability automerge; runtime/binários NUNCA (regra final, vence security).
- **scripts/measure-ci-time.sh** — NEW: proxy local do <60s (9s real); número autoritativo = GH Actions UI.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | ci.yml MODIFY incremental (não rewrite). | Já existia (1.b.3-1.b.5); convention rot benigno; preservar verify-redaction/truffleHog/pentest/integration. | Q-C4-1 |
| 2 | Entry compile = src/cli/hdd-worker.ts. | Entry real de produção (1.c.1); StorySpec src/main.ts impreciso; package.json/systemd intactos. | Q-C4-2 |
| 3 | release.yml em tag v* + workflow_dispatch. | Release deliberado/versionado; deploy continua SSH manual (1.c.5). | Q-C4-3 |
| 4 | Renovate D-04.11'; runtime nunca automerge vence security. | Estabilidade do runtime > velocidade do patch; security-patch do Bun não auto-mergir sem revisão. | Q-C4-4 |

### Trade-offs aplicados (narrativa)

- StorySpec dizia ci.yml 'created' + entry src/main.ts; realidade = MODIFY + src/cli/hdd-worker.ts. Fidelidade ao estado/produção > literal do spec.
- measure-ci-time.sh é proxy local (9s), não o wall-clock real do CI — o número <60s autoritativo só se confirma no GH Actions UI após o 1º push (open item honesto, sem afirmar 'verificado').

### Open items deferidos (com onde serão resolvidos)

- **O-C4-1:** Confirmar <60s no GH Actions UI após o 1º push (proxy local = 9s, mas CI inclui setup-bun/install/jobs paralelos).
- **O-C4-2:** Validar license-checker no GH real (compat com node_modules do bun); ajustar se a ferramenta falhar.
- **O-C4-3:** Renovate App tem de estar instalada no repo GitHub para o renovate.json ter efeito (onboarding PR).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 280 pass / 2 skip / 0 fail (sem regressão; só YAML/JSON/sh novos)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes; 0 TS novo)
- **Build:** bun build --compile rc=0 (~440ms); dist/hdd-worker --help rc=0
- **CI proxy:** 9s local (alvo <60s; autoritativo GH UI)
- **Deps adicionadas:** 0

### Próximos passos sugeridos

1. Operador aprova `approve story-1c4` → marco done + commit `feat(story-1c4): CI build:compile + release.yml + Renovate (AR-017/D-04.11')`. Push TOCA .github/workflows → scope workflow já presente (push normal); confirmar tempos no GH Actions UI após push (O-C4-1).
2. Sprint 0: 20/22 done. Epic 1.c: 5/7. Próxima: 1.c.5 (SSH restricted deploy — blocked_by 1.c.4 agora resolvido).

### Diff vs `HEAD`

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c9aacf7..f2a489d 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -34,6 +34,18 @@ jobs:
       - name: Test
         run: bun test
 
+      # Story 1.c.4 (AR-017) — gate de segurança explícito (subset rápido).
+      - name: Security suite
+        run: bun run test:security
+
+      # Story 1.c.4 (AR-017/NFR-P1) — binário standalone reproduzível. O smoke
+      # `--help` prova que o binário compilado arranca sem Bun externo. dist/ é
+      # gitignored (artifact, não fonte). Entry = src/cli/hdd-worker.ts (Q-C4-2).
+      - name: Build (compile standalone)
+        run: |
+          bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker
+          ./dist/hdd-worker --help
+
       # Story 1.b.3 (AO-160/166) — gate de redaction de secrets
       - name: Verify redaction (no secret survives)
         run: bun run scripts/verify-redaction.ts

```

---

→ Aprovar: `hdd-worker review approve story-1c4` · Pedir alterações: `hdd-worker review request-changes story-1c4 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c4 --reason "<razão>"`

