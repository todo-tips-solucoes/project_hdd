# Story 7.5: Onda de calibração nível 2 — feature que exige correção (cnpj)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operador,
I want o HDD construir uma feature cuja primeira tentativa provavelmente falha o `verify`,
so that eu exercite o loop real `verify → CORRECTING → EXECUTING → gate` e meça a recuperação autônoma (não só o caminho feliz da 7.4).

## Acceptance Criteria

1. **Given** o repo-alvo (`paulotodo/hdd-calibragem`, Story 7.3) e o harness (7.1) **When** inicio uma feature com requisito testável não-trivial **Then** o `verify` dispara **≥1 ciclo de correção** (sinal real, não placeholder) **And** o harness registra `hdd_wave_corrections_sum ≥ 1`.
2. **Given** o pré-flight de capacidade (correct-course OOM, `evaluate_capacity`) **When** rodo `calibration_wave.py run` **Then** a onda **só** inicia com swap ativo + `max_concurrent==1` + folga de RAM (senão recusa); o escape-hatch `HDD_CALIB_SKIP_PREFLIGHT=1` **não** é usado nesta onda.
3. **Given** o loop de correção (`max_corrections=3`) **When** a onda recupera dentro de N **Then** chega a `AWAITING_GATE` (`outcome=reached_gate`) e abre o gate de merge; **se** esgotar N **Then** escala (`outcome=escalated`) e o gap entra no loop de backlog (7.2) — ambos são desfechos válidos e registrados.
4. **Given** a onda chegou ao gate **When** reviso o PR e aprovo (`approve <wave_id>`) **Then** o merge real ocorre na `main` do repo-alvo, com audit `gate.approved` e workspace efêmero limpo (sem lease vazado).
5. **Given** o resultado da onda **When** consolido **Then** `docs/dogfood-calibragem.md` ganha a seção "Onda 2 (Story 7.5): `cnpj`" com correções medidas, desfecho e achados; gaps (se houver) ficam registrados via 7.2.

## Tasks / Subtasks

