# Story 7.5: Onda de calibração nível 2 — feature que exige correção (cnpj)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operador,
I want o HDD construir uma feature cuja primeira tentativa provavelmente falha o `verify`,
so that eu exercite o loop real `verify → CORRECTING → EXECUTING → gate` e meça a recuperação autônoma (não só o caminho feliz da 7.4).

## Acceptance Criteria

1. **[REDEFINIDA 2026-06-03 — course-correction ratificado pelo operador]** **Given** o repo-alvo (`paulotodo/hdd-calibragem`, Story 7.3) e o harness (7.1) **When** dirijo features reais com requisito testável não-trivial e **oracle de teste independente** (TDD vermelho) **Then** cada onda chega autonomamente ao gate (`reached_gate`) e o harness **mede as correções ocorridas** (`hdd_wave_corrections_sum`, observado — **não forçado**) **And** 0 correções ao longo das ondas é resultado **válido**, registrado como sinal H-A forte + gap estrutural. *Razão: com oracle visível ao agente do `execute` + modelo capaz, o loop de correção não dispara naturalmente — achado em `docs/dogfood-calibragem.md`. Forçá-lo exigiria oracle oculto (backlog de harness).*
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
- [x] **Task 2 — Pré-flight de capacidade verde (AC: #2)** — invariante do correct-course OOM. ✅ pré-flight passou nas 2 ondas (`swap=4095MB max_concurrent=1`); `hdd_dev` subido isolado e derrubado ao fim da janela; escape-hatch não usado.
  - [ ] Confirmar swap ativo (`SwapTotal>0`), `app.quota_counter.max_concurrent==1` (no `hdd_dev`), `MemAvailable ≥ 2 GiB`. O `calibration_wave.py run` já roda `_preflight_capacity` e recusa caso contrário — não burlar.
  - [ ] Janela `hdd_dev`: subir só durante a onda e `docker compose -p hdd_dev down` ao final. Não rodar driver-no-host junto com worker-dev sob pressão.
- [x] **Task 3 — Disparar a onda nível 2 (AC: #1, #3)**. ✅ 2 ondas dirigidas (cnpj/sonnet, data_br/haiku); ambas `reached_gate`, `corrections_sum=0` (medido). Achado estrutural registrado.
  - [ ] Env das ondas em `backend/.env`: `HDD_REPO_URL=https://github.com/paulotodo/hdd-calibragem`, `HDD_VERIFY_COMMAND="pytest -q"`, `HDD_CLAUDE_TIMEOUT_S=600` (lição da 7.4), `HDD_REPO_SLUG=paulotodo/hdd-calibragem`. Modelo: `settings.model` (sonnet recomendado p/ requisito não-trivial; haiku se quiser maior probabilidade de correção).
  - [ ] `uv run python scripts/calibration_wave.py run "Implemente calibragem.cnpj (validate/format) de modo que tests/test_cnpj.py passe; funções puras, sem I/O."` — **task honesta, não super-especificada** (deixar margem para o erro de 1ª tentativa).
  - [ ] Observar o loop: `verify` reprova → `CORRECTING` → re-`EXECUTING` (≤3) → `AWAITING_GATE` ou `ESCALATED`. Conferir `_print_metrics`: `corrections_sum ≥ 1` e `reached_gate`/`escalated`.
- [x] **Task 4 — Gate humano + merge (AC: #4)**. ✅ PR #3 (cnpj) e PR #4 (data_br) revisados e **mergeados** via `approve` (squash, branch removida); 0 leases vazados.
  - [ ] Se `AWAITING_GATE`: revisar o PR no repo-alvo (revisão obrigatória — DoD) e `uv run python scripts/calibration_wave.py approve <wave_id>` → merge real.
  - [ ] Se `ESCALATED`: **não** aprovar; inspecionar gaps (`status <wave_id>`), registrar o gap e decidir (ajustar task/oracle/modelo e re-rodar, ou levar como achado para a 7.6).
- [x] **Task 5 — Consolidar resultado (AC: #5)**. ✅ `docs/dogfood-calibragem.md` ganhou a seção "Ondas 2 e 3 (Story 7.5)" com a tabela de desfechos e o achado estrutural (gap p/ 7.6).
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

**Avaliação de prontidão do ambiente (2026-06-03, VPS Boston):**
- ✅ Capacidade (pré-flight): swap 4 GB ativo, MemAvailable ~14 GB. Pendente confirmar `max_concurrent==1` (precisa do Postgres de dev no ar).
- ✅ `claude` CLI presente (2.1.161) · `hdd-sandbox:latest` presente (tem pytest) · Docker socket OK.
- ❌ **Bloqueios para a onda (Task 3-4) — VPS nova, ambiente de dev não bootstrapado:**
  1. `backend/.env` ausente (só `.env.example`, sem as vars de onda HDD_REPO_URL/SLUG/VERIFY_COMMAND/CLAUDE_TIMEOUT_S).
  2. Postgres de dev (compose.yaml, host 5433) **não está no ar**; falta migrar + `set_max(1)` no `app.quota_counter`.
  3. `gh` CLI **ausente no host** — `GitHubVcs` o usa para abrir PR e fazer merge no gate. Precisa instalar + autenticar com o token do bot.
  4. Clone do repo-alvo privado precisa de credencial git (token do bot) no `HDD_REPO_URL` ou credential helper.
- Produção (`projeto_hdd-*` + traefik) está no ar na mesma VPS — janela de dev deve subir isolada (`-p hdd_dev`) e descer depois.

### Completion Notes List

**Onda 1 da 7.5 — `cnpj` com sonnet (2026-06-03, wave `019e8b09-…`):**
- Pré-flight: ✅ verde (`swap=4095MB mem_avail=13714MB max_concurrent=1`).
- Desfecho: `reached_gate=1`, **`corrections_sum=0`** — sonnet acertou o mod-11 do CNPJ de 1ª tentativa; `verify` (pytest sandbox) passou direto. PR #3 aberto (rascunho) em `paulotodo/hdd-calibragem`, código correto e no estilo do baseline. 0 leases vazados.
- **AC #1 NÃO atendida** (`verify dispara ≥1 ciclo` / `corrections_sum ≥ 1`): o oracle independente funcionou, mas o alvo não foi difícil o bastante para o sonnet → não exercitou o loop de correção. É outro caminho feliz (como a 7.4), não o nível 2.
- AC #2 (pré-flight) ✅, AC #4 (gate) pendente de decisão humana (não aprovado).
- Decisão do operador: PR #3 **aprovado e mergeado** (2º baseline de capacidade; fecha a calibração cnpj do OOM).

**Onda 2 da 7.5 — `data_br` com haiku (2026-06-03, wave `019e8b10-…`):**
- Oracle adversarial `tests/test_data_br.py` (zero-padding estrito + calendário) semeado no repo-alvo (commit `1a83e25`), estado vermelho.
- Desfecho: `reached_gate=1`, **`corrections_sum=0` de novo** — haiku acertou de 1ª tentativa (`regex ^\d{2}/\d{2}/\d{4}$` + `date(...)` que valida calendário). PR #4 aberto. Verify confirmado **íntegro** (reprovaria implementação ruim) — o modelo simplesmente acertou.

**🔑 Achado estrutural (gap p/ 7.2 → 7.6):** o agente do nó `execute` **lê o `tests/test_*.py` no clone** (o oracle é visível), então modelos capazes — até o haiku — implementam direto para os casos enumerados → 0 correções. A premissa da 7.5 ("feature cuja 1ª tentativa falha o verify") é **praticamente insatisfazível** com oracle visível + modelo capaz. Forçar correção exigiria mudança de harness (oracle oculto ao execute) ou sabotagem artificial — baixo valor.

**Sinal positivo (H-A):** 3 features reais (cep/cnpj/data_br) construídas autonomamente, 0 correções, 0 escaladas — o HDD **one-shota features bem-especificadas e test-bounded**. É um resultado forte de capacidade, mesmo não exercitando o loop de correção.

- **AC #1 permanece NÃO atendida por design**, não por incapacidade. Decisão de curso necessária (ver `bmad-correct-course` candidato): redefinir a AC da 7.5 (medir correção oportunisticamente, não forçar) **ou** abrir backlog de harness (oracle oculto). Story **in-progress** aguardando essa decisão.

### File List

- `docs/dogfood-calibragem.md` (seção "Ondas 2 e 3" + achado estrutural)
- `backend/.env` (criado, gitignored — config das ondas; não versionado)
- (repo-alvo `paulotodo/hdd-calibragem`, externo, mergeados): PR #3 `src/calibragem/cnpj.py`, PR #4 `src/calibragem/data_br.py` + `tests/test_data_br.py` (oracle) + `__init__.py`

## Change Log

- 2026-06-03 — Story dirigida (Tasks 2-5). 2 ondas (cnpj/sonnet, data_br/haiku), ambas `reached_gate` 0 correções, PRs #3/#4 mergeados. **AC #1 redefinida** (course-correction ratificado pelo operador): correção é medida, não forçada; oracle visível ao execute impede o loop com modelo capaz (gap p/ 7.6). Status → review.
