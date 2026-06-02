# Harness de medição de dogfood (Story 7.1)

Instrumentação que torna o dogfood do Epic 7 **mensurável** — prova a hipótese
primária **H-A (capacidade)** e instrumenta a salvaguarda **D-032**. Reusa a stack
de observabilidade do Epic 3 (Prometheus + Grafana); não introduz telemetria nova.

> **Hipótese H-A (a falsificar):** *"o HDD leva features reais de ponta a ponta com
> o humano intervindo só nos 6 gates RF-03b."*

## Métricas (Prometheus, `observability/metrics.py`)

### Primárias — capacidade (H-A)

| Métrica | Tipo | Onde é emitida | Significado |
|---|---|---|---|
| `hdd_wave_outcomes_total{outcome}` | Counter | `worker/runner.py` (`reached_gate`/`escalated`) e `worker/loop.py` (`failed`/`quota_hit`) | Desfecho da execução **autônoma** de uma onda, **antes** da decisão humana. |
| `hdd_wave_corrections` | Histogram | `worker/runner.py` (`bridge_after_wave`) | Ciclos de correção (verify reprovado) por onda. |
| `hdd_wave_duration_seconds` | Histogram | `worker/loop.py` (já existente) | Wallclock da onda. |

**`outcome`** ∈ `reached_gate` (sucesso autônomo: chegou ao gate de merge) ·
`escalated` (loop de correção esgotou N) · `failed` (exceção no worker) ·
`quota_hit` (bateu o limite real da conta).

**Taxa de sucesso autônomo (métrica-chave de GO da Story 7.6):**

```promql
sum(increase(hdd_wave_outcomes_total{outcome="reached_gate"}[$__range]))
  / clamp_min(sum(increase(hdd_wave_outcomes_total[$__range])), 1)
```

> A decisão humana no gate (MERGED/FAILED) **não** entra aqui — é medida de capacidade
> autônoma, não de aprovação. Por isso conta-se no lado worker (`bridge_after_wave`),
> nunca no resume (`api/routers/gates.py`), evitando dupla contagem.

### Salvaguarda — D-032

| Métrica | Tipo | Significado |
|---|---|---|
| `hdd_quota_limit_hits_total` | Counter | Hits do **limite real da conta** Claude (`QuotaExhausted` via `claude -p`). |
| `hdd_quota_acquisitions_total{result="no_quota"}` | Counter | Teto **interno** de slots concorrentes (`max_concurrent`) — **NÃO é a conta**. |

⚠️ **Não confundir os dois.** `no_quota` é o nosso próprio teto de concorrência; só
`quota_limit_hits` reflete a conta Max. O dashboard mostra-os lado a lado.

## Relatório / painel

Dashboard Grafana `ops/grafana/hdd-dashboard.json` → seção *"Dogfood (Epic 7) —
capacidade & D-032"*: taxa de sucesso autônomo, desfechos por tipo, correções por
onda e pressão de quota (conta vs teto interno). O recorte "por período" é o
`$__range` do Grafana (PromQL), sem código de runtime adicional.

## Limites honestos (driver `subscription`)

Descobertos por verificação adversarial contra o código (2026-06-02):

1. **Tokens/custo são IMPOSSÍVEIS de medir hoje.** O `claude -p` não emite tokens,
   custo nem proximidade de limite; `LlmResult` só tem `text/session_id/exit_code/raw`.
   Medição real de consumo só com o **driver `api`** (RF-12, Epic 8). Até lá, D-032 é
   medido por **pressão observável** (hits + wallclock), não por consumo.
2. **A detecção de limite é binária e frágil** — pattern-match de 5 strings em stderr
   (`adapters/llm/subscription.py`). Quebra se a Anthropic mudar a mensagem.

## Loop gaps → backlog (Story 7.2)

Cada **escalada**, **falha** ou **hit de quota** de uma onda vira um *gap* estruturado
e persistido em `app.dogfood_gaps` — o aprendizado do dogfood realimenta o backlog
(fecha o ciclo da meta-tese), em vez de se perder.

- **Captura automática** (`worker/runner.py`): `escalation` em `bridge_after_wave`
  (onda escalou); `failure`/`quota` no `run_wave` (exceção/`QuotaExhausted`). O registro
  é *best-effort* — nunca mascara a exceção original da onda.
- **Persistência** (`adapters/db/gap_store.py` + migration `0010`): `GapStore.record_gap`/
  `list_gaps`; campos `stage` · `reason` · `context` (jsonb) · `status`
  (`open|triaged|converted|dismissed`).
- **Export / listagem** (CLI): `hdd gaps` lista; `hdd gaps --md` exporta markdown
  (candidatos a story); `--status` filtra. A retrospectiva (Story 7.10) consome essa lista.
- **Seed**: a migration `0010` semeia os 3 gaps pré-identificados (abaixo), idempotente.

## Gaps descobertos (backlog — alimentam a Story 7.2 / seed de meta-ondas)

1. **Pausa-e-retoma de quota não existe.** `QuotaExhausted` hoje **falha a onda**
   (`queue.fail`) em vez de pausar e retomar. `retry.decide` (que retorna `PAUSE`)
   **não está wirado** ao fluxo da onda, e `SessionState.PAUSED_QUOTA` é **estado
   morto** (nada transiciona para ele). Consequência: o sinal "tempo em PAUSED_QUOTA"
   previsto para 7.1 **não é mensurável** até isto ser implementado. Forte candidato
   a meta-onda (resiliência a quota — diretamente ligado a D-032).
2. **Bug `quota_exhausted` sempre `False`** em `LlmResult` (campo nunca atualizado; a
   detecção real vive na exceção). Candidato a meta-onda.
3. **Detecção de quota frágil** (item 2 dos limites) — endurecer.
