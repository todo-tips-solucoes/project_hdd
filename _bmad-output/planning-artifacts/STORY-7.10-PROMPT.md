# Prompt de continuação — Meta-onda 2 (e seguintes) · sessão limpa

> Cole este conteúdo (ou aponte para este arquivo) ao iniciar uma **sessão limpa**.
> Estado em: 2026-06-03, após a **meta-onda 1 (Story 7.9 — oracle oculto, PR #27 merged)** e a
> retrospectiva do Epic 7. Decisão do operador: **seguir com mais meta-ondas, em sessão limpa.**

---

## Quem é você e o que é isto

Você está retomando o **HORSE DRIVEN DEVELOPMENT (HDD)** — plataforma de orquestração autônoma
de desenvolvimento com auditoria. Dir: `/var/lib/projeto_hdd`. Comunicação e documentos em
**português**. `project_name=projeto_hdd`, `user_name=operador`, `user_skill_level=intermediate`.
Leia o `CLAUDE.md` da raiz e **`docs/definition-of-done.md`** (padrão de decisão: recomende por
default a alternativa com melhor prática + segurança + escalabilidade; atalho só com custo
declarado; salvaguarda sempre como gate verificável).

> ⚠️ Config do BMAD: `_bmad/config.toml`, `_bmad/bmm/config.yaml` e os scripts resolver **não
> existem** nesta máquina. Use os valores do `CLAUDE.md`.

## Onde estamos — Epic 7 CONCLUÍDO; Fase 2 (meta-dogfood) operacional

O Epic 7 fechou com **sucesso pleno** (ver `_bmad-output/implementation-artifacts/epic-7-retro-2026-06-03.md`,
seção "Atualização — Fase 2 CONCLUÍDA"). Percurso (tudo em `main`):

- **Fase 1 (calibração):** 7.1 harness · 7.2 gaps→backlog · 7.3 repo-alvo · 7.4 `cep` · 7.5
  `cnpj`+`data_br`. **3/3 features one-shot.** Achado: **oracle visível** ao `execute` → o loop
  de correção não dispara naturalmente.
- **Gate Fase 2:** 7.6 NO-GO condicional → 7.7 hardening (PC-1 fechada, contenção por
  construção) → re-run → **GO** (ADR 0006).
- **Meta-dogfood:** 7.8 meta-sandbox (`hdd-meta-sandbox:latest` roda a suíte do projeto_hdd no
  verify) · **7.9 meta-onda 1 — oracle oculto** (primeira auto-modificação real, **one-shot**,
  PR #27 → `fc8d2b2` na `main`).

**O oracle oculto já existe no código:** `SandboxConfig.oracle_dir` + mount `-v <oracle>:/oracle:ro`
só no `verify`, via `HDD_ORACLE_DIR` (`backend/src/hdd/adapters/sandbox/runner.py`,
`verifier.py`, `config/settings.py`). Isto destrava **exercitar o loop de correção de verdade**.

## Objetivo desta sessão: a próxima meta-onda

Dirigir a **meta-onda 2** (e, se houver janela/quota, seguintes), in-container, com PR + gate
humano. **Confirme o alvo com o operador** — dois candidatos fortes:

- **(A) Exercitar o loop de correção via oracle oculto (RECOMENDADO — fecha o achado da 7.5).**
  Escolha uma feature pequena; escreva uma **suíte-oracle oculta** num dir do host (ex.:
  `/var/lib/hdd-oracles/<feat>/`), aponte `HDD_ORACLE_DIR` para ela no worker, e ajuste
  `HDD_VERIFY_COMMAND` para rodar os testes de `/oracle` contra o código de `/workspace`. O
  `execute` implementa **sem ver** os casos do oracle → o `verify` dá sinal real → observa-se
  `verify→CORRECTING→execute` disparar (mede H-A no modo "às cegas"). É a razão de a 7.9 existir.
- **(B) Indicadores do harness no painel (meta-onda 2 do `epic-7-scope-proposal.md`).** O HDD
  constrói a exibição das métricas de dogfood (Story 7.1) no painel (frontend+backend), via PR
  + gate; exercita o gate de drift de tipos TS. Valor de produto claro, bem-delimitado.

> Numeração: a meta-onda 1 foi a 7.9; chame esta de **Story 7.10**. (A retro do dogfood, que o
> escopo previa como 7.10, foi feita na sessão de 03/06 e está na retro do Epic 7.)

## ⚠️ Restrição crítica: in-container (PC-1) — INVIOLÁVEL

A meta-onda **DEVE** rodar pelo **worker container** (`hdd start` → fila → worker). **NUNCA**
pelo `scripts/calibration_wave.py` do host (Fase-1-only — lá o claude alcança `/var/lib/projeto_hdd`).

## O que FALTA (operacional desta sessão) — agora é simples (infra já existe)

`compose.meta.yaml` (committado) já tem o worker de meta-dogfood. Passos:

1. **Pré-flight de capacidade verde** (ADR 0005): swap ativo (há 4 GB), `max_concurrent=1`, RAM
   livre. Use a função real `evaluate_capacity` (`backend/scripts/calibration_wave.py`) como gate.
2. **Subir o stack dev isolado** (sem quota — o worker idla na fila vazia):
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   docker compose -p hdd_dev -f compose.yaml -f compose.meta.yaml up -d
   docker exec hdd_dev-postgres-1 psql -U hdd -d hdd -tAc \
     "UPDATE app.quota_counter SET max_concurrent=1 WHERE id=1;"
   ```
   Confirme `worker-meta` **healthy** e idlando (`docker logs hdd_dev-worker-meta-1`).
   - **Se alvo (A):** antes do `up`, prepare o dir do oracle no host e adicione ao worker (via
     override de env, ex.: `HDD_ORACLE_DIR=/var/lib/hdd-oracles/<feat>` + um bind do mesmo path
     host↔worker, análogo ao `HDD_WORKSPACE_ROOT`) e ajuste `HDD_VERIFY_COMMAND` para rodar de
     `/oracle`. **Rebuilde `hdd-meta-sandbox` se mudar deps.** Escreva isto num
     `compose.meta.oracle.yaml` (não edite o `compose.meta.yaml` base).
3. **PARAR e confirmar com o operador antes de enfileirar** (consome quota).
4. **Enfileirar** (dentro do worker, p/ cair no MESMO DB dev):
   ```bash
   docker exec hdd_dev-worker-meta-1 python -m hdd.cli.main start "<tarefa da onda>"
   ```
   Tarefa honesta, não super-especificada. Acompanhe `app.waves.state` → `awaiting_gate` e os
   logs; para alvo (A), observe se o loop de correção dispara.
5. **Gate humano:** o `verify` só roda `pytest`. **Rode o DoD completo no branch do PR** (worktree
   descartável): `uv run ruff check . && uv run mypy && uv run lint-imports && uv run pytest`.
   ⚠️ **O PR nasce _draft_** → `gh pr ready <N>` antes de mergear. **PARE p/ confirmação do
   operador antes do merge.**
6. **Registrar** em `docs/dogfood-meta.md` (seção "Resultados das meta-ondas") + atualizar a
   story 7.10. **Descer o stack dev** ao fim (`docker compose -p hdd_dev ... down`; volume
   `hdd_dev_pgdata` é preservado).

## Salvaguardas (Fase 2 — invioláveis)

PR + **gate humano** no merge; **workspace efêmero** por onda; **pré-flight de capacidade**;
**sem auto-deploy** (PC-2); o HDD **nunca** toca `compose.prod.yaml`/`secrets/`/`deploy.env`.
**Pare para confirmação do operador antes de gastar quota e antes de aprovar o gate.**
Merge ≠ deploy: o worker de **prod** só usa a feature após rebuild+restart (runbook) — fora de escopo da onda.

## Gotchas do ambiente (desta máquina, 2026-06-03)

- **Produção no ar** (`projeto_hdd-postgres-1/api-1/worker-1/frontend-1` + `traefik-traefik-1`).
  **NÃO mexer.** O worker de prod aponta p/ `hdd-smoke-test` (não é o meta).
- **Acesso do bot:** o token `secrets/hdd_gh_token` é da conta `paulotodo` mas tem **ADMIN** em
  `todo-tips-solucoes/project_hdd` (alvo das meta-ondas) — push/PR/merge OK.
- `uv` e `gh` em `~/.local/bin` (`export PATH="$HOME/.local/bin:$PATH"`). `claude` CLI autenticado.
  Imagens: `hdd-meta-sandbox:latest` (verify do meta), `hdd-worker:latest`, `hdd-sandbox:latest`
  (calibração). **`compose.meta.yaml`** committado (worker de meta-dogfood, URL sem token via
  credential helper do `gh`).
- **Meta-sandbox carrega deps da build:** onda que adicione dependência nova quebra o `verify`
  até `docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend`.
- **VPS Boston 16 GB**, swap 4 GB ativo. Postgres dev em **5433** (`-p hdd_dev`, volume
  `hdd_dev_pgdata` preservado). DSN dev (de dentro do worker): `postgresql://hdd:hdd_dev@postgres:5432/hdd`.
- Toolchain verde obrigatório p/ commit local: `cd backend && export PATH="$HOME/.local/bin:$PATH"
  && uv run ruff check . && uv run mypy && uv run lint-imports && uv run pytest` (≈113 unit).

## Como retomar (sugestão de 1ª ação)

1. `git log --oneline -20`; leia a retro do Epic 7 (seção Fase 2), `docs/dogfood-meta.md`,
   `compose.meta.yaml` e a story 7.9 (modelo do desfecho).
2. **Confirme o alvo da meta-onda 2 com o operador** (A: loop de correção via oracle oculto —
   recomendado; ou B: indicadores no painel).
3. Pré-flight verde → suba o stack dev (passo 2 acima) → **PARE p/ confirmar antes de enfileirar**.
