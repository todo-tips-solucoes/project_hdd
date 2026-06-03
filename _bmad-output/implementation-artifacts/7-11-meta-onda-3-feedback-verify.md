# Story 7.11: Meta-onda 3 (Fase 2) — o HDD conserta o próprio loop de correção (feedback do verify)

Status: done — meta-onda **one-shot** (0 correções) → PR #28 **merged** `9a7efa4`; gate humano = GO.
**F2 da 7.10 endereçado.** Novo achado F4 (verify pytest-only) registrado em `docs/dogfood-meta.md`.

> Decorre diretamente do achado **F2** da Story 7.10: o loop de correção descarta o output do
> verify e re-roda cego → não converge. Esta meta-onda faz o HDD **construir o conserto no próprio
> `projeto_hdd`**, via PR + gate humano. É a meta-onda mais "auto-referente" até aqui: o HDD
> melhorando a própria capacidade de auto-correção.

## Story

As a operador,
I want que o HDD construa, no próprio `projeto_hdd`, a propagação do **feedback do verify** para o
nó de correção (verify devolve o output; o estado o carrega; o execute o injeta no prompt da
correção),
so that o loop `verify→CORRECTING→execute` passe a **convergir** (ondas futuras com oracle oculto,
como a 7.10, poderão corrigir com sinal real em vez de às cegas).

## Acceptance Criteria

1. **Verify propaga o output:** **Given** o `verify` reprova **When** o nó roda **Then**
   `make_sandbox_verifier` devolve `(ok, output)` (com `output` = stderr+stdout do `SandboxResult`
   na reprovação; vazio quando `ok`), em vez de só `bool`. O log `verify.concluido` permanece.
2. **Estado carrega o feedback:** **Given** o `WaveGraphState` **When** o verify reprova **Then**
   há um campo `verify_feedback: str` preenchido com o output.
