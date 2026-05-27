---
title: Pipeline Autônomo Assíncrono de Desenvolvimento de Produto com BMAD + WhatsApp Interrupt
status: draft
created: 2026-05-20
updated: 2026-05-20
author: operador
project: projeto_hdd
fork: a (BMAD como ferramenta interna para construir outros produtos)
runtime_mode: c (híbrido — Claude Code interativo + OpenClaw worker autônomo)
---

# Brief: Pipeline Autônomo Assíncrono de Desenvolvimento de Produto

## Executive Summary

operador opera como solo founder/desenvolvedor com múltiplos projetos potenciais. Hoje, o ciclo de discovery + PRD é prazeroso; a **execução pós-escopo definido** (codificar, testar, revisar, integrar) é o gargalo — consome semanas que ele preferia gastar em discovery do próximo produto.

Este projeto entrega um **pipeline operacional bimodal** apoiado em BMAD:

- **Modo Colaborativo** (Fases 1-2 do BMAD — Análise + Planejamento): operador + agentes BMAD trabalham juntos no Claude Code interativo. Aqui se define produto, PRD, arquitetura, épicos. **Sempre humano-no-loop.**
- **Modo Autônomo** (Fases 3-4 do BMAD — Solução + Implementação): um worker OpenClaw assume após o Implementation Readiness Check. Os agentes Dev, Reviewer e QA executam as stories sequencialmente, com gates de qualidade entre handoffs, **sem supervisão contínua**.

A ponte entre os dois modos é um **canal de interrupt WhatsApp bidirecional**, rodando em sistema e VPS próprios do usuário. **Critério único e restrito:** 1 trigger primário (gap entre código e PRD/arquitetura) + 3 watchdogs declarados — detalhes em *The Solution > Regra de Interrupt*.

A entrega é o ambiente rodando — não um produto vendável. O primeiro projeto-piloto sai dele em até 1 mês.

## The Problem

**Para operador, operando solo:**

1. Tempo de execução pós-PRD é o maior incômodo. Discovery e Planning consomem ~20% do calendário; implementação consome 60-80%.
2. Mecanismos atuais de delegação (freelancers, agências) introduzem latência, retrabalho e custo desproporcional para projetos solo/MVP.
3. Ferramentas de IA contemporâneas (Cursor, Copilot, Claude Code interativo) aceleram tarefas isoladas, mas exigem supervisão constante. operador continua assistindo o agente trabalhar — quebra de foco.
4. Sem disciplina de qualidade entre fases, velocidade vira sujeira: PRD diz X, agente Dev implementa Y, e o erro só aparece em produção.

**O que operador NÃO quer resolver com este projeto:**

- Disciplina de discovery/validação (já funciona; o pre-mortem do facilitador foi exagero).
- Construção de framework próprio (BMAD é suficiente).
- Suporte a equipe (solo permanece solo nesta v1).

## The Solution

### Componentes

1. **Pipeline BMAD em dois modos.**
   - Colaborativo: operador dirige `bmad-product-brief`, `bmad-prd`, `bmad-create-architecture`, `bmad-create-epics-and-stories`, `bmad-check-implementation-readiness` no Claude Code.
   - Autônomo: passado o Implementation Readiness Check, o controle vai para um worker OpenClaw em VPS própria que executa `bmad-sprint-planning`, `bmad-dev-story`, `bmad-code-review`, `bmad-testarch-*` em loop, story por story.

2. **Canal de Interrupt WhatsApp.**
   - Stack: sistema proprietário, VPS própria, bidirecional, número aprovado e ativo.
   - Padrão: agente → mensagem ao operador → operador responde texto livre → webhook listener traduz → agente retoma.
   - Detalhe técnico no `addendum.md`.

3. **Regra de Interrupt** (1 trigger primário + 3 watchdogs, todos no v1):

   | # | Trigger | Condição | Ação |
   |---|---|---|---|
   | **P1** | Gap PRD/Arq ↔ Código | Reviewer/QA precisa de decisão de produto ou arquitetura que **não** consta nos artefatos canônicos | Pausa worker → WhatsApp |
   | **S1** | Watchdog timeout | Sem progresso detectável > 30 min (default configurável) | Pausa worker → WhatsApp "pode estar travado em [story X]" |
   | **S2** | Falha reincidente | 5 tentativas consecutivas sem progresso na mesma falha (teste ou execução) | Pausa worker → WhatsApp |
   | **S3** | Canal indisponível | 3 mensagens consecutivas em 10 min sem confirmação no WhatsApp | **Fallback automático para e-mail** (pipeline NÃO para — muda canal e segue) |

   Outros gatilhos (custo estimado de stack, conflito entre artefatos canônicos) ficam para a v1.1 — formalizados no `addendum.md`.

