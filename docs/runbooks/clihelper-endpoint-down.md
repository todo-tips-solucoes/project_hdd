# Runbook — clihelper endpoint em baixo

O HDD envia mensagens outbound via o app proprietário do operador
(`clihelper.chatmasterveloz.com`), camada sobre a Meta Cloud API, rate-limit
**1 req/s** (`[[project-hdd-clihelper-integration]]`). O inbound chega por um
agregador n8n separado (`[[project-hdd-n8n-topology]]`). Este runbook cobre o
**outbound em baixo**. ⚠️ **`[quando implementado]`** — o cliente clihelper é
Epic 3; abaixo está o procedimento conceptual + o que já se sabe.

## Sintoma

- Mensagens de saída não chegam ao WhatsApp; respostas do operador silenciadas.
- Erros de rede/5xx/timeout do HDD ao chamar o endpoint clihelper.
- `[quando implementado]` métricas/logs do cliente outbound a marcar falha.

## Diagnóstico

```bash
# Conectividade básica ao endpoint (sem curl inline — usar do shell do operador):
#   verificar DNS + TLS + resposta do health do clihelper
journalctl -u hdd-worker --since "15 min ago" | grep -iE "clihelper|outbound|429|5[0-9][0-9]"
```
- 429 → rate-limit (HDD deve respeitar 1 req/s; ver se há burst).
- 5xx/timeout/DNS → endpoint em baixo ou rede.

## Passos de Recuperação

1. Confirmar se é o clihelper (app do operador) ou a Meta a montante — testar o
   health do clihelper directamente.
2. Se clihelper down: o HDD deve **degradar graciosamente** — não perder eventos
   inbound (n8n é o trust boundary upstream; continua a receber); enfileirar/adiar
   outbound. `[quando implementado]` — confirmar a estratégia de retry/backoff.
3. Quando o endpoint voltar: drenar a fila de outbound respeitando 1 req/s.
4. Janela de 24h da Meta: mensagens fora da janela exigem template aprovado
   (`[[whatsapp-template-rejection]]`).

## Verificação

```bash
journalctl -u hdd-worker --since "5 min ago" | grep -i clihelper   # sem erros
```
Uma mensagem de teste outbound chega ao WhatsApp; backlog drenado.

## Post-mortem

- **Timeline:** início da falha → detecção → recuperação do endpoint.
- **Causa-raiz:** clihelper down? Meta a montante? rate-limit excedido pelo HDD?
- **Prevenção:** health-check do clihelper; backoff + fila persistente de outbound;
  alerta quando o outbound falha N vezes.
