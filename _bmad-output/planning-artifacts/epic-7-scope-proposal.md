# Epic 7 — Proposta de escopo (rascunho para validação)

> **Status:** ✅ validado e formalizado em `epics.md` (2026-06-02) · **Autor:** Amelia (Dev) + operador
> **Direção decidida (sessão 2026-06-02):** Dogfooding real (#5), **faseado** (repo
> separado → meta-dogfood), **com harness de medição**, backlog seed proposto pela Dev.
> **Não implementar nesta sessão.** Saída: Epic 7 registrado em `epics.md` para execução.

---

## 1. Objetivo

Validar o HDD **usando-o para construir features reais**, de forma faseada e instrumentada:
primeiro num **repo-alvo separado** (calibração de baixo risco), depois no **próprio
`projeto_hdd`** (meta-dogfood, alinhado à visão). Cada onda é medida — taxa de sucesso
autônomo, correções, consumo de quota (**D-032**) — e cada falha/escalada vira **backlog**.

**Hipótese primária (a falsificar) — H-A Capacidade:** *"o HDD leva features reais de
ponta a ponta com o humano intervindo só nos 6 gates RF-03b."* É o pré-requisito de tudo:
sem capacidade comprovada, a meta-tese de externalização ([[project-hdd-externalisation-thesis]])
não chega a importar. Por isso H-A é a primária; externalização (H-B) e viabilidade de
quota (H-C) ficam como sinais **secundários**, observados mas não decisivos para o GO.

## 2. Por que faseado (separado → meta)

| Fase | Alvo | Risco | Para quê |
|---|---|---|---|
| **1 — Calibração** | Repo-alvo separado | Baixo | Medir baseline de sucesso e cadência de quota **sem** risco de auto-modificação. Gate GO/NO-GO. |
| **2 — Meta-dogfood** | `projeto_hdd` (via PR + gate) | Médio | O HDD melhora a si próprio — valida a visão e expõe gaps reais. Só após a fase 1 passar. |

## 3. Salvaguardas (invariantes — transversais a todas as stories)

1. **Sem auto-deploy.** No meta-dogfood o HDD **abre PR** no repo; **merge exige gate
   humano** (já é o fluxo 6.8) e **deploy continua manual**. O HDD **nunca** toca
   `compose.prod.yaml`, `secrets/` ou `deploy.env` autonomamente. (Invariante: produção
   roda nesta máquina — [[project-hdd-prod-on-dev-machine]].)
2. **Workspace efêmero sempre.** Ondas operam em clone isolado por onda (comportamento
   6.6), **nunca** na árvore de produção. Dev isolado com `-p hdd_dev`.
