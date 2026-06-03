# Story 7.6: Gate de calibração — decisão GO/NO-GO para a Fase 2 (meta-dogfood)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a operador,
I want avaliar as métricas da Fase 1 (calibração) antes de deixar o HDD tocar a si próprio,
so that a Fase 2 (meta-dogfood no próprio `projeto_hdd`) só comece com confiança operacional fundamentada em dados — não em anedota.

## Acceptance Criteria

1. **Given** as métricas das ondas 7.4/7.5 (consolidadas em `docs/dogfood-calibragem.md`) **When** reviso a calibração (gate humano, análogo ao gate de fundação 1.1) **Then** as **métricas primárias de capacidade (H-A)** ficam registradas: taxa de sucesso autônomo, correções, escaladas, leases vazados.
2. **PC-1 (bloqueante) — contenção testada:** **Given** o `execute` roda `claude` no host com cwd no workspace (ADR [[0002]]) **When** existe/roda um teste de invariante **Then** prova-se que um `Write`/efeito com **path absoluto fora do workspace** (ex.: `/var/lib/projeto_hdd/...`, `../../`) **falha ou é contido** — fechando o risco residual *soft* do ADR 0002, que deixa de ser teórico quando o HDD modifica o próprio HDD na máquina de produção ([[project-hdd-prod-on-dev-machine]]). Se a contenção **não** estiver enforçada, isso é registrado como **NO-GO/condicional** com o gap.
3. **PC-2 (bloqueante) — sem auto-deploy verificado:** **Given** `.github/workflows/ci.yml` e `compose.prod.yaml` **When** audito **Then** confirma-se que **nenhum** webhook/job redeploya a stack no merge — a salvaguarda "deploy manual" passa de premissa a **fato verificado** (evidência citada).
4. **Given** métricas (AC#1) + PC-1 + PC-2 **When** decido **Then** registro **GO** — critério **qualitativo informado por métricas**, ancorado em **H-A**: **≥1 onda completa sem intervenção fora do gate** (temos 3) **e** pressão de quota sustentável na cadência testada — **ou NO-GO** (registrar gaps, ajustar, repetir).
5. **Given** a decisão **When** finalizo **Then** o veredito e a justificativa ficam **auditados** num ADR `docs/decisions/0006-gate-calibracao-go-nogo.md`, com critérios, evidências e as salvaguardas que continuam valendo na Fase 2.

## Tasks / Subtasks

- [ ] **Task 1 — Consolidar métricas da Fase 1 (AC: #1)**.
  - [ ] Reunir de `docs/dogfood-calibragem.md` (e do harness `hdd_wave_outcomes_total`, se o DB de dev for resubido) os desfechos das 3 ondas: cep (7.4/haiku), cnpj (7.5/sonnet), data_br (7.5/haiku).
  - [ ] Tabela-evidência: **3/3 `reached_gate`, 0 correções, 0 escaladas, 0 leases vazados**; encanamento `clone→claude→verify→PR→gate→merge` validado ponta a ponta.
  - [ ] Anotar o **achado estrutural** (oracle visível ao `execute` → one-shot; loop de correção não exercitado) como nuance da interpretação de H-A.
- [ ] **Task 2 — PC-1: contenção de path testada (AC: #2)** — bloqueante.
  - [ ] Ler `backend/tests/unit/test_security_invariants.py` e `src/hdd/application/broker.py` + `src/hdd/domain/capability.py`: verificar se já há invariante de contenção de path (Write absoluto fora do workspace).
  - [ ] Se faltar: escrever o teste de invariante (RED→GREEN) que prova que um efeito com path absoluto fora do workspace **falha/é recusado**. Se a contenção não estiver enforçada no `execute` (ADR 0002 host-cwd), registrar como gap e refletir no veredito (GO condicional / NO-GO).
  - [ ] Tooling verde (`ruff`/`mypy`/`import-linter`/`pytest`).
- [ ] **Task 3 — PC-2: auditar ausência de auto-deploy (AC: #3)** — bloqueante.
  - [ ] Ler `.github/workflows/ci.yml` por inteiro: confirmar que não há step de deploy/redeploy/ssh/swarm no merge (preliminar: só `setup-buildx` para build, sem deploy).
  - [ ] Ler `compose.prod.yaml`: confirmar ausência de watchtower/webhook/autoredeploy (preliminar: só políticas `restart:`).
  - [ ] Citar a evidência (linhas) no ADR.
- [ ] **Task 4 — Decisão GO/NO-GO (AC: #4)**.
  - [ ] Aplicar o critério qualitativo ancorado em H-A: ≥1 onda completa sem intervenção fora do gate (3/3) + quota sustentável (driver `subscription` não emite custo; 3 ondas sem `quota_hit`).
  - [ ] **Ponto humano (gate):** apresentar a recomendação ao operador e obter o veredito explícito antes de gravar o ADR.
- [ ] **Task 5 — Registrar o veredito (AC: #5)**.
  - [ ] Criar `docs/decisions/0006-gate-calibracao-go-nogo.md` (estilo dos ADRs 0001–0005): contexto, métricas-evidência, PC-1/PC-2, decisão GO/NO-GO, salvaguardas da Fase 2, e — se GO — o alvo da primeira meta-onda (candidato: dívida nº 7 worker multi-arch, ou o backlog "oracle oculto" achado na 7.5).

## Dev Notes

- **Story de decisão/gate** (análoga ao gate de fundação 1.1) — **não consome quota**. O valor é a **decisão auditada**, não código novo (exceto o teste de PC-1 se faltar).
- **Critério de GO (do `epic-7-scope-proposal.md` Story 7.6):** qualitativo **informado por métricas**, ancorado em **H-A** — *"≥1 onda completa sem intervenção fora do gate e pressão de quota sustentável"*. A Fase 1 entregou **3** ondas assim → o eixo de capacidade está fortemente satisfeito.
- **As 2 pré-condições são bloqueantes** (achado da análise de composição): PC-1 (contenção de path) e PC-2 (sem auto-deploy). Existem porque na Fase 2 o HDD modifica o **próprio repo na máquina de produção** ([[project-hdd-prod-on-dev-machine]]) — o risco *soft* do ADR 0002 vira concreto.
- **PC-1 nuance:** o `execute` roda `claude` no **host** com cwd no workspace (ADR 0002), com Write/Edit **permitidos** (precisa escrever código) mas Bash/WebFetch bloqueados. A contenção de path é *soft* (cwd), não um jail. O teste deve provar a contenção real; se ela não existir, o veredito honesto é **GO condicional** (Fase 2 só em workspace efêmero, nunca na árvore de prod — já é invariante 6.6) **ou NO-GO** até endurecer.
- **PC-2 preliminar (verde):** `ci.yml` sem step de deploy; `compose.prod.yaml` sem watchtower/webhook. Deploy é manual (runbook `docs/runbooks/deploy.md`). Confirmar lendo os arquivos inteiros.
- **Salvaguardas da Fase 2 (continuam valendo):** sem auto-deploy; merge só com gate humano (6.8); workspace efêmero por onda (6.6); pré-flight de capacidade (correct-course OOM, ADR 0005); HDD **nunca** toca `compose.prod.yaml`/`secrets/`/`deploy.env`. Ver `docs/definition-of-done.md`.
- **Não reabrir as ondas da Fase 1** para "forçar correção" — isso já foi decidido (7.5 course-correction): correção é medida, não forçada.

### Project Structure Notes

- ADRs em `docs/decisions/` (append-only, `NNNN-descricao.md`). Próximo número: **0006**.
- Contenção/capacidades: `src/hdd/application/broker.py`, `src/hdd/domain/capability.py`, `tests/unit/test_security_invariants.py`, `tests/unit/test_capability.py`.
- CI: `.github/workflows/ci.yml`. Prod: `compose.prod.yaml` (na raiz).
- Métricas Fase 1: `docs/dogfood-calibragem.md` (seções Onda 1 e Ondas 2-3).

### References

- [Source: _bmad-output/planning-artifacts/epic-7-scope-proposal.md#Story 7.6] (AC + PC-1/PC-2 + critério de GO)
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 7]
- [Source: docs/dogfood-calibragem.md] (métricas das 3 ondas + achado do oracle visível)
- [Source: _bmad-output/implementation-artifacts/7-5-calibracao-nivel-2-correcao.md] (achado estrutural, AC #1 redefinida)
- [Source: docs/decisions/0001-gate-fundacao-poc.md] (modelo do ADR de gate)
- [Source: docs/decisions/0002-execucao-execute-host-cwd.md] (risco soft de contenção que PC-1 fecha)
- [Source: docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md] e [Source: docs/definition-of-done.md] (salvaguardas da Fase 2)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
