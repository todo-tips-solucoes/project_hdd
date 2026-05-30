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
workflowId: story-1c5
workflowName: Story 1.c.5 — SSH restricted deploy
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.5 — SSH restricted deploy · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

5ª story de operações do Epic 1.c — deploy auditável sem shell livre. SSH forced-command (command=/opt/hdd/scripts/deploy.sh) → operador faz `ssh hdd-worker@vps deploy <sha>` e nada mais; cada deploy regista DeployCompleted na hash-chain do worker. Complementa o release.yml (1.c.4). NFR-S6/AR-112/D-04.25.

## O que foi feito

- **scripts/audit-deploy.ts** — NEW: recordDeploy() — adapter directo (sem bootstrap) append DeployCompleted{commitSha} runId deploy-<sha>; zero src mod (AuditEntry.type é string).
- **scripts/deploy.sh** — NEW: forced-command target; parseia $SSH_ORIGINAL_COMMAND; valida sha ^[0-9a-f]{7,40}$ antes de git; build+restart+audit.
- **scripts/install-authorized-keys.sh** — NEW: instala linha command=…+hardening; valida pubkey; 0600/0700; idempotente; não cria user.
- **tests/integration/deploy.integration.test.ts** — NEW: AC2 audit round-trip real + AC1 deploy.sh rejeita shell-livre/sha-inválido via bash (5 specs, sem sshd).
- **docs/runbooks/ssh-deploy.md** — NEW: key/forced-command, fluxo deploy, verificação audit, troubleshooting.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Registo via script standalone audit-deploy.ts. | Monta adapter directo, sem bootstrap completo; zero src mod. AuditEntry.type string livre. | Q-C5-1 |
| 2 | deploy.sh: git checkout + bun build + restart. | Binário fresco da fonte; bun na VPS garantido; forward-only. | Q-C5-2 |
| 3 | .integration.test.ts (não .test.sh). | Corre em test:integration; ambos ACs reais sem sshd (.test.sh fica órfão). | Q-C5-3 |
| 4 | runId = deploy-<sha>. | Legível; correlaciona com o commit; seq/ts distinguem re-deploys. | Q-C5-4 |

## Trade-offs aplicados

- audit-deploy.ts via bun (não subcommand) evita tocar src/cli, mas exige bun na VPS — aceitável porque o deploy já recompila com bun (Q-C5-2).
- Segurança concentrada na validação do sha em bash: ^[0-9a-f]{7,40}$ ANTES de git (fronteira anti-injection do $SSH_ORIGINAL_COMMAND); flags no-pty/no-forwarding no authorized_keys completam o hardening.

## Open items deferidos

- **O-C5-1:** Forced-command end-to-end com sshd real (testado via bash + env; o SSH layer em si fica para drill de host).
- **O-C5-2:** Restart precisa de polkit/sudoers p/ hdd-worker reiniciar a unit (host setup, documentado no runbook).
- **O-C4-2/3 acumula:** license-checker no release.yml e instalação da Renovate App ainda por confirmar (1.c.4).

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 285 pass / 2 skip / 0 fail (era 280; +5 deploy)
- **Integration:** 16 pass / 2 skip / 0 fail
- **Type-check:** clean
- **Lint:** exit 0 (23 infos; 1 formatter fixado)
- **Deps adicionadas:** 0; src/ intacto
- **Segurança:** forced-command + sha regex anti-injection + DeployCompleted na hash-chain

## Próximos passos sugeridos