3. **D-032 é um sinal de parada.** O harness mede o consumo; se a cadência do dogfood
   ameaçar a conta Max, **pausa-se** e aciona-se a conversa do driver `api` (vira o
   próximo épico — direção #1), em vez de empurrar.
4. **Tooling verde** antes de qualquer merge; revisão humana obrigatória ([[feedback-hdd-mandatory-review]]).

## 4. Estrutura proposta (9 stories, 3 blocos)

### Bloco A — Harness de medição (transversal, primeiro)

#### Story 7.1: Harness de métricas de dogfood

> **Revisado pós-investigação (2026-06-02):** o `claude -p` no driver `subscription`
> **não emite tokens/custo/proximidade-de-limite** — `LlmResult` só tem `text/session_id/`
> `exit_code/raw` e a detecção de limite é pattern-match de 5 strings em stderr
> (`subscription.py`). O `quota_lease` conta **slots de concorrência internos**
> (`max_concurrent=2`), **não** uso da conta. Logo a métrica de D-032 **não pode** ser
> "consumo de tokens"; é reformulada como *pressão de quota observável*. Medição real de
> tokens/custo só com o driver `api` (Epic 8).

As a operador,
I want métricas por onda que provem a **hipótese de capacidade (H-A)** e instrumentem a salvaguarda D-032,
So that o dogfood seja mensurável e o GO da 7.6 seja fundamentado em dados, não em anedota.

**Acceptance Criteria:**

**Given** a observabilidade do Epic 3 (Prometheus/OTel) e ondas executando
**When** uma onda de dogfood completa (ou escala)
**Then** são registradas as **métricas primárias de capacidade (H-A)**: taxa de sucesso
autônomo (% ondas que chegam ao gate sem `ESCALATED`), nº de correções por onda,
nº de escaladas e **nº de intervenções fora do gate** (toda ação humana que não seja a decisão do gate)
**And** são registradas as **métricas de salvaguarda D-032 (sinais reais disponíveis)**:
nº de *hits* de limite (exceção `QuotaExhausted`), **tempo acumulado em `PAUSED_QUOTA`** e
tempo até retomar, e duração wallclock (`hdd_wave_duration_seconds`, já existente)
**And** o harness **não confunde** `no_quota` (teto interno de slots) com limite da conta Max — são rótulos distintos
**And** existe um relatório/painel de dogfood consolidando essas métricas por período
**And** as métricas reaproveitam a stack existente (sem novo sistema de telemetria); a
impossibilidade de medir tokens/custo no `subscription` é documentada (aponta para o driver `api`)

#### Story 7.2: Loop gaps → backlog

As a operador,
I want que cada escalada/falha/correção-repetida vire um registro de "gap" estruturado,
So that o aprendizado do dogfood realimente o backlog (fecha o ciclo da meta-tese).

**Acceptance Criteria:**

**Given** uma onda que escala (`ESCALATED`), falha, ou excede um limiar de correções
**When** o evento ocorre
**Then** um "gap" é registrado com contexto (onda, etapa, motivo, trecho de auditoria)
**And** o gap é exportável como candidato a story (ex.: issue/markdown) — não é descartado
**And** os gaps são listáveis para a retrospectiva (Story 7.9)

### Bloco B — Fase 1: calibração em repo-alvo separado

#### Story 7.3: Preparar repo-alvo de calibração

As a operador,
I want um repo-alvo separado real-o-suficiente (com suíte de testes que dê sinal de `verify`),
So that a fase 1 calibre o pipeline sem risco de auto-modificação.

**Acceptance Criteria:**

**Given** a decisão do alvo (ver §6, ponto 1)
**When** o repo é preparado (criado/configurado) e registrado como destino de ondas
**Then** ele tem uma suíte de testes que falha/passa de forma observável (sinal real para `verify`)
**And** o HDD consegue cloná-lo, abrir PR e (com gate) mergear — fluxo 6.6→6.8 validado nele
**And** **não** é o `hdd-smoke-test` trivial (precisa de features de verdade a construir)

#### Story 7.4: Onda de calibração nível 1 — feature trivial (baseline)

As a operador,
I want o HDD construir uma feature simples no repo-alvo,
So that eu meça o baseline do caminho feliz (sucesso sem correção).

**Acceptance Criteria:**

**Given** o repo-alvo (7.3) e o harness (7.1)
**When** inicio uma feature pequena e bem-especificada pelo painel
**Then** a onda percorre `enqueue → claude → verify → PR → gate → merge` com métricas capturadas
**And** o resultado (sucesso/correções/quota) fica registrado no harness

#### Story 7.5: Onda de calibração nível 2 — feature que exige correção

As a operador,
I want o HDD construir uma feature cuja primeira tentativa provavelmente falha o `verify`,
So that eu exercite o loop real `verify → CORRECTING → gate` e meça a recuperação.

**Acceptance Criteria:**

**Given** o repo-alvo (7.3) e o harness (7.1)
**When** inicio uma feature com requisito testável não-trivial
**Then** o `verify` dispara ≥1 ciclo de correção (sinal real, não placeholder)
**And** o harness registra correções, e gaps (se houver escalada) entram no loop (7.2)

#### Story 7.6: Gate de calibração — decisão GO/NO-GO para a fase 2

As a operador,
I want avaliar as métricas da fase 1 antes de deixar o HDD tocar a si próprio,
So that a fase 2 (meta) só comece com confiança operacional fundamentada em dados.

**Acceptance Criteria:**

**Given** as métricas de 7.4/7.5 no harness **e** os 2 invariantes de prontidão do
meta-dogfood verdes (ver pré-condições abaixo)
**When** reviso a calibração (gate humano, análogo ao gate de fundação 1.1)
**Then** decido **GO** — critério **qualitativo informado por métricas** ancorado em **H-A**:
≥1 onda completa **sem intervenção fora do gate** **e** pressão de quota sustentável
(tempo em `PAUSED_QUOTA` tolerável) na cadência testada — ou **NO-GO** (registrar gaps, ajustar, repetir)
**And** a decisão e a justificativa ficam auditadas

**Pré-condições de prontidão do meta-dogfood (bloqueiam a fase 2 — achado da análise de composição):**
- **PC-1 — contenção testada:** existe teste de invariante provando que um Write com
  *path absoluto* fora do workspace (ex.: `/var/lib/projeto_hdd/...` ou `../../`) **falha**.
  Fecha o risco residual *soft* do ADR 0002, que deixa de ser teórico quando o HDD modifica
  o próprio HDD na máquina de produção ([[project-hdd-prod-on-dev-machine]]).
- **PC-2 — sem auto-deploy verificado:** auditoria do CI/Actions e do `compose.prod.yaml`
  confirmando que **nenhum** webhook/job redeploya a stack no merge. A salvaguarda "deploy
  manual" passa de premissa a fato verificado.

### Bloco C — Fase 2: meta-dogfood (próprio HDD)

#### Story 7.7: Meta-onda 1 — dívida conhecida de baixo risco

As a desenvolvedor,
I want o HDD fechar uma dívida conhecida e isolada do próprio HDD (candidato: **worker
multi-arch**, dívida nº 7),
So that a primeira meta-onda seja pequena, de valor claro e baixo raio de impacto.

**Acceptance Criteria:**

**Given** GO na calibração (7.6) e workspace efêmero do próprio repo
**When** inicio a feature pelo painel
**Then** o HDD abre PR no `projeto_hdd` com a mudança e os testes passam no `verify`
**And** **eu** reviso e aprovo o merge no gate (sem auto-deploy — salvaguarda §3.1)
**And** as métricas e gaps são capturados

#### Story 7.8: Meta-onda 2 — indicadores do harness no painel

As a operador,
I want o HDD construir a exibição das métricas de dogfood (Story 7.1) no painel,
So that o dogfood exercite uma feature de produto real e feche o loop visual da medição.

**Acceptance Criteria:**

**Given** GO na calibração, a meta-onda 1 (7.7) concluída e as métricas de 7.1
**When** inicio a feature pelo painel
**Then** a onda entrega os indicadores de dogfood no painel via PR + gate humano (tipos TS sem drift)
**And** as próprias métricas e gaps da onda são capturados (dogfood medindo dogfood)

#### Story 7.9: Pool de meta-ondas adicionais (just-in-time)

As a operador,
I want um pool de alvos meta especificados sob demanda (melhoria de UX do painel +
nova capacidade de produto),
So that o dogfood continue enquanto o orçamento de quota e o GO se mantiverem, sem
comprometer 4 features pesadas de uma vez sob D-032.

**Acceptance Criteria:**

**Given** GO mantido (7.6) e folga de quota observada no harness
**When** escolho o próximo alvo do pool (melhoria de UX do painel **ou** nova capacidade)
**Then** a feature é especificada just-in-time e percorre o pipeline via PR + gate humano
**And** se o harness sinalizar D-032 em risco, o pool **pausa** (salvaguarda §3.3) em vez de drenar a conta
**And** cada onda do pool alimenta métricas (7.1) e gaps (7.2)

#### Story 7.10: Retrospectiva de dogfood + atualização de backlog

As a operador,
I want consolidar o aprendizado do dogfood ao final do épico,
So that a próxima direção (escala / módulos / docs) seja decidida com dados reais.

**Acceptance Criteria:**

**Given** as métricas (7.1) e os gaps (7.2) acumulados
**When** facilito a retrospectiva (padrão do projeto: `epic-7-retro-*.md`)
**Then** os gaps viram backlog priorizado
**And** a viabilidade de D-032 sob uso real é recomputada (segue/aciona driver `api`)
**And** registra-se a recomendação de direção para o Epic 8

## 5. Dependências e ordem

- **7.1, 7.2** primeiro (transversais — sem medição, o resto não vale).
- **7.3 → 7.4 → 7.5 → 7.6** sequencial (fase 1).
- **7.6 (GO)** bloqueia **7.7, 7.8, 7.9** (fase 2 só após calibração).
- **7.10** por último.

## 6. Decisões de validação (2026-06-02)

1. **Repo-alvo da fase 1 (Story 7.3):** ✅ **projeto novo dedicado**. Default proposto:
   pequeno utilitário **Python com pytest** (casa com o `verify` default `pytest -q`);
   domínio concreto a confirmar no início da execução da 7.3. **Não** reusar o
   `hdd-smoke-test` (trivial demais).
2. **Backlog seed da fase 2:** ✅ os **4 alvos** entram no backlog meta —
   **worker multi-arch** (7.7, definida) + **indicadores do harness no painel** (7.8,
   definida) + **melhoria de UX do painel** e **nova capacidade de produto** (7.9, pool
   just-in-time sob orçamento de quota).
3. **Critério de GO (7.6):** ✅ **qualitativo informado por métricas** (≥1 onda completa
   sem intervenção além do gate + D-032 sem bloqueio na cadência testada). Sem limiar
   numérico (N pequeno demais).
4. **Hipótese primária:** ✅ **H-A Capacidade** (ver §1). H-B (externalização) e H-C
   (viabilidade de quota) são secundárias, observadas mas não decisivas para o GO.

## 7. Gaps já identificados (entram no backlog via 7.2 / seed de meta-ondas)

A passagem dirigida (Party Mode + investigação adversarial real, 2026-06-02) já produziu
backlog antes mesmo da primeira onda:

1. **Bug `quota_exhausted` sempre `False`** — o campo de `LlmResult` nunca é atualizado (a
   detecção real vive na exceção `QuotaExhausted`, em paralelo). Pequeno, isolado, valor
   claro → **ótimo candidato adicional de meta-onda** (o HDD conserta o próprio sensor que
   o harness observa). Não bloqueia o harness (este usa a exceção, não o campo).
2. **Detecção de quota frágil** — pattern-match de 5 strings em stderr; quebra se a
   Anthropic mudar a mensagem. Endurecer (ex.: também classificar por exit code / múltiplos
   sinais) aumenta a confiabilidade do harness. Candidato a meta-onda.
3. **Pausa de quota é cega** — `PAUSED_QUOTA` não sabe quando a conta libera; hoje espera
   externamente. Medir o tempo de pausa (7.1) é o primeiro passo; otimizar a retomada é
   backlog futuro.
