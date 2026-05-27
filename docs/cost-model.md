---
title: "Cost Model — HDD (HORSE DRIVEN DEVELOPMENT)"
status: approved
created: 2026-05-26
aprovado_por: paulotodo
aprovado_em: 2026-05-26 (approve ao151)
owner: paulotodo
ação_aberta: AO-151
disparado_por: D-050
decisão_nova: D-051
consumido_por: ["Story 6.a.1 (AC-5)", "Story 6.a.2", "Story 6.a.3"]
document_output_language: pt-PT
---

# Cost Model — HDD

> **Recompute do AO-151**, disparado pela **D-050** (roteamento LLM por fase,
> ratificada 2026-05-27). Substitui a economia da D-044, em que a fase
> token-heavy corria em Max 20x a R$0 marginal. Com a D-050 a implementação
> (dev/review/qa) corre na **Anthropic API pay-per-token por default** (ToS-safe);
> o Max 20x fica para planejamento + overflow/fallback. Como o worker autónomo
> basicamente só faz implementação, **quase todo o consumo do worker migra para
> API metered** — e o custo USD recorrente passa a ser o eixo principal.

---

## 1. Tabela de pricing (verificada)

Preços oficiais da Anthropic API, em **USD por milhão de tokens (MTok)**.

| Modelo | Papéis (D-050) | Input base | Cache write 5m | Cache read (hit) | Output |
|---|---|---|---|---|---|
| **Claude Sonnet 4.6** | dev / reviewer / qa | $3,00 | $3,75 | **$0,30** | $15,00 |
| **Claude Haiku 4.5** | classifier / gap-detector | $1,00 | $1,25 | $0,10 | $5,00 |

- **Fonte:** [VERIFICADO via `docs.claude.com/en/docs/about-claude/pricing`, consultado 2026-05-26].
- Cache read (hit) = **0,1×** do input base; cache write 5m = **1,25×**; cache write 1h = **2×**.
- **Cache hit poupa ~90%** no input reutilizado (eixo central da economia em loops agênticos).
- **Taxa de câmbio:** **R$5,00/USD** [ASSUNÇÃO confirmada pelo operador 2026-05-26 — coerente com a D-017, que equipara $200 ≈ R$1000]. Reavaliar mensalmente.

> O Max 20x (subscrição ~$200/m ≈ R$1000) **não tem custo marginal por token** —
> é janela. O overflow para Max 20x é, em USD, sempre "grátis" (ver Secção 4).

---

## 2. Baseline de volume e decomposição

**Baseline (de AO-151 / architecture):** implementação ≈ **2–3M tokens/mês** na API.
Tratado aqui como **throughput mensal total** de tokens da fase de implementação
(input fresh + cache-read + output somados), dominado por Sonnet 4.6; o
classifier (Haiku 4.5) representa ~5% do volume e é desprezável no custo.

**Mix de decomposição [ASSUNÇÃO a calibrar contra produção — AO-151 reavalia mensal]:**

| Categoria | % do total | Racional |
|---|---|---|
| Cache-read (input reutilizado) | **60%** | input ≈ 80% do total; cache hit ~75% nesse input → 0,75×0,80 = 60% |
| Input fresh (1ª ocorrência / cache-write) | **20%** | 0,25×0,80; loops agênticos reenviam contexto, mas a maior parte é hit |
| Output (código + reasoning) | **20%** | tokens gerados; **dominam o custo** ($15/MTok) |

> O **cache reuse de ~75%** (via `--resume`/`sessionId` + `cache_control: ephemeral`,
> per D-044/AR-093) é o que mantém o custo de input baixo: 60% do volume sai a
> $0,30/MTok em vez de $3,00/MTok.

**Custo blended por 1M tokens-total (Sonnet 4.6):**

```
0,60M × $0,30  (cache-read)  = $0,18
0,20M × $3,00  (input fresh) = $0,60
0,20M × $15,00 (output)      = $3,00
────────────────────────────────────
                      total  = $3,78 / 1M tokens-total
```

---

## 3. Cenários (3)

| Cenário | Tokens/mês | **USD/mês** | **R$/mês** (@R$5/USD) |
|---|---|---|---|
| **Baseline** | 2,0M | **$7,56** | R$37,80 |
| **Expected** | 2,5M | **$9,45** | R$47,25 |
| **Heavy** | 3,0M | **$11,34** | R$56,70 |

### Sensibilidade ao output (o driver de custo)

O custo é dominado pelo output ($15/MTok). Variante **conservadora** (output 35%
do total em vez de 20%; input fresh tarifado ao cache-write $3,75):

| Cenário conservador | Tokens/mês | USD/mês | R$/mês |
|---|---|---|---|
| Heavy + output-pesado | 3,0M | **~$17,65** | ~R$88 |

**Conclusão da Secção 3:** ao volume comprometido (2–3M/mês), a API custa
**~$8–18/mês (R$40–90)** — **uma ordem de grandeza abaixo** da subscrição Max 20x
($200) e abaixo do teto conservador da AO-153 ($25–50/sprint, que era um limite
superior, não uma estimativa central).

---

## 4. Break-even overflow → Max 20x

**O break-even em USD é degenerado.** O Max 20x já está pago ($200/m fixo) e tem
**custo marginal R$0 por token**. Logo, *em dólares*, fazer overflow para Max 20x
é **sempre** mais barato do que continuar na API — para qualquer volume > 0.

Portanto o **cost cap não é um break-even económico**; é um **teto de exposição
USD** escolhido pelo operador. O verdadeiro custo do overflow não é dinheiro, é:

