# Story 7.17: Meta-onda 9 (Fase 2) — indicadores do harness no painel

Status: done (2026-06-03) — entregue via PR #36 (`4e4c126`).

> Primeira meta-onda **full-stack** do dogfood: o HDD expõe os indicadores do harness (antes só em
> `GET /metrics` Prometheus) como JSON no painel. Exercita os **gates de drift** (OpenAPI + TS) — a
> frente que as meta-ondas 1–8 (backend puro) não cobriam. Modelo **híbrido**: HDD faz o backend
> (verificável no meta-sandbox Python); operador completa o frontend (Node) no gate.

## Story

As a operador,
I want ver os indicadores do harness de dogfood no painel (total de ondas, estados, correções,
gates pendentes),
so that eu acompanhe a saúde do meta-dogfood sem ler métricas Prometheus cruas.

## Acceptance Criteria

1. **Backend:** `GET /api/harness` (autenticado, `require_user`) → `HarnessSummary` derivado do DB
   via `repo.list_waves()` + `repo.count_pending_gates()`: `total_waves`, `by_state` (8 estados de
   `WaveState`), `total_corrections`, `mean_corrections` (0.0 se vazio), `reached_gate`
   (awaiting_gate+merged), `escalated`, `failed`, `gates_pending`. `openapi.json` regenerado.
2. **Frontend:** `getHarness()` tipado + componente `HarnessIndicators` no painel; `api-types.ts`
   regenerado por `npm run typegen`.
3. **DoD + CI verde** (incl. Integração, OpenAPI sem drift, Frontend) antes do merge; sem `--admin`.

## Execução (resumo — detalhe em docs/dogfood-meta.md, Meta-onda 9)

- **Tentativa 1** (verify = DoD + drift, **sem oracle**): one-shot → mas **no-op off-task** (PR #35,
  docs/planejamento, zero backend). **Achado F7**: verify sem oracle não detecta não-implementação.
  PR #35 fechado.
- **Tentativa 2** (verify = DoD + **oracle de aceitação oculto** + drift): backend **correto** (oracle
  + DoD verdes), mas **escalou** — 4 verify vermelhos **só no drift do `openapi.json`**. **Achado F9**:
  o agente regenera o contrato à mão (geração determinística e idêntica em worker/sandbox; version-skew
  F8 descartado). Convergência sob oracle demonstrada ao vivo (`->execute=4`, 3 correções F2).
- **Gate:** código do agente salvo (correto); `openapi.json` regenerado canonicamente; frontend
  completado pelo operador. PR #36 → CI 6/6 verde → merged `--squash` sem `--admin` → `4e4c126`.

## Tasks / Subtasks

- [x] Oracle de aceitação oculto (`/var/lib/hdd-oracles/harness/test_oracle_harness.py`), validado RED/GREEN.
- [x] `compose.meta.onda9.yaml` (verify = DoD + oracle + drift via compare-Python, pois o sandbox não tem git).
- [x] Pré-flight de capacidade verde; stack dev isolado; `max_concurrent=1`.
- [x] Onda enfileirada in-container (PR + gate humano). Tentativa 1 (no-op, F7) → tentativa 2 (escalou, F9).
- [x] Gate: salvar backend correto + regenerar `openapi.json` canônico + frontend híbrido; CI completo verde; merge sem `--admin`.
- [x] Registro em `docs/dogfood-meta.md` (Meta-onda 9) + esta story. Stack dev descido.

## Achados

- **F7** — verify (DoD + drift) não detecta sub-implementação/no-op sem oracle de aceitação.
- **F9** — o agente edita o `openapi.json` à mão → drift inconvergível (a geração canônica é
  determinística e idêntica nas duas imagens). Gargalo de contract-first no loop autônomo.

## Entregue

`backend/src/hdd/api/routers/harness.py`, `schemas.py` (`HarnessSummary`), `app.py` (registro),
`adapters/db/repository.py` (`count_pending_gates`), `tests/unit/test_api.py`, `backend/openapi.json`;
`frontend/src/lib/api.ts` (`getHarness`), `lib/api-types.ts`, `components/HarnessIndicators.tsx`,
`app/page.tsx`.
