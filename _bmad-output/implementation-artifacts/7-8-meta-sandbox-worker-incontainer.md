# Story 7.8: Meta-sandbox — imagem de verify capaz de rodar a suíte do projeto_hdd (pré-requisito das meta-ondas)

Status: review

> Pré-requisito **bloqueante** da Story 7.9 (meta-onda 1) e de toda a Fase 2. Origem:
> análise de 2026-06-03 ao dirigir a 7.9 — o `hdd-sandbox:latest` (Python 3.11 + pytest,
> sem uv/deps do backend) não roda a suíte do `projeto_hdd`. **Infra construída pelo dev
> (sem quota/onda)** — não pode ser meta-onda (recursão: a onda precisaria deste sandbox).

## Story

As a operador,
I want um sandbox de `verify` que rode a suíte de testes do próprio `projeto_hdd` (Python 3.13 + uv + deps do backend, sem credenciais),
so that as meta-ondas (Fase 2) possam ser verificadas de verdade — hoje o sandbox só serve a repos sem dependências (calibragem).

## Acceptance Criteria

1. **Imagem meta-sandbox:** **Given** o `backend/Dockerfile` **When** construo o alvo `meta-sandbox` **Then** existe `hdd-meta-sandbox:latest` com Python 3.13 + as deps do backend **incluindo dev** (pytest), **sem** credenciais, usuário não-root, `WORKDIR /workspace`.
2. **Roda a suíte do projeto_hdd:** **Given** um clone do `projeto_hdd` montado em `/workspace` **When** rodo o `HDD_VERIFY_COMMAND` do meta-dogfood no sandbox (`--network none`) **Then** a suíte unit do backend roda e dá sinal real (verde no código atual; vermelho se o código quebrar) — **provado** rodando a imagem contra o checkout atual.
3. **Config do meta-dogfood:** **Given** um worker in-container para a Fase 2 **When** configuro **Then** há um override/`.env` documentado com `HDD_REPO_URL=projeto_hdd`, `HDD_REPO_SLUG`, `HDD_SANDBOX_IMAGE=hdd-meta-sandbox:latest` e `HDD_VERIFY_COMMAND` da suíte — **sem** tocar `compose.prod.yaml` de produção.
4. **Retrocompatível + tooling:** **Given** o caminho atual (calibração com `hdd-sandbox:latest`) **When** finalizo **Then** nada quebra (a calibração continua usando a imagem minimal); `ruff`/`mypy`/`import-linter`/`pytest` verdes no código local.
5. **Limitação documentada:** **Given** o meta-sandbox tem as deps **da build** **When** uma onda futura adicionar uma dep nova **Then** está documentado que o meta-sandbox precisa ser rebuildado (a verify falharia até lá) — gap honesto, não silencioso.

## Tasks / Subtasks

