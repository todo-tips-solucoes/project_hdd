# Story 1.c.7 — bmad-cli smoke test + Plan B fork docs · projeto_hdd · 2026-05-28

> Resumo Tier-B (per D-019 obrigatório). Gerado manualmente porque
> `summary-generator.service` ainda não existe (chega em Story 1.a.8).
> Reviewer humano: operador. Status até aprovação: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 1, primeira story implementacional pós-aprovação do pipeline BMAD (PRD v2 → Architecture D-040 → Epics D-045 → Readiness D-047 → Course Correction D-049 → Sprint Planning). Story bloqueia Epic 2 inteiro: valida (ou refuta) o invariante operacional "BMAD invocável non-interactive via CLI" assumido em D-043 (Bun substitui OpenClaw, BMAD via CLI-wrapper).

## O que foi feito

- **`scripts/smoke-bmad-cli.sh`** — bash smoke test idempotente, 3 probes (BMAD reachability, skill invocation surface, SKILL.md presence). Captura evidência em `.smoke-evidence/` com timestamp. Exit 0 PASS / 1 FAIL / 2 ENV-missing.
- **`docs/decisions/bmad-cli-vs-plan-b.md`** — ADR D-052 ACCEPTED. Documenta evidência verbatim do FAIL, compara 3 opções (Claude Code headless / re-implement TS / defer), regista escolha do operador (Opção A) e implicações downstream para Stories 1.b.4, 1.b.5, 1.c.1, 1.c.4, 2.2, AO-151.
- **`tests/integration/bmad-cli.test.sh`** — wrapper TAP-style do smoke. 6 assertions contra baseline D-052 (Probe 1 PASS, version 6.7.1, Probe 3 OK, Probe 2 FAIL preserved como baseline, smoke exit=1 esperado). Designed para CI (Story 1.c.4) detectar regressão em qualquer direcção — incluindo upstream BMAD começar a passar Probe 2 (sinal de stack change que obriga a revisitar D-052).
- **Evidência runtime** — `.smoke-evidence/smoke-20260528T143848Z.log` + `p1-status-*.out` + `p2-help-*.out` (gitignore candidate; ver Open items).
- **Este Resumo Tier-B** (`_bmad-output/implementation-artifacts/story-1c7-summary.md`) — Tier-B antecipado, manual.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID no log |
|---|---------|-------------------|-----------|
| 1 | Smoke test honesto: tenta 6 sintaxes plausíveis (`bmad-help`, `help bmad-help`, `skill`, `run`, `invoke`, `exec`) antes de declarar FAIL | Evita falso-FAIL por desconhecer nome do subcommand correcto. Custo: 6×~1s; benefício: certeza de que CLI realmente não tem essa surface | (in-story) |
| 2 | Adoptar **Claude Code headless (`claude -p`) como BMAD-invoker** | Mantém D-043 intacto, esforço cabe em Story 2.2 budget, zero divergência do upstream BMAD. Rejeitadas: re-implement TS (alto risco, perda de updates v6.8+), defer (estoura Sprint 1 inteiro) | **D-052** |
| 3 | Integration test usa baseline `EXPECTED_PROBE2_BASELINE=FAIL` com assertion explícita de que PASS também é regressão | Silent PASS no futuro mascararia mudança upstream relevante (poderia haver runner nativo melhor que `claude -p`). Custo: assertion mais ruidosa hoje | (in-story) |
| 4 | Bash 5 + `set -u` apenas (sem `-e`); gestão manual de exits | `set -e` torna probes ininterpretáveis (cada fail aborta antes da agregação). Trade-off: mais linhas, mais explícito | (in-story) |

## Trade-offs aplicados

- **Quis "smoke test em ≤30s", escolheu "smoke test ~11s real":** o budget está cumprido por larga margem; preferi 6 probe-attempts redundantes a 1 probe rápido, para tornar o FAIL evidente em vez de ambíguo.
- **Quis usar `bmad-method` como invoker, escolheu `claude -p`:** D-043 falou em "CLI-wrapper" assumindo que o wrapper-alvo era `bmad-method`. A realidade upstream é que `bmad-method` é installer-only; o "CLI-wrapper" passa a significar wrapper sobre `claude -p`. Decisão semântica, não arquitectural — porta `BmadInvokerPort` permanece igual.
- **Quis registar tudo no audit JSONL, escolheu prosa neste Tier-B:** audit JSONL adapter (Story 1.a.6) ainda não existe; registar eventos crus em ficheiros ad-hoc agora seria divergência. Evidência runtime fica em `.smoke-evidence/` como ficheiros opacos; campos críticos são reproduzidos in-line no ADR.

## Open items deferidos

- **O-1:** `.smoke-evidence/` deve entrar em `.gitignore`? Sugiro sim (ruído + timestamps non-deterministic); decisão fica para Story 1.a.1 (repo scaffold) que toca em `.gitignore`.
- **O-2:** Story 2.2 precisa de re-scoping leve para reflectir D-052 (mudança de "wrap `bmad-method`" para "wrap `claude -p`"). Não toca em estimativa de tokens; apenas no detalhe técnico. Resolver via `bmad-edit-story` antes de Sprint 1 começar.
- **O-3:** Pinning de versão `claude` CLI no projecto — quando? Sugestão: Story 1.c.4 (CI GitHub Actions) é o lugar natural, regista version pin + smoke trigger em cada bump.
- **O-4:** Cost model (AO-151, `docs/cost-model.md`) precisa adicionar assumption sobre `claude -p` invocations — adia para sessão de recomputação já planeada (per memória `project-hdd-cost-optimal-llm`).

## Reviewer findings

N/A — este é o output **antes** do gate de revisão humana. Operador revê este Resumo + os 3 ficheiros committable + decide `approve story-1c7` ou pede alterações.

## Métricas

- Janela LLM: ~5% Opus (única sessão; sem Sonnet/Haiku usado nesta story)
- Duração: ~1h elapsed
- Artefactos gerados: 4 (`smoke-bmad-cli.sh`, `bmad-cli-vs-plan-b.md`, `bmad-cli.test.sh`, este summary) + 3 evidence files em `.smoke-evidence/`
- Decisões registadas: 4 (1 humana = D-052; 3 in-story / técnicas)
- Probes corridos: 3 (P1 PASS / P2 FAIL=baseline / P3 OK)
- Tests passing: 6/6 (integration TAP)
- AC binary cobertos: AC-1 (FAIL detectado correctamente) ✓ · AC-2 (decisão Plan B registada antes de continuar) ✓

## Próximos passos sugeridos

1. **Operador aprova** com `approve story-1c7` → Dev marca `1-c-7-bmad-cli-smoke-test-plan-b-fork-docs: backlog → done` e `epic-1c: backlog → in-progress` em `sprint-status.yaml`; commit dos 4 ficheiros + Resumo. (Nota: per CLAUDE.md confirmar antes de push.)
2. **Story 1.a.1 (Bun base scaffold)** — próxima na ordem do Sprint 0 (não tem `blocked_by` agora que 1.c.7 está done); arranca o repo Bun real. `.gitignore` desta story deve incluir `.smoke-evidence/` (O-1).
3. **Re-scope leve de Story 2.2** — actualizar StorySpec para reflectir D-052 (Opção A: `claude -p` wrapper). Pode acontecer em paralelo ou no momento de criar a story file (Sprint 1 Day 1).

→ Ver Tier-C: `(N/A — generator chega em 1.a.8)` · Aprovar: `approve story-1c7` · Pedir alterações: `request-changes story-1c7 <razão>`