3. **Correção usa o feedback:** **Given** `n_corrections > 0` e `verify_feedback` presente **When**
   o `_execute` roda **Then** o prompt do LLM inclui o feedback ("a verificação anterior falhou
   com: …; corrija"). Na 1ª passada (sem correção) o prompt segue como hoje.
4. **DoD verde e boundaries:** **Given** o gate humano **When** reviso o PR **Then** `ruff` /
   `mypy --strict` / `import-linter` / `pytest` verdes, com os call-sites e testes afetados
   atualizados (`factory.py:_always_ok`, `tests/unit/test_verifier.py`, `tests/unit/test_orchestrator.py`),
   boundaries hexagonais preservados.
5. **Auditoria:** **Given** a meta-onda **When** conclui **Then** o resultado fica registrado em
   `docs/dogfood-meta.md` (Meta-onda 3) e marca o achado F2 da 7.10 como endereçado.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** `compose.meta.onda3.yaml` (sem oracle; `HDD_CLAUDE_TIMEOUT_S=1200`).
- [ ] **Task 1 — Reconfigurar stack + pré-flight (sem quota).** Recriar `worker-meta` SEM o oracle
  (verify = suíte completa, base do `compose.meta.yaml`) e com timeout 1200; confirmar env;
  `evaluate_capacity` verde.
- [ ] **Task 2 — Disparar a meta-onda 3 in-container — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano.** DoD completo no branch do PR (worktree descartável); `gh pr ready`;
  **PARAR p/ confirmação antes do merge.**
- [ ] **Task 4 — Registrar (AC #5).** `docs/dogfood-meta.md` (Meta-onda 3) + atualizar esta story.
  Marcar F2 endereçado. Descer o stack dev.

## Dev Notes

- **Tarefa visível (enfileirar):**
  > "Faça o loop de correção do orquestrador usar o feedback do verify. Hoje o nó verify descarta
  > o output do pytest e a correção re-roda cega. Mudanças:
  > (1) backend/src/hdd/adapters/sandbox/verifier.py — `make_sandbox_verifier` passa a devolver uma
  > função `(workspace) -> tuple[bool, str]`, onde a string é stderr+stdout do `SandboxResult` na
  > reprovação (vazia quando ok). Mantenha o log `verify.concluido`.
  > (2) backend/src/hdd/adapters/orchestrator/wave.py — atualize o type alias
  > `Verifier = Callable[[str], tuple[bool, str]]`; adicione `verify_feedback: str` ao
  > `WaveGraphState`; em `_verify_node` desempacote `(ok, output)` e grave `output` em
  > `verify_feedback` na reprovação; em `_execute`, quando `n_corrections > 0` e houver
  > `verify_feedback`, inclua-o no prompt do LLM ('A verificação anterior falhou com:\n{feedback}\n
  > Corrija a implementação.').
  > (3) backend/src/hdd/adapters/orchestrator/factory.py — ajuste o default `_always_ok` p/ a nova
  > assinatura (retornar `(True, '')`).
  > (4) Atualize os call-sites e testes afetados (tests/unit/test_verifier.py,
  > tests/unit/test_orchestrator.py) cobrindo: verify devolve output na reprovação; execute injeta
  > o feedback na correção.
  > Preserve os boundaries hexagonais e mantenha ruff/mypy --strict/import-linter/pytest verdes."
- **⚠️ Recursão consciente:** o `verify` desta onda roda no código **atual** (cego). Logo a onda é
  esperada **one-shot** — o agente escreve/atualiza os próprios testes (visíveis à suíte do verify),
  como na 7.9. Se a 1ª passada reprovar, o loop **ainda** não ajuda (é justamente o que estamos
  consertando) → provável timeout/falha. Por isso a tarefa é precisa e o timeout folgado (1200s).
- **Verify = suíte COMPLETA (sem oracle).** A feature é "usar o feedback"; o teste natural é a
  própria suíte do projeto (os testes que o agente atualiza). Oracle oculto reativaria o bug cego.
- **Pontos de código (ler):** `wave.py:27` (`Verifier = Callable[[str], bool]`), `wave.py:30-41`
  (`WaveGraphState`), `wave.py:69-76` (`_execute`/`_verify_node`), `verifier.py:32-52`
  (`make_sandbox_verifier`), `factory.py:37` (`verify: Verifier = _always_ok`).
- **Salvaguardas Fase 2:** in-container (PC-1); PR + gate humano; workspace efêmero; pré-flight;
  sem auto-deploy; HDD nunca toca `compose.prod.yaml`/`secrets/`. Parar antes da quota e do merge.
- **Custo:** 1 onda de quota; ~one-shot (plan + execute), cada `claude` ≤ 1200s.

### Project Structure Notes

- Mudanças da feature (o HDD fará no clone, revisadas no gate): `verifier.py`, `wave.py`,
  `factory.py` (UPDATE), `tests/unit/test_verifier.py`, `tests/unit/test_orchestrator.py` (UPDATE).
- Mudanças DESTA story neste repo (operacional): `compose.meta.onda3.yaml` (NEW),
  `_bmad-output/.../7-11-...md` (NEW), `docs/dogfood-meta.md` (UPDATE, a fazer).

### References

- [Source: _bmad-output/implementation-artifacts/7-10-meta-onda-2-loop-correcao.md] (achado F2 — causa-raiz)
- [Source: docs/dogfood-meta.md] (Meta-onda 2 — F1/F2/F3)
- [Source: backend/src/hdd/adapters/sandbox/verifier.py:50] (output descartado)
- [Source: backend/src/hdd/adapters/orchestrator/wave.py:27,30-41,69-76] (type alias / estado / nós)
- [Source: backend/src/hdd/adapters/orchestrator/factory.py:37] (default _always_ok)
- [Source: docs/definition-of-done.md] (salvaguardas + padrão de decisão)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta`.

### Debug Log References

**Onda `019e8cfe-0ca1-7f61-8013-f6de6ced3e62` (2026-06-03):** `plan`→`execute` (1×)→`verify`
`exit_code=0 ok=true` (10:26:29, suíte completa contra o código novo) → `onda_concluida` →
`awaiting_gate` (`n_corrections=0`, one-shot). PR rascunho #28 aberto pelo nó `_pr`.

### Completion Notes List

- **One-shot** (0 correções): a tarefa era precisa e o verify (suíte completa) ficou verde na 1ª.
- **Gate humano (DoD no branch do PR, worktree descartável):** mypy --strict ✓ (74) · import-linter
  ✓ (4/4, boundaries preservados) · pytest ✓ (121 passed, 47 deselected). 3 violações ruff E501
  (`wave.py:74`, `test_orchestrator.py:43,98`) **corrigidas no gate** (commit `c1c4be3`, cosmético)
  → DoD 100% verde.
- **Merge:** operador aprovou; `--squash --admin` (proteção de branch exige review/checks; o gate
  humano é a revisão — padrão da 7.9) → `9a7efa4` na `main`, branch removida.
- **F2 endereçado:** `verify` propaga `(ok, output)`; `WaveGraphState.verify_feedback`; `_execute`
  injeta o feedback na correção (`n_corrections>0`). Teste novo cobre o comportamento.
- **F4 (novo):** verify do meta é pytest-only → lint/tipo só pegos no gate. Candidato a próxima
  meta-onda (verify = DoD completo), agora viável com F2 fechado. Registrado em `docs/dogfood-meta.md`.

### File List

**Neste repo (operacional, Story 7.11):**
- `compose.meta.onda3.yaml` (NEW) — override (sem oracle; timeout 1200).
- `_bmad-output/implementation-artifacts/7-11-meta-onda-3-feedback-verify.md` (NEW) — esta story.
- `docs/dogfood-meta.md` (UPDATE) — registro da Meta-onda 3 (a fazer).

**No PR da meta-onda (feito pelo HDD, revisado no gate — não commitado aqui):**
- `backend/src/hdd/adapters/sandbox/verifier.py`, `.../orchestrator/wave.py`, `.../orchestrator/factory.py`,
  `backend/tests/unit/test_verifier.py`, `backend/tests/unit/test_orchestrator.py` (UPDATE).
