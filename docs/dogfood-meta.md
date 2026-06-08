# Meta-dogfood (Fase 2) — execução in-container

A Fase 2 do Epic 7 (GO no gate 7.6, [[0006]]) deixa o HDD **construir features no próprio
`projeto_hdd`**, via PR + gate humano. Aqui se registra como rodar uma meta-onda com
segurança e os pré-requisitos de infra.

## Por que in-container (e não o driver do host)

O `scripts/calibration_wave.py` roda `claude` **no host** — onde `/var/lib/projeto_hdd`
(árvore de prod) é alcançável. Isso é aceitável só na **Fase 1** (repo-alvo separado).

Na **Fase 2** a onda **deve** rodar pelo **worker container**: o nó `execute` roda dentro do
worker, cujo mount namespace **não** inclui a árvore de prod nem os secrets (contenção por
construção — PC-1, Story 7.7, `test_security_invariants.py`). Produtor: `hdd start "<tarefa>"`
(`cli/main.py`) ou o painel "iniciar feature" (Story 6.10) → fila → worker processa.

## Pré-requisito: meta-sandbox (Story 7.8)

O nó `verify` roda a suíte de testes do alvo num sandbox `--network none`. Para o
`projeto_hdd`, a suíte precisa de **Python 3.13 + uv + as deps do backend (com pytest)** — o
`hdd-sandbox:latest` (calibração) **não** tem isso (é minimal, p/ funções puras).

**Imagem dedicada `hdd-meta-sandbox:latest`** (stage `meta-sandbox` em `backend/Dockerfile`):

```bash
docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend
```

- Python 3.13 + venv (`/deps/.venv`) com deps de prod **+ dev** (pytest). Sem credenciais.
- O projeto **não** é instalado na imagem (`--no-install-project`): o código vem do **clone
  montado** em `/workspace` (pyproject `pythonpath=["src"]`).
- ⚠️ **Limitação:** a imagem carrega as deps **da build**. Uma onda que **adicione uma
  dependência nova** fará o `verify` falhar até a imagem ser **rebuildada**. Gap honesto —
  rebuild o meta-sandbox quando o `uv.lock` mudar.

## Configuração da meta-onda (worker in-container isolado)

Worker de dev isolado (estilo `-p hdd_dev`), **nunca** o de produção, **sem** tocar
`compose.prod.yaml`/`secrets`:

| Setting (env) | Valor |
|---|---|
| `HDD_REPO_URL` | `https://<token>@github.com/todo-tips-solucoes/project_hdd.git` |
| `HDD_REPO_SLUG` | `todo-tips-solucoes/project_hdd` |
| `HDD_SANDBOX_IMAGE` | `hdd-meta-sandbox:latest` |
| `HDD_SANDBOX_NETWORK` | `none` |
| `HDD_VERIFY_COMMAND` | `sh -c 'cd backend && python -m pytest -q'` |
| `HDD_CLAUDE_TIMEOUT_S` | `600` |

O `verify` monta o clone em `/workspace`, roda o comando (deps vêm do venv da imagem, código
do `/workspace`), `exit 0` → verde. Selecionado por `HDD_SANDBOX_IMAGE` — a calibração
(Fase 1) segue usando `hdd-sandbox:latest`.

## Salvaguardas (continuam)

PR + gate humano no merge (6.8); workspace efêmero (6.6); pré-flight de capacidade ([[0005]]);
sem auto-deploy (PC-2); o HDD nunca toca `compose.prod.yaml`/`secrets/`/`deploy.env`. Pré-flight
e gate confirmados antes de cada onda. Ver `docs/definition-of-done.md`.

## Resultados das meta-ondas

### Meta-onda 1 — oracle oculto no nó `verify` (Story 7.9, 2026-06-03)

**Primeira meta-onda real** do meta-dogfood: o HDD construiu uma feature no próprio
`projeto_hdd`, via PR + gate humano, pelo caminho **in-container** (worker `worker-meta` do
`compose.meta.yaml`, projeto isolado `hdd_dev`).

| Campo | Valor |
|---|---|
| Tarefa | "implementar o oracle oculto no nó verify — `oracle_dir` opcional no `SandboxConfig`, mount `-v <oracle>:/oracle:ro` só no verify, retrocompatível, com testes" |
| Modelo | `sonnet` (driver `subscription` — 0 custo emitido) |
| Caminho | in-container (`hdd start` → fila dev → `worker-meta`); **não** o driver de host (PC-1) |
| Sandbox do verify | `hdd-meta-sandbox:latest` (`--network none`) — suíte do projeto_hdd verde |
| Desfecho | `reached_gate` (one-shot) · **0 correções** · 0 escaladas · 0 leases vazados |
| Onda | `019e8ba3-94d5-7783-9ac1-35f306d97e3b` |
| PR | https://github.com/todo-tips-solucoes/project_hdd/pull/27 (+61/−0, 5 ficheiros) |
| Pré-flight | swap 4095MB · MemAvailable 13708MB · `max_concurrent=1` — gate `evaluate_capacity` verde |

