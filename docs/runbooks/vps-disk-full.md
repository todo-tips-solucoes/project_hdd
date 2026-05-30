# Runbook — Disco da VPS cheio

State (`/opt/hdd/.hdd-state.db` + WAL), audit JSONL e logs crescem. Disco cheio
→ SQLite falha escritas, Litestream pára de replicar, worker degrada. Ver
`[[litestream-restore]]`.

## Sintoma

- Worker a falhar escritas / `SQLITE_FULL`; `/healthz` instável.
- `journalctl` com "No space left on device".
- Litestream a falhar uploads (sem espaço para snapshots locais).

## Diagnóstico

```bash
df -h /opt/hdd                                  # % usado da partição
du -sh /opt/hdd/.hdd-state.db* /opt/hdd/_bmad-output/audit/* 2>/dev/null | sort -h | tail
journalctl --disk-usage                          # logs do systemd
```
Identificar o maior consumidor: WAL gigante (checkpoint não corre?), audit antigo, logs.

## Passos de Recuperação

1. **Libertar espaço seguro primeiro** (logs, não dados):
   ```bash
   sudo journalctl --vacuum-size=200M
   ```
2. **Audit antigo** — comprimir (NUNCA apagar sem backup; é tamper-evident):
   ```bash
   gzip _bmad-output/audit/projeto_hdd/<datas-antigas>.jsonl   # mantém o .gz
   ```
   Confirmar que essas datas já estão replicadas no R2 (`[[litestream-restore]]`).
3. **Checkpoint do WAL** (reduz `.hdd-state.db-wal`): parar o worker e reabrir
   força checkpoint; ou `PRAGMA wal_checkpoint(TRUNCATE)` via sqlite3.
4. Confirmar que o Litestream voltou a replicar (tinha espaço para snapshot).

## Verificação

```bash
df -h /opt/hdd                                   # margem recuperada (>20% livre)
systemctl status hdd-worker hdd-worker.service   # active
bun run scripts/verify-audit-chain.ts $(date -u +%F)   # chain intacta
```

## Post-mortem

- **Timeline:** quando o disco encheu; o que cresceu mais depressa.
- **Causa-raiz:** WAL sem checkpoint? audit sem rotação? logs verbosos?
- **Prevenção:** alerta de disco a 80%; rotação/compressão de audit; retention
  local de WAL; dimensionar a partição.
