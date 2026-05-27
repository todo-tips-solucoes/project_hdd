---
title: Addendum técnico — Pipeline Autônomo BMAD + WhatsApp
status: draft
created: 2026-05-20
updated: 2026-05-20
parent: brief.md
purpose: Captura conteúdo que pertence a PRD/Arquitetura downstream, não ao brief estratégico.
---

# Addendum — Detalhes técnicos para PRD/Arquitetura

Conteúdo que operador trouxe durante a Discovery e que pertence a documentos downstream (PRD, Arquitetura, Sprint Planning), não ao brief de 1-2 páginas. Os agentes BMAD subsequentes (`bmad-prd`, `bmad-create-architecture`) devem ler este addendum.

---

## 1. Stack WhatsApp do usuário

| Item | Valor |
|---|---|
| **Provedor** | Sistema proprietário do operador (não Z-API, não Evolution API, não Twilio, não Cloud API oficial) |
| **Bidirecionalidade** | Confirmada (envia E recebe) |
| **Hosting** | VPS própria do operador |
| **Status do número** | Aprovado e operacional hoje |
| **Modo de envio** | Texto livre (presume-se que não há lock-in de templates aprovados, como ocorre na Cloud API oficial) |
| **Modo de recebimento** | Webhook HTTP — endpoint a ser exposto pelo worker OpenClaw |

**Implicação arquitetural:** o brief assume controle total da stack WhatsApp. Sem rate limits documentados de provedor terceiro, sem expiração de sessão imprevisível, sem template approval flow. operador controla a confiabilidade do canal.

> Para risco de banimento por uso de protocolo não-oficial, ver **§6 Riscos operacionais** — tratado lá de forma consolidada com mitigação e decisão pendente.

## 2. Regra de Interrupt — formalização

### 2.1 Trigger primário (única regra automatizada no v1)

O agente Reviewer (`bmad-code-review`) ou QA (`bmad-testarch-test-review`) detecta que, para avançar a story atual, precisa tomar uma **decisão de produto ou arquitetura** que não está coberta pelos artefatos canônicos:

- `_bmad-output/planning-artifacts/<projeto>/prd.md`
- `_bmad-output/planning-artifacts/<projeto>/architecture.md`
- `_bmad-output/planning-artifacts/<projeto>/addendum.md`
- `_bmad-output/planning-artifacts/<projeto>/decision-log.md`

**Heurística de detecção** — `[A definir em bmad-create-architecture. Três opções candidatas:]`

- **Opção A:** prompt explícito ao agente Reviewer — *"esta decisão está coberta pelos artefatos referenciados? Cite a linha. Se não, escreva 'INTERRUPT_GAP' como primeira linha da response."*
- **Opção B:** análise semântica (RAG) sobre os artefatos antes de qualquer decisão de implementação.
- **Opção C:** gate manual no agente Dev — antes de codar, declara intenções; se intenção sai do PRD, dispara.

Critério de decisão sugerido: precisão (falsos positivos/negativos) × custo de tokens × latência. Avaliar empiricamente no projeto-piloto.

### 2.2 Gatilhos secundários (declarados aqui, formalização em arquitetura)

| Gatilho | Comportamento |
|---|---|
| Falhas de teste reincidentes | Após 5 tentativas sem progresso da mesma falha, interrupt. |
| API externa indisponível ≥ 30 min | Worker pausa; interrupt opcional (operador configura). |
| Custo estimado de uma decisão de stack > R$ X/mês | Interrupt. X a definir. |
| Conflito direto entre arquivos canônicos | Interrupt obrigatório. |
| Worker sem progresso > Y minutos | Watchdog dispara interrupt. Y a definir. |

operador confirmou ("tudo que falou faz sentido"); o foco principal permanece o trigger primário (gap PRD vs. code).

## 3. Arquitetura proposta do worker autônomo

> Esboço — refinar em `bmad-create-architecture`.

### 3.1 Componentes

- **Worker** rodando em VPS própria (Node ou Python — escolha em arquitetura). Executa loop de stories.
- **State store:** Redis ou SQLite local para `current_story_id`, `story_status`, `paused_for_interrupt`, `last_interrupt_at`.
- **Logger:** arquivo estruturado JSONL para audit trail (cada decisão do agente, cada interrupt, cada resposta).
- **WhatsApp adapter:** módulo que fala com o sistema proprietário do operador (REST API interna a documentar).
- **Webhook listener:** endpoint HTTP que recebe mensagens entrantes do WhatsApp e injeta no contexto do agente.
- **BMAD invoker:** dispara skills BMAD via API local (**a definir** se o BMAD instalado permite invocação programática ou se requer um CLI-wrapper).