**Revisão do gate humano (DoD verificado fora do verify):** o nó `verify` só roda `pytest`;
a revisão rodou a suíte completa no branch do PR — **ruff ✓ · mypy --strict ✓ (74 ficheiros) ·
import-linter ✓ (4 contratos, boundaries preservados) · pytest ✓ (113)**. Mudança mínima e
**puramente aditiva**: `oracle_dir: str | None = None` no `SandboxConfig`; `_docker_cmd` injeta
`-v <oracle>:/oracle:ro` antes da imagem só quando setado; `verifier` propaga `settings.oracle_dir`
(env `HDD_ORACLE_DIR`); retrocompatibilidade **asseverada por teste** (cmd idêntico ao atual
quando `oracle_dir=None`). O oracle é verify-only por construção (o `execute` não usa o
`SandboxRunner`).

**Decisão do gate:** ✅ **GO — merged** por decisão do operador (2026-06-03 04:09 UTC). PR #27
em `--squash` → commit `fc8d2b2ac2d5384bcae7136d80e88697c6500362` na `main`, branch da onda
removida. (O PR foi aberto como _draft_ pelo nó de PR do HDD; marcado ready no gate antes do
merge — comportamento esperado da salvaguarda "sem auto-merge".)

> ℹ️ Follow-up de deploy (fora desta story): o `worker` de **produção** só passa a usar o
> oracle oculto após rebuild da imagem + restart (runbook de deploy). Prod não foi tocado aqui.

**Gap da 7.5 (oracle visível) endereçado:** a capacidade de oracle oculto passa a existir no
`verify` — ondas futuras podem montar a suíte autoritativa só no `verify` (`HDD_ORACLE_DIR`),
deixando o `execute` implementar às cegas → o caminho `verify→CORRECTING→execute` pode disparar
de verdade (esta onda foi one-shot por construir a feature cujos próprios testes são visíveis).

### Meta-onda 2 — loop de correção com oracle oculto (Story 7.10, 2026-06-03)

Primeira onda a **exercitar** o oracle oculto às cegas. Feature-alvo: `parse_repo_slug` em
`backend/src/hdd/domain/vcs.py`, com uma suíte-oracle **oculta** (`/var/lib/hdd-oracles/repo-slug/`,
22 casos) montada só no `verify` via `HDD_ORACLE_DIR` + `compose.meta.oracle.yaml`.

| Campo | Valor |
|---|---|
| Caminho | in-container (`worker-meta`, projeto `hdd_dev`) — PC-1 respeitado |
| Onda | `019e8bf5-886f-7503-8cab-d150a8acf71e` |
| Pré-flight | swap 4095MB · MemAvailable 13561MB · `max_concurrent=1` — `evaluate_capacity` verde |
| Loop de correção | **DISPAROU** ✅ (`execute` rodou 2×; `verify→CORRECTING→execute`) — 1ª vez |
| Desfecho | **FAILED** — a 2ª passada (correção) estourou o timeout de 600s do `claude`; sem PR |
| Remote | falha limpa (sem branch `hdd/wave-*`, sem PR) |

**Objetivo primário atingido** (observar o loop disparar num verify vermelho real — fecha o gap
da 7.5 no mecanismo), mas a onda **não convergiu**. A investigação subsequente achou a causa-raiz.

**Validação da infra (reprodução isolada, mesma imagem/flags):** `vcs.py` correto → 22 passed
(exit 0); ingênuo → 10 failed (exit 1, assertions reais); ausente → exit 2. O oracle oculto e o
caminho host↔sandbox **funcionam**.

#### Achados (backlog de dogfood)

- **F2 — feedback do verify descartado (DOMINANTE, vira Story 7.11).** O nó `verify`
  (`adapters/sandbox/verifier.py:50-52`) devolve só `bool`: o `SandboxResult.stdout/stderr` (diffs
  de assertion do pytest) é jogado fora. `WaveGraphState` (`adapters/orchestrator/wave.py:30-41`)
  não tem campo de feedback, e o `_execute` (`wave.py:69-71`) re-invoca o LLM com o **mesmo prompt**
  na correção. → O loop **corrige às cegas e não converge** (re-roda até N=3 ou timeout). Por isso
  a 7.10 não convergiu mesmo com o loop tendo disparado.
- **F1 — timeout apertado.** `HDD_CLAUDE_TIMEOUT_S=600` não dá folga a uma rodada de correção.
  Secundário a F2 (sem feedback, mais tempo não resolve).
- **F3 — observabilidade.** Numa falha por timeout, `app.waves.state` fica preso em `planned`
  (a projeção do estado só roda no retorno bem-sucedido do `run_wave`); o operador só vê a falha
  pelos logs do worker. Candidato a hardening futuro.

> **Encaminhamento:** F2 vira a **Meta-onda 3 (Story 7.11)** — o HDD conserta o próprio loop de
> correção (verify propaga o output; estado carrega o feedback; execute o injeta na correção).

### Meta-onda 3 — o HDD conserta o próprio loop de correção (Story 7.11, 2026-06-03)

