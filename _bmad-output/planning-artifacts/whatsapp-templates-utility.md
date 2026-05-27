---
title: "Templates WhatsApp UTILITY — HDD (para criar no clihelper)"
project: projeto_hdd
date: 2026-05-20
category: UTILITY
language: pt_BR
status: draft (aguarda revisão do operador antes de submeter à Meta)
endpoint_send_no_vars: "https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template-sem-variavel/"
endpoint_send_with_vars: "https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template/"
---

# Templates WhatsApp do HDD — Categoria UTILITY

> **Categoria UTILITY** é a mais barata da Meta (vs MARKETING) e adequada porque todas estas mensagens são **notificações de serviço** do próprio pipeline ao seu operador — não promoção. Meta tipicamente aprova UTILITY em 1-3 dias.
>
> **Procedimento:** o operador `operador` cria estes 6 templates na UI do clihelper, copiando o body abaixo e configurando os botões. Após aprovação da Meta, o HDD passa a invocá-los via `/api-oficial-mensagem-template/` com os parâmetros indicados.
>
> **Convenção:** cada `{{N}}` é uma variável posicional. Buttons são Quick Reply com `payload` (string que volta no webhook).

---

## 1. `hdd_interrupt_p1` — Gap PRD/Arq ↔ Código detectado

**Header (texto, fixo):** `🛑 HDD pausado — gap encontrado`

**Body:**
```
*Story:* {{1}}
*Gap:* {{2}}

O worker está parado. Preciso da tua decisão para continuar.

*Contexto:* {{3}}

Responde livremente ou usa um botão abaixo.
```

**Footer:** `HDD · {{4}}`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | Continuar assim | `p1_continuar_assim` |
| 1 | Mudar rumo | `p1_mudar_rumo` |
| 2 | Ver detalhes | `p1_ver_detalhes` |

**Variáveis (sample para aprovação Meta):**
- `{{1}}` = `story-007 (auth flow OAuth2)`
- `{{2}}` = `PRD não especifica se OAuth2 aceita só Google ou também GitHub`
- `{{3}}` = `src/auth/oauth.ts:42 — função getProviders()`
- `{{4}}` = `run-abc123`

---

## 2. `hdd_interrupt_s1` — Watchdog timeout

**Header:** `⏰ HDD parado — sem progresso há {{1}}min`

**Body:**
```
A story *{{2}}* não tem progresso detectável.

*Última actividade:* {{3}}
*Fase actual:* {{4}}

Pode estar travado. Como queres prosseguir?
```

**Footer:** `HDD · {{5}}`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | Aguardar mais | `s1_aguardar_mais` |
| 1 | Forçar retomar | `s1_forcar_retomar` |
| 2 | Cancelar story | `s1_cancelar_story` |

**Sample:**
- `{{1}}` = `30`
- `{{2}}` = `story-012 (database migration)`
- `{{3}}` = `15:42 — sub-agente Dev em chamada Anthropic`
- `{{4}}` = `dev → review (transição)`
- `{{5}}` = `run-abc123`

---

## 3. `hdd_interrupt_s2` — Falha reincidente

**Header:** `🔁 HDD com falhas — story {{1}}`

**Body:**
```
A story falhou {{2}} vezes consecutivas no mesmo passo.

*Erro:* {{3}}
*Local:* {{4}}
*Última tentativa:* {{5}}

Diff completo: {{6}}
```

**Footer:** `HDD · {{7}}`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | Tentar mais 1x | `s2_tentar_novamente` |
| 1 | Pular story | `s2_pular_story` |
| 2 | Intervir manual | `s2_intervir_manual` |

**Sample:**
- `{{1}}` = `story-017`
- `{{2}}` = `5`
- `{{3}}` = `Cannot find module 'jsonwebtoken'`
- `{{4}}` = `src/auth/oauth.ts:8`
- `{{5}}` = `16:03 — npm install retornou exit code 1`
- `{{6}}` = `https://hdd.local/runs/abc123/stories/017/diff`
- `{{7}}` = `run-abc123`

---

## 4. `hdd_summary_finalization` — Resumo de Finalização Tier-A

**Header:** `{{1}} Finalização pronta — {{2}}`

**Body:**
```
*{{3}}* · {{4}} · {{5}}

{{6}}

*Decisões:*
• {{7}}
• {{8}}
• {{9}}

*Estado:* {{10}} · *Open items:* {{11}} · *Janela:* {{12}}%

Ver Tier-B: {{13}}
```

**Footer:** `HDD`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | ✅ Aprovar | `fin_aprovar` |
| 1 | ⚠️ Rever | `fin_rever` |
| 2 | 🛑 Bloquear | `fin_bloquear` |

**Sample:**
- `{{1}}` = `⚠️`
- `{{2}}` = `bmad-create-architecture`
- `{{3}}` = `projeto_hdd`
- `{{4}}` = `2026-05-20`
- `{{5}}` = `1h23m`
- `{{6}}` = `Arquitetura HDD desenhada com 46 obligações, 6 templates WhatsApp, schema SQLite com 9 tabelas, Litestream backup.`
- `{{7}}` = `Worker em Node (não Python) — ecosistema BMAD_Openclaw`
- `{{8}}` = `State store SQLite com WAL desde dia 1`
- `{{9}}` = `Backup Litestream primário + rclone secundário`
- `{{10}}` = `ready-with-flags`
- `{{11}}` = `3`
- `{{12}}` = `15`
- `{{13}}` = `https://hdd.local/runs/abc123/summary-tier-b`

