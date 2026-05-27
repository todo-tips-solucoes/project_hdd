# Sprint Change Proposal — D-050: Roteamento LLM por fase (impl. API default)

- **Data:** 2026-05-27
- **Projeto:** projeto_hdd (HORSE DRIVEN DEVELOPMENT)
- **Autor / aprovador:** operador (solo-op — acumula PM/Arquiteto/Dev)
- **Workflow:** `bmad-correct-course` (modo incremental)
- **Decisão criada:** **D-050** (sucede D-049)
- **Estado:** ✅ Aprovado e ratificado nos artefatos canónicos

---

## Secção 1 — Issue Summary

Durante o arranque do Sprint 0, o operador determinou que o **runtime do produto HDD** deve rotear LLM **por fase do pipeline BMAD**, e não por criticidade como definia a D-044:

- **Planejamento** (Análise → Planejamento → Solução), interativo e com humano no loop → **Anthropic Max 20x** (`claude --print`, budget = janela, R$0 marginal).
- **Implementação autónoma** (dev / review / qa), não-supervisionada 24/7 → **Anthropic API pay-per-token** por **default**.

**Racional do operador:** o worker autónomo roda unattended e não pode conduzir sessão interativa Max 20x de forma fiável e ToS-compliant. A API oficial é o caminho programático correto para automação contínua. Isto **aposenta o risco D-032** (uso de `claude --print` para automação = ACCEPTED RISK de ToS) na carga pesada.

**Escolha de ratificação (questão ao operador):** *"API como default, Max 20x fallback"* — não é reversão total da D-017; mantém **single-provider Anthropic** e conserva o Max 20x como **overflow/fallback configurável** da implementação, além do planejamento.

## Secção 2 — Impact Analysis

### Conflito com decisão fundacional D-017
A D-017 tinha duas partes:
- *"Sem multi-provider"* → **permanece verdadeira** (API ainda é Anthropic; é dual-mode de acesso, não multi-provider).
- *"Budget = janela, não USD"* → **flexibilizada**: a implementação passa a incorrer USD metered por default.

### Inversão da lógica de custo D-044
A D-044 colocou a fase token-heavy (dev/review/qa) no Max 20x (R$0 marginal) justamente para honrar "não USD". A D-050 inverte: a fase token-heavy vai para API metered. Como o worker autónomo basicamente só faz implementação, **quase todo o consumo do worker migra para API pay-per-token**.

### Trade-off
| Ganha | Custa |
|---|---|
| Elimina risco ToS D-032 na carga pesada | Custo USD recorrente na fase mais pesada |
| Caminho programático fiável p/ automação 24/7 | Cost model AO-151 precisa ser recomputado |
| Max 20x preservado p/ planejamento + overflow | Budget deixa de ser "só janela" |

### Artefatos impactados
- **PRD:** FR-060, FR-064, FR-065, G-3, A-07/§5.2, O-3/§5.1, não-objetivos.
- **Architecture:** constraints rígidos, D-032 (mitigado), AO-24 (reframed), **AO-151 (recompute — crítico)**, AO-153, F7.
- **Epics:** Seção G (AR-090), **Story 6.a.1** (inverte role-based selection), **Story 1.a.10** (adapters foundational — SDK passa a servir Sonnet impl.), Story 6.b.1 (downgrade/overflow), Goal Epic 6, FR restatements, mapeamento, header B.

## Secção 3 — Recommended Approach

**Direct Adjustment** — modificar os artefatos no plano existente (sem rollback, sem replan completo). A mudança é de roteamento/billing; não altera o desenho hexagonal nem o pipeline de stories. Stories 6.a.1 e 1.a.10 absorvem o grosso da mudança de comportamento; as demais edições são propagação textual.

**Ação pendente fora deste proposal:** recomputar o cost model (`docs/cost-model.md`, AO-151) com pricing real da API para ~2-3M tokens/mês de implementação + definir o **cost cap mensal USD** e o **ponto de overflow** para Max 20x. Sem o cost cap configurado, a Story 6.a.1 não tem o limiar do AC-5.

## Secção 4 — Detailed Change Proposals

Todas as edições abaixo foram **aprovadas (incremental, "aprovar todos") e aplicadas**.

### PRD (`prds/prd-projeto_hdd-2026-05-20/prd.md`)
- FR-060 → budget híbrido dual-mode (D-050).
- FR-064 → seleção de modo de acesso por fase.
- FR-065 → overflow Max 20x ou downgrade de modelo.
- G-3 → single-provider mantido; budget híbrido.
- A-07/§5.2, O-3/§5.1, "Max 20x activo", não-objetivos → citam D-017/D-050.

### Architecture (`architecture.md`)
- Constraints rígidos → acesso dual-mode (D-050).
- D-032 → "largamente MITIGADO por D-050; risco residual só no overflow automatizado".
- AO-24 → reframed: switch→API é default; runbook cobre o inverso (overflow→Max 20x).
- AO-151 → **RECOMPUTADO**: custo USD recorrente é o eixo principal + cost cap + overflow.
- AO-153 → rehearsal (b) valida caminho API default + ensaia overflow→Max 20x.
- F7 → dual-mode + cost cap USD.

### Epics (`epics.md`)
- **Story 6.a.1** → User Story + AC-1 invertidos (Dev → AnthropicSDKAdapter Sonnet API default); **novo AC-5** (overflow→Max 20x ao bater cost cap); ao_subset += D-050.
- **Story 1.a.10** → título + User Story (SDK serve Sonnet+Haiku; CLI Max 20x = planejamento/overflow); AC do SDK testa role dev/Sonnet; AC do CLI marcado como fallback; ao_subset += D-050.
- Seção G / AR-090 → impl. via API default; Max 20x fallback.
- Goal Epic 6 → budget híbrido + observability (tokens + USD + % janela).
- Story 6.b.1 → downgrade/overflow reframe.
- FR-060/064/065 restated, mapeamento FR-064, header B, ARs covered → citam D-050.

## Secção 5 — Implementation Handoff

- **Escopo:** **MAJOR** (reescreve decisão fundacional propagando por PRD + Architecture + Epics), executado como Direct Adjustment porque não muda arquitetura de código nem o pipeline.
- **Handoff:** solo-op (operador) — sem coordenação multi-pessoa.
- **Próximas ações concretas:**
  1. **AO-151** — recomputar `docs/cost-model.md` + definir cost cap USD mensal e ponto de overflow (pré-requisito do AC-5 da Story 6.a.1).
  2. Refletir D-050 em `docs/runbooks/ban-Anthropic-emergency.md` quando a Story 6.b.2 for trabalhada (overflow é agora o caminho normal, não só emergência).
  3. Nenhuma alteração ao Sprint 0 Day 1 (Story 1.c.7 — bmad-cli smoke test) — segue intocada; D-050 só aterrissa em código no Epic 1.a (Story 1.a.10) e Epic 6.a (Story 6.a.1).
- **Success criteria:** artefatos canónicos consistentes (✅ feito); cost model recomputado com cap definido (⏳ AO-151); Story 6.a.1 implementa roteamento por fase + overflow conforme novos ACs.

---

### Registo da decisão

**D-050 (2026-05-26, ratificada 2026-05-27):** Runtime HDD roteia LLM por fase — implementação (dev/review/qa) via Anthropic API pay-per-token por default (ToS-safe); Max 20x para planejamento interativo + overflow/fallback configurável. Single-provider Anthropic preservado (D-017); flexibiliza "budget = janela, não USD". Mitiga D-032. Exige recompute do cost model AO-151.