- **Consumo de janela Max 20x** reservada para planejamento (silence > noise);
- **Risco ToS D-032** (uso de Max 20x para automação não-supervisionada —
  *largamente mitigado* pela D-050 precisamente por mover o caminho normal para a
  API; o overflow reintroduz o risco residual).

**Volume de disparo do overflow** = `cap_USD / custo_blended_por_MTok`:

| Custo/MTok | Cap $30 dispara a… |
|---|---|
| $3,78 (mix central) | **~7,9M tokens/mês** |
| $5,88 (conservador) | **~5,1M tokens/mês** |

Ou seja: sob carga normal (2–3M) o worker **nunca** atinge o cap; o overflow só
morde a **~1,7–4× o volume esperado** — exatamente um cenário de *runaway*
(tempestade de retries, loop patológico), que é quando se quer o travão.

---

## 5. Decisão de budget — D-051 (Postura B)

> **D-051 (2026-05-26) — Budget sobe; cap USD adicional para a API.**
> Decisão consciente do operador (paulotodo). **Postura B** escolhida sobre a A.

A D-017 calibrou o budget em **R$1000/m ≈ exatamente o custo da subscrição Max 20x
($200)** — i.e., headroom ≈ R$0. Com a D-050, qualquer gasto de API ultrapassa
R$1000. As duas posturas eram:

- **(A) Teto fixo R$1000 total** — o cap da API teria de caber dentro de R$1000 −
  subscrição ≈ R$0, forçando overflow precoce e estrangulando a fase de
  implementação 24/7 — **contradiz o propósito da D-050**. *Rejeitada.*
- **(B) Budget sobe** — R$1000 (Max 20x) **+** cap USD adicional. *Escolhida.*

### Números fixados

| Item | Valor |
|---|---|
| Subscrição Max 20x | $200/m (~R$1000) — inalterado |
| **Cost cap USD da implementação (API)** | **$30/mês** (~R$150) |
| **Novo teto total de budget LLM** | **~R$1150/mês** (R$1000 + R$150) |
| **Ponto de overflow** (impl. → Max 20x) | gasto API mês-a-data **≥ $30** → routes impl. para `ClaudeCliAdapter` (Max 20x) o resto do mês civil; reset mensal |

**Racional do cap $30:** ~1,7–4× headroom sobre o cenário heavy (bottom-up
$11–18); alinhado com o limite inferior do teto conservador AO-153 ($25–50/sprint);
arredondado para um número de configuração limpo. **Reavalia mensal** (AO-151) e
calibra contra o consumo real medido na Story 6.a.2 (telemetry tokens + USD + %
janela). A AO-151 permanece **MEDIUM confidence** até validada contra produção.

> Impacto registado por referência na D-017 (não reescrita) e na memória
> `project-hdd-llm-budget`. A parte *"sem multi-provider"* da D-017 mantém-se
> verdadeira (a API é Anthropic; é dual-mode de acesso, não multi-provider). A
> parte *"budget = janela, não USD"* fica **flexibilizada**: a implementação passa
> a incorrer USD metered por default, dentro do cap.

---

## 6. Contrato para as stories (o que consomem deste modelo)

| Story | Consome | Valor |
|---|---|---|
| **6.a.1 (AC-5)** | limiar do cost cap | `IMPL_API_MONTHLY_CAP_USD = 30` (config). Ao atingir → overflow `ClaudeCliAdapter` (Max 20x) + audit event |
| **6.a.2** | unidades de telemetry | reportar **tokens in/out + USD acumulado + % do cap + % janela Max 20x**; breakdown por sub-agente (Dev/Reviewer/QA/classifier) |
| **6.a.3** | thresholds de notificação | aplicar 80% **do cap USD** (além do 80% da janela) para WhatsApp warning |

**Config sugerida (`.env.example`):**
```
IMPL_API_MONTHLY_CAP_USD=30        # cost cap mensal da implementação (D-051)
LLM_COST_OVERFLOW_TARGET=max20x    # destino do overflow ao atingir o cap
USD_BRL_RATE=5.0                   # [ASSUNÇÃO] reavaliar mensal
```

---

## 7. Assumptions Index (a calibrar — AO-151 reavalia mensal)

| # | Assunção | Estado | Como validar |
|---|---|---|---|
| C-1 | Volume impl. 2–3M tokens/mês | [ASSUNÇÃO de AO-151] | Telemetry 6.a.2 nas 1ªs 10 dias Sprint 0 |
| C-2 | Mix 60/20/20 (cache-read/fresh/output) | [ASSUNÇÃO] | Medir distribuição real por sub-agente |
| C-3 | Cache hit ~75% | [ASSUNÇÃO, herdada D-044] | `cache_read_input_tokens` observável (6.a.1 AC-3) |
| C-4 | Taxa R$5,00/USD | [ASSUNÇÃO confirmada operador] | Reavaliar mensal vs câmbio real |
| C-5 | Pricing Sonnet 4.6 / Haiku 4.5 | [VERIFICADO 2026-05-26] | Re-check em mudança de modelo/preço |
| C-6 | Cap $30 dá folga suficiente | [DECISÃO D-051, provisória] | Re-review se window-consumption >70% em 10 dias (AO-151 trigger) |

---

## 8. Próximos passos

1. ✅ **Operador aprovou** o cap $30 e o novo teto R$1150 (`approve ao151`, 2026-05-26) — números finais.
2. Story 6.a.1 implementa `IMPL_API_MONTHLY_CAP_USD` + overflow (AC-5).
3. Story 6.a.2 instrumenta telemetry USD + tokens + % cap + % janela → calibra C-1/C-2/C-3.
4. Re-review mensal da AO-151 contra produção (gatilho: window-consumption >70% em 10 dias).