4. **Gates de Qualidade nos Handoffs.**
   - PRD → Arquitetura: `bmad-check-implementation-readiness` precisa fechar antes de modo autônomo iniciar.
   - Story → Dev: checklist de critérios de aceitação completo.
   - Dev → Review: testes verdes na story.
   - Review → QA: PRD/arquitetura consistentes com implementação (sai para interrupt se não).

### Fluxo end-to-end de um projeto-piloto

**Fases 1-2 (Modo Colaborativo):** operador + Claude Code rodam Brief → PRD → Architecture → Epics → Implementation Readiness Check.

**Fases 3-4 (Modo Autônomo):**

1. operador dispara o worker autônomo (script no VPS).
2. Worker executa Story 1: `bmad-dev-story` → `bmad-code-review` → `bmad-testarch-*` → próxima story.
3. Em algum momento, Reviewer levanta gap. WhatsApp dispara. operador responde *"use Postgres com TimescaleDB; escalabilidade no PRD assume séries temporais"*. Worker integra resposta no addendum do PRD, atualiza arquitetura, continua.
4. Última story fecha. Worker entrega PR ou deploy. WhatsApp final: *"pronto, revise aqui."*

## What Makes This Different

A maioria das discussões sobre "agentes autônomos" oscila entre dois extremos: **autonomia total** (e os agentes acabam construindo coisas que ninguém pediu) ou **supervisão total** (e o desenvolvedor fica colado na cadeira, anulando o ganho de IA).

Este pipeline corta o meio com **três princípios não-negociáveis**:

1. **Produto e arquitetura são SEMPRE colaborativos.** operador não cede essas decisões aos agentes. O modo autônomo só toca *execução* dentro de fronteiras já desenhadas.
2. **Critério de interrupt explícito e auditável.** Não é uma lista emergente e heurística de 20+ gatilhos: é **1 trigger primário + 3 watchdogs declarados no v1**. Fácil de implementar no `bmad-code-review`, fácil de revisar quando o pipeline falhar.
3. **Canal de interrupt é onde o usuário REALMENTE responde rápido.** WhatsApp, não Slack ou e-mail; stack já existente, sem nova ferramenta.

Não é produto vendável. É **infraestrutura pessoal**. Isso é deliberado (fork b foi explicitamente descartado — rationale em `.decision-log.md`).

## Who This Serves

**Primário:** operador — solo founder/desenvolvedor com tese multi-produto, nível intermediário em BMAD, full-stack, com VPS própria e stack WhatsApp própria já operacional.

**Secundário (não modelado nesta v1):** eventual 1 colaborador no futuro. Implicação: arquitetura do worker e da regra de interrupt deve tolerar adicionar um segundo destino de WhatsApp sem refatoração.

**Quem este projeto NÃO serve:** times >2 pessoas, organizações com compliance/aprovações formais, founders que delegam discovery a agentes.

## Pré-requisitos

Capacidades já em mão antes do start (validadas durante a Discovery):

- **BMAD instalado** em `/var/lib/projeto_hdd/_bmad` (v6.7.1, manifest em `_bmad/_config/manifest.yaml`).
- **Claude Code** com modelo de janela longa (Opus 4.7, 1M tokens) — viabiliza sessões interativas profundas nas Fases 1-2.
- **VPS própria** do operador — hospedará o worker OpenClaw e o webhook listener.
- **Número WhatsApp aprovado** no sistema próprio do operador, bidirecional, operacional hoje.
- **Conta de e-mail SMTP ou serviço transacional** (Resend / Postmark / SES) — pré-requisito do fallback S3. Provedor a decidir em arquitetura.
- **Plugin `BMAD_Openclaw`** a ser instalado no worker — único componente ainda não presente no v0.

## Success Criteria

