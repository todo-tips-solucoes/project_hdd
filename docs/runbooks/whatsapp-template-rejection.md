# Runbook — Rejeição de template WhatsApp

Fora da janela de 24h da Meta, só se pode iniciar conversa com **templates
pré-aprovados** (`[[project-hdd-whatsapp-api]]`: Meta Cloud API oficial, via
clihelper outbound). A Meta pode **rejeitar** um template (submissão ou em uso).
⚠️ **`[quando implementado]`** — a integração WhatsApp é de um Epic posterior;
abaixo o procedimento conceptual + o que já se sabe da arquitectura.

## Sintoma

- Mensagem template não entregue; Meta devolve erro de template
  (rejected / paused / disabled).
- Submissão de novo template recusada (categoria errada, conteúdo, formatação).
- Operador não consegue iniciar conversa fora da janela 24h.

## Diagnóstico

```bash
journalctl -u hdd-worker --since "1 hour ago" | grep -iE "template|whatsapp|rejected|paused"
```
- Distinguir: template **rejeitado na aprovação** vs **pausado em uso**
  (qualidade baixa / marcado como spam pelos destinatários).
- `[quando implementado]` — confirmar o código de erro exacto da Meta via clihelper.

## Passos de Recuperação

1. Ler o motivo da rejeição no painel da Meta / resposta da API (categoria,
   variáveis, conteúdo promocional fora de categoria).
2. Corrigir e **re-submeter** o template (categoria correcta, sem placeholders
   inválidos).
3. Enquanto não aprovado: responder **apenas dentro da janela de 24h** (mensagens
   livres) — adiar o que exige template.
4. Se um template foi **pausado por qualidade**: rever o conteúdo/segmentação que
   gerou reports; submeter versão revista.
5. Manter um template de fallback genérico já aprovado para continuidade.

## Verificação

- Template aparece **Approved** no painel da Meta.
- Envio de teste com o template entregue ao destinatário.
- `journalctl` sem erros de template após o reenvio.

## Post-mortem

- **Timeline:** submissão/uso → rejeição/pausa → correcção → aprovação.
- **Causa-raiz:** categoria errada? conteúdo promocional? qualidade/reports?
- **Prevenção:** templates pré-aprovados de reserva; respeitar categorias da Meta;
  monitorizar a qualidade dos templates em uso; nunca depender de um só template.
