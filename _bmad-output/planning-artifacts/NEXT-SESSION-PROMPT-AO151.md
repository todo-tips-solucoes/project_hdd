# NEXT SESSION — AO-151 · Recompute do Cost Model (pós D-050)

> Copia o bloco delimitado por triple-backticks abaixo para uma sessão limpa Claude Code.
> `MEMORY.md` + `CLAUDE.md` carregam automaticamente; o resto está em artefactos canónicos referenciados.
> **Esta é uma tarefa de PLANEJAMENTO → corre em Max 20x (D-050).**

---

```
És o Business Analyst / Arquiteto de custo do HDD (HORSE DRIVEN DEVELOPMENT,
project_name=projeto_hdd). Tarefa de planejamento — corre em Max 20x interativo.

## A tua tarefa

Executar **AO-151 — recompute do cost model** disparado pela decisão **D-050**
(roteamento LLM por fase, ratificada 2026-05-27). Produzir `docs/cost-model.md`
e definir dois números que a Story 6.a.1 (AC-5) e a 6.a.2 consomem:
  1. **cost cap USD mensal** da implementação;
  2. **ponto de overflow** impl.→Max 20x (quando o cap é atingido).

## Contexto crítico — o que mudou

Antes (D-044): a fase token-heavy (dev/review/qa) corria em Max 20x → R$0 marginal.
Agora (D-050): dev/review/qa correm na **Anthropic API pay-per-token por default**
(ToS-safe); Max 20x fica para planejamento + overflow/fallback. Como o worker
autónomo basicamente só faz implementação, **quase todo o consumo migra para API
metered**. O cost model precisa ser refeito do zero sobre essa nova realidade.

## Lê primeiro, nesta ordem (NÃO releias tudo — só estas secções)

1. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-27.md` — a D-050
   completa: racional, trade-off, escopo, e a Secção 5 que lista AO-151 como ação aberta.
2. `_bmad-output/planning-artifacts/architecture.md` — procura "AO-151" (já revisto:
   "implementação ~2-3M tokens/mês na API por default; custo USD recorrente é o eixo
   principal; definir cost cap mensal + ponto de overflow") e "AO-153".
3. `_bmad-output/planning-artifacts/epics.md` — procura "Story 6.a.1" (AC-5 precisa do
   cap como limiar) e "Story 6.a.2" (telemetry deve reportar tokens + USD + % janela).
4. Memórias (já no contexto via MEMORY.md): `project-hdd-llm-budget` (D-017: budget
   R$1000/m ≈ custo do Max 20x ~$200), `project-hdd-cost-optimal-llm` (D-044 + D-050).

## A TENSÃO central que tens de resolver e tornar explícita

A D-017 fixou budget = R$1000/m ≈ o próprio custo do Max 20x. Com a implementação
agora na API, há custo USD **adicional** por cima da subscription. Tens de decidir
e documentar uma de duas posturas (PERGUNTA AO OPERADOR qual ele quer):
  (A) **Teto fixo R$1000/m total** — então o cap USD da API tem de caber dentro,
      possivelmente exigindo throttle / mais reliance em overflow Max 20x.
  (B) **Budget sobe** — R$1000 (Max 20x) + cap USD adicional X; documentar o novo total.
Não decidas isto sozinho — é decisão de budget do operador.

## Como construir o modelo

- Baseline: **~2-3M tokens/mês** de implementação (vem de AO-151). Decompõe em
  input / output / cache-read — o pricing difere muito entre eles.
- **NÃO inventes pricing.** O teu knowledge cutoff pode estar desatualizado. Ou
  (a) faz WebSearch do pricing oficial atual da Anthropic API para
  `claude-sonnet-4-6` e `claude-haiku-4-5`, ou (b) pede os números ao operador.
  Marca claramente qualquer valor como [VERIFICADO via fonte X] ou [ASSUNÇÃO a confirmar].
- Modela 3 cenários: baseline (2M), expected (2.5M), heavy (3M) tokens/mês.
- Fatoriza o cache reuse (`--resume`/`cache_control: ephemeral`, ~75% nos hits) onde aplicável.
- Calcula o break-even: a partir de que volume o overflow→Max 20x compensa vs continuar na API.
- Converte USD→BRL com taxa marcada como [ASSUNÇÃO] (confirma a taxa que o operador usa).

## Outputs esperados desta sessão

1. `docs/cost-model.md` (committable) com: tabela de pricing (com fontes), 3 cenários,
   break-even, **cost cap USD/mês recomendado**, **ponto de overflow**, e a postura
   (A) ou (B) decidida com o operador.
2. Se a decisão de budget mudar o teto, regista como nova sub-decisão (D-051) e nota
   o impacto em `project-hdd-llm-budget` memory + na D-017 (via referência, não reescreve).
3. Resumo de Finalização Tier-B (D-019, revisão obrigatória) em
   `_bmad-output/implementation-artifacts/ao151-cost-model-summary.md` seguindo o
   template em `prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md`.
   (O summary-generator.service ainda não existe — escreve à mão.)

## Princípios não-negociáveis

- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/`) — read-only do installer.
- **NÃO inventes números de pricing** — verifica via fonte ou pergunta. Marca assunções.
- **Confirma com o operador antes de:** (a) escolher postura A vs B de budget;
  (b) push/commit; (c) fixar o cost cap como número final.
- Idioma: **português** em todos os artefactos (D-019 / [core].document_output_language).
- Esta tarefa NÃO altera código nem o Sprint 0 Day 1 (Story 1.c.7 segue intocada).

## Plano de comunicação

- **Antes de começar:** confirma em 2-3 linhas o que entendeste + plano.
- **A meio:** apresenta a postura A vs B + os números de pricing obtidos para validação.
- **No fim:** Resumo Tier-B + pede aprovação `approve ao151` antes de tratar como fechado.

Começa.
```

---

## Como usar

1. Abre uma nova sessão Claude Code em `/var/lib/projeto_hdd`.
2. Cola o bloco delimitado por triple-backticks acima.
3. `MEMORY.md` + `CLAUDE.md` carregam sozinhos; o prompt direciona aos 4 artefactos canónicos.
4. Confirma a 1ª resposta (2-3 linhas) antes de deixá-lo prosseguir.

## Riscos identificados para essa sessão

| Risco | Mitigação no prompt |
|---|---|
| Inventar pricing desatualizado | "NÃO inventes — WebSearch ou pergunta; marca assunções" |
| Decidir budget sozinho (A vs B) | "PERGUNTA AO OPERADOR qual postura" |
| Não fatorizar input/output/cache | Instrução explícita de decompor + cache reuse 75% |
| Esquecer que é planning (Max 20x) | Cabeçalho "tarefa de PLANEJAMENTO → Max 20x (D-050)" |
| Resumo Tier-B esquecido | Output #3 explícito + template path |
| Tocar em código / Story 1.c.7 | "NÃO altera código nem o Sprint 0 Day 1" |

**Ficheiro:** `_bmad-output/planning-artifacts/NEXT-SESSION-PROMPT-AO151.md`
