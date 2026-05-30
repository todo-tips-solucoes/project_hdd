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
workflowId: story-1c6
workflowName: Story 1.c.6 — 8 Runbooks must-have
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.6 — 8 Runbooks must-have · projeto_hdd · 2026-05-30

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

6ª e última story do Epic 1.c — encerra o Sprint 0. 8 runbooks de incident-response com template uniforme de 5 secções + scanner anti-rot. Materializa AR-110/D-04.24 e a lição feedback-hdd-soft-convention-rot ('incident response não depende da memória de um único humano').

## O que foi feito

- **docs/runbooks/{ban-anthropic-emergency,hash-chain-corruption,vps-disk-full,manual-rollback}.md** — NEW: 4 runbooks accionáveis com comandos reais (systemctl, verify-audit-chain.ts, df, deploy.sh).
- **docs/runbooks/{whatsapp-template-rejection,clihelper-endpoint-down}.md** — NEW: features futuras (Epic WhatsApp/3) — accionável + [quando implementado], sem inventar.
- **docs/runbooks/{secret-rotation,litestream-restore}.md** — MODIFY: conformados ao template de 5 secções preservando conteúdo (Q-C6-3 aditivo).
- **scripts/runbook-completeness.sh** — NEW: gate — 8 must-have × 5 headings PT; exit≠0 se <5. Run: 8/8 5/5.
- **docs/runbooks/index.md** — NEW: 8 must-have + operacionais (ssh-deploy/systemd-deploy) + comando do scanner.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Scanner valida só os 8 must-have. | ssh-deploy/systemd-deploy são how-to operacional (index, fora do gate). | Q-C6-1 |
| 2 | 5 secções em PT. | Sintoma/Diagnóstico/Passos de Recuperação/Verificação/Post-mortem; coerente com CLAUDE.md. | Q-C6-2 |
| 3 | secret-rotation/litestream-restore MODIFY aditivo. | Estão nos 8; conformar preservando conteúdo testado, não reescrever destrutivo. | Q-C6-3 |
| 4 | Features futuras: escrever agora + [quando implementado]. | Cumpre a tese 'não depender de memória' já; sem inventar comandos de código futuro. | Q-C6-4 |

## Trade-offs aplicados

- O AC exigia um scanner não listado em files_created — criei-o (como o ci.yml na 1.c.4): o gate é o que dá força ao 'must-have' e impede rot futuro.
- Forçar secret-rotation (how-to de rotação) ao template Sintoma/Post-mortem é um pouco artificial, mas enquadrei rotação como incidente (planeada/comprometida) — honra o AC sem perder o conteúdo.

## Open items deferidos

- **O-C6-1:** whatsapp-template-rejection e clihelper-endpoint-down têm secções [quando implementado] — completar quando Epic WhatsApp/Epic 3 existirem.
- **O-C6-2:** Integrar runbook-completeness.sh no CI (step de gate) — candidato a próxima iteração de ci.yml; hoje corre local.
- **Sprint 0 close:** 22/22 done + epic-1c 7/7. Candidato a retrospectiva do Sprint 0 (epic-1c-retrospective: optional) antes de abrir o Sprint 1 / M1.

## Reviewer findings

_(nenhum)_

## Métricas

- **Runbooks:** 8/8 must-have com 5/5 secções (scanner rc=0) + index + 2 operacionais
- **Tests:** 285 pass / 2 skip / 0 fail (sem regressão — story só docs+bash)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos)
- **Deps adicionadas:** 0; src/ intacto

## Próximos passos sugeridos