### 3.2 Fluxo do interrupt (sequence)

```
worker → BMAD code-review skill → detecta gap
worker → state store: paused_for_interrupt=true, save context
worker → WhatsApp adapter: envia mensagem ao operador
            "Story #42 (auth flow): code-review detectou ambiguidade.
             PRD não especifica se OAuth2 deve aceitar Google + GitHub
             ou só Google. Como prosseguir?"
[operador lê no celular, responde]
operador → "Só Google. Adicione GitHub no addendum como roadmap pós-MVP."
WhatsApp → webhook listener
webhook → state store: pop pending interrupt, inject response
worker → BMAD skill: aplica decisão, atualiza addendum.md, retoma story
worker → continua execução
```

### 3.3 Falhas a considerar

| Falha | Comportamento proposto | Decisão pendente |
|---|---|---|
| WhatsApp down ou banido | Após 3 falhas em 10 min, fallback automático para e-mail (S3 do brief). Worker NÃO para. | Provedor de e-mail a definir em arquitetura. |
| operador não responde em N horas | Worker continua tentativas em backoff exponencial; após T horas, pausa story e escala próxima. | N e T a definir. |
| Resposta ambígua do usuário | Agente responde com clarificação via WhatsApp (mensagem follow-up: *"não entendi X, pode esclarecer?"*). | Limite de rounds de clarificação a definir. |

## 4. Integração BMAD ↔ Worker

### 4.1 Modo de invocação dos skills BMAD

**Decisão tomada:** modo **híbrido** (Opção C do menu de runtime).

- Claude Code interativo nas Fases 1-2 do BMAD.
- Worker OpenClaw nas Fases 3-4, com plugin `ErwanLorteau/BMAD_Openclaw` instalado.
- Implica manter BMAD nativo no Claude Code local + instalar plugin no worker.

> Opções A (Claude Code headless via subprocesso) e B (Claude API direto + prompt manual) foram consideradas e descartadas. Rationale: Opção C é a mais alinhada com o `.docx` original e oferece sessões persistentes nativas — atributo essencial para pipeline autônomo de longa duração.

### 4.2 Sincronização de artefatos

- Workspace canônico: `/var/lib/projeto_hdd/_bmad-output/` no ambiente local de operador.
- Worker em VPS própria precisa de cópia sincronizada — Git? rsync? Volume montado? Decisão em arquitetura.
- Após o worker autônomo terminar, sync de volta para local antes da retrospectiva.

## 5. Tópicos para `bmad-prd`

Quando operador for rodar `bmad-prd` para o projeto-piloto, este addendum sinaliza requisitos não-funcionais que entram no PRD:

- **RNF-1:** O pipeline deve operar sem necessidade de supervisão humana contínua durante Fases 3-4.
- **RNF-2:** O canal WhatsApp deve garantir entrega de interrupt em < 30s (SLA do sistema próprio).
- **RNF-3:** O worker deve manter audit trail de todas as decisões e interrupts.
- **RNF-4:** O tempo total de Fases 3-4 para um MVP típico deve ser < 5 dias úteis (alinhado a M3 do brief).
- **RNF-5:** O sistema deve preservar consistência entre código produzido e artefatos canônicos (PRD/Arquitetura) — qualquer divergência dispara interrupt.
- **RNF-6:** Idempotência por story. Em caso de crash, o worker retoma do último checkpoint persistido (não do começo, nem do meio sem state). Implementação concreta — Redis vs. SQLite vs. JSONL — a definir em `bmad-create-architecture`.
- **RNF-7:** SLO de canal WhatsApp ≤ 30s. Após 3 falhas consecutivas em 10 min, fallback automático para e-mail (não-bloqueante: pipeline segue). Métrica observável via log do adapter.

## 6. Riscos operacionais identificados

| Risco | Mitigação proposta | Decisão pendente |
|---|---|---|
| Sistema WhatsApp não-oficial banido pela Meta (Baileys, whatsapp-web.js e similares não oficiais) | Fallback automático para e-mail no v1 (S3 do brief); Telegram considerado para a v1.1 | operador decide se aceita risco residual no v1 |
| Worker fica empacado às 3 h da manhã sem trigger primário disparar | Watchdog timeout (gatilho secundário S1) | Definir Y em arquitetura |
| operador responde algo no WhatsApp que invalida stories já feitas | Política de rollback parcial | Estratégia em arquitetura |
| BMAD upstream lança breaking change | Pin de versão; atualizar release no ciclo de retrospectiva | Operacional, não bloqueador |
| Acúmulo de interrupts não resolvidos | Métrica visível: "interrupts pendentes" no log | Adicionar aos critérios de sucesso do M1 |