1. Operador aprova `approve story-1c5` → marco done + commit `feat(story-1c5): SSH restricted deploy + DeployCompleted audit (NFR-S6/AR-112)`. Não toca workflows → push normal; verificar CI verde via gh run após push.
2. Sprint 0: 21/22 done. Epic 1.c: 6/7. Próxima e última do epic: 1.c.6 (8 runbooks must-have; blocked_by 1.c.2+1.c.3 done).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c5` · Pedir alterações: `hdd-worker review request-changes story-1c5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c5 --reason "<razão>"`


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
workflowId: story-1c5
workflowName: Story 1.c.5 — SSH restricted deploy
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.5 — SSH restricted deploy

### Contexto detalhado

5ª story de operações do Epic 1.c — deploy auditável sem shell livre. SSH forced-command (command=/opt/hdd/scripts/deploy.sh) → operador faz `ssh hdd-worker@vps deploy <sha>` e nada mais; cada deploy regista DeployCompleted na hash-chain do worker. Complementa o release.yml (1.c.4). NFR-S6/AR-112/D-04.25.

### O que foi feito (verbose)

- **scripts/audit-deploy.ts** — NEW: recordDeploy() — adapter directo (sem bootstrap) append DeployCompleted{commitSha} runId deploy-<sha>; zero src mod (AuditEntry.type é string).
- **scripts/deploy.sh** — NEW: forced-command target; parseia $SSH_ORIGINAL_COMMAND; valida sha ^[0-9a-f]{7,40}$ antes de git; build+restart+audit.
- **scripts/install-authorized-keys.sh** — NEW: instala linha command=…+hardening; valida pubkey; 0600/0700; idempotente; não cria user.
- **tests/integration/deploy.integration.test.ts** — NEW: AC2 audit round-trip real + AC1 deploy.sh rejeita shell-livre/sha-inválido via bash (5 specs, sem sshd).
- **docs/runbooks/ssh-deploy.md** — NEW: key/forced-command, fluxo deploy, verificação audit, troubleshooting.

### Full file list

- **scripts/audit-deploy.ts** — NEW: recordDeploy() — adapter directo (sem bootstrap) append DeployCompleted{commitSha} runId deploy-<sha>; zero src mod (AuditEntry.type é string).
- **scripts/deploy.sh** — NEW: forced-command target; parseia $SSH_ORIGINAL_COMMAND; valida sha ^[0-9a-f]{7,40}$ antes de git; build+restart+audit.
- **scripts/install-authorized-keys.sh** — NEW: instala linha command=…+hardening; valida pubkey; 0600/0700; idempotente; não cria user.
- **tests/integration/deploy.integration.test.ts** — NEW: AC2 audit round-trip real + AC1 deploy.sh rejeita shell-livre/sha-inválido via bash (5 specs, sem sshd).
- **docs/runbooks/ssh-deploy.md** — NEW: key/forced-command, fluxo deploy, verificação audit, troubleshooting.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Registo via script standalone audit-deploy.ts. | Monta adapter directo, sem bootstrap completo; zero src mod. AuditEntry.type string livre. | Q-C5-1 |
| 2 | deploy.sh: git checkout + bun build + restart. | Binário fresco da fonte; bun na VPS garantido; forward-only. | Q-C5-2 |
| 3 | .integration.test.ts (não .test.sh). | Corre em test:integration; ambos ACs reais sem sshd (.test.sh fica órfão). | Q-C5-3 |
| 4 | runId = deploy-<sha>. | Legível; correlaciona com o commit; seq/ts distinguem re-deploys. | Q-C5-4 |

### Trade-offs aplicados (narrativa)

- audit-deploy.ts via bun (não subcommand) evita tocar src/cli, mas exige bun na VPS — aceitável porque o deploy já recompila com bun (Q-C5-2).
- Segurança concentrada na validação do sha em bash: ^[0-9a-f]{7,40}$ ANTES de git (fronteira anti-injection do $SSH_ORIGINAL_COMMAND); flags no-pty/no-forwarding no authorized_keys completam o hardening.

### Open items deferidos (com onde serão resolvidos)

- **O-C5-1:** Forced-command end-to-end com sshd real (testado via bash + env; o SSH layer em si fica para drill de host).
- **O-C5-2:** Restart precisa de polkit/sudoers p/ hdd-worker reiniciar a unit (host setup, documentado no runbook).
- **O-C4-2/3 acumula:** license-checker no release.yml e instalação da Renovate App ainda por confirmar (1.c.4).

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 285 pass / 2 skip / 0 fail (era 280; +5 deploy)
- **Integration:** 16 pass / 2 skip / 0 fail
- **Type-check:** clean
- **Lint:** exit 0 (23 infos; 1 formatter fixado)
- **Deps adicionadas:** 0; src/ intacto
- **Segurança:** forced-command + sha regex anti-injection + DeployCompleted na hash-chain

### Próximos passos sugeridos

1. Operador aprova `approve story-1c5` → marco done + commit `feat(story-1c5): SSH restricted deploy + DeployCompleted audit (NFR-S6/AR-112)`. Não toca workflows → push normal; verificar CI verde via gh run após push.
2. Sprint 0: 21/22 done. Epic 1.c: 6/7. Próxima e última do epic: 1.c.6 (8 runbooks must-have; blocked_by 1.c.2+1.c.3 done).

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-1c5` · Pedir alterações: `hdd-worker review request-changes story-1c5 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c5 --reason "<razão>"`