1. Operador aprova `approve story-1c6` → marco done + commit `feat(story-1c6): 8 runbooks must-have + completeness gate (AR-110)`. Não toca workflows → push normal; verificar CI verde via gh run.
2. **Sprint 0 FECHADO: 22/22 done; Epic 1.c 7/7.** Próximo: retrospectiva opcional do Sprint 0 (bmad-retrospective) e abertura do Sprint 1 (M1) via sprint-planning.

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c6` · Pedir alterações: `hdd-worker review request-changes story-1c6 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c6 --reason "<razão>"`


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
workflowId: story-1c6
workflowName: Story 1.c.6 — 8 Runbooks must-have
date: 2026-05-30
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.6 — 8 Runbooks must-have

### Contexto detalhado

6ª e última story do Epic 1.c — encerra o Sprint 0. 8 runbooks de incident-response com template uniforme de 5 secções + scanner anti-rot. Materializa AR-110/D-04.24 e a lição feedback-hdd-soft-convention-rot ('incident response não depende da memória de um único humano').

### O que foi feito (verbose)

- **docs/runbooks/{ban-anthropic-emergency,hash-chain-corruption,vps-disk-full,manual-rollback}.md** — NEW: 4 runbooks accionáveis com comandos reais (systemctl, verify-audit-chain.ts, df, deploy.sh).
- **docs/runbooks/{whatsapp-template-rejection,clihelper-endpoint-down}.md** — NEW: features futuras (Epic WhatsApp/3) — accionável + [quando implementado], sem inventar.
- **docs/runbooks/{secret-rotation,litestream-restore}.md** — MODIFY: conformados ao template de 5 secções preservando conteúdo (Q-C6-3 aditivo).
- **scripts/runbook-completeness.sh** — NEW: gate — 8 must-have × 5 headings PT; exit≠0 se <5. Run: 8/8 5/5.
- **docs/runbooks/index.md** — NEW: 8 must-have + operacionais (ssh-deploy/systemd-deploy) + comando do scanner.

### Full file list

- **docs/runbooks/{ban-anthropic-emergency,hash-chain-corruption,vps-disk-full,manual-rollback}.md** — NEW: 4 runbooks accionáveis com comandos reais (systemctl, verify-audit-chain.ts, df, deploy.sh).
- **docs/runbooks/{whatsapp-template-rejection,clihelper-endpoint-down}.md** — NEW: features futuras (Epic WhatsApp/3) — accionável + [quando implementado], sem inventar.
- **docs/runbooks/{secret-rotation,litestream-restore}.md** — MODIFY: conformados ao template de 5 secções preservando conteúdo (Q-C6-3 aditivo).
- **scripts/runbook-completeness.sh** — NEW: gate — 8 must-have × 5 headings PT; exit≠0 se <5. Run: 8/8 5/5.
- **docs/runbooks/index.md** — NEW: 8 must-have + operacionais (ssh-deploy/systemd-deploy) + comando do scanner.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | Scanner valida só os 8 must-have. | ssh-deploy/systemd-deploy são how-to operacional (index, fora do gate). | Q-C6-1 |
| 2 | 5 secções em PT. | Sintoma/Diagnóstico/Passos de Recuperação/Verificação/Post-mortem; coerente com CLAUDE.md. | Q-C6-2 |
| 3 | secret-rotation/litestream-restore MODIFY aditivo. | Estão nos 8; conformar preservando conteúdo testado, não reescrever destrutivo. | Q-C6-3 |
| 4 | Features futuras: escrever agora + [quando implementado]. | Cumpre a tese 'não depender de memória' já; sem inventar comandos de código futuro. | Q-C6-4 |

### Trade-offs aplicados (narrativa)

- O AC exigia um scanner não listado em files_created — criei-o (como o ci.yml na 1.c.4): o gate é o que dá força ao 'must-have' e impede rot futuro.
- Forçar secret-rotation (how-to de rotação) ao template Sintoma/Post-mortem é um pouco artificial, mas enquadrei rotação como incidente (planeada/comprometida) — honra o AC sem perder o conteúdo.

### Open items deferidos (com onde serão resolvidos)

- **O-C6-1:** whatsapp-template-rejection e clihelper-endpoint-down têm secções [quando implementado] — completar quando Epic WhatsApp/Epic 3 existirem.
- **O-C6-2:** Integrar runbook-completeness.sh no CI (step de gate) — candidato a próxima iteração de ci.yml; hoje corre local.
- **Sprint 0 close:** 22/22 done + epic-1c 7/7. Candidato a retrospectiva do Sprint 0 (epic-1c-retrospective: optional) antes de abrir o Sprint 1 / M1.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Runbooks:** 8/8 must-have com 5/5 secções (scanner rc=0) + index + 2 operacionais
- **Tests:** 285 pass / 2 skip / 0 fail (sem regressão — story só docs+bash)
- **Type-check:** clean
- **Lint:** exit 0 (23 infos)
- **Deps adicionadas:** 0; src/ intacto

### Próximos passos sugeridos

1. Operador aprova `approve story-1c6` → marco done + commit `feat(story-1c6): 8 runbooks must-have + completeness gate (AR-110)`. Não toca workflows → push normal; verificar CI verde via gh run.
2. **Sprint 0 FECHADO: 22/22 done; Epic 1.c 7/7.** Próximo: retrospectiva opcional do Sprint 0 (bmad-retrospective) e abertura do Sprint 1 (M1) via sprint-planning.

### Diff vs `HEAD`

```diff

```

---

→ Aprovar: `hdd-worker review approve story-1c6` · Pedir alterações: `hdd-worker review request-changes story-1c6 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c6 --reason "<razão>"`

