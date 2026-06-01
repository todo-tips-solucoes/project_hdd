# Runbook — Smoke E2E em produção (Story 6.4)

Valida a malha completa do Epic 6 num deploy real: **uma feature percorre
`enqueue → claude → verify → PR rascunho → gate no painel → resume → merge`**,
respeitando o teto de quota (sem vazar lease) e observando o D-032.

> Pré-leitura: `deploy.md` (subir o stack), ADRs `0002`/`0003`/`0004` (modelo de
> execução, merge na API, socket do verify).

---

## ⚠️ Antes de tudo — duas armadilhas que invalidam o smoke

1. **O `hdd-sandbox` precisa rodar o `HDD_VERIFY_COMMAND` do repo-alvo.** A imagem
   `hdd-sandbox` é Node+git+claude — **não tem `pytest`/`uv`**. Se o alvo é
   `projeto_hdd` (Python) e `HDD_VERIFY_COMMAND=pytest -q`, o verify FALHA (pytest
   ausente) → loop de correção → escala. **Para o 1º smoke, valide o ENCANAMENTO**
   com um alvo trivial:
   - `HDD_REPO_URL` = um repo de teste descartável (não o de produção);
   - `HDD_VERIFY_COMMAND=true` (sempre passa) → isola o fluxo dos testes reais.
   Só depois rode um 2º smoke com o repo real + uma imagem de sandbox que tenha o
   toolchain do projeto (ex.: estender `sandbox/Dockerfile` com python+uv).

2. **O merge é REAL.** Aprovar o gate faz `gh pr merge --squash` no `HDD_REPO_SLUG`.
   Use um **repo/branch de teste**, nunca o `main` de produção, no 1º smoke.

---

## 0. Pré-voo (no nó manager do Swarm)

```bash
cd /var/lib/projeto_hdd
# Variáveis (deploy.env a partir de deploy.env.example):
#   HDD_DOMAIN, CADDY_ACME_EMAIL
#   HDD_REPO_URL      = <repo de teste, clonável pelo worker (com token)>
#   HDD_REPO_SLUG     = owner/repo-de-teste
#   HDD_VERIFY_COMMAND= true          # 1º smoke: isola o encanamento
#   HDD_WORKSPACE_ROOT= /var/lib/hdd-workspaces
#   HDD_DOCKER_GID    = $(getent group docker | cut -d: -f3)
#   CLAUDE_CODE_OAUTH_TOKEN, HDD_GH_TOKEN (escopo mínimo: o repo de teste)
mkdir -p /var/lib/hdd-workspaces

# Imagens (incl. o sandbox — o worker faz `docker run` dele):
docker build -t hdd-api:latest    --target api    backend
docker build -t hdd-worker:latest --target worker backend
docker build -t hdd-frontend:latest                frontend
docker build -t hdd-sandbox:latest                 sandbox

# Secrets criados? (ver secrets.md) — hdd_pg_dsn aponta p/ @postgres:5432.
docker secret ls | grep hdd_
```

**Checklist de pré-voo:**
- [ ] `getent group docker` existe e `HDD_DOCKER_GID` está correto
- [ ] `/var/lib/hdd-workspaces` criado no host
- [ ] `HDD_GH_TOKEN` consegue `git clone` E `gh pr merge` no repo de teste
- [ ] imagem `hdd-sandbox:latest` presente (`docker image ls | grep hdd-sandbox`)
- [ ] DNS de `$HDD_DOMAIN` resolve para o nó; portas 80/443 abertas

---

## 1. Deploy

```bash
set -a && . ./deploy.env && set +a
docker stack deploy -c stack.yaml hdd
watch -n2 docker stack services hdd        # aguardar REPLICAS 1/1 em todos
docker service logs -f hdd_caddy           # certificado ACME emitido
```

- [ ] `api`, `worker`, `frontend`, `postgres`, `caddy` todos `1/1`

---

## 2. Saúde

```bash
curl -sS https://$HDD_DOMAIN/healthz        # {"status":"ok"} com TLS válido
curl -sS https://$HDD_DOMAIN/readyz         # readiness (DB alcançável)
curl -sSI https://$HDD_DOMAIN/ | head -1    # 200 — painel carrega
```
- [ ] healthz/readyz OK · painel responde

Atalhos para inspeção (reutilizados abaixo):
```bash
PG() { docker exec "$(docker ps -qf name=hdd_postgres)" psql -U hdd -d hdd -tAc "$1"; }
WLOG() { docker service logs --since "${1:-10m}" hdd_worker; }
```

---

## 3. Disparar uma feature

**Via painel (canal autenticado, recomendado):** faça login OAuth em
`https://$HDD_DOMAIN`, ou via API com o cookie de sessão:
```bash
# (após autenticar; substitua o cookie de sessão)
curl -sS -X POST https://$HDD_DOMAIN/api/features \
  -H 'content-type: application/json' -b "$COOKIE" \
  -d '{"task":"smoke: adicionar comentário trivial no README"}'
# → {"session_id":"...","wave_id":"<WID>","work_id":"<work>"}
```
**Ou via CLI dentro do container:**
```bash
docker exec -it "$(docker ps -qf name=hdd_api)" hdd start "smoke: trivial"
```
- [ ] resposta traz `wave_id`/`work_id`
- [ ] item enfileirado: `PG "select status,payload from app.work_queue order by created_at desc limit 1;"` → `pending` com `{"task":...,"thread_id":"<WID>"}`

---

## 4. Acompanhar a onda (claim → execute → verify → PR)

