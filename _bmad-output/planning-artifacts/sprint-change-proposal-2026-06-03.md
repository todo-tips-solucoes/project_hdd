# Sprint Change Proposal — Correct Course: incidente OOM na calibração (Epic 7)

- **Data:** 2026-06-03
- **Navegador da mudança:** John (PM) / correct-course
- **Gatilho:** incidente OOM de 2026-06-02 durante a calibração do Epic 7 (Fase 1)
- **Entrada autoritativa:** `_bmad-output/planning-artifacts/EPIC-7-OOM-CORRECT-COURSE-PROMPT.md`
- **Escopo classificado:** **Moderado** (novo ADR + reorg de backlog de salvaguarda + um pré-flight de código + DoD)

---

## 1. Resumo do problema (Issue Summary)

Em **2026-06-02**, durante a Fase 1 (calibração) do Epic 7, a VPS compartilhada (Hetzner,
8 GB RAM, **0 swap**) sofreu uma série de mortes por **OOM killer** do kernel — pico em
`Tue Jun 2 12:04:16 2026 Killed process (claude)`, com OOMs também em 31/05 e 01/06 ×2.

**Causa raiz — falha de composição (não um bug do HDD):** a máquina hospedava
simultaneamente produção (`projeto_hdd-*`), `painel-relatorios` ×N, n8n, pgAdmin,
Portainer, IDE Antigravity e várias sessões `claude`. Às 11:42 subiu-se o stack de **dev**
(`hdd_dev`) para dirigir a calibração; o `calibration_wave.py run` roda **no host** e
dispara `claude -p` (faminto de memória, ~1.5–1.7 G RSS por processo), somado ao `claude`
do worker de dev. Sem swap, o estouro virou *kill*.

**Onde a calibração parou:**
- Story 7.4 (`cep`) — baseline ✅ onda `019e861e…` chegou a `merged` (caminho feliz validado).
- Calibração seguinte (`cnpj`): 2 ondas em `planned` + 3 itens `work_queue=failed`, mortas no
  OOM e **preservadas como evidência**.
- Produção: **intacta** (containers healthy, DB limpo, sem lease preso — `quota_lease`
  auto-expira por design).

**Diagnóstico de evidência (não anedota):** a métrica de D-032 não é "consumo de tokens"
(o driver `subscription` do `claude -p` não emite tokens/custo); o `quota_lease` conta
**slots de concorrência internos**, não uso da conta. O OOM foi pressão de **memória do
host**, ortogonal à quota — por isso a salvaguarda é de **capacidade do host**, não de quota.

---

## 2. Análise de impacto (Impact Analysis)

| Eixo | Impacto |
|---|---|
| **Épico** | Epic 7 Fase 1 não pode prosseguir com segurança sem uma salvaguarda de capacidade **verificável** (não convenção). |
| **Stories** | 7.3/7.4 (docs de calibração) precisam de AC de pré-condição; **7.5** (onda nível 2) e **7.6** (gate GO/NO-GO) dependem da salvaguarda ativa para re-rodar a calibração `cnpj`. |
| **Artefatos** | Falta ADR de capacidade/cutover; falta **Definition of Done** do projeto; `calibration_wave.py` roda sem pré-flight; o padrão de decisão dos agentes não está ancorado em lugar durável. |
| **Técnico** | Cutover para **VPS dedicada de 16 GB (Boston)** já aplicado e **live** (commits `259a26d`→`75d3fac`): `mem_limit` por stack, swap 4 G + `swappiness=10`, pgBackRest isolado por path `/hdd-boston`, ingress Traefik por file-provider sem `docker.sock`. Falta apenas formalizar + tornar a pré-condição auto-verificável. |

**Estado de capacidade verificado nesta máquina (2026-06-03):** `MemTotal ≈ 16 GB`,
`SwapTotal = 4 GB` (ativo), `swappiness = 10`, `/swapfile` em `/etc/fstab`. Cutover confirmado live.

---

## 3. Abordagem recomendada (Recommended Approach)

**Direct Adjustment** — sem rollback, sem replan. A mitigação já foi para frente (VM
dedicada de 16 GB). Resta **formalizar** o que foi decidido e **converter a salvaguarda
em gate verificável**, para não depender de memória humana:

1. **Registrar ADR** de capacidade/cutover (decisão durável + trade-offs nos 3 eixos).
2. **Pré-flight de código** em `calibration_wave.py` que **recusa** rodar sem capacidade
   segura, com escape-hatch explícito de custo declarado.
3. **Ratificar** o padrão de decisão dos agentes num **Definition of Done** do projeto +
   memória de feedback, para valer em todas as stories futuras.

**Esforço:** baixo (≈ meio dia). **Risco:** baixo (aditivo; nenhuma mudança em produção).
**Timeline:** desbloqueia re-rodar `cnpj` + Story 7.5 imediatamente após o merge.

---

## 4. Propostas de mudança detalhadas (Detailed Change Proposals)

### 4.1 — ADR de capacidade & cutover (NOVO)

**Arquivo:** `docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md`

