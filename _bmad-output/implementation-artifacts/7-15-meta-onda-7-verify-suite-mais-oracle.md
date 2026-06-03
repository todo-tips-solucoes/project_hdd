# Story 7.15: Meta-onda 7 (Fase 2) — verify roda a suíte do agente + o oracle (mitiga F6)

Status: done (2026-06-03) — **F6 mitigado**: verify rodou suíte do agente + oracle; o agente
**escreveu** `test_parsing.py` (consistente com o oracle), exercitado no verify. one-shot
(`->execute=1`); PR #32 merged `dd5c454`. Nuance: o mecanismo força consistência dos testes, mas
não compele a escrevê-los (depende da tarefa + gate). DoD verde, sem fix manual.

> Mitiga o achado **F6** da Meta-onda 6: com verify oracle-only, o agente não escreveu os próprios
> testes (não eram exercitados). Aqui o verify roda a **suíte do agente (tests/unit) + o oracle
> oculto** — forçando o agente a escrever testes E a reconciliá-los com a spec oculta via o feedback
> (F2). É a forma "final" do verify do meta: comportamento autoritativo (oracle) + os testes do agente.

## Story

As a operador,
I want que o verify do meta-dogfood rode a suíte de testes do agente **junto com** o oracle oculto,
so that o agente seja obrigado a escrever os próprios testes (mitigando F6) e a reconciliá-los com
a especificação oculta — exercitando o loop com feedback (F2) num cenário mais realista.

## Acceptance Criteria

1. **verify = suíte + oracle:** **Given** `HDD_VERIFY_COMMAND` =
   `sh -c 'cd backend && PYTHONPATH=src python -m pytest tests/unit /oracle -q'` **When** a onda roda
   **Then** o verde exige a suíte unitária do projeto (incl. o `test_parsing.py` do agente) **e** o
   oracle verdes. Validado: impl correta → RC=0; ingênua → oracle reprova.
2. **Agente escreve testes (mitiga F6):** **Given** a suíte do agente roda no verify **When** o
   `execute` implementa **Then** ele escreve `backend/tests/unit/test_parsing.py` (senão a suíte não
   muda, mas o oracle ainda julga o comportamento; o gate confere que os testes existem).
3. **Reconciliação + convergência:** **Given** a convenção do oracle é não-óbvia **When** os testes
   do agente assumem outra convenção **Then** suíte+oracle não podem ambos passar até o agente
   reconciliar (corrigir impl **e** os próprios testes) via feedback → converge a `awaiting_gate`
   (`n_corrections ≥ 1` provável). Fallback: escala (mais eixos de falha; desfecho válido).
4. **Gate humano:** DoD completo no branch; boundaries; testes do agente presentes; **PARAR antes do merge**.
5. **Auditoria:** registrar a Meta-onda 7 em `docs/dogfood-meta.md` (com `->execute`/desfecho e se
   o agente escreveu os testes) — fechando (ou não) o F6.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** Oracle `/var/lib/hdd-oracles/parsebool/test_oracle_parsebool.py`
  (9 verdadeiros + 9 falsos + 12 inválidos). `compose.meta.onda7.yaml` (verify=suíte+oracle; timeout
  1200; bind). **Wiring validado:** correto → RC=0 (suíte unitária + oracle); ingênuo → oracle reprova.
  Worker com F2. Sem rebuild do meta-sandbox.
- [ ] **Task 1 — Subir stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch; conferir testes do agente; `gh pr ready`; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 7 + esta story). Descer o stack.

## Dev Notes

- **Tarefa visível (pina contrato, NÃO o conjunto aceito):**
  > "Crie o módulo backend/src/hdd/domain/parsing.py com a função pura parse_bool(s: str) -> bool que
  > interpreta uma string como booleano. Strings não reconhecidas levantam ValueError. Inclua testes
  > unitários em backend/tests/unit/test_parsing.py. Funções puras, sem I/O; mantenha o DoD verde
  > (ruff, mypy --strict, import-linter, pytest)."
- **Oracle (convenção NÃO dita):** case-insensitive; `strip`; True ∈ {true,1,yes,on};
  False ∈ {false,0,no,off}; qualquer outra → ValueError (incl. "", "maybe", "2", "y", "n").
- **O wrinkle (o ponto):** a suíte do agente roda junto com o oracle. Se os testes do agente
  assumem outro conjunto, suíte+oracle não passam ambos até o agente reconciliar impl + testes pelo
  feedback (F2). Mitiga F6 de verdade (testes do agente exercitados E alinhados à spec). Mais eixos
  de falha → escalação é um desfecho válido.
- **verify aponta tests/unit** (exclui integration, que precisa docker/rede) **+ /oracle**;
  PYTHONPATH=src resolve o pacote (projeto não instalado no sandbox). DoD completo no gate.
- **Salvaguardas Fase 2:** in-container (PC-1); PR + gate humano; workspace efêmero; pré-flight;
  sem auto-deploy; HDD nunca toca `compose.prod.yaml`/`secrets/`. Parar antes da quota e do merge.

### Project Structure Notes

- Feature (HDD fará no clone, revisada no gate): `backend/src/hdd/domain/parsing.py` (NEW),
  `backend/tests/unit/test_parsing.py` (NEW — agora exigido pelo verify).
- Operacional: `compose.meta.onda7.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md` (UPDATE).
  Oracle fora do repo (`/var/lib/hdd-oracles/parsebool/`).

### References

- [Source: docs/dogfood-meta.md] (Meta-onda 6 — achado F6; convergência demonstrada)
- [Source: backend/src/hdd/adapters/orchestrator/wave.py] (loop com feedback — F2)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta` (com F2).

### Debug Log References

- Onda `019e8e6c-40ac` (worker com F2, verify=suíte+oracle): `->execute=1`, verify exit 0 →
  `awaiting_gate` one-shot. O agente acertou `parse_bool` e escreveu testes consistentes na 1ª.

### Completion Notes List

- **F6 mitigado:** o agente escreveu `test_parsing.py` (22 válidos + 9 inválidos), consistente com
  o oracle, exercitado no verify combinado. (Onda 6 oracle-only → sem testes do agente.)
- **Nuance:** verify=suíte+oracle força *consistência* dos testes com a spec (pegaria testes
  errados), mas não *compele* a escrevê-los — depende da tarefa + gate. Caso de reconciliação não
  exercitado (one-shot).
- **Gate humano:** ruff ✓ · mypy --strict ✓ (78) · import-linter ✓ (4/4) · pytest ✓ (194). Sem fix manual.
- **Merge:** operador aprovou; `--squash --admin` → `dd5c454` na `main`, branch removida.

### File List

**Neste repo (operacional, Story 7.15):**
- `compose.meta.onda7.yaml` (NEW), `_bmad-output/implementation-artifacts/7-15-meta-onda-7-verify-suite-mais-oracle.md` (NEW),
  `docs/dogfood-meta.md` (UPDATE, a fazer).

**Fora do repo:** `/var/lib/hdd-oracles/parsebool/test_oracle_parsebool.py` (NEW).

**No PR da meta-onda (feito pelo HDD, revisado no gate):** `backend/src/hdd/domain/parsing.py`,
`backend/tests/unit/test_parsing.py` (NEW).