- [x] **Task 1 — Oracle de teste independente no repo-alvo (AC: #1)** — pré-requisito que torna a falha *real*, não auto-cumprida. **JÁ PRONTA** (semeada antes do OOM, commit `1d56ca3` no `paulotodo/hdd-calibragem`); verificada em 2026-06-03.
  - [x] `tests/test_cnpj.py` **autoritativo e estrito** presente: CNPJ válidos (formatado e cru), inválidos (dígito verificador errado), **dígitos repetidos** (`00.000.000/0000-00` → inválido — o erro clássico do mod-11), comprimento 13, vazio, caractere não-numérico; `format_cnpj` + erro p/ entrada inválida. **Os pares entrada/saída não revelam o algoritmo** (força a derivação dos DVs → erro provável na 1ª tentativa).
  - [x] **Corretude validada independentemente:** os 4 CNPJs "válidos" e os 7 "inválidos" batem com o algoritmo real (pesos DV1 `[5,4,3,2,9,8,7,6,5,4,3,2]`, DV2 `[6,5,4,3,2,9,8,7,6,5,4,3,2]`) — 11/11 consistentes. Garante que a onda é **satisfazível** (verify pode ficar verde).
  - [x] Estado vermelho confirmado: `pytest -q` no clone falha na coleção (`ModuleNotFoundError: calibragem.cnpj`); `src/calibragem/cnpj.py` ausente.
  - [x] `BACKLOG.md` já lista `cnpj` (item 1: "dígitos verificadores; rejeita todos-iguais").
  - [x] Implementação **não** escrita — é o que o HDD vai construir na onda.
- [ ] **Task 2 — Pré-flight de capacidade verde (AC: #2)** — invariante do correct-course OOM.
  - [ ] Confirmar swap ativo (`SwapTotal>0`), `app.quota_counter.max_concurrent==1` (no `hdd_dev`), `MemAvailable ≥ 2 GiB`. O `calibration_wave.py run` já roda `_preflight_capacity` e recusa caso contrário — não burlar.
  - [ ] Janela `hdd_dev`: subir só durante a onda e `docker compose -p hdd_dev down` ao final. Não rodar driver-no-host junto com worker-dev sob pressão.
- [ ] **Task 3 — Disparar a onda nível 2 (AC: #1, #3)**.
  - [ ] Env das ondas em `backend/.env`: `HDD_REPO_URL=https://github.com/paulotodo/hdd-calibragem`, `HDD_VERIFY_COMMAND="pytest -q"`, `HDD_CLAUDE_TIMEOUT_S=600` (lição da 7.4), `HDD_REPO_SLUG=paulotodo/hdd-calibragem`. Modelo: `settings.model` (sonnet recomendado p/ requisito não-trivial; haiku se quiser maior probabilidade de correção).
  - [ ] `uv run python scripts/calibration_wave.py run "Implemente calibragem.cnpj (validate/format) de modo que tests/test_cnpj.py passe; funções puras, sem I/O."` — **task honesta, não super-especificada** (deixar margem para o erro de 1ª tentativa).
  - [ ] Observar o loop: `verify` reprova → `CORRECTING` → re-`EXECUTING` (≤3) → `AWAITING_GATE` ou `ESCALATED`. Conferir `_print_metrics`: `corrections_sum ≥ 1` e `reached_gate`/`escalated`.
- [ ] **Task 4 — Gate humano + merge (AC: #4)**.
  - [ ] Se `AWAITING_GATE`: revisar o PR no repo-alvo (revisão obrigatória — DoD) e `uv run python scripts/calibration_wave.py approve <wave_id>` → merge real.
  - [ ] Se `ESCALATED`: **não** aprovar; inspecionar gaps (`status <wave_id>`), registrar o gap e decidir (ajustar task/oracle/modelo e re-rodar, ou levar como achado para a 7.6).
- [ ] **Task 5 — Consolidar resultado (AC: #5)**.
  - [ ] Adicionar a `docs/dogfood-calibragem.md` a seção "Onda 2 (Story 7.5): `cnpj`": desfecho, `n_corrections`, se recuperou ou escalou, achados (ex.: qualidade do feedback de correção, tempo, gaps). Alimenta o dataset do gate GO/NO-GO da 7.6.

## Dev Notes

- **Esta é uma story operacional de dogfood** (como a 7.4): o **HDD** constrói a feature via `claude -p`; o operador/dev **prepara o oracle, dirige a onda e observa**. Não implemente `cnpj` à mão — isso anularia a medição de H-A.
- **Por que `cnpj`:** dígitos verificadores mod-11 com vetores de peso `[5,4,3,2,9,8,7,6,5,4,3,2]` e a regra de rejeitar dígitos repetidos são erros de 1ª tentativa comuns → alta probabilidade de `verify` vermelho real. Além disso, continua a calibração `cnpj` que morreu no OOM de 2026-06-02 ([[0005-capacidade-e-cutover-vps-dedicada]]).
- **Oracle independente é o ponto-chave:** na 7.4 (`cep`) o `claude` escreveu impl **e** testes juntos → `verify` passou de primeira (sinal auto-cumprido, 0 correções). Para a 7.5 medir o loop de correção de verdade, o teste tem de vir do **repo-alvo** (TDD: vermelho antes), não do próprio claude.
- **Loop de correção (não reinventar):** `backend/src/hdd/adapters/orchestrator/wave.py` — `verify` → `AWAITING_GATE` se ok senão `CORRECTING`; `_after_correct` re-executa enquanto `n_corrections < max_corrections (3)`, senão `escalate` (interrupt). `runner.py:73` faz `wave_corrections.observe(n_corrections)`.
- **Sandbox sem rede** (`--network none`, Story 6.3): a imagem do sandbox precisa já conter `pytest` (estendida na 7.4); `pythonpath=["src"]` no `pyproject` do repo-alvo importa `calibragem` sem instalar.
- **Gap conhecido da 7.4 (não confundir):** `retry.decide` não wirado → `TransientError` (infra) não vira RETRY. Aqui o sinal é falha de `verify` = `DomainError` → caminho de **correção** (não retry), então o loop deve funcionar; se um timeout transitório aparecer, é o gap separado já no backlog.

### Project Structure Notes

- Driver: `backend/scripts/calibration_wave.py` (sub-comandos `run`/`approve`/`status`). Config das ondas via `backend/.env` (gitignored).
- Métricas do harness: `backend/src/hdd/observability/metrics.py` (`hdd_wave_outcomes_total`, `hdd_wave_corrections`).
- Repo-alvo é **externo** (`paulotodo/hdd-calibragem`) — as mudanças de oracle (Task 1) são commitadas lá, não neste repo. Neste repo só muda `docs/dogfood-calibragem.md` (Task 5).
- Salvaguarda de capacidade já em código (`evaluate_capacity`/`_preflight_capacity`) — Task 2 é operacional, não de código.

### References

- [Source: _bmad-output/planning-artifacts/epic-7-scope-proposal.md#Story 7.5]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7]
- [Source: docs/dogfood-calibragem.md] (config das ondas, resultado da Onda 1 `cep`, pré-condições de capacidade)
- [Source: docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md] (salvaguarda OOM)
- [Source: docs/definition-of-done.md] (revisão obrigatória, padrão de decisão, gate verificável)
- [Source: backend/src/hdd/adapters/orchestrator/wave.py] (loop plan→execute→verify→correct→gate, max_corrections=3)
- [Source: backend/src/hdd/worker/runner.py#73-93] (observe corrections, escalation → gap)
- [Source: backend/src/hdd/config/settings.py] (verify_command, repo_url/slug, model, HDD_CLAUDE_TIMEOUT_S)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
