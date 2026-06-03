# Story 7.14: Meta-onda 6 (Fase 2) — convergência às cegas FORÇADA (oracle não-óbvio)

Status: done (2026-06-03) — **CONVERGÊNCIA ÀS CEGAS DEMONSTRADA**. Loop disparou 2× (`->execute=3`):
verify exit 2 (import) → exit 1 (formato) → exit 0 (verde) → awaiting_gate. O agente convergiu só
com o feedback do verify (F2), sem ver o oracle. PR #31 merged `85feab1`. Achado F6 (verify
oracle-only não exige os testes do agente) — `test_bytesize.py` adicionado no gate.

> A Meta-onda 5 atingiu o gate **one-shot** (o formato era "natural" demais → o agente não errou →
> o loop não disparou). Esta onda usa um oracle de convenção **deliberadamente não-óbvia** para
> *garantir* divergência na 1ª passada → forçar o loop `verify→CORRECTING→execute` a **convergir**
> com o feedback (F2). É a demonstração ao vivo que faltava.

## Story

As a operador,
I want que o HDD construa `format_bytes` cujo formato exato é fixado por um oracle oculto de
convenção **não-óbvia** (base 1024, sufixos KB, 2 casas decimais),
so that o `execute` quase certamente diverge na 1ª passada, recebe os diffs do pytest via feedback
(F2) e **converge** — a evidência viva do loop de auto-correção funcionando às cegas.

## Acceptance Criteria

1. **Divergência forçada na 1ª passada:** **Given** a tarefa não dita base/sufixo/casas decimais
   **When** o `execute` implementa **Then** é altamente provável divergir do oracle (validado: a
   convenção default — decimal 1000, 1 casa — falha 9/15 casos).
2. **Convergência (o ponto):** **Given** o verify reprova **When** o output do pytest (diffs de
   todos os casos) vai ao prompt da correção (F2) **Then** o agente ajusta a convenção e o loop
   **converge** a `awaiting_gate` com **`n_corrections ≥ 1`** (a evidência buscada). Fallback:
   escala se não convergir em `max_corrections=3` (ainda mede o comportamento).
3. **In-container (PC-1) + worker com F2;** PR + gate humano; workspace efêmero; pré-flight verde.
4. **Gate humano:** DoD completo no branch; boundaries; **PARAR antes do merge**.
5. **Auditoria:** registrar a Meta-onda 6 em `docs/dogfood-meta.md` com o **`n_corrections`
   observado** — fechando (ou não) a demonstração de convergência às cegas.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** Oracle `/var/lib/hdd-oracles/bytes/test_oracle_bytes.py`
  (12 casos + 3 negativos). `compose.meta.onda6.yaml` (oracle-only; timeout 1200; bind). **Wiring
  validado:** correto → 15 passed (exit 0); convenção default → 9 failed (exit 1, diffs claros).
  Worker com F2 (onda 4). Sem rebuild do meta-sandbox.
- [ ] **Task 1 — Subir stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch; `gh pr ready`; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 6 + esta story). Descer o stack.

## Dev Notes

- **Tarefa visível (pina contrato, NÃO a convenção):**
  > "Crie o módulo backend/src/hdd/domain/bytesize.py com a função pura
  > format_bytes(n: int) -> str que formata um número não-negativo de bytes como string legível por
  > humanos (com unidade apropriada). Entradas negativas levantam ValueError. Inclua testes em
  > backend/tests/unit/test_bytesize.py. Funções puras, sem I/O; mantenha o DoD verde."
- **Oracle (convenção NÃO dita):** base 1024; sufixos B/KB/MB/GB/TB (KB, não KiB); maior unidade
  com valor ≥ 1; bytes como inteiro (`512 B`); KB+ com **exatamente 2 casas** (`1.00 KB`); espaço
  antes da unidade; `0 B` p/ zero; negativo → ValueError. Ex.: 1024→`1.00 KB`, 1000000→`976.56 KB`
  (base 1024!), 1048576→`1.00 MB`, 1023→`1023 B`.
- **Por que deve convergir (e não one-shot como a onda 5):** a convenção é específica o bastante
  para o agente divergir (validado: default falha 9/15), mas trivialmente aprendível pelos diffs
  (`assert "1.0 MB" == "1.00 MB"`, `"1000.0 KB"`/`"1.0 MB"` vs `"976.56 KB"`). Com F2, o agente vê
  todos os diffs de uma vez → infere base/casas/threshold → corrige. Provável 1 correção.
- **verify = oracle-only;** DoD completo no gate humano.
- **Salvaguardas Fase 2:** in-container (PC-1); PR + gate humano; workspace efêmero; pré-flight;
  sem auto-deploy; HDD nunca toca `compose.prod.yaml`/`secrets/`. Parar antes da quota e do merge.

### Project Structure Notes

- Feature (HDD fará no clone, revisada no gate): `backend/src/hdd/domain/bytesize.py` (NEW),
  `backend/tests/unit/test_bytesize.py` (NEW).
- Operacional: `compose.meta.onda6.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md` (UPDATE).
  Oracle fora do repo (`/var/lib/hdd-oracles/bytes/`).

### References

- [Source: docs/dogfood-meta.md] (Meta-onda 5 — one-shot; encaminhamento p/ convenção não-óbvia)
- [Source: backend/src/hdd/adapters/orchestrator/wave.py] (loop com feedback — F2)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

Meta-onda construída por `claude` (modelo `sonnet`, driver `subscription`) dentro do `worker-meta` (com F2).

### Debug Log References

- Onda `019e8e2f-3a73` (worker com F2): `->execute=3` (loop 2×). verify: 16:03 **exit 2** (erro
  estrutural/import na 1ª) → 16:06 **exit 1** (formato divergente, assertions) → 16:06 **exit 0**
  (verde) → `onda_concluida` → `awaiting_gate`.
- `app.waves.n_corrections=0` (projeção incompleta; checkpointer mostra `->execute=3`).

### Completion Notes List

- **Convergência às cegas DEMONSTRADA** — o objetivo central. O agente nunca viu o oracle; corrigiu
  só com o feedback do verify (F2) através de 2 falhas distintas (import → formato) até verde.
- **bytesize.py** convergido bate exatamente com a spec/oracle (base 1024, B inteiro, KB+ 2 casas,
  0 B, negativo→ValueError).
- **F6 (novo):** verify oracle-only não exercita os testes do agente → ele não escreveu
  `test_bytesize.py`. Adicionado no gate (derivado da spec, não da impl); DoD re-rodado: 163 passed.
- **Gate humano:** ruff ✓ · mypy --strict ✓ (77) · import-linter ✓ (4/4) · pytest ✓ (163).
- **Merge:** operador aprovou; `--squash --admin` → `85feab1` na `main`, branch removida.

### File List

**Neste repo (operacional, Story 7.14):**
- `compose.meta.onda6.yaml` (NEW), `_bmad-output/implementation-artifacts/7-14-meta-onda-6-convergencia-forcada.md` (NEW),
  `docs/dogfood-meta.md` (UPDATE, a fazer).

**Fora do repo (segredo do experimento):** `/var/lib/hdd-oracles/bytes/test_oracle_bytes.py` (NEW).

**No PR da meta-onda (feito pelo HDD, revisado no gate):** `backend/src/hdd/domain/bytesize.py`,
`backend/tests/unit/test_bytesize.py` (NEW).
