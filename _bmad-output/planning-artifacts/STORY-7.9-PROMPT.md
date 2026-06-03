# Prompt de continuação — Story 7.9: Meta-onda 1 (oracle oculto)

> Cole este conteúdo (ou aponte para este arquivo) ao iniciar uma **sessão limpa**.
> Estado em: 2026-06-03, após a Story 7.8 (meta-sandbox). Checkpoint do operador.

---

## Quem é você e o que é isto

Você está retomando o **HORSE DRIVEN DEVELOPMENT (HDD) v2** — plataforma de orquestração
autônoma de desenvolvimento com auditoria. Dir: `/var/lib/projeto_hdd`. Comunicação e
documentos em **português**. `project_name=projeto_hdd`, `user_name=operador`,
`user_skill_level=intermediate`. Há um `CLAUDE.md` na raiz — leia-o. **Leia também
`docs/definition-of-done.md`** (padrão de decisão: recomende por default a alternativa com
melhor prática + segurança + escalabilidade; atalho só com custo declarado; salvaguarda
sempre como gate verificável).

> ⚠️ Config do BMAD: `_bmad/config.toml` e `_bmad/bmm/config.yaml` **não existem** nesta
> máquina; o resolver de customização também não. Use os valores do `CLAUDE.md` e resolva
> `customize.toml` à mão se preciso (sem overrides em `_bmad/custom/` além do `config.toml`).

## Onde estamos — Epic 7, Fase 2 (meta-dogfood) LIBERADA

O Epic 7 ("Dogfooding Real & Harness de Medição") validou a capacidade do HDD na Fase 1
(calibração) e **liberou a Fase 2** (o HDD constrói features no próprio `projeto_hdd`).
Percurso (todos commitados em `main`):

- **Fase 1:** 7.1 harness · 7.2 loop gaps→backlog · 7.3 repo-alvo (`paulotodo/hdd-calibragem`) ·
  7.4 `cep` · 7.5 `cnpj`+`data_br`. **3/3 features one-shot** (reached_gate, 0 correções).
- **Incidente OOM (02/06)** → correct-course: pré-flight de capacidade em código + ADR 0005
  (cutover p/ VPS dedicada de 16 GB "Boston", `mem_limit` por stack) + DoD.
- **Achado da 7.5:** o nó `execute` LÊ os testes no clone → modelos capazes one-shotam; o loop
  de correção não dispara com **oracle visível**. (É o que a 7.9 resolve.)
- **7.6 gate GO/NO-GO:** capacidade ✅, PC-2 (sem auto-deploy) ✅, PC-1 (contenção de Write) ❌
  → **NO-GO condicional** (ADR 0006).
- **7.7 hardening:** PC-1 fechada — na Fase 2 o `execute` roda no **container worker**, que
  não monta a árvore de prod/secrets (contenção por construção, pinada por invariante em
  `backend/tests/unit/test_security_invariants.py::test_pc1_execute_contido_pelo_boundary_do_worker`).
  Gate 7.6 re-rodado → **GO**. ADR 0006 atualizado.
- **7.8 meta-sandbox (pré-requisito, FEITO):** `hdd-meta-sandbox:latest` roda a suíte do
  `projeto_hdd` no verify (`--network none`), validado **113 testes verdes**. Ver
  `docs/dogfood-meta.md`. Renumerou a meta-onda oracle-oculto 7.8 → **7.9**.

Artefato-fonte: `_bmad-output/implementation-artifacts/7-9-meta-onda-1-oracle-oculto.md`
(status `blocked` → agora desbloqueada pela 7.8). Commits recentes: `ebfb70c` (correct-course)
… `b0273a7` (meta-sandbox). Veja `git log --oneline -20`.

## Objetivo da Story 7.9

Dirigir a **PRIMEIRA meta-onda real**: o HDD constrói, no próprio `projeto_hdd` (via PR + gate
humano), um **verify com oracle oculto** — a suíte autoritativa fica montada **só no nó
`verify`** (`-v <oracle>:/oracle:ro`) e **não** no clone que o `execute` lê. Assim o execute
implementa às cegas do oracle e o verify dá sinal real → o loop de correção pode disparar de
verdade em ondas futuras. Escopo **MVP/baixo risco**: `oracle_dir` opcional no `SandboxConfig`
+ mount no `verify`, retrocompatível, com testes. Ler a story 7.9 inteira antes.

## ⚠️ Restrição crítica: in-container (PC-1)

A meta-onda **DEVE** rodar pelo **caminho in-container** (worker container), **NUNCA** pelo
`scripts/calibration_wave.py` do host (que roda `claude` no host, onde `/var/lib/projeto_hdd`
é alcançável — isso é Fase-1-only). Use o produtor real: `hdd start "<tarefa>"`
(`backend/src/hdd/cli/main.py:33` → `WorkQueue.enqueue`) e um **worker container** processa.

## O que FALTA para disparar (o trabalho operacional desta sessão)

O meta-sandbox está pronto; falta **subir um worker container de dev isolado** com a config do
meta-dogfood e enfileirar. Config em `docs/dogfood-meta.md`. Passos:

1. **Verificar acesso do bot ao repo-alvo.** O token `secrets/hdd_gh_token` é da conta
   **`paulotodo`**; o `projeto_hdd` está em **`todo-tips-solucoes/project_hdd`**. **Confirme
   que o bot tem push/PR nesse repo** (`GH_TOKEN=$(cat secrets/hdd_gh_token) gh repo view
   todo-tips-solucoes/project_hdd`). Se não tiver, decidir com o operador (dar acesso, ou usar
   um fork/mirror do HDD na conta do bot como alvo da meta-onda).