- [x] **Task 1 — Stage `meta-sandbox` no `backend/Dockerfile` (AC: #1)**. ✅ stage novo (Python 3.13 + uv, `uv sync --frozen --no-install-project` → deps prod+dev/pytest em `/deps/.venv`), usuário 10001, `WORKDIR /workspace`, sem credenciais.
- [x] **Task 2 — Build + validação (AC: #2)**. ✅ `hdd-meta-sandbox:latest` (643MB) buildado; **validado** rodando a suíte do projeto_hdd contra um clone montado em `/workspace` com `--network none` → **113 testes verdes** (Python 3.13 do venv da imagem, código do clone via `pythonpath=src`).
- [x] **Task 3 — Config do meta-dogfood (AC: #3)**. ✅ documentado em `docs/dogfood-meta.md` (tabela de env: `HDD_REPO_URL`/`SLUG`=projeto_hdd, `HDD_SANDBOX_IMAGE=hdd-meta-sandbox:latest`, `HDD_VERIFY_COMMAND="sh -c 'cd backend && python -m pytest -q'"`, worker isolado). `compose.prod.yaml` **não** tocado.
- [x] **Task 4 — Documentar + tooling (AC: #4, #5)**. ✅ `docs/dogfood-meta.md` criado (modelo in-container, meta-sandbox, verify command, **limitação** do rebuild ao mudar deps). Calibração Fase 1 intacta (segue `hdd-sandbox:latest`). Tooling verde: ruff/mypy(74)/import-linter(4)/pytest(113).

## Dev Notes

- **Infra, não meta-onda.** Construída direto pelo dev — sem quota, sem `claude -p`.
- **Estado atual (ler):**
  - `sandbox/Dockerfile` (raiz): imagem `hdd-sandbox:latest` — Node (Claude CLI) + git + python3 + **pytest** (minimal, p/ calibragem). **Não** tem uv nem deps do backend. Mantém-se para calibração (Fase 1).
  - `backend/Dockerfile`: stage `builder` faz `uv sync --frozen --no-install-project --no-dev` (deps de prod, **sem** dev) + `uv sync --frozen --no-dev`; `runtime-base` tem `/app/.venv/bin` no PATH. → o meta-sandbox precisa de `uv sync --frozen` **sem** `--no-dev` (inclui pytest).
  - `adapters/sandbox/runner.py`: `SandboxRunner` monta `-v {workspace}:/workspace:rw -w /workspace … {image} {command}`. `image` = `settings.sandbox_image`; `command` = `shlex.split(settings.verify_command)`. → o meta-sandbox só precisa ser uma imagem + config (`HDD_SANDBOX_IMAGE`, `HDD_VERIFY_COMMAND`), **sem** mudar o código do runner.
  - `adapters/sandbox/verifier.py`: roda `settings.verify_command` no sandbox; `exit 0` → verde.
- **HDD_VERIFY_COMMAND do projeto_hdd:** a suíte está em `backend/`; o `pyproject` usa `pythonpath=["src"]` e `addopts='-m "not integration"'`. Comando provável: `sh -c 'cd backend && python -m pytest -q'` (deps vêm do venv da imagem; código vem do `/workspace` montado).
- **Limitação (documentar):** o meta-sandbox carrega as deps **da build**. Onda que adicione dep nova → verify vermelho até rebuildar a imagem. Aceitável no MVP; é gap honesto.
- **Não confundir os dois sandboxes:** calibração (Fase 1) usa `hdd-sandbox:latest` (minimal); meta-dogfood (Fase 2) usa `hdd-meta-sandbox:latest` (deps do backend). Selecionado por `HDD_SANDBOX_IMAGE`.
- **Salvaguardas:** sem tocar `compose.prod.yaml`/`secrets`; o meta-sandbox **não** carrega credenciais (a auth do `claude` é do nó execute, não do verify).

### Project Structure Notes

- Mudanças: `backend/Dockerfile` (NEW stage `meta-sandbox`), `docs/dogfood-meta.md` (NEW), possível `compose.meta.yaml` ou seção de config (NEW), opcional ajuste em `settings`/`.env.example` documentando `HDD_SANDBOX_IMAGE`.
- Desbloqueia: Story 7.9 (meta-onda 1 — oracle oculto) e todas as meta-ondas.

### References

- [Source: _bmad-output/implementation-artifacts/7-9-meta-onda-1-oracle-oculto.md] (Debug Log — descoberta do pré-requisito)
- [Source: docs/decisions/0006-gate-calibracao-go-nogo.md] (GO Fase 2; in-container)
- [Source: backend/Dockerfile] (stages builder/runtime-base/worker — modelo p/ o meta-sandbox)
- [Source: sandbox/Dockerfile] (sandbox de calibração — minimal)
- [Source: backend/src/hdd/adapters/sandbox/runner.py] (SandboxRunner — image + command por config)
- [Source: docs/definition-of-done.md] (salvaguardas Fase 2)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Pré-requisito das meta-ondas entregue **sem quota** (infra dev). `hdd-meta-sandbox:latest` roda a suíte do projeto_hdd no verify (`--network none`), validado 113/113. Config do worker in-container documentada; calibração Fase 1 intacta. Limitação (rebuild ao mudar deps) documentada. **Desbloqueia a Story 7.9** (meta-onda 1 — oracle oculto).

### File List

- `backend/Dockerfile` (UPDATE — stage `meta-sandbox`)
- `docs/dogfood-meta.md` (NEW — modelo de execução in-container + meta-sandbox + config + limitação)

## Change Log

- 2026-06-03 — Meta-sandbox criado (Story 7.8): stage `meta-sandbox` no backend/Dockerfile, imagem `hdd-meta-sandbox:latest` validada rodando a suíte do projeto_hdd (113 verdes, `--network none`), config in-container documentada em `docs/dogfood-meta.md`. Tooling verde. Status → review. Desbloqueia a 7.9.
