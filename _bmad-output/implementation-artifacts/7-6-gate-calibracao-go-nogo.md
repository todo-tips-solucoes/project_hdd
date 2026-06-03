# Story 7.6: Gate de calibração — decisão GO/NO-GO para a Fase 2 (meta-dogfood)

Status: review

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

- [x] **Task 1 — Consolidar métricas da Fase 1 (AC: #1)**. ✅ 3/3 ondas (cep/haiku, cnpj/sonnet, data_br/haiku) `reached_gate`, **0 correções, 0 escaladas, 0 leases vazados**; pipeline `clone→claude→verify→PR→gate→merge` validado ponta a ponta (PRs #1/#3/#4 mergeados). Nuance H-A: 0 correções decorre do oracle visível ao `execute` (achado da 7.5), não de incapacidade.
- [x] **Task 2 — PC-1: contenção de path (AC: #2)** — bloqueante. ✅ análise feita; **resultado: PC-1 NÃO satisfeita (gap real).**
  - Enforcement existente cobre só **shell**: `domain/capability.py` classifica `rm`/DROP/DELETE/push fora do workspace, e `WORKSPACE_DISALLOWED` bloqueia `Bash`/`WebFetch`. O **Write/Edit é permitido** no `execute`.
  - **O broker NÃO está wirado aos efeitos de Write** (grep: só citado em comentários; nenhum call-site roteia tool-use do claude por `broker.authorize`). O `claude -p` roda autônomo.
  - O `execute` usa `permission_mode="acceptEdits"` + `cwd=workspace`, **sem `--add-dir`** (factory.py:44-51). A contenção de um Write com **path absoluto fora do workspace** depende inteiramente de o `acceptEdits` respeitar o cwd — **não verificado, sem teste**. Para a Fase 2 (HDD no prod), `/var/lib/projeto_hdd/...` ou `secrets/` ficam teoricamente alcançáveis.
  - Um teste unitário **não fecha** PC-1 (o risco é comportamento de runtime do claude + falta de enforcement). Fechar exige: `--add-dir` workspace-only **e verificar**, ou sandboxar o `execute` (análogo ao verify, ADR 0004), + teste de invariante (integração) que asserte que um Write em sentinela fora do workspace não ocorre. → **Backlog bloqueante da Fase 2.**
- [x] **Task 3 — PC-2: auditar ausência de auto-deploy (AC: #3)** — bloqueante. ✅ **VERDE, verificado.** `ci.yml` (push/PR em main): jobs `quality`/`integration`/`openapi-drift`/`frontend`/`deps`/`docker-build` — o `docker-build` usa **`push: false`** (builda, não publica nem deploya); **zero step de deploy/ssh/swarm/redeploy**. `compose.prod.yaml`: sem watchtower/webhook/autoredeploy (o `webhook` lá é o HMAC inbound do n8n; só políticas `restart:`). Deploy é **manual** (`docs/runbooks/deploy.md`). A salvaguarda "deploy manual" passa de premissa a fato verificado.
- [x] **Task 4 — Decisão GO/NO-GO (AC: #4)**. ✅ recomendação NO-GO condicional apresentada; **veredito do operador: NO-GO até fechar PC-1** (gate humano, 2026-06-03).
- [x] **Task 5 — Registrar o veredito (AC: #5)**. ✅ `docs/decisions/0006-gate-calibracao-go-nogo.md` criado: evidência de capacidade, PC-1/PC-2, decisão NO-GO condicional, backlog bloqueante (confinar/sandboxar o execute + teste) e caminho para reabrir o gate → GO.

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

**Análise do gate (2026-06-03) — recomendação ao operador (Task 4):**
- **Capacidade (H-A): GO-worthy** — 3/3 features reais one-shot, 0 escaladas, 0 leases vazados, pipeline E2E validado; quota sustentável (driver `subscription` sem custo emitido, 0 `quota_hit`).
- **PC-2: ✅ VERDE** — sem auto-deploy (evidência citada).
- **PC-1: ❌ NÃO MET (bloqueante)** — contenção de Write absoluto fora do workspace é *soft* (`acceptEdits`+cwd, sem `--add-dir`, broker não wirado, sem teste). Risco concreto na Fase 2 (HDD no prod).
- **Recomendação: NO-GO condicional** — não liberar a Fase 2 até fechar PC-1 (backlog: confinar/sandboxar o `execute` + teste de invariante). O eixo de capacidade está provado; o gate cumpriu seu papel ao barrar a auto-modificação até a contenção ser endurecida. Veredito final é decisão do operador (Task 4).

### Completion Notes List

- Gate executado sem consumir quota (decisão/análise). Capacidade H-A provada (3/3 one-shot); PC-2 verde; **PC-1 não met** → **NO-GO condicional** (veredito do operador). Nenhum código do backend alterado nesta story — só ADR + doc da story.

### File List

- `docs/decisions/0006-gate-calibracao-go-nogo.md` (novo — veredito do gate)

## Change Log

- 2026-06-03 — Gate de calibração executado (Tasks 1-5). Métricas Fase 1 consolidadas; PC-2 verificado verde; PC-1 identificada como gap bloqueante (contenção de Write não enforçada/testada). Veredito do operador: **NO-GO condicional**. ADR 0006 registrado. Status → review.
- 2026-06-03 — **Gate RE-RODADO** após a Story 7.7 fechar PC-1 (boundary do container worker + invariante). Pré-condições PC-1 ✅ + PC-2 ✅ + capacidade provada → **veredito do operador: GO**. ADR 0006 atualizado para GO. **Fase 2 (meta-dogfood) liberada.**