Endereça o **F2** da Meta-onda 2: o HDD construiu, no próprio `projeto_hdd`, a propagação do
feedback do verify para a correção. **Sem oracle** (verify = suíte completa); `HDD_CLAUDE_TIMEOUT_S=1200`.

| Campo | Valor |
|---|---|
| Caminho | in-container (`worker-meta`, `hdd_dev`) — PC-1 respeitado |
| Onda | `019e8cfe-0ca1-7f61-8013-f6de6ced3e62` |
| Pré-flight | swap 4095MB · MemAvailable 13169MB · `max_concurrent=1` — verde |
| Desfecho | **`awaiting_gate` one-shot** · 0 correções · verify (suíte completa) exit 0 |
| PR | #28 (+70/−25, 5 ficheiros) → **merged `--squash`** → `9a7efa4` na `main` |

**Mudança (revisada no gate):** `Verifier` passa a `Callable[[str], tuple[bool, str]]`; `verify`
devolve `(False, stderr+stdout)` na reprovação; `WaveGraphState.verify_feedback`; `_execute`
injeta o feedback no prompt **só quando `n_corrections>0`**. Teste novo assevera o feedback na 2ª
passada e ausente na 1ª.

**Gate humano (DoD no branch):** mypy --strict ✓ (74) · import-linter ✓ (4/4) · pytest ✓ (121).
3 violações ruff E501 (linhas >100) — **corrigidas no gate** (reformatação cosmética, commit
`c1c4be3`) → DoD 100% verde antes do merge. Operador aprovou; merge `--admin` (proteção de branch
exige review/checks; o gate humano é a revisão — mesmo padrão da 7.9).

**F2 ENDEREÇADO** ✅ — ondas futuras com oracle oculto (estilo 7.10) passam a corrigir com sinal
real (o output do pytest no prompt) em vez de às cegas.

#### Novo achado

- **F4 — verify do meta é pytest-only.** `HDD_VERIFY_COMMAND` roda só `pytest`; lint/tipo (ruff,
  mypy, import-linter) escapam ao loop autônomo e só são pegos no gate humano (a 7.9 veio limpa por
  sorte; a 7.11 teve 3 E501). **Melhoria futura (candidata a meta-onda):** verify roda o DoD
  completo (`ruff check . && mypy && lint-imports && pytest`) — o loop passaria a auto-corrigir
  lint/tipo também (agora que o feedback do verify é propagado, F2 fechado, isso de fato convergiria).

### Meta-onda 4 — verify do meta roda o DoD completo (Story 7.12, 2026-06-03)

Endereça o **F4**: `HDD_VERIFY_COMMAND` passou a rodar o DoD completo
(`cd backend && ruff check . && MYPYPATH=src mypy && PYTHONPATH=src lint-imports && python -m pytest -q`),
validado verde (main limpa) e vermelho (erro de lint) no sandbox antes de configurar. Tools já no
`hdd-meta-sandbox` (`/deps/.venv/bin`) → sem rebuild do sandbox. Feature-veículo: `parse_repo_slug`
(a que a Meta-onda 2 não entregou), spec visível, sem oracle. `HDD_CLAUDE_TIMEOUT_S=1200`.

**Rodou duas vezes** (a 1ª expôs o F5):

| Run | Worker | Desfecho | Lição |
|---|---|---|---|
| 1 (`019e8d4a-2333`) | `hdd-worker:latest` **stale** (pré-F2, build 06-02) | **escalated** — loop disparou 4× (`->execute=4`), 4 verify `exit_code=1` (DoD real), esgotou `max_corrections=3` → escalou **limpo** (sem branch/PR) | **F5** |
| 2 (`019e8d71-c36f`) | `hdd-worker` **rebuildado** da main (com F2) | **awaiting_gate one-shot** — verify (DoD completo) exit 0; PR #29 | **F4 provado** |

- **F5 (novo) — merge ≠ deploy também no worker do meta.** Após uma onda auto-modificante mergear,
  o `worker-meta` continua na imagem antiga até `docker build -t hdd-worker:latest --target worker
  backend` + recriar o container. A Run 1 rodou o loop **cego** (pré-F2) por isso → escalou. Depois
  do rebuild, o worker passou a ter `Verifier=Callable[[str],tuple[bool,str]]` + `verify_feedback`.
  *Salvaguarda verificável:* rebuildar+recriar o `worker-meta` após cada meta-onda que toca o
  worker/orquestrador, antes da próxima onda depender do novo comportamento.
- **Achado positivo (Run 1):** sob o full-DoD verify, o loop **escala limpo** ao esgotar N (vs o
  **timeout** da Meta-onda 2) — o DoD falha rápido (exit 1), então o loop cicla e escala em vez de
  pendurar. Melhora de comportamento mensurável.

