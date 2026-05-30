# Runbooks — índice

Incident response e operações do HDD. A tese (lição `feedback-hdd-soft-convention-rot`):
**o incident response não pode depender da memória de um único humano**. Cada
runbook é curto e accionável; os 8 must-have têm 5 secções fixas
(Sintoma · Diagnóstico · Passos de Recuperação · Verificação · Post-mortem),
validadas por `scripts/runbook-completeness.sh` (gate anti-rot — corre no CI/local).

## Incident-response (8 must-have — AR-110 / D-04.24)

| Runbook | Quando usar |
|---|---|
| [secret-rotation](secret-rotation.md) | rodar/instalar secrets; chave comprometida |
| [ban-anthropic-emergency](ban-anthropic-emergency.md) | corte de custo/acesso Anthropic; chave abusada |
| [litestream-restore](litestream-restore.md) | restaurar state+audit após perda de disco/VPS |
| [hash-chain-corruption](hash-chain-corruption.md) | `verifyChain` falha; audit adulterada |
| [whatsapp-template-rejection](whatsapp-template-rejection.md) | Meta rejeita/pausa template *(Epic WhatsApp)* |
| [clihelper-endpoint-down](clihelper-endpoint-down.md) | outbound clihelper em baixo *(Epic 3)* |
| [vps-disk-full](vps-disk-full.md) | disco cheio; SQLITE_FULL; Litestream parado |
| [manual-rollback](manual-rollback.md) | reverter um deploy mau (re-deploy de sha estável) |

## Operacional / how-to (fora do gate das 5 secções)

| Runbook | Quando usar |
|---|---|
| [ssh-deploy](ssh-deploy.md) | configurar/usar o deploy SSH restrito (1.c.5) |
| [systemd-deploy](systemd-deploy.md) | instalar/gerir a unit systemd do worker (1.c.1) |

## Validar completude

```bash
bash scripts/runbook-completeness.sh    # 8/8 com 5/5 secções → exit 0
```
