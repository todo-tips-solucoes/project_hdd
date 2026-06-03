# Story 7.12: Meta-onda 4 (Fase 2) — verify do meta roda o DoD completo

Status: done (2026-06-03) — **F4 endereçado**: verify do meta roda o DoD completo. Rodou 2×: Run 1
escalou rodando o loop cego (worker stale, pré-F2 → achado **F5**); após rebuild do worker, Run 2
**one-shot** DoD-verde → PR #29 **merged** `24ea764`. Entregou `parse_repo_slug` (que a onda 2 não
conseguira) + validação de `settings.repo_slug`.

> Decorre do achado **F4** da Story 7.11: o verify do meta rodava só `pytest`, então lint/tipo só
> eram pegos no gate humano. Agora que o **F2 está fechado** (o verify propaga o output à correção,
> PR #28 / `9a7efa4`), o verify pode rodar o **DoD completo** e o loop passa a auto-corrigir
> lint/tipo/imports também. Esta onda **prova** isso construindo uma feature real sob o novo verify.

## Story

As a operador,
I want que o `verify` do meta-dogfood rode o **DoD completo** (`ruff && mypy && lint-imports &&
pytest`) enquanto o HDD constrói uma feature pequena real,
so that o loop autônomo passe a enforçar (e, se preciso, auto-corrigir) lint/tipo/imports — não só
testes — fechando o gap F4 e exercitando o feedback de correção (F2) num sinal de DoD real.

## Acceptance Criteria

1. **Verify = DoD completo:** **Given** o `worker-meta` com `HDD_VERIFY_COMMAND` =
   `sh -c 'cd backend && ruff check . && MYPYPATH=src mypy && PYTHONPATH=src lint-imports && python -m pytest -q'`
   **When** a onda roda **Then** o verde do verify exige ruff+mypy+import-linter+pytest verdes (não
   só pytest). Comando **validado** contra a `main` limpa (exit 0) e contra um erro de lint (reporta e
   para a cadeia).
2. **Feature-veículo entregue:** **Given** a tarefa visível **When** o `execute` roda **Then** a
   feature pequena (`parse_repo_slug` em `backend/src/hdd/domain/vcs.py`, pura, com testes) é
   construída; spec **visível** (o agente escreve os próprios testes), **sem** oracle oculto.
3. **Loop sob DoD (F2 × F4):** **Given** a 1ª passada com qualquer falha de DoD (ex.: linha >100,
   import não usado, type) **When** o verify reprova **Then** o output da ferramenta vai ao prompt
   da correção (F2) e o loop **converge** — ou a onda é one-shot (DoD verde já na 1ª). Ambos
   provam que o verify=DoD-completo funciona. Registrar o desfecho (`n_corrections`).
4. **Gate humano:** **Given** o gate **When** reviso o PR **Then** DoD completo verde no branch,
   boundaries preservados; **PARAR p/ confirmação antes do merge**.
5. **Auditoria:** registrar a Meta-onda 4 em `docs/dogfood-meta.md` e marcar F4 endereçado.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** `compose.meta.onda4.yaml` (verify=DoD completo; timeout 1200;
  sem oracle). Pré-requisitos verificados: tools no meta-sandbox (`/deps/.venv/bin`), comando do DoD
  validado verde/vermelho no sandbox. **Sem rebuild.**
- [ ] **Task 1 — Reconfigurar stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar a onda in-container — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch; `gh pr ready`; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 4 + esta story; F4 endereçado). Descer o stack.

## Dev Notes

- **Tarefa visível (enfileirar):**
  > "Adicione validação de slug de repositório ao domínio. Crie o módulo
  > backend/src/hdd/domain/vcs.py com a função pura
  > parse_repo_slug(slug: str) -> tuple[str, str], que recebe um slug GitHub no formato 'owner/repo'
  > e retorna (owner, repo). Entradas inválidas/malformadas levantam ValueError com mensagem
  > descritiva (rejeite vazio, sem barra, partes vazias, barra extra, espaços, e nomes de repo '.'/'..';
  > aceite hífen/underscore/ponto válidos). A função valida settings.repo_slug antes do `gh --repo`.
  > Inclua testes unitários em backend/tests/unit/test_vcs.py cobrindo os casos válidos e inválidos.
  > Siga o estilo do domínio (funções puras, sem I/O) e mantenha ruff/mypy --strict/import-linter/pytest verdes."
- **Por que `parse_repo_slug` como veículo:** é a feature que a Meta-onda 2 não conseguiu entregar
  (falhou no timeout); é real/útil (hoje `settings.repo_slug` vai cru ao `gh --repo`); pura e
  single-module (one-shot-friendly); e implementações naturais tendem a esbarrar em lint (linhas
  longas, regex) — chance honesta de exercitar o loop sob DoD (como a 7.11 teve 3 E501).
