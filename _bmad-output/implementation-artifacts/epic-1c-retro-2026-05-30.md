# Retrospetiva — Sprint 0 (Epics 1.a + 1.b + 1.c)

**Data:** 2026-05-30 · **Facilitador:** Amelia (Developer) · **Project Lead:** operador
**Âmbito:** fecho do Sprint 0 completo (foco no Epic 1.c, recém-concluído) + continuidade da retro do Epic 1.b (`epic-1b-retro-2026-05-29.md`).
**Participantes (personas):** Amelia (Dev), John (PM), Mary (Analyst), Arquiteto.

## 1. Sumário do Sprint 0

| Métrica | Valor |
|---|---|
| Stories | **22/22 done** (Epic 1.a 10/10 · 1.b 5/5 · 1.c 7/7) |
| Testes | 285 pass / 2 skip (`skipIf` consciente) / 0 fail |
| Integração real | 16 specs (docker + fs/audit + healthz + backup + deploy) |
| CI | verde; `<60s` confirmado (job mais lento ~24s) |
| Disciplina | 13 dogfoods do summary generator (D-019); revisão humana em todas; 0 auto-aprovações |
| Incidentes | 1 — CI vermelho pré-existente (1.b.5), descoberto e corrigido nesta sessão |

## 2. O que correu bem (validado pelo Project Lead — 4/4)

- **Disciplina de processo:** ciclo BMAD canónico (Open Questions → dev-story → summary D-019 → revisão humana → 2 commits) deu previsibilidade e rasto de decisões.
- **D-053 / integração real:** provar comportamento real (não só mocks) + verificar o CI real pós-push apanhou bugs que ficariam escondidos.
- **Decisões honestas:** Open Questions sempre com alternativas (nunca empurrar o "Recommended"); o operador escolheu — ex. Q-C2-1 (CLIHELPER required, não-Recommended), Q-C4-4 (Renovate: runtime nunca-automerge vence security).
- **Fidelidade > spec literal:** divergir do StorySpec quando a realidade mandava (ci.yml MODIFY não NEW; entry `src/cli/hdd-worker.ts` não `src/main.ts`; `.hdd-state.db` não `data.db`; `.integration.test.ts` não `.test.sh`) evitou bugs silenciosos.

## 3. Padrões emergentes (lições que viajaram entre stories)

- **Alinhamento de path:** 1.c.3 (Litestream→mesma DB do worker) → reaplicado em 1.c.5 (audit-deploy→mesma chain). Uma lição propagou-se sem se perder.
- **Gate-como-artefacto:** `measure-ci-time.sh`, `runbook-completeness.sh` — travões executáveis contra erosão de convenções (anti `soft-convention-rot`).
- **`AuditEntry.type` string livre** (1.a.6) permitiu `DeployCompleted` (1.c.5) com zero src mod — arquitectura a pagar dividendos.

## 4. 🔑 Insight central — o D-053 estava certo mas incompleto

A retro do Epic 1.b cravou: *mock-only escondia bugs reais* → **D-053** (integração híbrida). Nesta sessão o **mesmo padrão repetiu-se um nível acima**: na 1.c.4 todos os gates locais estavam verdes, mas o `gh run watch` revelou um **CI vermelho desde a 1.b.5** — `pentest-report.ts` com `Bun.spawnSync(["bun"])` + path hardcoded, ambos falham no runner (a suite local nunca apanhava: `bun` no PATH global + path existente).

**Conclusão:** "real onde possível" tem de incluir **o CI real**, não só integração real local. A fronteira de engano deslocou-se de *mock-vs-real* para *local-vs-CI*. Materializado na memória `project-hdd-bun-spawn-ci-gotcha` + hábito `gh run watch` pós-push (extensão prática do D-053).

## 5. Continuidade com a retro do Epic 1.b

- **D-053 (action item central do 1.b):** ✅ aplicado e estendido (integração real em 1.c.1/1.c.3/1.c.5 + verificação de CI real). A própria sessão validou-o ao apanhar o bug de CI.

## 6. Action items (Sprint 0 → M1) — as 4 fricções priorizadas pelo Project Lead

