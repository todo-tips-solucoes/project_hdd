# Runbook — Incidentes & on-call (Story 6.4)

Diagnóstico e remediação dos modos de falha do HDD em produção. Os alertas
(`ops/prometheus/alerts.yml`) apontam para as seções abaixo.

## Ferramentas rápidas

```bash
PG() { docker exec "$(docker ps -qf name=hdd_postgres)" psql -U hdd -d hdd -tAc "$1"; }
docker service logs --since 15m hdd_worker   # loop, execute, verify
docker service logs --since 15m hdd_api      # gates, resume, merge
curl -s https://$HDD_DOMAIN/metrics | grep hdd_   # métricas atuais
```

## Quota exausta {#quota-exausta}

**Sinal:** `HddQuotaExausta` / `hdd_quota_acquisitions_total{result="no_quota"}` a subir.

**Diagnóstico:**
```bash
PG "SELECT count(*) AS leases_ativos FROM app.quota_lease;"
PG "SELECT max_concurrent FROM app.quota_counter WHERE id=1;"
docker service logs --since 15m hdd_worker | grep -i "quota\|limit\|usage"
```
- **Conta de assinatura esgotada (D-032):** logs do `claude` mostram limite. Ação:
  aguardar a janela renovar; se recorrente, avaliar troca para o driver `api`
  (RF-12) — é o gatilho do D-032.
- **Leases vazados** (slots ocupados por workers mortos): `leases_ativos` == teto
  mas nenhuma onda a correr. O reaper recupera por TTL; se não, ver abaixo.

## Lease preso / vazado {#lease-preso}

**Diagnóstico:**
```bash
PG "SELECT lease_id, worker_id, expires_at, expires_at < now() AS expirado
    FROM app.quota_lease ORDER BY expires_at;"
```
- Leases `expirado=true` deviam ter sido recuperados pelo reaper (Story 5.2). Se
  persistirem, reinicie o worker (o reaper roda no acquire):
  `docker service update --force hdd_worker`.
- **Último recurso** (libera o slot manualmente — confirme que o worker dono morreu):
  `PG "DELETE FROM app.quota_lease WHERE expires_at < now();"`

## Onda falhada {#onda-falhada}

**Sinal:** `HddOndasFalhando` / `hdd_wave_failures_total`.

**Diagnóstico:**
```bash
docker service logs --since 1h hdd_worker | grep "worker.onda_falhou"
PG "SELECT id,status FROM app.work_queue WHERE status='failed' ORDER BY created_at DESC LIMIT 10;"
```
Causas comuns: clone do repo falhou (token/URL), `claude` errou, verify quebrou
por falta de toolchain no sandbox (ver smoke-e2e.md). O item fica `failed` — não é
reentregue. Para reprocessar, reenfileire a feature (`hdd start`).

## Merge falhado {#merge-falhado}

**Sinal:** `HddMergeFalhando` / `hdd_merge_failures_total`. A onda foi a `merged`
mas o `gh pr merge` falhou (a decisão humana vale; o merge não aconteceu).

**Diagnóstico:**
```bash
PG "SELECT payload FROM audit.events WHERE type='error.raised' ORDER BY seq DESC LIMIT 5;"
```
Causas: PR com checks pendentes/conflito, branch protegida no GitHub, `GH_TOKEN`
sem permissão de merge. Ação: resolver no GitHub e mergear o PR manualmente
(`gh pr merge <n> --repo $HDD_REPO_SLUG --squash`).

## Backlog de gates {#backlog-de-gates}

**Sinal:** `HddBacklogDeGates` / `hdd_gate_backlog` alto.

```bash
PG "SELECT id,gate_type,reason,created_at FROM app.gates WHERE status='pending' ORDER BY created_at;"
```
Gates aguardam decisão humana no painel. Decida-os em `https://$HDD_DOMAIN/gates`.
Gates expiram por timeout (→ EXPIRED, nunca auto-aprovam) — a ação fica pendente.

## API fora do ar {#api-fora-do-ar}

```bash
docker service ps hdd_api          # estado das tarefas
docker service logs --since 10m hdd_api | tail -50
curl -s https://$HDD_DOMAIN/readyz  # readiness (DB)
```
Se `/readyz` = `db_unavailable`, ver Postgres (`docker service ps hdd_postgres`).
Migrations rodam no boot da api; falha de migration impede o start.

## Escalonamento

1. Mitigar (acima). 2. Se o D-032 disparar (quota recorrente), abrir ADR de troca
para o driver `api`. 3. Registrar o incidente (causa, ação, prevenção) — alimenta
a retrospectiva.
