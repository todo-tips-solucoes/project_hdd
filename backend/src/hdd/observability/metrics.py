"""Métricas Prometheus (Story 3.5 / Epic 8) — RED + métricas de negócio do HDD.

Harness de dogfood (Story 7.1): além das métricas-base, expõe os sinais que
provam a **hipótese H-A (capacidade)** — desfecho da execução autônoma e
correções por onda — e instrumentam a **salvaguarda D-032** — hits do limite
REAL da conta.

⚠️ **Limite do driver `subscription`:** `claude -p` NÃO emite tokens/custo/
proximidade-de-limite. Só é possível medir SLOTS internos, HITS de limite
(binário) e wallclock. Medição real de consumo (tokens/custo) só com o driver
`api` (RF-12, Epic 8). Ver `docs/dogfood-harness.md`.
"""
from __future__ import annotations

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest

from hdd.contracts.dtos import LlmResult

REGISTRY = CollectorRegistry()

gate_convocations = Counter(
    "hdd_gate_convocations_total",
    "Convocações de gate humano por tipo (RF-03b).",
    ["gate_type"],
    registry=REGISTRY,
)
quota_acquisitions = Counter(
    "hdd_quota_acquisitions_total",
    "Tentativas de aquisição de lease de quota.",
    ["result"],
    registry=REGISTRY,
)
wave_duration = Histogram(
    "hdd_wave_duration_seconds",
    "Duração de uma onda (wallclock).",
    registry=REGISTRY,
)
sessions_active = Counter(
    "hdd_sessions_started_total",
    "Sessões iniciadas.",
    registry=REGISTRY,
)
wave_failures = Counter(
    "hdd_wave_failures_total",
    "Ondas que falharam no worker (exceção → queue.fail).",
    registry=REGISTRY,
)
merge_failures = Counter(
    "hdd_merge_failures_total",
    "Merges que falharam ao aprovar o gate (Story 6.8).",
    registry=REGISTRY,
)
gate_backlog = Gauge(
    "hdd_gate_backlog",
    "Gates pendentes de decisão (atualizado ao listar no painel).",
    registry=REGISTRY,
)

# --- Harness de dogfood (Story 7.1) ------------------------------------------
# Métricas primárias de CAPACIDADE (H-A): desfecho da execução AUTÔNOMA de uma
# onda (antes da decisão humana de gate) e nº de correções. A taxa de sucesso
# autônomo deriva de reached_gate / total.
wave_outcomes = Counter(
    "hdd_wave_outcomes_total",
    "Desfecho da execução autônoma de uma onda (antes da decisão humana). "
    "reached_gate=chegou ao gate de merge (sucesso autônomo) | escalated=loop de "
    "correção esgotou N | failed=exceção no worker | quota_hit=limite real da conta.",
    ["outcome"],
    registry=REGISTRY,
)
wave_corrections = Histogram(
    "hdd_wave_corrections",
    "Ciclos de correção (verify reprovado) por onda.",
    buckets=(0, 1, 2, 3, 5),
    registry=REGISTRY,
)
# Salvaguarda D-032: hit do limite REAL da conta. DISTINTO de
# hdd_quota_acquisitions_total{result=no_quota}, que é o teto INTERNO de slots
# concorrentes (max_concurrent), não a conta. NÃO confundir os dois.
quota_limit_hits = Counter(
    "hdd_quota_limit_hits_total",
    "Hits do limite real da conta Claude (QuotaExhausted via claude -p) — "
    "distinto de no_quota (teto interno de slots).",
    registry=REGISTRY,
)


# --- Epic 8: consumo real do driver `api` (RF-12) ----------------------------
# Só incrementados quando os campos NÃO são None; no-op para driver subscription
# (que não emite tokens/custo via `claude -p`).
llm_tokens_total = Counter(
    "hdd_llm_tokens_total",
    "Tokens consumidos por tipo (input/output) — driver api.",
    ["type"],
    registry=REGISTRY,
)
llm_cost_usd_total = Counter(
    "hdd_llm_cost_usd_total",
    "Custo acumulado em USD — driver api.",
    registry=REGISTRY,
)


def record_llm_usage(result: LlmResult) -> None:
    """Incrementa contadores de tokens/custo quando presentes (no-op para subscription)."""
    if result.input_tokens is not None:
        llm_tokens_total.labels(type="input").inc(result.input_tokens)
    if result.output_tokens is not None:
        llm_tokens_total.labels(type="output").inc(result.output_tokens)
    if result.cost_usd is not None:
        llm_cost_usd_total.inc(result.cost_usd)


def render_metrics() -> bytes:
    """Exposição no formato Prometheus (endpoint /metrics)."""
    return generate_latest(REGISTRY)
