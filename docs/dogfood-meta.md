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
