# Story 7.16: Meta-onda 8 (Fase 2) — projeção de n_corrections + estado em falha (família-F3)

Status: done (2026-06-03) — **família-F3 endereçada**. One-shot; PR #34 merged `a9d9486` **sem
`--admin`** com **CI completo verde (incl. Integração)** — lição do #33 aplicada. sync_wave_state
ganhou n_corrections opcional; bridge passa o valor; _safe_project_failed projeta FAILED nos except.
O agente atualizou os testes de integração proativamente.

> Endereça a **família-F3** observada ao longo do arco: `app.waves.n_corrections` projeta 0 mesmo
> com correções reais (visível só no checkpointer), e o estado fica preso em `planned` quando a onda
> falha (ex.: timeout da onda 2/4-run1). É um fix de **observabilidade na projeção** — toca o bridge
> do worker e o repositório, não uma função pura.

## Story

As a operador,
I want que a projeção em `app.waves` reflita o nº de correções e o desfecho de falha,
so that eu consiga ver pelo painel/CLI quantas correções uma onda fez e quando ela falhou — sem ter
de inspecionar o checkpointer do LangGraph.

## Acceptance Criteria

1. **n_corrections projetado:** **Given** uma onda que fez N correções **When** `bridge_after_wave`
   roda **Then** `app.waves.n_corrections` reflete N (hoje só vai p/ a métrica Prometheus).
2. **Estado em falha:** **Given** uma onda que levanta exceção/timeout **When** o `except` de
   `run_wave` roda **Then** `app.waves.state` é projetado como `FAILED` (não fica em `planned`),
   sem mascarar a exceção original (que continua a propagar para o loop contabilizar).
3. **Sem regressão de assinatura:** **Given** `sync_wave_state` ganha parâmetro **opcional** **When**
   o resume (`gates.py:106`) chama sem ele **Then** continua funcionando (retrocompatível).
4. **DoD + CI:** **Given** o gate **When** reviso o PR **Then** ruff/mypy --strict/import-linter/
   pytest verdes E **o CI completo verde, incl. o job "Integração (Postgres+pgvector)"** (lição do
   PR #33) — boundaries preservados.
5. **Auditoria:** registrar a Meta-onda 8 em `docs/dogfood-meta.md` e marcar a família-F3 endereçada.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** `compose.meta.onda8.yaml` (verify = DoD completo; sem oracle;
  timeout 1200). Worker com F2. Sem rebuild.
- [ ] **Task 1 — Subir stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch **+ CI completo verde incl. Integração**; `gh pr ready`;
  merge **sem --admin**; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 8 + esta story). Descer o stack.

## Dev Notes

- **Tarefa visível (enfileirar):**
  > "Faça a projeção do estado da onda em app.waves refletir o nº de correções e a falha. Hoje
  > bridge_after_wave (worker/runner.py) só sincroniza app.waves.state e nunca persiste n_corrections;
  > e em exceção a projeção não roda (estado fica 'planned'). Mudanças: (1) Repository.sync_wave_state
  > (adapters/db/repository.py): novo parâmetro OPCIONAL n_corrections: int | None = None; quando
  > dado, persiste em app.waves.n_corrections. (2) bridge_after_wave: passar
  > result.get('n_corrections', 0). (3) run_wave no except (Exception e QuotaExhausted): projetar
  > WaveState.FAILED antes de re-levantar, defensivamente. (4) Atualizar/adicionar testes (unitários
  > com repo fake p/ n_corrections e a projeção de FAILED; e o de integração test_gate_roundtrip.py
  > se a assinatura mudar). Mantenha ruff/mypy --strict/import-linter/pytest verdes e os boundaries."
- **Pontos de código (ler):** `worker/runner.py:53-94` (`bridge_after_wave` — sync só de state;
  `wave_corrections.observe`), `:115-129` (`run_wave` except), `adapters/db/repository.py:77`
  (`sync_wave_state` — só `row.state = target`), `:106` (`list_waves` já lê n_corrections),
  `adapters/db/models.py:44` (`WaveRow.n_corrections` já existe), `api/routers/gates.py:106`
  (call-site do resume — não pode quebrar).
- **⚠️ Risco de regressão de integração (lição do PR #33):** o agente **não roda integração no
  verify** (sandbox `--network none`, sem Postgres) — `python -m pytest -q` usa `-m "not integration"`.
  Uma mudança na projeção/assinatura pode quebrar `test_gate_roundtrip.py` (Postgres real) sem o loop
  perceber. **No gate: exigir `gh pr checks` 100% verde (incl. Integração) e mergear sem `--admin`.**
- **verify = DoD completo** (onda 4); sem oracle. **Salvaguardas Fase 2:** in-container (PC-1); PR +
  gate humano; workspace efêmero; pré-flight; sem auto-deploy. Parar antes da quota e do merge.

### Project Structure Notes

- Feature (HDD fará no clone, revisada no gate): `adapters/db/repository.py`, `worker/runner.py`
  (UPDATE), testes unitários (NEW/UPDATE), `tests/integration/test_gate_roundtrip.py` (UPDATE se a
  assinatura mudar).
- Operacional: `compose.meta.onda8.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md` (UPDATE).

### References

- [Source: docs/dogfood-meta.md] (família-F3 observada nas meta-ondas 2/4/6)
- [Source: backend/src/hdd/worker/runner.py] (bridge_after_wave; run_wave except)
- [Source: backend/src/hdd/adapters/db/repository.py:77] (sync_wave_state)
- [Source: _bmad-output/implementation-artifacts/... PR #33] (lição: integração fora do gate local)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta` (com F2).

### Debug Log References

- Onda `019e8ea4-d99e` (worker com F2, verify=DoD completo): `->execute=1`, verify exit 0 →
  `awaiting_gate` one-shot. PR #34.

### Completion Notes List

- **Família-F3 endereçada:** (a) `sync_wave_state(..., n_corrections=None)` opcional persiste
  `row.n_corrections`; bridge passa `result.get('n_corrections', 0)`. (b) `_safe_project_failed`
  (best-effort) projeta `WaveState.FAILED` nos dois `except` de `run_wave` sem mascarar a exceção.
- **Retrocompatível:** o call-site do resume (`gates.py:106`) não passa `n_corrections` → segue OK.
- **O agente atualizou a integração proativamente** (`test_gate_roundtrip.py`, `test_persistence.py`)
  + unitários (`test_dogfood_harness.py`).
- **Gate (lição #33):** CI completo verde via `gh pr checks` — **Integração (Postgres+pgvector) →
  pass** (validação end-to-end que o verify in-loop não faz). Merge **sem `--admin`** → `a9d9486`.

### File List

**Neste repo (operacional, Story 7.16):**
- `compose.meta.onda8.yaml` (NEW), `_bmad-output/implementation-artifacts/7-16-meta-onda-8-projecao-ncorrections-estado.md` (NEW),
  `docs/dogfood-meta.md` (UPDATE, a fazer).

**No PR da meta-onda (feito pelo HDD, revisado no gate):** `backend/src/hdd/adapters/db/repository.py`,
`backend/src/hdd/worker/runner.py`, testes unitários, `backend/tests/integration/test_gate_roundtrip.py`.
