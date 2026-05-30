# Runbook — Rollback manual (re-deploy de um commit estável)

Um deploy introduziu uma regressão. O deploy é **forward-only** (`[[ssh-deploy]]`,
1.c.5): o rollback é re-deployar o último commit bom via o mesmo canal SSH
restrito. Cada rollback fica auditado (`DeployCompleted` com o sha antigo).

## Sintoma

- Após `ssh hdd-worker@vps deploy <sha-mau>`, o worker falha / `/healthz` ≠ 200
  / comportamento regredido.
- `systemctl status hdd-worker` em falha ou restart loop.

## Diagnóstico

```bash
# último DeployCompleted (qual sha está em produção):
tail -n1 /opt/hdd/_bmad-output/audit/projeto_hdd/$(date -u +%F).jsonl
journalctl -u hdd-worker --since "10 min ago"    # erro do arranque
git -C /opt/hdd log --oneline -5                  # candidatos a sha estável
```
Identificar o **último sha bom** (CI verde / run estável anterior).

## Passos de Recuperação

1. Re-deployar o commit estável via o canal restrito (do cliente):
   ```bash
   ssh hdd-worker@vps deploy <sha-bom>
   ```
   O `deploy.sh` faz checkout + `bun build --compile` + restart + audita.
2. Se o `deploy.sh` em si estiver partido pela regressão, fazer manualmente na VPS:
   ```bash
   cd /opt/hdd && git checkout <sha-bom>
   bun build --compile src/cli/hdd-worker.ts --outfile dist/hdd-worker
   sudo systemctl restart hdd-worker
   bun run scripts/audit-deploy.ts <sha-bom>      # registar o rollback
   ```

## Verificação

```bash
systemctl status hdd-worker                       # active
curl -sf http://localhost:${PORT:-8080}/healthz   # 200 (ou via teste; ver nota)
tail -n1 /opt/hdd/_bmad-output/audit/projeto_hdd/$(date -u +%F).jsonl  # sha-bom
```

## Post-mortem

- **Timeline:** sha mau deployado → detecção → rollback.
- **Causa-raiz:** porque passou o CI mas falhou em produção? (gap de teste? env?)
- **Prevenção:** smoke pós-deploy automático; `release.yml` artifact por tag
  (`[[ssh-deploy]]`); reforçar o gate de CI que falhou em cobrir o caso.