**Run 2 — gate humano (DoD no branch):** ruff ✓ · mypy --strict ✓ (75) · import-linter ✓ (4/4) ·
pytest ✓ (135). **Sem fix manual** (≠ PR #28, que teve 3 E501 corrigidos no gate) — porque o
**verify=DoD-completo barrou tudo antes do gate**. É a prova end-to-end do F4. PR #29 → merged
`--squash` → `24ea764` na `main`.

**Mudança entregue (PR #29):** `parse_repo_slug` em `domain/vcs.py` (puro; rejeita vazio/espaços/
barra-extra/partes-vazias/`.`/`..`/chars inválidos) + `field_validator` no `repo_slug` em
`settings.py` (fail-fast em config inválida) + testes parametrizados. **Fecha também a feature que
a Meta-onda 2 não conseguiu entregar.**

**F4 ENDEREÇADO** ✅ — o verify autônomo do meta-dogfood agora enforça o DoD completo.

### Meta-onda 5 — oracle oculto, tentativa de convergência às cegas (Story 7.13, 2026-06-03)

Primeira onda com oracle oculto **rodando o worker com F2** (loop com feedback). Feature-veículo:
`format_duration_human` (`domain/duration.py`), spec visível subespecificada no formato; oracle
oculto (`/var/lib/hdd-oracles/duration`, 13+3 casos) fixando o formato. verify = oracle-only.

| Campo | Valor |
|---|---|
| Onda | `019e8def-9761` · worker **com F2** |
| Desfecho | **awaiting_gate one-shot** (`->execute=1`, `n_corr=0`, verify exit 0) |
| PR | #30 → merged `--squash` → `0d50d08` (DoD verde, sem fix manual) |

- **Objetivo (convergência às cegas) NÃO exercitado:** o agente acertou o formato na 1ª tentativa —
  a convenção escolhida (omitir zeros, `0s`, espaço) era a *natural*, então não houve divergência
  para corrigir. 3º one-shot seguido de feature-veículo.
- **Estado da convergência:** a *máquina* está verificada (teste unitário
  `test_feedback_da_verificacao_injetado_na_correcao` da onda 3 + escalação limpa da onda-4-run1
  sob loop cego), mas **observar fire→feedback→fix→verde ao vivo** segue elusivo: quando o loop
  disparou (ondas 2, 4-run1) o worker era pré-F2; com F2, o agente one-shota.
- **Encaminhamento → Meta-onda 6 (Story 7.14):** oracle de convenção **não-óbvia** (`format_bytes`:
  base 1024, sufixos `KB`, 2 casas decimais) para *garantir* divergência na 1ª tentativa → forçar
  a convergência pelo feedback.

### Meta-onda 6 — convergência às cegas, DEMONSTRADA (Story 7.14, 2026-06-03)

**O resultado que todo o arco perseguia.** Oracle de convenção não-óbvia (`format_bytes`: base 1024,
sufixos `KB`, 2 casas decimais) projetado para *garantir* divergência na 1ª passada. Worker com F2.

| Campo | Valor |
|---|---|
| Onda | `019e8e2f-3a73` · worker com F2 · verify oracle-only |
| **Trajetória** | `execute→verify(exit 2)→correct→execute→verify(exit 1)→correct→execute→verify(exit 0)→awaiting_gate` |
| Loop | **disparou 2×** (`->execute=3`) — **CONVERGIU** |
| PR | #31 → merged `--squash` → `85feab1` |

**A demonstração ao vivo do loop de auto-correção:** o `execute` nunca viu o oracle; convergiu só
com o feedback do verify (F2) — 1º um **erro estrutural/import** (exit 2), depois os **diffs de
formato** (exit 1: `"1.0 MB"` vs `"1.00 MB"`, base 1024), e então **verde** (exit 0). Contraste
direto com a Meta-onda 2 (mesmas falhas → timeout cego, pré-F2). Fecha o arco F2→F4→convergência.

- **F6 (novo) — verify oracle-only não incentiva os testes do agente.** O agente **não escreveu**
  `test_bytesize.py` (a tarefa pedia) — como o verify roda só `/oracle`, os testes do próprio agente
  não são exercitados. Corrigido no gate humano (`test_bytesize.py` derivado da spec). *Mitigação
  futura:* verify do meta poderia rodar oracle **+** a suíte do agente, ou o gate sempre exige os
  testes. (Sob full-DoD verify — onda 4 — o agente escreveu os testes; o sinal importa.)
- **Projeção `n_corrections`:** `app.waves.n_corrections=0` apesar de 2 correções reais (visível só
  no checkpointer, `->execute=3`) — mesma família do F3 (projeção incompleta). Candidato a hardening.

**Convergência às cegas: DEMONSTRADA** ✅ — encerra o objetivo central do meta-dogfood do Epic 7.

### Meta-onda 7 — verify = suíte do agente + oracle (mitiga F6) (Story 7.15, 2026-06-03)

Endereça o **F6**: o verify passou a rodar a **suíte unitária do agente** (`tests/unit`, incluindo
o `test_parsing.py` que ele escreve) **junto com** o oracle oculto. Feature-veículo: `parse_bool`
(`domain/parsing.py`).

| Campo | Valor |
|---|---|
| Onda | `019e8e6c-40ac` · worker com F2 · verify = `pytest tests/unit /oracle` |
| Desfecho | **awaiting_gate one-shot** (`->execute=1`, verify exit 0) |
| PR | #32 → merged `--squash` → `dd5c454` (DoD verde, **sem fix manual**) |

- **F6 mitigado:** o agente **escreveu** `test_parsing.py` (22 válidos + 9 inválidos), **consistente
  com o oracle**, e os testes foram exercitados no verify — contraste com a onda 6 (oracle-only → o
  agente não escreveu testes → adicionados no gate).
- **Nuance honesta:** o verify=suíte+oracle **força consistência** dos testes do agente com a spec
  (pegaria testes errados via reconciliação), mas **não compele** a escrevê-los — isso ainda depende
  da instrução da tarefa + checagem no gate. Aqui o agente os escreveu one-shot (o caso de
  reconciliação não foi exercitado). `parse_bool`: strip+lower; true/1/yes/on; false/0/no/off;
  desconhecido → ValueError.
- **Gate:** ruff ✓ · mypy --strict ✓ (78) · import-linter ✓ (4/4) · pytest ✓ (194). Operador
  aprovou; `--squash --admin`.

**F6 ENDEREÇADO** ✅ (com a nuance acima registrada).

### Meta-onda 8 — projeção de n_corrections + estado em falha (família-F3) (Story 7.16, 2026-06-03)

Endereça a **família-F3** observada no arco: `app.waves.n_corrections` projetava 0 mesmo com
correções (visível só no checkpointer) e o estado ficava preso em `planned` quando a onda falhava.
Fix na **projeção** (worker bridge + repository), não função pura. verify = DoD completo (sem oracle).

| Campo | Valor |
|---|---|
| Onda | `019e8ea4-d99e` · worker com F2 · verify = DoD completo |
| Desfecho | **awaiting_gate one-shot** (verify exit 0) |
| PR | #34 → merged `--squash` **sem `--admin`** → `a9d9486` |

**Mudança (revisada no gate):** `Repository.sync_wave_state` ganhou parâmetro **opcional**
`n_corrections` (retrocompatível com `gates.py`); `bridge_after_wave` passa
`result.get('n_corrections', 0)`; novo helper `_safe_project_failed` (best-effort, espelha
`_safe_record_gap`) projeta `WaveState.FAILED` nos dois `except` de `run_wave` sem mascarar a
exceção. O agente **atualizou os testes de integração** (`test_gate_roundtrip.py`,
`test_persistence.py`) + unitários proativamente.

**🔑 Lição do PR #33 aplicada:** o agente não roda integração in-loop (sandbox `--network none`); no
gate exigi o **CI completo verde** (`gh pr checks`) — **Integração (Postgres+pgvector) → pass** com
Postgres real — e mergeei **sem `--admin`**. Sem o problema do #28 (regressão de integração mascarada).

**Família-F3 ENDEREÇADA** ✅ — `app.waves` agora reflete correções e falhas (observável pelo painel/CLI).

### Meta-onda 9 — indicadores do harness no painel (Story 7.17, 2026-06-03)

Primeira meta-onda **full-stack** (backend + frontend) — exercita os **gates de drift** (OpenAPI +
TS), a frente que faltava. Modelo **híbrido**: o HDD faz o backend (verificável no sandbox Python);
o operador completa o frontend (Node, impossível no meta-sandbox) no gate. Feature: `GET /api/harness`
→ `HarnessSummary` (read-model do DB) + indicadores no painel. **Duas tentativas, dois achados.**

**Tentativa 1 — verify = DoD + drift do OpenAPI (sem oracle).** Onda `019e8ee2-bf5e` →
**awaiting_gate one-shot**, mas o PR (#35) era um **NO-OP off-task**: o agente escreveu uma *story*
de planejamento BMAD + um compose, **zero backend**. O verify passou trivialmente — sem mudança de
código o DoD segue verde e o `openapi.json` não tem drift.

> **Achado F7 — o verify (DoD + drift) NÃO detecta sub-implementação/no-op.** Prova "nada quebrou +
> contrato consistente", não "a feature pedida existe". Sem **oracle de aceitação** da feature, um
> no-op chega ao gate. Só o gate humano pegou. PR #35 **fechado**.

**Tentativa 2 — verify = DoD + ORACLE de aceitação oculto + drift.** Oracle em
`/var/lib/hdd-oracles/harness` (acceptance offline via FastAPI `TestClient` + `get_repository` fake —
sem DB/rede), validado **RED** (main, 3 failed) / **GREEN** (referência) antes de enfileirar; prompt
imperativo (proíbe docs, fixa arquivos+contrato). Onda `019e8efb-d652`: o agente implementou o backend
**correto** (oracle + DoD verdes), mas **ESCALOU** após **4 verifies vermelhos** — *todos só no
drift do `openapi.json`*.

> **Achado F9 — o agente regenera o contrato À MÃO.** Editou o `openapi.json` (ordenação de
> `components.schemas` divergente) em vez de rodar `export_openapi.py`. A geração é **determinística e
> IDÊNTICA no worker e no meta-sandbox** (version-skew **F8 descartado**: fastapi 0.136.3 / pydantic
> 2.13.4 nos dois) — teria casado byte-a-byte se rodasse o script. O drift-check (corretamente, como o
> CI) barrou as 4 tentativas → escalou. **Convergência sob oracle DEMONSTRADA ao vivo** (`->execute=4`,
> 3 correções via feedback F2), mas o agente insistiu no hand-edit no eixo do contrato.

| Campo | Valor |
|---|---|
| Onda (entregue) | `019e8efb-d652` · worker com F2 · verify = DoD + oracle + drift |
| Desfecho autônomo | **escalated** (4 verify exit 1, só drift do `openapi.json`) |
| Gate | código do agente **salvo** (correto), `openapi.json` **regenerado canonicamente**, frontend (híbrido) completado pelo operador |
| PR | #36 → **CI 6/6 verde** (incl. Integração + OpenAPI sem drift + Frontend) → merged `--squash` **sem `--admin`** → `4e4c126` |

**Entregue:** `GET /api/harness` + `HarnessSummary` (`total_waves`, `by_state` das 8 chaves,
`total/mean_corrections`, `reached_gate`/`escalated`/`failed`, `gates_pending`) +
`Repository.count_pending_gates`; no frontend `getHarness()` + `HarnessIndicators` no painel.

**Encaminhamento (candidatos a meta-onda):** **F7** → verify de *feature* deve incluir oracle de
aceitação, não só DoD+drift. **F9** → forçar a regeneração canônica do contrato (proibir hand-edit no
prompt/wrapper) **ou** regenerar o `openapi.json` automaticamente no nó de PR **ou** tornar o
drift-check tolerante à ordenação (normalizar). O hand-edit do agente é hoje o gargalo de
contract-first no loop autônomo.

### Meta-onda 10 — passo de codegen no loop (endereça F9) (Story 7.18, 2026-06-03)

Endereça o **F9** com a correção de raiz: artefatos derivados (ex.: `openapi.json`) passam a ser
**regenerados pelo sistema**, não editados pelo agente. Nova config `HDD_CODEGEN_COMMAND` (opcional):
o nó `verify` roda o codegen no sandbox **antes** do `verify_command`, sobre o `/workspace` (escrita
in-place persiste até o commit do nó `pr`) → o contrato fica **autoritativo por construção**, e o
hand-edit do agente é sobrescrito. Falha de codegen → loop de correção (como o verify). Vazio →
desligado (retrocompatível).

| Campo | Valor |
|---|---|
| Onda | `019e8f6e-b7ed` · worker com F2 · verify = DoD + **oracle** (sem drift — não toca a API) |
| Desfecho | **awaiting_gate one-shot** (`->execute=1`, `n_corr=0`, verify exit 0) — **sem fix manual** |
| PR | #37 → **CI 6/6 verde** → merged `--squash` **sem `--admin`** → `b8ed9d8` |

**Primeira meta-onda full-autônoma de uma feature de orquestrador.** Mudança: `Settings.codegen_command`
+ `make_sandbox_codegen` (espelha `make_sandbox_verifier`) + param `codegen` no `WaveOrchestrator`
(`_verify_node` roda codegen antes do verify; `(False, fb)` → `CORRECTING` + `verify_feedback`) + wiring
no `factory.open_orchestrator` (constrói o codegen quando `codegen_command` setado). Código idiomático,
**one-shot** sob DoD + oracle oculto (acceptance que dirige o `WaveOrchestrator` com fakes, offline,
validado RED/GREEN). A onda mexe só em Python (orquestrador/settings), **não na API** → sem o drift que
derrubou a onda 9 → converge limpa.

**Por que isto fecha o F9:** com `HDD_CODEGEN_COMMAND = cd backend && PYTHONPATH=src python
scripts/export_openapi.py openapi.json` no worker, qualquer onda futura que mude a API regenera o
`openapi.json` canonicamente no loop — o CI "OpenAPI sem drift" passa sem depender do agente. **Ativação:**
após o merge, `hdd-worker:latest` foi **rebuildado** (F5) com o codegen; as próximas meta-ondas setam
`HDD_CODEGEN_COMMAND` no override de compose. (Deploy de prod = passo separado, fora de escopo / PC-2.)

**F9 ENDEREÇADO** ✅ — a regeneração de artefatos derivados é responsabilidade do sistema; a prova viva
será a próxima onda que mude a API (regenera o contrato sem hand-edit).

### Meta-onda 11 — validação do F9 AO VIVO (2026-06-04)

Primeira onda com **`HDD_CODEGEN_COMMAND` ligado** (entregue na Meta-onda 10). Feature-veículo: novo
campo `active_waves: int` no `HarnessSummary` (ondas em estados não-terminais/não-gate) — uma mudança
de **API**, logo o `openapi.json` precisa mudar. A tarefa **proibiu o agente de tocar o `openapi.json`**.

| Campo | Valor |
|---|---|
| Onda | `019e8fec-414e` · worker com codegen · `HDD_CODEGEN_COMMAND = export_openapi.py openapi.json` |
| Desfecho | **awaiting_gate one-shot** (`->execute=1`, `n_corr=0`) — **sem escalação** (vs onda 9, que escalou exatamente aqui) |
| PR | #38 → **CI 6/6 verde** (incl. **OpenAPI sem drift**) → merged `--squash` **sem `--admin`** → `ea10234` |

**Cadeia da prova (F9 fechado de ponta a ponta):**
1. O agente mudou só `schemas/router/test` — o `git status` dele **nunca** teve `openapi.json`.
2. `codegen.concluido exit_code=0` — o codegen do sistema rodou no nó verify e regenerou o contrato.
3. O `openapi.json` no PR tem `active_waves`, commitado pelo nó `pr` (trabalho do sistema).
4. **CI "OpenAPI sem drift" → pass**: o contrato commitado é canônico, sem hand-edit do agente.

**Contraste direto com a onda 9:** lá o agente hand-editou o `openapi.json` → drift inconvergível → 4
verify vermelhos → escalou. Aqui, com o codegen, o mesmo tipo de mudança de API converge **one-shot**.

**Gap residual (conhecido, fora do F9):** o `api-types.ts` do **frontend** (Node) ainda precisa de
regeneração no gate quando a API muda — o codegen Python cobre o contrato backend, não os tipos TS. A
parte de frontend (`api-types.ts` + stat "Ativas" no painel) foi completada no gate, como nas ondas
full-stack anteriores. Candidato futuro: um passo de codegen de frontend (fora do loop Python).

**F9 CONFIRMADO AO VIVO** ✅ — o loop autônomo mantém o contrato OpenAPI canônico sem o agente.

### Meta-onda 12 — codegen full-stack: fecha o gap de frontend (2026-06-04)

Fecha o **gap residual da Meta-onda 11**: o `api-types.ts` (Node) também passa a ser regenerado pelo
sistema no loop. Pré-requisito (PR #39, `2ffdf1c`): o `meta-sandbox` ganhou **Node 22 +
`openapi-typescript@7.13.0`** (pinado == devDep do frontend; saída byte-idêntica ao `npm run typegen`
do CI, validada sob o hardening real). O `HDD_CODEGEN_COMMAND` passou a **full-stack**:
`export_openapi.py openapi.json && openapi-typescript backend/openapi.json -o frontend/src/lib/api-types.ts`.

Feature-veículo: campo `merged: int` no `HarnessSummary` (mudança de API → muda **os dois** contratos).
A tarefa **proibiu o agente de tocar `openapi.json` E `api-types.ts`**.

| Campo | Valor |
|---|---|
| Onda | `019e94d8-6950` · meta-sandbox com Node · codegen full-stack |
| Desfecho | **awaiting_gate one-shot** (`->execute=1`, `n_corr=0`, `codegen.concluido` exit 0) |
| PR | #40 → **CI 6/6 verde** (incl. **OpenAPI sem drift** E **Frontend/typegen-drift**) → merged `--squash` **sem `--admin`** → `f508038` |

**Prova de ponta a ponta:** o agente mexeu **só** em `schemas/router/test`; o codegen do sistema
regenerou **ambos** os contratos no loop (`openapi.json` com `merged`, `api-types.ts` com `merged`);
o CI passou 100% **sem nenhum hand-fix de frontend no gate** — contraste direto com a onda 11, onde o
`api-types.ts` foi regenerado à mão. O loop autônomo agora mantém **backend + frontend** contract-first
sozinho.

**Nota de manutenção:** o pin `openapi-typescript@7.13.0` no `meta-sandbox` é acoplado ao devDep do
frontend (comentado no `backend/Dockerfile`). **Follow-up (fora de escopo):** o sandbox de verify de
**prod** (`HDD_SANDBOX_IMAGE`) precisa do mesmo Node+ots para o codegen full-stack em produção (PC-2).

**GAP DE FRONTEND FECHADO** ✅ — codegen full-stack no loop, sem passo manual no gate.

### Meta-ondas 13/14 — gate de "testes adicionados" (generaliza o F7) + fix do bug -uall (2026-06-05)

Generaliza o **F7** (verify sem oracle não pega no-op/off-task) com um gate **autônomo**: o orquestrador
reprova in-loop uma onda de feature que não adicionou testes — sem depender de um oracle escrito à mão.

**Meta-onda 13 (Story 7.19) — o gate.** `Settings.require_tests_glob` + `make_git_tests_gate` (roda
`git status` no workspace, checa o glob; runner de git **injetável** p/ testar sem git) + param
`acceptance` no `WaveOrchestrator` (roda ANTES do verify; sem teste casando o glob → `CORRECTING`) +
wiring no factory. Onda `019e98cb-fbad` → **awaiting_gate one-shot**; PR #41 → CI 6/6 → `ea56493`.

**Prova ao vivo (forçada).** Com `HDD_REQUIRE_TESTS_GLOB=*tests/acceptance/*.py` e um no-op (cria
`marker.py`), o agente pôs o teste em `tests/unit/` → **gate disparou** → `->execute=4`,
`verify.concluido=0` → **escalou sem chegar ao gate** (contraste com a onda-9-tentativa-1, em que o
no-op *chegou* ao gate). **Disparo do gate DEMONSTRADO.** Mas surfou um **bug**: o
`git status --porcelain` SEM `--untracked-files=all` **colapsa diretórios novos** não-rastreados, então
o teste que o agente criou em `tests/acceptance/` (dir novo) não foi visto — o gate era over-strict.
(Os unit tests não pegaram: usavam runner injetável com saída fabricada, não git real sobre dir novo —
o valor do dogfood ao vivo.)

**Meta-onda 14 — o HDD conserta o próprio gate.** Fix: `git status --porcelain --untracked-files=all`.
Onda `019e9911-ef4d` → **awaiting_gate one-shot**; PR #43 → CI 6/6 → `ee0f44f`.

**Re-prova (gate corrigido) — disparo → correção → convergência LIMPA:**

| | `->execute` | `verify.concluido` | desfecho |
|---|---|---|---|
| Gate buggy (antes do fix) | 4 | 0 | **escalou** (não via o teste no dir novo) |
| Gate corrigido | **2** | **1** | **awaiting_gate** (disparou → agente criou `tests/acceptance/` → gate viu → passou) |

**F7 GENERALIZADO** ✅ — gate de testes autônomo, provado ao vivo (dispara, bloqueia, e converge após
correção). **Ativação:** ondas de feature setam `HDD_REQUIRE_TESTS_GLOB` (glob casando o prefixo do
path, ex.: `*tests/*.py`) no override de compose; deploy de prod = passo separado (PC-2).

### Meta-onda 15 — Epic 8: driver `api` (RF-12, custo+tokens reais) (2026-06-08)

Primeira onda do **Epic 8**. Implementa o driver `api` (RF-12) que mede **consumo real** (tokens +
custo), pelo **Caminho 1** confirmado com o operador: o `api` é o **mesmo agente `claude -p`** do
`subscription`, só trocando a auth (`ANTHROPIC_API_KEY` via `env`, nunca em argv/log) — com a key, a
saída JSON passa a reportar `usage`/`total_cost_usd`, parseados no `LlmResult`. Python-only (não toca a
API → sem drift), `HDD_REQUIRE_TESTS_GLOB=*tests/*.py` ligado. Oracle: `/var/lib/hdd-oracles/api-driver`
(mock de `subprocess`, offline, $0). Escopo: `ApiProvider.invoke` + `LlmResult` (input/output_tokens,
cost_usd) + `settings.anthropic_api_key` + `factory.make_provider` (chaveia por `llm_driver`) +
`metrics` (`hdd_llm_tokens_total{type}`, `hdd_llm_cost_usd_total`, `record_llm_usage`, fiado no `wave.py`).

**Achado F10 — o oracle deve pinar COMPORTAMENTO, não detalhe de implementação.** A 1ª tentativa
**escalou**. Causa-raiz (via `verify_feedback` no checkpoint): o oracle assertava
`provider.api_key == ...` (nome do atributo), enquanto o teste que o **próprio agente** escreveu
assertava `provider._api_key` (privado). Os dois são **contraditórios** — nenhuma implementação
satisfaz ambos — então o agente **oscilou** (`api_key` ↔ `_api_key`) a cada correção e esgotou N.
(ruff/mypy/lint-imports nunca foram o problema.) **Fix:** o teste de factory do oracle passou a ser
**comportamental** — verifica que `llm_driver="api"` → `ApiProvider` **e** que a key configurada chega
ao `env` do subprocess (via `invoke` mockado), sem acoplar ao nome do atributo. RED 10/1 e GREEN 11/11
re-validados fora do loop; o prompt ganhou nota de consistência (teste do agente ↔ implementação).

**Re-prova (oracle endurecido) — convergência one-shot:**

| | `->execute` | `verify.concluido` | desfecho |
|---|---|---|---|
| Oracle frágil (pinava atributo) | — | 0 (×4) | **escalou** (oscilação `api_key`↔`_api_key`) |
| Oracle comportamental | **1** | **1** | **awaiting_gate one-shot** (0 correções) |

Onda `019ea8ef-f66e` → awaiting_gate one-shot. Gate humano: o agente usou `self._api_key` (privado) —
aceito pelo oracle comportamental, prova viva do F10. Removido 1 arquivo espúrio da raiz
(`run_dod_checks.py`, scratch do agente). PR #46 → **CI 6/6 verde** → merged `--squash` **sem `--admin`**
→ `c743d24`.

**F10 REGISTRADO** ✅ — oracle de aceitação pina contrato observável (a credencial chega ao subprocess),
nunca o nome interno do atributo; senão conflita com a escolha de encapsulamento do agente → oscilação.

**Pendente (gate separado, fora desta onda):** validação **ao vivo** sob `llm_driver=api` — gasta **$
real** e exige a `ANTHROPIC_API_KEY` nos secrets (com `env_prefix=HDD_`, provavelmente
`/run/secrets/hdd_anthropic_api_key` — confirmar). Tratada como o gate de quota, com custo estimado
antes de rodar.