```bash
WLOG 5m    # claim do item, lease adquirido, provision do workspace, claude, verify
```
Verificações:
```bash
# Item saiu de pending (running/done):
PG "select status from app.work_queue order by created_at desc limit 1;"
# Lease ativo durante a onda (1 enquanto roda; some ao fim):
PG "select count(*) from app.quota_lease;"
# Workspace efêmero criado no host (existe durante a onda, removido no fim):
ls -d /var/lib/hdd-workspaces/hdd-wave-* 2>/dev/null
# Onda chegou ao gate:
PG "select state from app.waves where id='<WID>';"          # awaiting_gate
# Gate aberto, com a URL do PR no reason:
PG "select id,gate_type,reason,status from app.gates where wave_id='<WID>';"
```
- [ ] worker logou `claim → lease → run`
- [ ] `app.waves.state` = `awaiting_gate`
- [ ] gate `pending` com `reason` contendo `PR https://github.com/.../pull/N`
- [ ] o **PR rascunho existe no GitHub** (`gh pr view N --repo $HDD_REPO_SLUG`)
- [ ] verify rodou no sandbox: `WLOG` mostra `verify.concluido exit_code=0`
      (com `HDD_VERIFY_COMMAND=true`)

> Se o verify falhar por `docker`/socket → ver Troubleshooting.

---

## 5. Aprovar o gate → merge real

No painel, abra a fila de gates, confira o PR e **aprove**. (Ou via API:
`POST /api/gates/<gate_id>/approve` com o cookie.)

```bash
PG "select status from app.gates where wave_id='<WID>';"     # approved
PG "select state from app.waves where id='<WID>';"           # merged
gh pr view N --repo $HDD_REPO_SLUG --json state,merged        # merged:true
# Trilha de auditoria (decisão registrada, hash-chain):
PG "select type,actor from audit.events where correlation_id='<WID>' order by seq;"
```
- [ ] gate → `approved` · onda → `merged`
- [ ] **PR mergeado no GitHub** (squash, branch removida)
- [ ] audit tem `gate.approved` com o `actor` (login do operador)
- [ ] rejeição (num 2º teste) → onda `failed`, PR não mergeado

---

## 6. Quota e lease — sem vazamento

```bash
# Após a onda concluir, NENHUM lease deve restar:
PG "select count(*) from app.quota_lease;"                   # 0
# Item da fila terminal:
PG "select status from app.work_queue where id='<work>';"    # done
# Workspace efêmero removido:
ls -d /var/lib/hdd-workspaces/hdd-wave-<WID> 2>/dev/null      # (não existe)
```
Teto global: com `HDD_WORKER_REPLICAS>1`, dispare N>teto features e confirme que
nunca há mais leases que o teto, e que nenhum fica preso (reaper recupera).
- [ ] `quota_lease` volta a 0 · sem workspace órfão · item `done`

---

## 7. Observação do D-032 (conta de assinatura sob automação)

Durante uma sequência de ondas (deixe rodar várias), registre:
```bash
WLOG 1h | grep -iE "quota|limit|usage|overloaded|rate" || echo "sem marcadores de quota"
```
- [ ] anote: nº de ondas até (eventual) limite, tempo, mensagens da conta
- [ ] **Resultado D-032:** viável (segue no `subscription`) **ou** acionar troca
      para o driver `api` (RF-12) — registrar a decisão num ADR novo

---

## 8. Critérios de sucesso (resumo)

- [ ] feature disparada enfileira e o worker consome (claim SKIP LOCKED)
- [ ] onda: `planned → … → awaiting_gate` com PR rascunho real
- [ ] verify rodou **no sandbox** (isolado) a partir do worker
- [ ] aprovar no painel **mergeia o PR** e a onda vai a `merged`
- [ ] decisão auditada (hash-chain) · teto de quota respeitado · zero lease vazado
- [ ] D-032 observado e registrado

---

## 9. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `verify` falha: `docker: not found` ou `permission denied` no socket | CLI docker ausente ou `HDD_DOCKER_GID` errado | confirme o CLI na imagem worker; `HDD_DOCKER_GID = getent group docker` |
| `docker run` do verify monta `/workspace` vazio | `HDD_WORKSPACE_ROOT` não é caminho do host bind-montado no mesmo path | ver ADR 0004; use `/var/lib/hdd-workspaces` bind-montado idêntico |
| verify sempre reprova (exit≠0) | sandbox não tem o toolchain do alvo (ex.: `pytest`) | 1º smoke com `HDD_VERIFY_COMMAND=true`; depois estenda `sandbox/Dockerfile` |
| onda fica `planned`, sem PR | `HDD_REPO_URL` vazio → sem workspace (execute sem write, verify defere) | configure `HDD_REPO_URL`/`HDD_REPO_SLUG` |
| `gh pr merge` falha na aprovação | `GH_TOKEN` sem escopo ou `HDD_REPO_SLUG` errado na **api** | token com merge no repo; conferir env da api |
| gate não aparece no painel | bridge não abriu o gate / onda não chegou a `awaiting_gate` | `WLOG`; checar erro no execute/verify |
| lease preso após crash | worker morreu sem liberar | o reaper recupera por TTL (Story 5.2); confirme `quota_lease` esvazia |

---

## 10. Limpeza

```bash
# Workspaces órfãos (se algum ficou após crash):
rm -rf /var/lib/hdd-workspaces/hdd-wave-*
# Derrubar o stack (volumes/secrets ficam):
docker stack rm hdd
```