ADR registrando: contexto do OOM; decisão de migrar dev+calibração+prod para VPS dedicada
de 16 GB (Boston) com `mem_limit` por stack (cgroup v2 + swap accounting no kernel 6.8);
swap 4 G como rede de segurança; isolamento de backup por `repo1-path=/hdd-boston` (preserva
histórico do cluster antigo no mesmo bucket R2); ingress Traefik por file-provider (sem
acesso ao `docker.sock` — superfície menor). Trade-offs sob **performance · segurança ·
escalabilidade**. Status: **aceito (GO)** — implementado em `259a26d`→`75d3fac`.

### 4.2 — Salvaguarda de capacidade como gate verificável

**Arquivo:** `backend/scripts/calibration_wave.py` — pré-flight em `cmd_run`, **antes** do `enqueue`.

```
OLD (cmd_run, início):
    settings = get_settings()
    if not settings.repo_url:
        raise SystemExit("HDD_REPO_URL vazio — configure o repo-alvo de calibração")
    sm = make_sessionmaker(make_engine(settings.pg_dsn))

NEW:
    settings = get_settings()
    if not settings.repo_url:
        raise SystemExit("HDD_REPO_URL vazio — configure o repo-alvo de calibração")
    sm = make_sessionmaker(make_engine(settings.pg_dsn))
    await _preflight_capacity(sm)   # recusa rodar sem swap + max_concurrent==1 + folga de RAM
```

**Função nova `_preflight_capacity`** (no mesmo arquivo) — pura e testável via
`evaluate_capacity(swap_total_kb, mem_available_kb, max_concurrent) -> list[str]` (violações):

- **Swap ativo** (`SwapTotal > 0` em `/proc/meminfo`) — senão recusa.
- **`max_concurrent == 1`** nesta máquina (lido de `app.quota_counter`) — senão recusa.
- **Folga de RAM** (`MemAvailable ≥ 2 GB`) — senão recusa (driver-no-host + worker-dev + prod
  competindo é exatamente o cenário do incidente).
- **Escape-hatch** `HDD_CALIB_SKIP_PREFLIGHT=1` → roda **com aviso ruidoso** e custo declarado
  (atalho só aparece com o custo explícito — alinhado ao padrão de decisão da §4.3).

**Arquivo:** `backend/src/hdd/adapters/db/quota.py` — adicionar getter `current_max()`
(espelho de `set_max`) para o pré-flight ler o teto sem SQL solto.

**Arquivo:** `backend/tests/unit/test_dogfood_harness.py` — testes de `evaluate_capacity`
(sem swap → viola; max_concurrent=2 → viola; RAM baixa → viola; tudo ok → lista vazia).

**Arquivo:** `docs/dogfood-calibragem.md` — seção **"Pré-condições de capacidade (gate
verificável)"**: swap ativo + `max_concurrent=1` + janela `hdd_dev up` só durante a
calibração e `docker compose -p hdd_dev down` depois + nunca driver-no-host junto com
worker-dev junto com prod. Marcado como **AC** das ondas de calibração (7.4/7.5/pool).

### 4.3 — Padrão de decisão dos agentes (ratificação durável)

**Arquivo:** `docs/definition-of-done.md` (NOVO) — DoD do projeto, incluindo a diretriz do
operador (2026-06-02):

> Em toda decisão, os agentes do HDD (dev/QA/review + worker `claude -p`) **recomendam por
> default a alternativa com melhor prática de desenvolvimento + segurança + escalabilidade**,
> com justificativa explícita nesses 3 eixos. O atalho só é apresentado **com o custo
> declarado**. Toda salvaguarda nasce ancorada em **gate verificável**, não em convenção.

E o DoD operacional já vigente: tooling verde (`ruff`/`mypy --strict`/`import-linter`/
`pytest`) antes de qualquer merge; revisão humana obrigatória; sem auto-deploy; workspace
efêmero por onda.

**Memória (feedback):** registrar a diretriz como memória persistente para valer em sessões
futuras (ligada a `[[feedback-hdd-mandatory-review]]`).

**Pointer:** uma linha em `CLAUDE.md → Convenções ao trabalhar aqui` apontando para o DoD.

---

## 5. Handoff de implementação (Implementation Handoff)

- **Escopo:** Moderado → implementação direta pelo dev (Amelia) com revisão do operador.
- **Deliverables:**
  1. `docs/decisions/0005-capacidade-e-cutover-vps-dedicada.md`
  2. Pré-flight em `calibration_wave.py` + `current_max()` em `quota.py` + testes
  3. Seção de AC em `docs/dogfood-calibragem.md`
  4. `docs/definition-of-done.md` + memória de feedback + pointer no `CLAUDE.md`
- **Critério de sucesso:** `ruff`/`mypy`/`import-linter`/`pytest` verdes; pré-flight recusa
  cenário inseguro em teste; ADR e DoD revisados.
- **Próximo passo pós-merge:** re-rodar calibração `cnpj` + **Story 7.5** (onda nível 2) com a
  salvaguarda ativa → `approve <wave_id>` no gate → **Story 7.6** (gate GO/NO-GO Fase 2).
