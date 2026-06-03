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

_(a preencher conforme as meta-ondas rodarem — desfecho, correções, PR, decisão do gate)_