| Marco | Quando | Métrica |
|---|---|---|
| **M0 — Baseline** | Semana 0 (antes do start) | Registrar tempo das Fases 3-4 do último MVP manual.¹ ⚠️ **Pendente:** `[BASELINE = ? dias úteis]`. |
| **M1 — Pipeline end-to-end** | 1 mês após start | Um projeto-piloto rodou do Brief ao código deployado. ≥ 3 interrupts WhatsApp resolvidos com sucesso (mensagem → resposta → agente retomou). ≥ 1 fallback de canal (WhatsApp→e-mail) testado em ambiente controlado. |
| **M3 — Tempo de execução** | 3 meses | Tempo total das Fases 3-4 **≥ 4× mais rápido que o baseline M0**. Em ausência de baseline registrado, M3 funciona como referência para M6 (não como meta absoluta). |
| **M6 — Repetibilidade** | 6 meses | Segundo produto saiu pelo pipeline sem retrabalho do processo. Tempo de execução **medido contra M3** (não regressão). Marco de **revisão consciente do descarte de fork b** — ver `.decision-log.md`. |
| **Q4-2026 — Sustentabilidade** | 7 meses | Pelo menos 1 produto vivo em produção (com user real, não fictício). Retrospectiva **por projeto** (não trimestral) documentada em 1 página, com aprendizados aplicados ao pipeline. |

> ¹ Se operador não tiver registro disponível, o primeiro projeto-piloto pelo pipeline define o baseline, e M3/M6 viram metas para o **segundo** projeto.

## Scope (v1)

### Inclui

- Setup BMAD nativo no Claude Code (já feito — ver `_bmad/_config/manifest.yaml`).
- Worker OpenClaw rodando em VPS própria com agentes Dev/Review/QA orquestrados pelo BMad Master.
- Integração WhatsApp ↔ worker via webhook (sistema próprio).
- Customização da skill `bmad-code-review` para detectar "gap no PRD/arquitetura" e disparar webhook.
- **Watchdog timeout** no worker (30 min default, configurável).
- **Detector de falha reincidente** no agente Dev/QA (5 tentativas → interrupt).
- **Fallback de canal:** e-mail acionado quando WhatsApp falha em entregar 3 mensagens consecutivas em 10 min.
- **Idempotência por story** com state store persistente (Redis ou SQLite — a definir em arquitetura).
- Documentação operacional viva (este brief + PRD + arquitetura + decision-log do piloto).
- **Um** projeto-piloto.

### Não inclui (v1)

- Dashboard visual de monitoramento (logs em arquivo bastam).
- Suporte multi-projeto simultâneo (um por vez).
- Módulos BMAD customizados além da regra de interrupt no code-review.
- Onboarding de colaborador.
- Fallback Slack (e-mail é único fallback no v1, ativado apenas em falha do WhatsApp).
- Empacotamento como produto open-source ou comercial.

## Vision (3 anos)

- operador opera 2-3 produtos em paralelo via mesmo pipeline, sem aumentar headcount.
- O pipeline evolui em **retrospectivas ao fim de cada projeto-piloto**, output em 1 página (não 8). Disciplina **event-based** (que tem maior aderência para solos), não **time-based** (que tipicamente falha em solo founder após 2 trimestres).
- BMAD pode ter sido substituído por outra metodologia; o **padrão** (Colaborativo→Autônomo + WhatsApp Interrupt + Gate de Qualidade no Code Review + Idempotência por Story) sobrevive porque é independente da ferramenta.
- Opcional: o template do pipeline é publicado como referência (não como produto), se outros founders solo o quiserem.

## Open Questions

### Bloqueador imediato

1. **Escolha do projeto-piloto** — não decidida nesta rodada. Possibilidades sinalizadas pelo título do `.docx`: BIMED (médico)? Outra coisa? Sem isso, M0 e M1 não têm âncora real.

### A resolver em arquitetura (após PRD)

2. **"Gap detector" no code-review** — qual é exatamente o sinal? Heurística textual? Verificação de cobertura PRD vs. AST? Pergunta ao próprio agente "isso está coberto pelo PRD?" — definir em `bmad-create-architecture`.
3. **Estado do worker entre runs** — onde armazena progresso da story atual quando interrompido por WhatsApp? Redis? Arquivo no VPS? Database BMAD? Decidir em arquitetura.
4. **Limite de tentativas autônomas antes de interrupt forçado** — `N=?` (em testes reincidentes, ou em loop sem progresso). Defaults na config do worker.
5. **Política de rollback** — se operador responder algo no WhatsApp que invalida 3 stories já feitas, como o worker re-executa só o necessário? Estratégia em arquitetura.