- **Spec visível, sem oracle:** o ponto é o **verify = DoD completo**; o agente escreve os próprios
  testes (verificados pela suíte do verify). A spec lista os casos para guiar, sem esconder nada.
- **F2 × F4:** se a 1ª passada reprovar no DoD, o output (ruff/mypy/import-linter) chega ao prompt da
  correção (F2, já em prod) → o loop pode convergir — algo impossível antes desta cadeia de ondas.
- **Salvaguardas Fase 2:** in-container (PC-1); PR + gate humano; workspace efêmero; pré-flight; sem
  auto-deploy; HDD nunca toca `compose.prod.yaml`/`secrets/`. Parar antes da quota e do merge.
- **Custo:** 1 onda de quota; cada `claude` ≤ 1200s.

### Project Structure Notes

- Feature (o HDD fará no clone, revisada no gate): `backend/src/hdd/domain/vcs.py` (NEW),
  `backend/tests/unit/test_vcs.py` (NEW).
- Operacional neste repo: `compose.meta.onda4.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md`
  (UPDATE, a fazer).

### References

- [Source: docs/dogfood-meta.md] (Meta-onda 3 → achado F4; Meta-onda 2 → F2)
- [Source: _bmad-output/implementation-artifacts/7-11-meta-onda-3-feedback-verify.md] (F2 fechado; F4)
- [Source: backend/pyproject.toml] (config ruff/mypy/importlinter — files=src/hdd, root_package=hdd)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta`.

### Debug Log References

- **Run 1 (`019e8d4a-2333`, worker stale pré-F2):** `->execute=4`, 4× `verify.concluido exit_code=1`
  (falhas reais de DoD, não timeout) → esgotou `max_corrections=3` → **escalated** (limpo, sem
  branch/PR/workspace). Diagnóstico: o `worker-meta` rodava `hdd-worker:latest` buildado em 06-02
  (pré-F2) — `Verifier=Callable[[str],bool]`, sem `verify_feedback` → correção **cega** → não
  convergiu. **Achado F5.**
- **Rebuild:** `docker build -t hdd-worker:latest --target worker backend` (da main com F2) +
  `up -d --force-recreate worker-meta`. Confirmado no container: `Verifier=...tuple[bool,str]`,
  `verify_feedback` no estado/nós.
- **Run 2 (`019e8d71-c36f`, worker com F2):** `->execute=1`, `verify.concluido exit_code=0`
  (DoD completo verde) → **awaiting_gate one-shot**. PR #29 aberto.

### Completion Notes List

- **F4 endereçado:** verify do meta roda o DoD completo; validado verde/vermelho no sandbox antes.
- **F5 (novo):** merge ≠ deploy também no `worker-meta` — rebuildar+recriar após onda que toca o
  worker/orquestrador. Registrado em `docs/dogfood-meta.md`.
- **Achado positivo:** sob full-DoD verify, o loop **escala limpo** ao esgotar N (Run 1) — melhor
  que o timeout da Meta-onda 2.
- **Gate humano (Run 2, DoD no branch):** ruff ✓ · mypy --strict ✓ (75) · import-linter ✓ (4/4) ·
  pytest ✓ (135). **Sem fix manual** (o verify=DoD-completo já barrara tudo) — prova end-to-end do F4.
- **Merge:** operador aprovou; `--squash --admin` → `24ea764` na `main`, branch removida.
- **Entrega:** `parse_repo_slug` (`domain/vcs.py`) + `field_validator` no `repo_slug` (`settings.py`)
  + testes parametrizados. Fecha a feature que a Meta-onda 2 não conseguiu entregar.

### File List

**Neste repo (operacional, Story 7.12):**
- `compose.meta.onda4.yaml` (NEW) — override (verify=DoD completo; timeout 1200).
- `_bmad-output/implementation-artifacts/7-12-meta-onda-4-verify-dod-completo.md` (NEW) — esta story.
- `docs/dogfood-meta.md` (UPDATE) — registro da Meta-onda 4 (a fazer).

**No PR #29 (feito pelo HDD, revisado no gate — `24ea764` na main):**
- `backend/src/hdd/domain/vcs.py` (NEW), `backend/tests/unit/test_vcs.py` (NEW),
  `backend/src/hdd/config/settings.py` (UPDATE — `field_validator` no `repo_slug`).

**Infra (rebuild do worker, F5):** `hdd-worker:latest` rebuildado da main após o merge da onda 3
para o worker passar a usar o F2 (sem isso, Run 1 rodou o loop cego e escalou).