2. **Postgres de dev** (compose.yaml, host 5433) no ar e migrado:
   `docker compose -p hdd_dev -f compose.yaml up -d postgres` → `cd backend && uv run alembic
   upgrade head` → garantir `app.quota_counter.max_concurrent=1` (pré-flight OOM).
3. **Worker container de dev** (imagem `hdd-worker:latest`) com env de meta-dogfood:
   `HDD_PG_DSN` (dev 5433, mas visto de dentro do container → usar a rede/host adequada),
   `HDD_REPO_URL=https://<token>@github.com/todo-tips-solucoes/project_hdd.git`,
   `HDD_REPO_SLUG=todo-tips-solucoes/project_hdd`, `HDD_SANDBOX_IMAGE=hdd-meta-sandbox:latest`,
   `HDD_VERIFY_COMMAND="sh -c 'cd backend && python -m pytest -q'"`, `HDD_CLAUDE_TIMEOUT_S=600`,
   `HDD_MODEL=<sonnet|haiku>`; secrets `hdd_gh_token` + `hdd_claude_oauth_token`; bind do
   `docker.sock` e do `HDD_WORKSPACE_ROOT` (mesmo path host↔worker, como no compose.prod).
   **Isolado** (`-p hdd_dev`), **nunca** o worker de produção; **não** tocar `compose.prod.yaml`.
   - Considere escrever um `compose.meta.yaml` (override de dev) para isto — é um artefato
     legítimo da 7.9 (a story prevê). Espelhe o serviço `worker` do `compose.prod.yaml`
     (mounts docker.sock + workspace, secrets, group_add do gid docker) com a env acima.
3b. **Pré-flight de capacidade** verde antes de qualquer onda: swap ativo (já há 4 GB),
   `max_concurrent=1`, RAM livre. Subir o dev só na janela e descer depois.
4. **Disparar** com confirmação do operador (consome quota): `uv run python -m hdd... ` ou
   `hdd start "<tarefa da onda>"` enfileira; o worker processa
   (execute in-container → verify no meta-sandbox → PR no projeto_hdd → para no gate).
   Tarefa honesta, não super-especificada — algo como: *"Implemente o oracle oculto no nó
   verify: `oracle_dir` opcional no SandboxConfig, mount `-v <oracle>:/oracle:ro` só no verify,
   retrocompatível, com testes; mantenha os boundaries."*
5. **Gate humano:** revisar o PR no `projeto_hdd` (retrocompatível? tooling verde? boundaries?)
   e **PARAR para confirmação do operador antes de aprovar o merge**.
6. **Registrar** o resultado em `docs/dogfood-meta.md` (seção "Resultados das meta-ondas").

## Salvaguardas (Fase 2 — invioláveis)

PR + **gate humano** no merge (6.8); **workspace efêmero** por onda (6.6); **pré-flight de
capacidade** (ADR 0005); **sem auto-deploy** (PC-2 verificado); o HDD **nunca** toca
`compose.prod.yaml`/`secrets/`/`deploy.env`. **Pare para confirmação do operador antes de
gastar quota e antes de aprovar o gate.**

## Gotchas do ambiente (desta máquina, 2026-06-03)

- **Produção está no ar** nesta VPS (`projeto_hdd-postgres-1/api-1/worker-1/frontend-1` +
  `traefik-traefik-1`). NÃO mexer. O worker de prod aponta p/ `hdd-smoke-test` (não é o meta).
- `uv` e `gh` foram instalados em `~/.local/bin` nesta sessão (`export PATH="$HOME/.local/bin:$PATH"`).
  `claude` CLI autenticado (`~/.claude/.credentials.json`). Imagens: `hdd-sandbox:latest`
  (calibração), `hdd-meta-sandbox:latest` (meta — recém-criada), `hdd-worker/api/postgres/frontend:latest`.
- **VPS Boston 16 GB**, swap 4 GB ativo (`swappiness=10`, `/etc/fstab`). Postgres dev em **5433**
  (prod em 5432 interno). DSN dev default: `postgresql://hdd:hdd_dev@localhost:5433/hdd`.
- `backend/.env` existe (gitignored) — hoje aponta para a **calibração** (`hdd-calibragem`,
  `HDD_MODEL=haiku`). Para a meta-onda use a config do **worker container** (não o `.env` do
  host) — ou ajuste conscientemente. Volume `hdd_dev_pgdata` preservado (dados da calibração).
- Toolchain verde obrigatório antes de commitar código local: `cd backend && export
  PATH="$HOME/.local/bin:$PATH" && uv run ruff check . && uv run mypy && uv run lint-imports &&
  uv run pytest` (113 unit; integração é opt-in, custa quota).
- ⚠️ **Recursão consciente:** a 7.9 constrói a *capacidade* de oracle oculto; os testes da
  própria feature são escritos pelo execute (visíveis), então esta onda provavelmente é
  one-shot — tudo bem. O valor é (a) validar o pipeline de auto-modificação em alvo real e
  (b) entregar a feature para ondas futuras exercitarem o loop de correção.

## Como retomar (sugestão de 1ª ação)

1. `git log --oneline -20` e leia `7-9-meta-onda-1-oracle-oculto.md` + `docs/dogfood-meta.md` +
   `docs/decisions/0006-...md`.
2. Invoque **`bmad-dev-story`** apontando a story 7.9, com a instrução de **parar antes de
   gastar quota** para montar/confirmar o worker in-container (passo "O que FALTA" acima).
3. Verifique o acesso do bot ao `todo-tips-solucoes/project_hdd` (gotcha #1) — pode ser o
   primeiro bloqueio a resolver com o operador.
