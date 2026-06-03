# Story 7.17: Meta-onda 9 (Fase 2) — CI valida build do meta-sandbox + Makefile de rebuild

Status: in_progress (2026-06-03)

> Endereça o **action item #7 da retro do Epic 7**: "Automar rebuild do meta-sandbox quando
> `uv.lock` mudar; documentar PR-draft + runbook deploy." Parcela entregue nesta meta-onda:
> a **validação automática** (o CI confirma que o `meta-sandbox` ainda builda a cada PR/push —
> detectando deps quebradas antes do gate) e um **Makefile com `rebuild-meta-sandbox`** para
> o operador recriar a imagem localmente sem ter de copiar o comando. A documentação de
> PR-draft e runbook de deploy é registrada em `docs/dogfood-meta.md` (operacional, sem
> meta-onda — mas o Makefile abre a porta para mais automação futura).

## Story

As a operador,
I want que o CI valide o build do `hdd-meta-sandbox` em todo PR/push e que exista um
`Makefile` com o target `rebuild-meta-sandbox`,
so that eu descubra dependências quebradas antes do gate da próxima meta-onda (em vez de só
quando a onda falha por `ModuleNotFoundError`) e reconstrua a imagem com um único comando
sem precisar consultar o Dockerfile.

## Acceptance Criteria

1. **CI builda meta-sandbox:** **Given** o job `docker-build` do `.github/workflows/ci.yml`
   **When** um PR/push toca `backend/` **Then** há um step `backend — meta-sandbox` que
   executa `docker build --target meta-sandbox` com `push: false` (cache GHA). Build com
   deps corretas → sucesso; `uv.lock` corrompido → CI falha, alerta o operador antes do gate.
2. **Makefile com `rebuild-meta-sandbox`:** **Given** o `Makefile` na raiz do repo **When**
   o operador roda `make rebuild-meta-sandbox` **Then** executa
   `docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend` — equivalente ao
   comando manual do `Dockerfile`. Sem dependências extras (só `make` + `docker`).
3. **Retrocompatível:** **Given** as imagens `api`, `worker`, `frontend` no CI **When** o
   step `meta-sandbox` é adicionado **Then** os steps existentes continuam idênticos
   (nenhuma mudança de comportamento).
4. **DoD + CI:** ruff/mypy --strict/import-linter/pytest verdes (sem código Python novo —
   mas a suíte completa deve passar); CI verde incl. Integração.
5. **Auditoria:** registrar a Meta-onda 9 em `docs/dogfood-meta.md` e marcar action item #7
   parcialmente endereçado.

## Tasks / Subtasks

- [x] **Task 0 — Setup (sem quota).** `compose.meta.onda9.yaml` (verify = DoD completo;
  sem oracle; timeout 1200). Worker com F2 (hdd-worker:latest atual). Sem rebuild do
  meta-sandbox (a onda não muda deps).
- [ ] **Task 1 — Subir stack + pré-flight (sem quota).**
- [ ] **Task 2 — Disparar — PARAR p/ confirmação do operador antes (quota).**
- [ ] **Task 3 — Gate humano** (DoD no branch + CI completo verde incl. Integração;
  `gh pr ready`; PARAR antes do merge).
- [ ] **Task 4 — Registrar** (`docs/dogfood-meta.md` Meta-onda 9 + esta story). Descer o stack.

## Dev Notes

- **Tarefa visível (enfileirar):**
  > "Adicione o target `meta-sandbox` ao job `docker-build` do CI
  > (`.github/workflows/ci.yml`). O job já builda `api`, `worker` e `frontend` com
  > `push: false`; adicione um step `backend — meta-sandbox` usando
  > `docker/build-push-action@v6` com `target: meta-sandbox`, `push: false`, e cache GHA
  > no scope `meta-sandbox` (mesmo padrão dos outros). Também crie um `Makefile` na raiz
  > do repo com o target `rebuild-meta-sandbox` que executa
  > `docker build -t hdd-meta-sandbox:latest --target meta-sandbox backend`. Adicione um
  > `.PHONY: rebuild-meta-sandbox` e um comentário de cabeçalho. Mantenha ruff/mypy
  > --strict/import-linter/pytest verdes e os boundaries."
- **Pontos de código (ler):**
  - `.github/workflows/ci.yml:134-167` (job `docker-build` — três steps `build-push-action`)
  - `backend/Dockerfile:98-121` (stage `meta-sandbox` — context é `./backend`)
  - `compose.meta.yaml` (referência ao `hdd-meta-sandbox:latest`)
- **verify = DoD completo** (sem oracle, exato como onda 8). O `ci.yml` é YAML, não Python —
  o verify roda pytest da suíte do projeto_hdd (que não inclui teste de YAML). A correção
  do YAML é verificada pelo CI após o merge; o gate deve exigir o CI verde.
- **Não há código Python novo** — mypy/ruff/import-linter não terão nada novo para analisar.
  Se o agente criar helpers Python, devem seguir o DoD; mas a feature não exige isso.
- **Salvaguardas Fase 2 (invioláveis):** in-container (PC-1); PR + gate humano; workspace
  efêmero; pré-flight de capacidade; sem auto-deploy. Parar antes da quota e do merge.

### Project Structure Notes

- Feature (HDD fará no clone, revisada no gate):
  - `.github/workflows/ci.yml` (UPDATE — step novo no job `docker-build`)
  - `Makefile` (NEW — na raiz do repo)
- Operacional: `compose.meta.onda9.yaml` (NEW), esta story (NEW), `docs/dogfood-meta.md` (UPDATE).

### References

- [Source: .github/workflows/ci.yml] (job docker-build — padrão dos steps existentes)
- [Source: backend/Dockerfile:98-121] (stage meta-sandbox)
- [Source: _bmad-output/implementation-artifacts/epic-7-retro-2026-06-03.md] (action item #7)
- [Source: docs/dogfood-meta.md] (Meta-ondas anteriores — padrão de registro)
- [Source: docs/definition-of-done.md] (DoD + salvaguardas)

## Dev Agent Record

### Agent Model Used

_A preencher após a meta-onda._

### Debug Log References

_A preencher após a meta-onda._

### Completion Notes List

_A preencher após a meta-onda._

### File List

**Neste repo (operacional, Story 7.17):**
- `compose.meta.onda9.yaml` (NEW), `_bmad-output/implementation-artifacts/7-17-meta-onda-9-ci-meta-sandbox.md` (NEW),
  `docs/dogfood-meta.md` (UPDATE, a fazer).

**No PR da meta-onda (feito pelo HDD, revisado no gate):**
- `.github/workflows/ci.yml`, `Makefile`.