**Limite de caracteres:** corpo Meta = 1024 chars. Com 13 variáveis a este tamanho, manter cada uma ≤ 80 chars para garantir 7-9 decisões cabem.

---

## 5. `hdd_heartbeat` — Heartbeat proactivo (FR-085 / AO-20)

**Header:** `💓 HDD activo — {{1}}`

**Body:**
```
*Pipeline:* {{2}} em curso
*Story actual:* {{3}}
*Progresso:* {{4}}% da sprint · {{5}} stories concluídas
*Janela LLM:* {{6}}% usada

Próximo heartbeat em {{7}}h.
```

**Footer:** `HDD · {{8}}`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | OK, continuar | `hb_ok` |
| 1 | Pausar | `hb_pausar` |
| 2 | Snooze 2h | `hb_snooze_2h` |

**Sample:**
- `{{1}}` = `RUNNING`
- `{{2}}` = `epic-2 (auth + onboarding)`
- `{{3}}` = `story-014 (signup form validation)`
- `{{4}}` = `42`
- `{{5}}` = `5`
- `{{6}}` = `38`
- `{{7}}` = `8`
- `{{8}}` = `run-abc123 @ 2026-05-20T15:30:00Z`

> **Nota UX (AO-33):** heartbeat respeita `do_not_disturb_start/end` (default 23h-8h). Fora desse horário, mensagens acumulam e enviam-se às 8h com sumário.

---

## 6. `hdd_release_final` — Release final (F-RELEASE)

**Header:** `🚢 HDD release pronto — {{1}}`

**Body:**
```
Pipeline concluído para *{{2}}*.

*Stories:* {{3}}
*PRs abertos:* {{4}}
*Janela total usada:* {{5}}%
*Duração total:* {{6}}

Link de revisão: {{7}}
```

**Footer:** `HDD · run {{8}}`

**Quick Reply buttons:**
| Index | Label | Payload |
|---|---|---|
| 0 | ✅ Aprovar release | `rel_aprovar` |
| 1 | Pedir alterações | `rel_alteracoes` |
| 2 | 🛑 Bloquear | `rel_bloquear` |

**Sample:**
- `{{1}}` = `v0.1.0-pilot`
- `{{2}}` = `projeto_hdd MVP`
- `{{3}}` = `18 / 18`
- `{{4}}` = `5`
- `{{5}}` = `73`
- `{{6}}` = `4 dias úteis`
- `{{7}}` = `https://github.com/<owner>/projeto_hdd/releases/tag/v0.1.0-pilot`
- `{{8}}` = `run-abc123`

---

## Payload exemplo para `hdd_interrupt_p1` (chamada ao endpoint)

Para enviar via `POST https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template/`:

```json
{
  "number": "55XXXXXXXXXXX",
  "name": "hdd_interrupt_p1",
  "language": "pt_BR",
  "openTicket": 1,
  "queueId": 100,
  "template": [
    {
      "type": "header",
      "parameters": [
        {"type": "text", "text": "🛑 HDD pausado — gap encontrado"}
      ]
    },
    {
      "type": "body",
      "parameters": [
        {"type": "text", "text": "story-007 (auth flow OAuth2)"},
        {"type": "text", "text": "PRD não especifica se OAuth2 aceita só Google ou também GitHub"},
        {"type": "text", "text": "src/auth/oauth.ts:42 — função getProviders()"},
        {"type": "text", "text": "run-abc123"}
      ]
    },
    {
      "type": "button",
      "sub_type": "quick_reply",
      "index": "0",
      "parameters": [{"type": "payload", "payload": "p1_continuar_assim"}]
    },
    {
      "type": "button",
      "sub_type": "quick_reply",
      "index": "1",
      "parameters": [{"type": "payload", "payload": "p1_mudar_rumo"}]
    },
    {
      "type": "button",
      "sub_type": "quick_reply",
      "index": "2",
      "parameters": [{"type": "payload", "payload": "p1_ver_detalhes"}]
    }
  ]
}
```

**Header:** `Authorization: <token-do-clihelper>` (formato exacto a confirmar com operador).

---

## Recomendações para a aprovação Meta

1. **Submeter na categoria UTILITY** (não MARKETING) — todas estas mensagens são notificações de serviço sobre o estado do próprio pipeline do operador. Encaixa perfeitamente na definição UTILITY da Meta ("account updates, alerts, status changes").
2. **Sample values devem ser realistas** — Meta rejeita templates com placeholders óbvios como `XXXX` ou `TESTE`.
3. **Submeter em batch de 2-3 templates** — não os 6 ao mesmo tempo, para acelerar análise.
4. **Ordem de prioridade** para começar a usar:
   - **M1 mínimo viável (3 templates):** `hdd_interrupt_p1` (mais importante), `hdd_summary_finalization`, `hdd_heartbeat`
   - **Antes do release final:** `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_release_final`
5. **Quality rating:** começar com volume conservador (≤ 20 mensagens/dia nos primeiros 7 dias) para não disparar low quality flag.

---

## Próximos passos

1. **Operador (`operador`):** rever este artefacto; ajustar copy/buttons conforme preferência; criar os templates no clihelper.
2. **HDD (próximos workflows):** implementar adapter HTTP com queue leaky-bucket (1 req/s, AO-45), Authorization header (AO-11'), retry com backoff, audit JSONL de cada envio.
3. **Webhook inbound:** operador partilha estrutura JSON; HDD implementa listener com parser NLP para texto livre + parser de Quick Reply payloads (`p1_continuar_assim`, etc.).
