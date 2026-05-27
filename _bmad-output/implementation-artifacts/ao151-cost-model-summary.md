---
title: "Resumo de Finalização (Tier-B) — AO-151 Recompute do Cost Model"
workflow: "AO-151 — Recompute do cost model (pós D-050)"
projeto: projeto_hdd
data: 2026-05-26T00:00:00Z
tier: B
status: approved
verdict: ready-to-merge
aprovado_por: operador
aprovado_em: 2026-05-26 (approve ao151)
document_output_language: pt-PT
---

# AO-151 — Recompute do Cost Model · projeto_hdd · 2026-05-26

## Contexto

Estamos na fase de **Solução/Planejamento** do ciclo BMM, em ação aberta pendente
da D-050 (roteamento LLM por fase, ratificada 2026-05-27). A D-050 moveu a
implementação (dev/review/qa) de Max 20x (R$0 marginal) para **Anthropic API
pay-per-token por default**; como o worker autónomo só faz implementação, quase
todo o consumo migra para API metered. O cost model precisava de ser refeito do
zero sobre essa realidade, e dois números dele bloqueiam stories do Epic 6.a.

## O que foi feito

- **`docs/cost-model.md`** (novo, committable) — cost model completo: tabela de
  pricing verificada, decomposição input/output/cache, 3 cenários, break-even,
  cap USD, ponto de overflow, postura de budget, assumptions index.
- **`project-hdd-llm-budget.md`** (memória, atualizada) — anexada secção D-051
  (não reescreve a D-017); ponteiro em `MEMORY.md` atualizado.
- **`ao151-cost-model-summary.md`** (este ficheiro) — Resumo Tier-B (D-019).

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---|---|---|
| 1 | Budget **sobe** (R$1000 + cap USD) em vez de teto fixo R$1000 | D-017 calibrou R$1000 ≈ exatamente a subscrição ($200) → headroom ≈ R$0; teto fixo forçaria overflow precoce e contradiria a D-050. *Não escolheu Postura A porque estrangularia o worker 24/7.* | **D-051** |
| 2 | **Cost cap impl. = $30/mês** (~R$150); teto total ~R$1150/m | ~1,7–4× folga sobre cenário heavy ($11–18); alinhado ao limite inferior do teto AO-153. *Não escolheu cap menor para não tornar overflow o caminho normal.* | D-051 |
| 3 | **Ponto de overflow** = gasto API mês-a-data ≥ cap → Max 20x o resto do mês | Limiar limpo e auditável; sob carga normal (2–3M) nunca dispara (só ~5–8M). Consumido por Story 6.a.1 AC-5. | D-050/D-051 |
| 4 | Break-even tratado como **teto de exposição**, não break-even económico | Max 20x marginal = R$0 → overflow é sempre USD-cheaper; o custo real do overflow é janela + risco ToS D-032, não dólares. | — |
| 5 | Taxa **R$5,00/USD** [ASSUNÇÃO confirmada] | Coerente com a D-017; reavaliar mensal. | — |

## Trade-offs aplicados

- **Quis honrar a D-017 ("budget = janela, não USD"), escolheu flexibilizá-la para
  a implementação:** a D-017 mantém-se intacta para planejamento e para
  "sem multi-provider"; só a fase de implementação passa a USD metered, dentro do cap.
- **Quis um break-even económico, encontrou um degenerado:** como o Max 20x é custo
  afundado, o overflow é sempre mais barato em USD — o cap virou política de risco,
  não otimização de dólares. Documentado explicitamente para evitar leitura errada.
- **Quis exatidão de pricing, evitou inventar:** todos os preços [VERIFICADOS] na
  página oficial; todo o resto (volume, mix, câmbio) marcado [ASSUNÇÃO] a calibrar.

## Open items deferidos

- **O-1:** Volume (2–3M) e mix (60/20/20) são assunções de planeamento → calibrar
  contra telemetry real (Story 6.a.2) nos primeiros 10 dias de Sprint 0.
- **O-2:** Cap $30 é provisório → re-review mensal da AO-151; gatilho de
  re-review = window-consumption >70% em 10 dias sem load.
- **O-3:** Registo formal da D-051 no decision-log canónico do projeto (se/onde
  existir além da memória) — fora do escopo desta sessão.

## Reviewer findings

Sem gate de reviewer automatizado (tarefa de planejamento solo-op). Auto-revisão:
0 critical · 0 high · 2 medium (O-1, O-2: assunções não validadas contra produção —
esperado, AO-151 mantém-se MEDIUM confidence até Sprint 0) · 1 low (O-3).

## Métricas

- Janela LLM: tarefa de planejamento em Max 20x (interactive) — sem custo USD.
- Artefactos gerados/alterados: 3 (1 novo doc + 1 memória + 1 ponteiro MEMORY.md) + este resumo.
- Decisões registadas: 5 (humanas: 2 — postura B + taxa câmbio; derivadas: 3).
- Fontes externas verificadas: 1 (pricing oficial Anthropic).

## Próximos passos sugeridos

1. ✅ **`approve ao151`** — cap $30 + teto R$1150 fixados como finais (2026-05-26).
2. Story 6.a.1 — implementar `IMPL_API_MONTHLY_CAP_USD` + overflow (AC-5), desbloqueada.
3. Story 6.a.2 — instrumentar telemetry USD/tokens/% cap/% janela → calibra O-1.
4. (Quando 6.b.2 for trabalhada) refletir overflow-como-caminho-normal no runbook `ban-Anthropic-emergency.md`.

---

**Estado:** ready-to-merge (aprovado `approve ao151` 2026-05-26) · **Open items:** 3 (calibração diferida p/ Sprint 0)
