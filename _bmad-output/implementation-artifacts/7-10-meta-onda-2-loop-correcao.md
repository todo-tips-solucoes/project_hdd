# Story 7.10: Meta-onda 2 (Fase 2) — exercitar o loop de correção com oracle oculto

Status: done (meta-onda dirigida 2026-06-03) — **loop de correção DISPAROU** (objetivo primário
✅, gap da 7.5 fechado no mecanismo), mas a onda **FALHOU** sem chegar ao gate: a 2ª passada do
`execute` estourou o timeout de 600s do `claude`. **Achado estrutural** (a investigação que se
seguiu): o loop de correção descarta o feedback do verify → corrige às cegas → não converge.
Endereçado pela **meta-onda 3 (Story 7.11)**.

> Sucessora da Story 7.9 (que entregou a **capacidade** de oracle oculto, one-shot). Esta story
> **exercita** essa capacidade às cegas pela primeira vez, fechando o gap da 7.5 (oracle visível →
> o loop `verify→CORRECTING→execute` nunca disparou naturalmente). A retro do dogfood (prevista
> como 7.10 no `epic-7-scope-proposal.md`) já foi feita na retro do Epic 7.

## Story

As a operador,
I want a **meta-onda 2** que construa, no próprio `projeto_hdd`, uma feature pequena e pura (`parse_repo_slug`) **com uma suíte-oracle oculta** montada só no `verify`,
so that eu observe o loop de auto-correção `verify→CORRECTING→execute` disparar de verdade — medindo H-A "às cegas" (ou o comportamento de escalada), o que nenhuma onda do Epic 7 fez até aqui.

## Acceptance Criteria

1. **Oracle oculto às cegas:** **Given** o `worker-meta` com `HDD_ORACLE_DIR` + `HDD_VERIFY_COMMAND` oracle-only **When** a onda roda **Then** o `execute` implementa `parse_repo_slug` **sem ver** os casos do oracle (o oracle é montado `-v <host>:/oracle:ro` só no `verify`, fora do clone que o `execute` lê).
2. **Loop mensurável:** **Given** edge cases não-óbvios no oracle **When** a 1ª tentativa erra um subconjunto **Then** o `verify` fica vermelho e observa-se ao menos uma transição `verify→CORRECTING→execute` (`corrections_sum ≥ 1`), convergindo a `awaiting_gate`. **Fallback válido:** se não convergir dentro de `RetryLimits`, **escala** — e a escalada é registrada como dado.
3. **In-container (PC-1):** **Given** o GO da Fase 2 **When** disparo a onda **Then** ela roda pelo caminho in-container (`hdd start` → fila dev → `worker-meta`), alvo `projeto_hdd`, **nunca** pelo `scripts/calibration_wave.py` do host. **And** PR + gate humano (sem auto-merge), workspace efêmero, pré-flight de capacidade verde.
4. **Feature correta no gate:** **Given** o gate humano **When** reviso o PR **Then** `parse_repo_slug` está correto contra os 24 casos do oracle, vive em `hdd/domain/vcs.py` (puro, sem I/O), e o DoD completo é verde (`ruff`/`mypy --strict`/`import-linter`/`pytest`), com boundaries hexagonais preservados.
5. **Auditoria:** **Given** a meta-onda **When** conclui **Then** o resultado (desfecho, nº de correções ou escalada, evidência do loop, PR, decisão do gate) fica registrado em `docs/dogfood-meta.md` (Meta-onda 2).

## Tasks / Subtasks

- [x] **Task 0 — Setup do oracle oculto (sem quota).**
  - [x] `compose.meta.oracle.yaml` (override): `HDD_ORACLE_DIR`, `HDD_VERIFY_COMMAND` oracle-only, bind host↔worker.
  - [x] `/var/lib/hdd-oracles/repo-slug/test_oracle_repo_slug.py`: oracle parametrizado (6 ACEITA + 18 REJEITA). Dir world-readable.
  - [x] Confirmar mecânica no código (runner/verifier/settings) e que não há deps novas (sem rebuild do meta-sandbox).
- [ ] **Task 1 — Pré-flight + subir stack dev (sem quota).**
  - [ ] `evaluate_capacity` verde (swap + `max_concurrent==1` + RAM).
  - [ ] `docker compose -p hdd_dev -f compose.yaml -f compose.meta.yaml -f compose.meta.oracle.yaml up -d`; `max_concurrent=1`.
  - [ ] `worker-meta` healthy/idle; env do oracle presente no container.
