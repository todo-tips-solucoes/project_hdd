# Story 7.13: Meta-onda 5 (Fase 2) — oracle oculto que precisa convergir às cegas

Status: done (2026-06-03) — atingiu o gate **one-shot** (`->execute=1`, `n_corr=0`); PR #30 merged
`0d50d08`. **Convergência NÃO exercitada:** o agente acertou o formato (convenção natural) na 1ª
tentativa, sem divergência para corrigir. Máquina do loop verificada (teste da onda 3 + onda-4-run1),
mas a demonstração ao vivo de fire→feedback→fix→verde foi encaminhada à **Meta-onda 6 (Story 7.14)**
com oracle de convenção não-óbvia.

> **A culminação do arco do Epic 7.** A Meta-onda 2 disparou o loop de correção com oracle oculto
> mas **falhou** (loop cego → timeout). As ondas 3 (F2: feedback do verify) e 4 (worker rebuildado
> com F2) destravaram o loop. Esta onda fecha o ciclo: um oracle oculto que o `execute` **precisa
> convergir às cegas**, usando o feedback que agora existe.

## Story

As a operador,
I want que o HDD construa uma feature pequena (`format_duration_human`) cujo **formato exato é
fixado por um oracle oculto** (não visível ao `execute`),
so that eu observe o loop `verify→CORRECTING→execute` **convergir de verdade** — o `execute` erra o
formato na 1ª passada, recebe os diffs do pytest via feedback (F2) e corrige até verde, sem nunca
ver o oracle. É o teste que a Meta-onda 2 não completou.

## Acceptance Criteria

1. **Oracle oculto:** **Given** `HDD_ORACLE_DIR=/var/lib/hdd-oracles/duration` + verify oracle-only
   **When** a onda roda **Then** o `execute` implementa `format_duration_human` **sem ver** os casos
   (montados `-v <host>:/oracle:ro` só no verify).
2. **Convergência às cegas (o ponto):** **Given** a tarefa não dita o formato exato **When** a 1ª
   passada erra o formato **Then** o `verify` reprova, o output do pytest (diffs de TODOS os casos)
   vai ao prompt da correção (F2) e o loop **converge** a `awaiting_gate` em ≤ `max_corrections`
   (`n_corrections ≥ 1` esperado). Fallback: escala se não convergir (ainda mede o comportamento).
3. **In-container (PC-1):** caminho `hdd start`→fila→`worker-meta` (com F2); PR + gate humano;
   workspace efêmero; pré-flight verde.
4. **Gate humano:** DoD completo no branch do PR verde; boundaries; **PARAR antes do merge**.
5. **Auditoria:** registrar a Meta-onda 5 em `docs/dogfood-meta.md` (com `n_corrections` observado —
   a evidência da convergência às cegas).

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** Oracle `/var/lib/hdd-oracles/duration/test_oracle_duration.py`
  (13 casos de formato + 3 negativos). `compose.meta.onda5.yaml` (oracle-only; timeout 1200; bind).
  **Wiring validado** no sandbox: impl correta → 16 passed (exit 0); ingênua → 11 failed (exit 1,
  assertions legíveis). Worker já com F2 (rebuild da onda 4). Sem rebuild do meta-sandbox.
- [ ] **Task 1 — Subir stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar a onda — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch; `gh pr ready`; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 5 + esta story). Descer o stack.

## Dev Notes

- **Tarefa visível (enfileirar — pina contrato, NÃO o formato):**
  > "Crie o módulo backend/src/hdd/domain/duration.py com a função pura
  > format_duration_human(seconds: int) -> str que formata uma duração não-negativa em segundos como
  > string legível por humanos com componentes de horas/minutos/segundos. Entradas negativas levantam
  > ValueError. Inclua testes unitários em backend/tests/unit/test_duration.py. Funções puras, sem
  > I/O; mantenha o DoD verde (ruff, mypy --strict, import-linter, pytest)."
- **Oracle (regras NÃO ditas):** compõe h/m/s; omite componentes zero; separa por um espaço;
  unidades h/m/s; `"0s"` para zero; horas não transbordam p/ dias; negativo → ValueError.
  Ex.: 0→`0s`, 60→`1m`, 90→`1m 30s`, 3600→`1h`, 3661→`1h 1m 1s`, 3720→`1h 2m`, 90000→`25h`.
- **Por que converge (e não timeout como a onda 2):** o worker agora roda o F2 — na reprovação o
  `verify` devolve `(False, stderr+stdout)`; `_execute` injeta o feedback no prompt da correção. O
  agente vê os diffs `assert "1h 0m 0s" == "1h"` de todos os casos de uma vez → infere a regra
  (omitir zeros, separador, caso zero) → corrige. Provável **1 correção**.
- **verify = oracle-only:** isola o sinal; evita thrash com os testes que o agente escreve. DoD
  completo no gate (já provado na onda 4).
- **Salvaguardas Fase 2:** in-container (PC-1); PR + gate humano; workspace efêmero; pré-flight;
  sem auto-deploy; HDD nunca toca `compose.prod.yaml`/`secrets/`. Parar antes da quota e do merge.

### Project Structure Notes

- Feature (HDD fará no clone, revisada no gate): `backend/src/hdd/domain/duration.py` (NEW),
  `backend/tests/unit/test_duration.py` (NEW).
- Operacional neste repo: `compose.meta.onda5.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md`
  (UPDATE, a fazer). Oracle vive fora do repo (`/var/lib/hdd-oracles/duration/`) — não commitado.

### References

- [Source: docs/dogfood-meta.md] (Meta-ondas 2/3/4 — F2 fechado, worker c/ F2)
- [Source: _bmad-output/implementation-artifacts/7-10-meta-onda-2-loop-correcao.md] (oracle oculto; achado F2)
- [Source: backend/src/hdd/adapters/orchestrator/wave.py] (loop com feedback — F2)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta` (com F2).

### Debug Log References

(a preencher após a onda — `->execute`, `n_corrections`, verify exit codes, evidência da convergência)

### Completion Notes List

(a preencher após o gate)

### File List

**Neste repo (operacional, Story 7.13):**
- `compose.meta.onda5.yaml` (NEW) — override (oracle-only; timeout 1200).
- `_bmad-output/implementation-artifacts/7-13-meta-onda-5-oracle-convergencia.md` (NEW) — esta story.
- `docs/dogfood-meta.md` (UPDATE) — registro da Meta-onda 5 (a fazer).

**Fora do repo (segredo do experimento, não commitado):**
- `/var/lib/hdd-oracles/duration/test_oracle_duration.py` (NEW) — oracle oculto.

**No PR da meta-onda (feito pelo HDD, revisado no gate — não commitado aqui):**
- `backend/src/hdd/domain/duration.py`, `backend/tests/unit/test_duration.py` (NEW).