| # | Action item | Owner | Critério de sucesso |
|---|---|---|---|
| **AI-S0-1** | Sinal proativo de CI vermelho — não depender de `gh run` manual. Mínimo: `gh run watch` pós-push como passo padrão (já em memória); avaliar branch protection / notificação. | operador + Dev | CI vermelho nunca passa ≥1 push despercebido |
| **AI-S0-2** | Integrar `runbook-completeness.sh` no `ci.yml` (fecha O-C6-2) — gate dos runbooks deixa de correr só local. | Dev | step no CI; runbook degradado parte o build |
| **AI-S0-3** | Consolidar open items diferidos (O-C4-2/3, O-C5-1/2, O-C6-1/2) em `readiness-open-items.md` com **TTL/trigger de revisão** (anti soft-convention-rot). | Mary/PM | registo único; cada item com condição de reabertura |
| **AI-S0-4** | Reconciliar imprecisões do `epics.md` vs realidade (O-A6-6): ci.yml created→modified, src/main.ts→src/cli/hdd-worker.ts, data.db→.hdd-state.db, .test.sh→.integration.test.ts. Via `correct-course` no arranque do M1 (não reescrever canon a meio). | John (PM) | divergências registadas; epics.md alinhado antes de stories que lhes tocam |

> **Nota de processo:** AI-S0-1 e AI-S0-2 são pequenos e apontam ambos para reforçar o CI — candidatos a um `fix(ci)` rápido (como o desta sessão) antes da 1ª story do M1, se o operador quiser.

## 7. Preview & Readiness — Epic 2: Worker Autónomo & Pipeline Bimodal (M1/Sprint 1)

7 stories: CLI `hdd-worker` + BMAD invoker + sub-agent contexts + gates Story→Dev e Dev→Review + lifecycle subcommands.

**Dependências do Sprint 0 (satisfeitas):**
- Story 2.1 `blocked_by [1.a.7, 1.a.8, 1.c.7]` → todos done ✅
- Story 2.2 (BMAD invoker) assenta no **D-052** (claude headless invoker, validado em 1.c.7) ✅
- CLI scaffold (`src/cli/hdd-worker.ts`, 1.c.1), audit, bootstrap, secrets, deploy — todos presentes ✅

**Atenção (não-bloqueante):**
- **2.1 é parcialmente MODIFY:** `files_modified` inclui `src/cli/hdd-worker.ts` (já existe, 1.c.1) e `src/main.ts` — esperar a mesma tensão MODIFY-vs-NEW da 1.c.4. Cruza com **O-C1-1** (consolidar `dev` script vs `hdd-worker start`).
- **webhook-mock (O-B5-3)** continua aberto — só relevante a partir do Epic 3 (inbound clihelper).

**Significant discovery alert:** ❌ nenhuma — nada do Sprint 0 muda fundamentalmente o plano do Epic 2. Direção sólida.

## 8. Readiness assessment do Sprint 0

| Dimensão | Estado |
|---|---|
| Testes & qualidade | ✅ 285 pass / 0 fail; integração real; CI verde |
| "Deploy" | N/A no piloto (sem produção live ainda); canal SSH pronto (1.c.5) |
| Aceitação | ✅ revisão humana + approve em todas as 22 stories |
| Saúde técnica | ✅ estável; src/ limpo; 0 deps supérfluas; type-check/lint verdes |
| Blockers carregados | nenhum bloqueante; 4 action items + open items diferidos (com plano) |

## 9. Key takeaways

1. **O sinal de verdade tem de estar onde não se possa ignorar** — o CI. Três das quatro fricções são variações disto (AI-S0-1/2/4).
2. **D-053 escala:** mock→real→CI-real. Verificar o CI real pós-push é agora hábito (memória registada).
3. **Fidelidade à realidade > spec literal**, mas isso gera divergência de canon que precisa de reconciliação periódica (AI-S0-4) — senão o `epics.md` apodrece (soft-convention-rot).
4. **Gates executáveis** (measure-ci-time, runbook-completeness) são a defesa estrutural contra rot — desde que corram no CI (AI-S0-2).

---

**Próximos passos:** (1) opcional `fix(ci)` rápido para AI-S0-1/2; (2) `bmad-sprint-planning` para abrir o M1; (3) rever os action items no arranque do Epic 2.