- [ ] **Task 2 — Disparar a meta-onda in-container — PARAR p/ confirmação do operador antes (quota).**
  - [ ] `docker exec hdd_dev-worker-meta-1 python -m hdd.cli.main start "<tarefa visível>"`.
  - [ ] Acompanhar `app.waves.state` + logs; **observar o loop** (`corrections_sum`, transições).
- [ ] **Task 3 — Gate humano (AC #2, #4).**
  - [ ] DoD completo no branch do PR (worktree descartável): ruff/mypy --strict/import-linter/pytest.
  - [ ] `gh pr ready <N>` (PR nasce draft). **PARAR p/ confirmação do operador antes do merge.**
- [ ] **Task 4 — Registrar (AC #5).** `docs/dogfood-meta.md` (Meta-onda 2) + atualizar esta story. Descer o stack dev.

## Dev Notes

- **Esta é uma META-ONDA** (Fase 2): o HDD constrói `parse_repo_slug` via `claude -p` num clone de
  `projeto_hdd`; o operador dirige e revisa. **Diferença-chave vs 7.9:** o oracle é **oculto** ao
  `execute` (montado só no `verify`), então a 1ª tentativa pode falhar nos edge cases não-óbvios →
  **o loop de correção pode disparar de verdade** (o objetivo desta story).
- **Tarefa visível (pina só o contrato, não os edge cases):** "Adicione validação de slug de
  repositório ao domínio. Crie `backend/src/hdd/domain/vcs.py` com
  `parse_repo_slug(slug: str) -> tuple[str, str]` ('owner/repo' → `(owner, repo)`); entradas
  malformadas levantam `ValueError`. Valida `settings.repo_slug` antes do `gh --repo`. Inclua
  testes em `backend/tests/unit/test_vcs.py`. Estilo do domínio (puro, sem I/O); DoD verde."
- **Oracle (regras, NÃO enumeradas na tarefa):** trim do input → strip de um `.git` final →
  exatamente um `/` com duas partes não-vazias → sem whitespace interno → owner `[A-Za-z0-9]` com
  hífens permitidos mas não nas pontas → repo `[A-Za-z0-9._-]`, nunca `.`/`..` → case preservado.
  Uma 1ª impl. ingênua (split + non-empty) erra: strip de `.git`, trim externo, `.`/`..`, hífen na
  ponta, chars inválidos → verify vermelho → correção guiada pelas assertions que falham.
- **⚠️ PC-1 / in-container (ADR [[0006]], Story 7.7):** a onda **DEVE** rodar pelo `worker-meta`
  (mount namespace sem a árvore de prod nem secrets). **NUNCA** pelo driver de host.
- **verify oracle-only (decisão consciente):** isola o sinal do loop e evita thrash (o `execute`
  reescreve os próprios testes a cada correção); `vcs.py` é aditivo, nada existente quebra. O DoD
  completo (ruff/mypy/import-linter/suíte 113) é rodado no **gate humano**, no branch do PR.
- **Por que a feature é real:** `settings.repo_slug` hoje vai **cru** para `gh --repo`/branch sem
  validação — `parse_repo_slug` é hardening genuíno e alinhado ao espírito do PC-1 (rejeitar
  `..`/barras embutidas). Pura, single-module → encaixa no padrão de `domain/gate.py`/`session.py`.
- **Salvaguardas Fase 2:** PR + gate humano (6.8); workspace efêmero (6.6); pré-flight ([[0005]]);
  sem auto-deploy (PC-2); HDD nunca toca `compose.prod.yaml`/`secrets/`/`deploy.env`. DoD:
  `docs/definition-of-done.md`. **Parar antes de gastar quota (Task 2) e antes do merge (Task 3).**
- **Custo declarado:** 1 onda de quota + N iterações de `claude -p` (~1.5–1.7G RSS, serializadas
  por `max_concurrent=1`).

### Project Structure Notes

- Mudanças da feature (o HDD fará no clone, revisadas no gate): `backend/src/hdd/domain/vcs.py`
  (NEW), `backend/tests/unit/test_vcs.py` (NEW). Possível wiring opcional em `config/settings.py`
  (usar `parse_repo_slug` para validar `repo_slug`) — aceitável se vier, não exigido.
- Mudanças DESTA story neste repo (operacional): `compose.meta.oracle.yaml` (NEW),
  `_bmad-output/.../7-10-...md` (NEW), `docs/dogfood-meta.md` (UPDATE). O oracle vive **fora** do
  repo (`/var/lib/hdd-oracles/repo-slug/`) — não é commitado (é o segredo do experimento).

### References

- [Source: _bmad-output/implementation-artifacts/7-9-meta-onda-1-oracle-oculto.md] (capacidade de oracle oculto; modelo de desfecho)
- [Source: docs/dogfood-meta.md] (execução in-container; Meta-onda 1)
- [Source: docs/dogfood-calibragem.md] (achado do oracle visível — gap da 7.5)
- [Source: backend/src/hdd/adapters/sandbox/runner.py:40] (mount `-v {oracle_dir}:/oracle:ro`)
- [Source: backend/src/hdd/adapters/sandbox/verifier.py:30,42] (`shlex.split(verify_command)` + `oracle_dir`)
- [Source: backend/src/hdd/config/settings.py:39] (`oracle_dir`/`HDD_ORACLE_DIR`)
- [Source: docs/definition-of-done.md] (salvaguardas Fase 2 + padrão de decisão)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta`
(in-container). Direção/revisão por Claude Code (operador no gate).

### Debug Log References

**Cronologia (onda `019e8bf5-886f-7503-8cab-d150a8acf71e`, 2026-06-03):**
- 05:29:44 `wave.started` → `plan` → `execute` (1ª passada; inclui clone do alvo).
- 05:37:46 `verify.concluido` **exit_code=4, ok=false** → roteia para `correct`.
- 05:37:46→05:47:47 `execute` (2ª passada / correção) roda **exatamente 600s** → timeout do
  `claude` (`HDD_CLAUDE_TIMEOUT_S=600`).
- 05:47:47 `worker.onda_falhou` (exc_info) → `app.work_queue.status=failed`, lease liberado.
- **`writes->execute=2`** no checkpointer langgraph → o loop `verify→CORRECTING→execute`
  **disparou** (objetivo primário da story).
- **Falha limpa no remote:** sem branch `hdd/wave-*`, sem PR aberto (o execute estourou durante a
  implementação, antes de commitar). Nada a limpar no GitHub.
- **`app.waves.state` ficou preso em `planned`** (a projeção só roda no retorno bem-sucedido do
  `run_wave`; ver F3).

**Wiring do oracle validado por reprodução isolada** (mesma imagem `hdd-meta-sandbox:latest` +
flags do verify, `/workspace` = clone do repo):
- `vcs.py` **correto** → `22 passed`, exit **0**.
- `vcs.py` **ingênuo** (split simples) → `10 failed, 12 passed`, exit **1** (assertions reais).
- **sem** `vcs.py` → `ImportError` na coleta, exit **2**.
→ A infra do experimento (oracle oculto + bind host↔sandbox + verify-command) está **correta**.

### Completion Notes List

- **Objetivo primário ATINGIDO:** primeira vez que o loop de correção `verify→CORRECTING→execute`
  disparou num verify vermelho real (fecha o gap da 7.5 no nível do mecanismo).
- **Desfecho:** onda **falhou** (timeout na correção), **não** chegou ao gate. Sem PR (esperado).
- **Achado estrutural (causa-raiz do não-convergir) — vira backlog/Story 7.11:**
  1. `adapters/sandbox/verifier.py:50-52` — `verify` devolve só `bool`; o `SandboxResult.stdout/stderr`
     (diffs de assertion do pytest) é **descartado**.
  2. `adapters/orchestrator/wave.py:30-41` — `WaveGraphState` **não tem campo** para feedback do verify.
  3. `adapters/orchestrator/wave.py:69-71` — na correção o `_execute` re-invoca o LLM com o **mesmo
     prompt** ("Implemente conforme o plano"), sem dizer que falhou nem o quê.
  → O loop de correção **não consegue convergir** (re-roda cego até N=3 ou timeout). F1 (timeout
  600s) é secundário; mesmo com tempo infinito, sem feedback não converge.
- **Achados de dogfood registrados em `docs/dogfood-meta.md` (Meta-onda 2):** F1 timeout apertado;
  **F2 feedback do verify descartado (dominante)**; F3 `app.waves.state` preso em `planned` numa
  falha por timeout (gap de observabilidade).
- **Stack dev preservado** para a meta-onda 3 (worker idle após a falha).

### File List

**Neste repo (operacional, Story 7.10):**
- `compose.meta.oracle.yaml` (NEW) — override do oracle oculto p/ o `worker-meta`.
- `_bmad-output/implementation-artifacts/7-10-meta-onda-2-loop-correcao.md` (NEW) — esta story.
- `docs/dogfood-meta.md` (UPDATE) — registro da Meta-onda 2 (a fazer).

**Fora do repo (segredo do experimento, não commitado):**
- `/var/lib/hdd-oracles/repo-slug/test_oracle_repo_slug.py` (NEW) — oracle oculto.

**No PR da meta-onda (feito pelo HDD, revisado no gate — não commitado aqui):**
- `backend/src/hdd/domain/vcs.py` (NEW), `backend/tests/unit/test_vcs.py` (NEW).
