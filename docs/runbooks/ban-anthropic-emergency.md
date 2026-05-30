# Runbook — Ban / corte de emergência da Anthropic

Corte imediato do acesso ao LLM Anthropic — por suspeita de abuso de custo,
chave comprometida, ou ban do lado da Anthropic. Cost model: D-051 (API metered,
cap **$30/mês**, teto ~R$1150/mês) + D-050 (roteamento por fase). Ver
`[[secret-rotation]]`.

## Sintoma

- Custo a disparar / alerta de billing acima do cap $30/mês.
- Respostas LLM a falhar com 401/403 (chave revogada ou banida pela Anthropic).
- Suspeita de `ANTHROPIC_API_KEY` exposta.

## Diagnóstico

```bash
systemctl status hdd-worker            # worker a correr?
journalctl -u hdd-worker --since "1 hour ago" | grep -iE "anthropic|401|403|rate"
```
- 401/403 → chave inválida/revogada. Custo elevado → uso anómalo (loop?).

## Passos de Recuperação

1. **Parar o worker** (corta o consumo imediatamente):
   ```bash
   sudo systemctl stop hdd-worker
   ```
2. **Revogar** a `ANTHROPIC_API_KEY` no console Anthropic (não esperar).
3. Gerar nova chave; instalar via `[[secret-rotation]]` (`install-secrets.sh` + restart).
4. Se o problema for custo (não chave): investigar o loop/causa ANTES de re-arrancar.
5. **Kill-switch a nível de aplicação** `[quando implementado]` — feature-flag para
   desligar o LLM sem parar o worker; hoje o corte é `systemctl stop` + revogação.

## Verificação

```bash
systemctl status hdd-worker            # active após re-arranque controlado
journalctl -u hdd-worker --since "5 min ago" | grep -i anthropic   # sem 401/403
```
Billing no console Anthropic estabiliza; sem novas chamadas com a chave antiga.

## Post-mortem

- **Timeline:** quando começou o disparo de custo / o ban; quando se parou o worker.
- **Causa-raiz:** chave exposta? loop de retries? prompt sem cache (D-050)?
- **Prevenção:** alertas de billing < cap; rate-limit interno; rotação periódica
  da chave; (futuro) kill-switch por feature-flag.
