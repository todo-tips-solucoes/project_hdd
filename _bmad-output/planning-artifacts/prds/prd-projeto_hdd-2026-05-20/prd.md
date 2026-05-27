---
title: "PRD v2 — HORSE DRIVEN DEVELOPMENT (HDD): Pipeline Autónomo Assíncrono BMAD + OpenClaw + WhatsApp Interrupt"
project: projeto_hdd
status: final
version: 2
created: 2026-05-20
updated: 2026-05-20
finalized: 2026-05-20
authors: [operador]
facilitator: bmad-prd (Claude Opus 4.7)
language: pt-PT
sources:
  - "_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/brief.md"  # canónico
  - "_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/addendum.md"
  - "documentos/Solução OpenClaw BIMED.docx"
supersedes: "prd.md v1 (2026-05-20, status:final)"
---

# PRD v2 — HORSE DRIVEN DEVELOPMENT (HDD): Pipeline Autónomo Assíncrono BMAD + OpenClaw + WhatsApp Interrupt

> **v2 — reconciliação com brief autoritativo.**
> v1 foi escrito sem descoberta do `brief.md` existente; descoberto no Step-01 init de `bmad-create-architecture`. Esta versão reconcilia: brief vence onde conflita; decisões D-016/D-017/D-018/D-019 do utilizador mantêm-se (naming HDD, Anthropic Max 20x, piloto=projeto_hdd, revisão obrigatória). Trilha completa em `.decision-log.md` (D-020..D-028).

> **Convenções de marcação:** `[ASSUMPTION]` (inferência razoável a validar) · `[OPEN]` (questão aberta) · `[NOTE PARA O PM]` (callout dirigido ao revisor).

---

## 1. Visão & Contexto

**Tese.** O ciclo discovery+PRD do `operador` é prazeroso e já funciona; o gargalo real é a **execução pós-escopo-definido** (codificar, testar, revisar, integrar) — 60-80% do calendário em trabalho de baixo retorno cognitivo. O pipeline HDD aposta que com **uma cisão estrita entre fase colaborativa e fase autónoma**, mais um **canal de interrupt onde o operador realmente responde em segundos (WhatsApp)**, é possível recuperar essas semanas sem perder controlo estratégico sobre produto e arquitetura.

**HORSE DRIVEN DEVELOPMENT** (abreviado **HDD** — alinhado com `project_name=projeto_hdd`) é uma plataforma interna **bimodal**:

- **Modo Colaborativo** (Fases BMAD 1-2: Análise + Planejamento) — `operador` + agentes BMAD trabalham juntos no **Claude Code interactivo**. Aqui se define produto, PRD, arquitetura, épicos. **Sempre humano-no-loop.**
- **Modo Autónomo** (Fases BMAD 3-4: Solução + Implementação) — um **worker OpenClaw em VPS própria** assume após o `bmad-check-implementation-readiness`. Agentes Dev, Reviewer e QA executam stories sequencialmente, com **gates de qualidade entre handoffs**, sem supervisão contínua.

A ponte entre os dois modos é o **canal de interrupt WhatsApp bidirecional** rodando no sistema próprio do operador. Critério único e restrito: **1 trigger primário + 3 watchdogs declarados no v1** (detalhe em §7.2).

A escolha **OpenClaw + plugin `BMAD_Openclaw`** (vs LangGraph/CrewAI/AutoGen ou orquestrador custom) baseia-se no plugin oficial alinhado com o método BMAD — alternativas exigiriam reimplementar gateway, sessions, plugin model e fluxos de fase. Trade-off completo em `addendum.md §A1`. Glossário em §13.

**Entrega:** o ambiente rodando — **não um produto vendável** (fork (b) "OpenClaw Studio" foi explicitamente descartado no brief). É **infraestrutura pessoal**. O primeiro projeto-piloto sai dele em **até 1 mês** (M1 do brief).

## 2. Problema & Oportunidade

### 2.1 Problema (do brief §The Problem)

Para `operador`, operando solo:

1. **Tempo de execução pós-PRD é o maior incómodo.** Discovery + Planning consomem ~20% do calendário; implementação consome 60-80%.
2. **Mecanismos atuais de delegação** (freelancers, agências) introduzem latência, retrabalho e custo desproporcional para projetos solo/MVP.
3. **Ferramentas de IA contemporâneas** (Cursor, Copilot, Claude Code interactivo) aceleram tarefas isoladas, mas exigem **supervisão constante** — `operador` continua a assistir o agente trabalhar; quebra de foco.
4. **Sem disciplina de qualidade entre fases, velocidade vira sujeira:** PRD diz X, agente Dev implementa Y, erro só aparece em produção.

### 2.2 O que `operador` NÃO quer resolver

- Disciplina de discovery/validação — já funciona; o "pre-mortem do facilitador" foi exagero (brief §Problem).
- Construção de framework próprio — BMAD é suficiente.
- Suporte a equipa — solo permanece solo nesta v1.

### 2.3 Oportunidade

Blocos prontos: **OpenClaw** (gateway, sessions, plugins multi-canal e execução), **BMAD-METHOD v6.7.1** (já instalado), **plugin `BMAD_Openclaw`** (oficial), **Claude Opus 4.7 1M context** (sessões interactivas profundas), **VPS própria + número WhatsApp aprovado** no sistema do operador.

A oportunidade é **costurar estas peças num pipeline operacional bimodal** com regra de interrupt explícita e auditável.

## 3. Objetivos & Métricas de Sucesso

### 3.1 Três princípios não-negociáveis (do brief §What Makes This Different)

- **P-1.** **Produto e arquitetura são SEMPRE colaborativos.** `operador` não cede essas decisões aos agentes. O modo autónomo só toca *execução* dentro de fronteiras já desenhadas.
- **P-2.** **Critério de interrupt explícito e auditável.** Não é lista emergente de 20+ heurísticas — é **1 trigger primário + 3 watchdogs declarados no v1**. Fácil de implementar no `bmad-code-review`; fácil de revisar quando o pipeline falhar.
- **P-3.** **Canal de interrupt é onde o utilizador REALMENTE responde rápido.** **WhatsApp** — não Slack nem e-mail. Stack já existente, sem nova ferramenta. E-mail é apenas fallback (S3).

### 3.2 Objetivos

- **G-1** — Permitir que `operador` opere o ciclo Brief→PRD→Architecture→Epics→Readiness no Claude Code interactivo (Modo Colaborativo) e depois dispare o worker autónomo (Modo Autónomo) para executar stories até deploy.
- **G-2** — Garantir trilha auditável (decision-log + state persistente + JSONL audit log) que permita inspecionar, reverter ou re-executar qualquer fase.
- **G-3** — Operar **single-provider Anthropic**, sem multi-provider no v1 (D-017). Budget é **híbrido** (D-050): janela Max 20x no planejamento + fallback; USD metered (API) na implementação, dentro de cost cap mensal.
- **G-4** — Confiabilidade operacional: estado sobrevive a crash do worker, falha de rede ou WhatsApp; fallback automático para e-mail (S3) **mantém o pipeline a correr** (não pausa).
- **G-5** — Conformidade com os 3 princípios não-negociáveis (P-1/P-2/P-3 são gates: violação = bloqueia release).

### 3.3 Marcos & Métricas (do brief §Success Criteria, vinculados a `operador`)

| Marco | Quando | Métrica | Counter-métrica |
|---|---|---|---|
| **M0 — Baseline** | Semana 0 (antes do start) | Registar tempo das Fases 3-4 do último MVP manual. `[OPEN]` baseline = ? dias úteis | Sem baseline registado, primeiro piloto define-o |
| **M1 — Pipeline end-to-end** | 1 mês após start | Um projeto-piloto rodou Brief→código deployado. ≥ 3 interrupts WhatsApp resolvidos com sucesso. ≥ 1 fallback WhatsApp→e-mail testado em ambiente controlado | Não a custa de qualidade (testes verdes na Story → Dev) |
| **M3 — Tempo de execução** | 3 meses | Fases 3-4 ≥ **4× mais rápido** que baseline M0. Sem baseline, M3 = referência para M6 (não meta absoluta) | Não a custa de stories incompletas/quebradas |
| **M6 — Repetibilidade** | 6 meses | 2.º produto saiu pelo pipeline sem retrabalho do processo. Tempo de execução medido contra M3 (não regressão). **Revisão consciente do descarte do fork b** (SaaS) | — |
| **Q4-2026 — Sustentabilidade** | 7 meses | ≥ 1 produto vivo em produção com utilizador real (não fictício). Retrospectiva **por projeto** (não trimestral) em 1 página, aprendizados aplicados ao pipeline | — |

### 3.4 Não-objetivos (consolidação brief + PRD v1)

- **N-1.** Substituir o operador em decisões estratégicas (visão, arquitetura, trade-offs financeiros/legais).
- **N-2.** Multi-tenancy real — solo permanece solo no v1.
- **N-3.** Publicação automática de artefactos para fora da máquina/VPS do operador no v1 (sem upload Confluence/Notion/Drive automático).
- **N-4.** Código pronto para produção sem revisão humana em superfícies sensíveis (vide NFR-S4).
- **N-5.** Empacotamento como produto open-source ou comercial no v1 (fork (b) explicitamente descartado).
- **N-6.** Dashboard visual de monitorização — logs JSONL + Resumos de Finalização + WhatsApp bastam.

## 4. Personas

### Persona primária — **`operador`**
- Solo founder/desenvolvedor com tese multi-produto.
- Nível **intermediate** em BMAD (config `[bmm].skill_level=intermediate`).
- Full-stack.
- **VPS própria operacional**, com Node ou Python disponível para hospedar o worker.
- **Número WhatsApp aprovado** no sistema proprietário do operador (bidirecional, ativo hoje).
- Modelo mental: o pipeline é um **colaborador júnior diligente** — capaz mas que precisa aprovação em momentos-chave (D-019).

### Persona secundária (não modelada no v1) — **1 colaborador futuro**
- Brief §Who: "eventual 1 colaborador no futuro" — arquitetura deve **tolerar adicionar segundo destino WhatsApp sem refactor**. Diferido para v1.1+.

### Quem este projeto NÃO serve (brief §Who)
- Equipas > 2 pessoas.
- Organizações com compliance/aprovações formais.
- Founders que delegam discovery a agentes.

> Detalhe estendido em `addendum.md §A4`. **Persona "Revisor Convidado" da v1 foi removida** — brief deixa claro que WhatsApp é canal directo ao operador único; não há revisor convidado no v1.

## 5. Escopo

> **🔔 D-043 (post-architecture clarification, 2026-05-22):** O brief original previa **OpenClaw como runtime de orquestração** com plugin `BMAD_Openclaw`. Durante `bmad-create-architecture` Steps 03-04, decisões cumulativas (D-035 Bun-first + D-04.12 OQ-H CLI-wrapper + D-033 clihelper outbound + D-042 n8n inbound) substituíram OpenClaw por **worker Bun nativo** como orquestrador. **OpenClaw arquitetonicamente diferido para v1.1+** se viable. Detalhes em ADR `0007-bun-substitutes-openclaw.md` (a criar Sprint 0). Referências OpenClaw abaixo são preservadas como **trail histórico do brief**, não realidade operacional.

### 5.1 Inclui (v1, do brief §Scope; com D-043 clarification)

- **Setup BMAD nativo no Claude Code** (✅ feito — manifest em `_bmad/_config/manifest.yaml`).
- ~~**Worker OpenClaw rodando em VPS própria**~~ → **Worker Bun nativo rodando em VPS própria** (D-035 + D-043) com agentes Dev/Review/QA orquestrados pelo código TS do worker; ~~plugin `BMAD_Openclaw`~~ → **CLI-wrapper para BMAD skills** (D-04.12 OQ-H; **Sprint 0 Day 1 BLOCKER:** validar `bmad-cli` non-interactive invocation).
- **Integração WhatsApp ↔ worker** via webhook (sistema proprietário).
- **Customização do `bmad-code-review`** para detetar "gap PRD/arquitetura" e disparar webhook (Trigger P1).
- **Watchdog timeout** no worker (default 30min, configurável — Trigger S1).
- **Detetor de falha reincidente** no Dev/QA (5 tentativas → interrupt — Trigger S2).
- **Fallback de canal** — e-mail acionado quando WhatsApp falha em entregar 3 mensagens consecutivas em 10 min (Trigger S3); pipeline **NÃO para** — muda canal e segue.
- **Idempotência por story** com state store persistente (Redis ou SQLite — escolha em arquitetura).
- **Documentação operacional viva** — este PRD + arquitetura + decision-log do piloto.
- **Um projeto-piloto**: **`projeto_hdd`** (D-018 — meta-dogfood; supersedes brief Q-1 deixada em aberto).

### 5.2 Não inclui (v1, do brief §Scope > Não inclui)

- Dashboard visual de monitorização (logs JSONL bastam).
- Suporte multi-projeto simultâneo (um por vez).
- Módulos BMAD customizados além da regra de interrupt no code-review.
- Onboarding de colaborador.
- Fallback Slack (e-mail é único fallback no v1; ativado apenas em falha de WhatsApp).
- Empacotamento como produto open-source ou comercial.
- Multi-provider LLM — outro provider além de Anthropic (M0 = **Anthropic exclusivo, dual-mode Max 20x + API** — D-017/D-050).

### 5.3 Roadmap

| Fase | Tema | Saída |
|---|---|---|
| **v1** | Pipeline end-to-end com 1 piloto (`projeto_hdd`) | Cumpre M1; brief.md + PRD + arch + epics + código deployado |
| **v1.1** | Hardening pós-piloto | Gatilhos adicionais (custo estimado de stack, conflito entre artefactos), 2º destino WhatsApp tolerado em arquitetura, fallback Telegram considerado |
| **Vision 3 anos** | 2-3 produtos em paralelo via mesmo pipeline; retrospectivas event-based (não time-based); BMAD opcionalmente substituível | Padrão Colab→Auton + WhatsApp Interrupt + Gate Code-Review + Idempotência por Story sobrevive independente da ferramenta |

## 6. Casos de Uso / User Journeys

### UJ-1 — Modo Colaborativo: Brief → PRD → Architecture → Epics → Readiness
1. `operador` invoca `bmad-product-brief` (ou já tem brief) no Claude Code.
2. Sequência: `bmad-prd` → `bmad-create-architecture` → `bmad-create-epics-and-stories` → `bmad-check-implementation-readiness`.
3. Cada finalização exige revisão humana + **Resumo de Finalização 3-tier** (D-019, §7.8).
4. Sucesso de `bmad-check-implementation-readiness` é o **gate de transição** para o modo Autónomo.

### UJ-2 — Modo Autónomo: worker em VPS executa stories
1. `operador` dispara o worker via script no VPS (`hdd-worker start <project-id>`).
2. Worker chama BMad Master no plugin `BMAD_Openclaw`: `bmad-sprint-planning` → loop por story (`bmad-dev-story` → `bmad-code-review` → `bmad-testarch-*`).
3. Cada handoff entre agentes passa por um **gate de qualidade** (§7.6).
4. Worker progride sem supervisão até atingir um trigger de interrupt (UJ-3) ou concluir todas as stories.
5. No fim: worker abre PR (ou faz deploy), envia mensagem WhatsApp final `"pronto, revisa aqui."` + link, e aguarda revisão final (D-019).

### UJ-3 — Interrupt fluxo (Trigger P1 — gap código↔PRD/arquitetura)
1. Worker está a executar Story #42 (auth flow); chama `bmad-code-review`.
2. Reviewer deteta que o PRD não especifica se OAuth2 aceita Google+GitHub ou só Google — **gap PRD/Arq ↔ Código**.
3. Worker → state store: `paused_for_interrupt=true`, snapshot do contexto.
4. Worker → WhatsApp adapter: envia mensagem ao `operador` com contexto da ambiguidade.
5. `operador` lê no telemóvel, responde: *"Só Google. Adicione GitHub no addendum como roadmap pós-MVP."*
6. WhatsApp → webhook listener → state store: pop pending interrupt, injeta resposta.
7. Worker aplica decisão: atualiza `addendum.md` do PRD, atualiza arquitetura se necessário, retoma story.

### UJ-4 — Fallback de canal (Trigger S3 — WhatsApp indisponível)
1. Worker envia 1ª mensagem ao WhatsApp para interrupt; sem confirmação em N tempo.
2. Worker re-envia (2ª, 3ª) em janela de 10 min.
3. Após 3ª sem confirmação → **S3 dispara**: worker ativa adapter de e-mail (SMTP/Resend/Postmark/SES, provider a definir em arquitetura).
4. **Pipeline NÃO pára.** Worker continua a aguardar pela resposta via e-mail; novas mensagens são enviadas por e-mail; quando WhatsApp voltar, sistema regista mas não trocar canal de volta sem ação do operador.

## 7. Features e Requisitos Funcionais

### 7.1 Feature — Pipeline bimodal orquestrado pelo BMad Master
- **FR-001.** O Modo Colaborativo deve correr no **Claude Code interactivo localmente** com BMAD v6.7.1 já instalado em `/var/lib/projeto_hdd/_bmad`.
- **FR-002.** ~~O Modo Autónomo deve correr num **worker OpenClaw em VPS própria** com o plugin `ErwanLorteau/BMAD_Openclaw` instalado.~~ → **D-043 update:** O Modo Autónomo corre num **worker Bun nativo em VPS própria** (D-035); BMAD skills invocadas via **CLI-wrapper** (D-04.12 OQ-H); plugin BMAD_Openclaw arquitetonicamente diferido v1.1+ se viable.
- **FR-003.** A transição Colab→Auton requer **sucesso explícito de `bmad-check-implementation-readiness`** (gate dur do brief).
- **FR-004.** O BMad Master (no worker) deve coordenar sub-agentes Dev/Review/QA com **contexto isolado por workflow**.
- **FR-005.** Cada sub-agente deve invocar `bmad_save_artifact` ao concluir um passo e `bmad_complete_workflow` ao concluir um workflow.
- **FR-006.** O worker deve permitir invocação programática das skills BMAD. `[OPEN — arq-Q3 do brief]` se o BMAD instalado permite invocação programática directa ou se requer um CLI-wrapper.

### 7.2 Feature — Regra de Interrupt (1 primário + 3 watchdogs, v1)

> **Política transversal:** revisão humana é obrigatória em finalização de fase (D-019). Interrupts são **eventos não-planeados** dentro de fases — diferentes de finalizações planeadas.

| Trigger | Condição | Ação |
|---|---|---|
| **P1** — Gap PRD/Arq ↔ Código | Reviewer/QA precisa de decisão de produto ou arquitetura que **não consta** nos artefactos canónicos (PRD, arquitetura, addendum) | Pausa worker → WhatsApp com contexto completo |
| **S1** — Watchdog timeout | Sem progresso detetável > 30 min (default configurável) | Pausa worker → WhatsApp "pode estar travado em [story X]" |
| **S2** — Falha reincidente | 5 tentativas consecutivas sem progresso na mesma falha (teste ou execução) | Pausa worker → WhatsApp com último erro + diff da última tentativa |
| **S3** — Canal indisponível | 3 mensagens consecutivas em 10 min sem confirmação no WhatsApp | **Fallback automático para e-mail** — pipeline NÃO pára; muda canal e segue |

- **FR-010.** O `bmad-code-review` customizado deve detetar gap PRD/Arq↔Código (Trigger P1). `[OPEN — arq-Q2 do brief]` definir o sinal exato: heurística textual? cobertura PRD vs AST? pergunta directa ao agente "isto está coberto pelo PRD?"
- **FR-011.** O worker deve manter um **watchdog timer** por story; default 30 min sem progresso disparar S1.
- **FR-012.** O worker deve manter um **contador de retries** por falha; default 5 retries consecutivas dispara S2.
- **FR-013.** O webhook listener deve **timeout-poll** confirmação de leitura/resposta no WhatsApp; 3 mensagens em 10 min sem confirmação dispara S3.
- **FR-014.** Em P1/S1/S2: worker pausa, grava state (`paused_for_interrupt=true`), envia mensagem com contexto, **aguarda resposta**.
- **FR-015.** Em S3: worker **NÃO pausa**; muda canal para e-mail e prossegue a comunicar; volta a WhatsApp apenas após ação explícita do operador.
- **FR-016.** Toda mensagem (entrante/saída) regista no audit log JSONL com timestamp, trigger-id, story-id, payload.
- **FR-017.** Outros gatilhos (custo estimado de stack, conflito entre artefactos canónicos) ficam para **v1.1** — não implementar no v1.

### 7.3 Feature — Canal WhatsApp (via app proprietário do operador) + fallback e-mail
- **FR-020.** O sistema **NÃO fala directamente com a Meta Cloud API**. Usa o **app proprietário do operador `operador` em `clihelper.example.com`** como camada de abstração (D-033). A app do operador trata WABA, número certificado, display name, templates registados, quality rating, pricing Meta, janela 24h. **HDD = HTTP client simples.**
- **FR-021.** O WhatsApp adapter faz `POST` aos endpoints:
  - **Template com variável:** `https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template/`
  - **Template sem variável:** `https://clihelper.example.com/principal/apis/mensagem/api-oficial-mensagem-template-sem-variavel/`
- **FR-022.** Header obrigatório `Authorization: <token>` (formato a confirmar; assumir Bearer até clarificação operador).
- **FR-023.** Payload conforme schema clihelper: `{number, name (template_name), language ("pt_BR"), openTicket, queueId, template: [{type: "header"|"body"|"button", parameters: [...]}]}`. Buttons `sub_type: "quick_reply"` com `index` e `payload` string que volta no webhook inbound.
- **FR-024.** O webhook listener inbound recebe callbacks do app do operador (estrutura JSON `[PENDING]` — operador partilhará). Deve parsear: (a) resposta livre do operador (NLP via Haiku 4.5); (b) Quick Reply payloads (`p1_continuar_assim`, `fin_aprovar`, etc.) — match exacto sem NLP.
- **FR-025.** **Rate-limit obrigatório: 1 requisição por segundo** ao endpoint clihelper. Adapter implementa **leaky bucket queue** com retry exponencial em 429/5xx (FR-027).
- **FR-026.** **6 templates UTILITY** a desenhar pelo HDD e criar pelo operador no clihelper UI: `hdd_interrupt_p1`, `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_summary_finalization` (Tier-A), `hdd_heartbeat` (FR-085), `hdd_release_final`. Spec completo em `_bmad-output/planning-artifacts/whatsapp-templates-utility.md`. **M1 mínimo viável requer 3 aprovados:** P1, summary_finalization, heartbeat.
- **FR-027.** Retry: 429 → backoff exponencial base 2s, max 5 retries, max delay 60s; 5xx → backoff + circuit breaker após 5 falhas em 1min. Cada attempt logado no audit JSONL.
- **FR-028.** **Custo WhatsApp = $0** do ponto de vista do HDD (absorvido pela infra do operador). Cost cap operacional cobre apenas Anthropic janela + VPS + Resend + R2.
- **FR-029.** Fallback e-mail (Trigger S3) usa **Resend** (default; SDK moderno + delivery webhook nativo) ou alternativa equivalente.
- **FR-030.** Idempotência: cada envio carrega `idempotency_key = SHA-256(run_id || story_id || template_name || seq_local)` registado no state store **antes** do POST (commit-state-before-side-effect, AO-3/AO-39). Re-envios da mesma chave retornam resultado anterior sem nova chamada.

### 7.4 Feature — Worker autónomo em VPS
- **FR-030.** O worker corre em **VPS própria** do operador (Node ou Python — escolha em arquitetura).
- **FR-031.** O worker tem ponto de entrada `hdd-worker` com subcomandos `start <project>`, `pause`, `resume`, `status`, `logs`.
- **FR-032.** O worker deve sobreviver a restart do processo (crash recovery via state store).
- **FR-033.** O worker tem um **BMAD invoker** que dispara skills via **CLI-wrapper** (D-04.12 OQ-H + D-043). ~~plugin `BMAD_Openclaw`~~ diferido v1.1+. **Sprint 0 Day 1 mandatory validation:** confirmar `bmad-cli` non-interactive invocation; se falhar, escalar para Plan B (Claude Code headless OR re-implement subset BMAD skills em TS).
- **FR-034.** O worker executa um **único projeto por vez** (sem multi-tenancy no v1).

### 7.5 Feature — State store + idempotência
- **FR-040.** O state store persiste no mínimo: `current_story_id`, `story_status`, `paused_for_interrupt`, `last_interrupt_at`, `interrupt_pending_id`, `retry_count`, `current_workflow`, `current_phase`.
- **FR-041.** Cada **story** é **idempotente** — re-executar a mesma story após crash não duplica side-effects (commits, mensagens, artefactos).
- **FR-042.** Tecnologia do state store: **Redis ou SQLite** — escolha em arquitetura (`[OPEN — arq-Q4 do brief]`).
- **FR-043.** O sistema deve permitir **rollback parcial**: se `operador` responder algo no WhatsApp que invalida 3 stories já feitas, política de rollback decide o que re-executar (`[OPEN — arq-Q5 do brief]` — estratégia em arquitetura).
- **FR-044.** **Audit log JSONL**: cada decisão do agente, cada interrupt, cada resposta — uma linha por evento, em `_bmad-output/audit/<project>/<date>.jsonl`.

### 7.6 Feature — Gates de qualidade nos handoffs (P-2 do brief)

| Handoff | Gate | Ação se falhar |
|---|---|---|
| PRD → Arquitetura | `bmad-check-implementation-readiness` fechado | Bloqueia Modo Autónomo |
| Story → Dev | Critérios de aceitação completos na story | Worker pausa, pede ao operador via WhatsApp |
| Dev → Review | Suite de testes verde na story | Worker tenta correção (max FR-012); se falhar, S2 |
| Review → QA | PRD/arquitetura consistentes com implementação | Se inconsistente, P1 (gap detectado) |

- **FR-050.** Cada handoff acima é **gate explícito** — não passa silenciosamente.
- **FR-051.** Falha de gate é evento auditado no JSONL (FR-044).
- **FR-052.** Em falha de gate, o worker deve produzir **diagnóstico estruturado** (qual critério falhou, com que evidência) antes de pausar.

### 7.7 Feature — Gestão de janela LLM (Claude Max 20x)
- **FR-060.** O sistema usa Anthropic em **dual-mode** (D-050): planejamento interativo e fallback correm na **janela do plano Max 20x** (budget = tempo de janela); a **implementação autónoma** (dev/review/qa) corre por default na **Anthropic API pay-per-token** (budget = USD metered, dentro de cost cap). Continua **single-provider Anthropic** (D-017).
- **FR-061.** Em proximidade do limite de janela (default 80% de uso diário), o sistema deve notificar via WhatsApp.
- **FR-062.** Em atingimento do limite, o worker deve **pausar** automaticamente, gravar state, e aguardar reset. Flag `--hard-stop` termina sem retomar (CI).
- **FR-063.** O sistema reporta consumo por sub-agente e por workflow em % da janela.
- **FR-064.** Sub-agentes usam modelos da mesma família conforme criticidade (Opus 4.7 para Arquiteto/PM/decisões críticas; Sonnet 4.6 para Dev/Review/QA; Haiku 4.5 para tasks triviais) e selecionam o **modo de acesso por fase** (D-050): planejamento → Max 20x; implementação → API pay-per-token (default) com Max 20x como overflow configurável.
- **FR-065.** Quando o budget USD da implementação atinge o cap configurado **ou** a janela de fallback esgota, oferecer (a) **overflow para Max 20x** se houver janela, ou (b) **downgrade de modelo** (Sonnet→Haiku) conforme role + budget cap (D-050).

### 7.8 Feature — Resumo de Finalização (3-tier)

> **Política (D-019):** *Toda finalização de workflow ou unidade entregável (PRD, arquitetura, épico, sprint, story, release) exige revisão humana obrigatória.* O sistema gera automaticamente um Resumo 3-tier. Sem auto-aprovar no v1.

- **FR-070.** Ao concluir qualquer workflow/unidade entregável, gerar Resumo de Finalização em Markdown nos 3 tiers (template em `finalization-summary-templates.md`).
- **FR-071.** Tier-A (≤200 palavras) entregue via canal primário (**WhatsApp**); Tier-B link para `_bmad-output/<phase>/<workflow-id>-summary.md`; Tier-C audit-only no workspace.
- **FR-072.** Workflow pausa em `paused-awaiting-review` até resposta.
- **FR-073.** Respostas aceites: `approve`, `request_changes <nota>`, `reject <razão>`.
- **FR-074.** Resumo permanente em `_bmad-output/<phase>/<workflow-id>-summary.md`, committed em git.
- **FR-075.** Diff side-by-side com o resumo anterior do mesmo projeto (via git diff no v1; semântico em v1.1+).
- **FR-076.** Detalhes mecânicos (botões WhatsApp? CLI? parsing) — definir em `bmad-create-architecture`.

### 7.9 Feature — Bootstrap, configuração e operação

- **FR-080.** ~~Bootstrap documenta: clone `BMAD_Openclaw` no VPS, npm install, edit openclaw.json, criar workspace, registar webhook WhatsApp, configurar SMTP/Resend, reiniciar gateway.~~ → **D-043:** Bootstrap documenta: clone repo HDD no VPS, `bun install`, configurar `.env` + systemd unit, validar `bmad-cli` non-interactive smoke test, registar webhook n8n callback, configurar Resend (S3 fallback), Litestream + rclone setup, `systemctl start hdd-worker`.
- **FR-081.** Verificação de pré-requisitos no start: BMAD v6.7.1 instalado, **`bmad-cli` non-interactive funcional (validado Sprint 0 Day 1)**, ~~plugin BMAD_Openclaw presente~~, número WhatsApp ativo no clihelper, e-mail Resend configurado, credenciais Anthropic Max 20x válidas, n8n webhook configured to forward to HDD `/callback`.
- **FR-082.** Falhar **fechado** se credenciais essenciais em falta — sem modo "degradado" silencioso.
- **FR-083.** Overrides locais em `_bmad/custom/` (gitignored para personal, committable para team) para sobreviver re-instalação.
- **FR-084.** `hdd-worker logs` deve produzir tail do JSONL com formatação humana opcional.

## 8. Requisitos Não-Funcionais

### 8.1 Segurança
- **NFR-S1.** Segredos (Anthropic API key, WhatsApp tokens, SMTP credentials, GitHub) em vault externo (env vars / 1Password CLI / equivalente) — **nunca** em ficheiros do workspace ou no VPS plain-text.
- **NFR-S2.** Logs JSONL aplicam redaction automática de tokens/secrets antes de escrever.
- **NFR-S3.** Sandbox de execução do Dev agent impede acesso fora do workspace do projeto.
- **NFR-S4.** PRs em repos públicos requerem **revisão humana obrigatória** em **superfícies sensíveis**: (a) handlers de rede HTTP/RPC/WebSocket; (b) auth/sessões; (c) processos privilegiados; (d) integrações com credenciais externas; (e) migrações de dados. Reviewer/QA marca PR com label `human-review-required`.
- **NFR-S5.** WhatsApp via **app proprietário do operador (clihelper)** sobre Meta Cloud API (D-033) elimina o risco de ban de stack não-oficial **e** de gestão directa de Meta. Riscos residuais a mitigar: (a) **endpoint clihelper indisponível** — fallback e-mail Resend (S3); (b) **rate-limit 1 req/s** — leaky bucket queue no adapter (FR-025); (c) **quality rating** monitorizado pelo operador (não pelo HDD); (d) **dependência do app do operador** — alternativa Telegram para v1.1+ se necessário.
- **NFR-S6.** VPS deve ter SSH key-only auth, firewall mínimo (porta webhook + 22), updates automáticos.

### 8.2 Confiabilidade
- **NFR-R1.** Crash do worker não resulta em perda de state — recuperar via state store + último `bmad_save_artifact`.
- **NFR-R2.** Falhas transitórias de rede: retry exponencial (base 2s, max 5 retries, max delay 60s `[ASSUMPTION — calibrar]`).
- **NFR-R3.** Concurrent stories no mesmo projeto são **serializadas** (worker single-stream no v1).
- **NFR-R4.** **Idempotência por story** (FR-041) é gate; nenhuma operação efectua side-effects sem idempotency key registada no state store.
- **NFR-R5.** Pipeline NÃO pára em falha de canal primário (S3); apenas troca para fallback.

### 8.3 Observabilidade
- **NFR-O1.** `bmad_get_state` (ou equivalente `hdd-worker status`) devolve estado em ≤ 2s.
- **NFR-O2.** Consumo de janela LLM consultável a qualquer momento.
- **NFR-O3.** **Audit log JSONL** (FR-044) é a fonte primária; tail-able em tempo real.
- **NFR-O4.** Métrica visível: **"interrupts pendentes"** — adicionar aos critérios de sucesso do M1 (do brief).
- **NFR-O5.** No v1: observabilidade via WhatsApp + JSONL + Resumos de Finalização. **Sem dashboard gráfico** (v1.1+).

### 8.4 Performance
- **NFR-P1.** Cold start do worker ≤ 30s `[ASSUMPTION — calibrar com piloto]`.
- **NFR-P2.** Latência interrupt-event→mensagem WhatsApp entregue ≤ 10s `[ASSUMPTION]`. Bound: revisor deve receber rapidamente, não confundir com tempo de resposta humana.
- **NFR-P3.** Sem requisitos de throughput agressivos no v1 (single-operator + single-project + single-story-at-a-time).

### 8.5 Manutenibilidade
- **NFR-M1.** Versão BMAD pinada em `_bmad/_config/manifest.yaml` (v6.7.1); upgrade só via `npx bmad-method install` deliberado.
- **NFR-M2.** Overrides em `_bmad/custom/` para sobreviver re-instalação.
- **NFR-M3.** Plugin BMAD_Openclaw versão pinada explicitamente no setup do worker.

### 8.6 Usabilidade
- **NFR-U1.** `operador` responde a interrupts pelo **telemóvel** (WhatsApp) — sem instalar nada além do já existente.
- **NFR-U2.** Mensagens WhatsApp em português (idioma `[core].communication_language`).
- **NFR-U3.** Tier-A do Resumo de Finalização ≤ 200 palavras (decisão em 30s no telemóvel).
- **NFR-U4.** Comandos do worker (`hdd-worker start/pause/resume/status/logs`) com `--help` claro.

### 8.7 Compliance & IP (diferido para v1.1+)
- **NFR-C1.** *v1:* sem requisito de auditoria de licenças do código gerado.
- **NFR-C2.** *v1.1+:* antes de qualquer publicação externa, suite de auditoria de IP/licenças (SBOM, scan copyleft, attribution).

## 9. Restrições, Pré-requisitos & Pressupostos

### 9.1 Pré-requisitos (validados ou a validar antes do start, do brief §Pré-requisitos)
- ✅ **BMAD v6.7.1** instalado em `/var/lib/projeto_hdd/_bmad` (manifest validado).
- ✅ **Claude Code** com **Opus 4.7 1M tokens** — Fases 1-2 (sessões interactivas profundas).
- ✅ **Plano Anthropic Claude Max 20x** activo (D-017) — dual-mode com API pay-per-token na implementação (D-050).
- ⚠️ **VPS própria** do operador — hospedará worker + webhook listener. *Validar acesso SSH + recursos.*
- ✅ **App proprietário do operador em `clihelper.example.com`** já operacional (WABA + número Meta certificado + display name aprovado + quality rating monitorizado — todos do lado do operador, **não responsabilidade HDD**).
- ⚠️ **Token de Authorization** do clihelper — operador fornece ao HDD.
- ⚠️ **6 templates UTILITY** desenhados em `whatsapp-templates-utility.md` — operador cria no clihelper UI e aguarda aprovação Meta (1-3 dias por template). M1 mínimo viável: 3 templates aprovados (P1 + summary + heartbeat).
- ⚠️ **Webhook callback URL** para receber respostas — operador configura no app dele apontando para endpoint HDD; estrutura JSON do payload inbound a partilhar.
- ⚠️ **Conta SMTP / serviço transacional** (Resend / Postmark / SES) — pré-requisito do fallback S3. *Provider escolhido em arquitetura.*
- ❌ **Plugin `BMAD_Openclaw`** — não presente no v0; instalar no worker (FR-002).

### 9.2 Pressupostos
- `documento_output_language=Portuguese` para todos os artefactos gerados.
- `_bmad/_config/manifest.yaml` é fonte autoritativa de versão BMAD.
- Skills BMAD em `.claude/skills/bmad-*` são as canónicas para invocação pelo Claude Code; cópias em outras pastas servem outros IDEs.
- O brief é a **fonte canónica de visão de produto**; PRDs subsequentes (incluindo esta v2) extraem do brief.

## 10. Riscos (do brief addendum)

| ID | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R-1 | ~~Sistema WhatsApp não-oficial banido pela Meta~~ → **Endpoint clihelper indisponível ou rate-limit excedido** | Baixa | Médio | Fallback Resend (S3) automático; leaky bucket queue no adapter (FR-025); health-check periódico do endpoint (AO-7') |
| R-2 | Worker fica empacado às 3h sem trigger primário disparar | Média | Alto | Watchdog timeout S1 (default 30 min) |
| R-3 | `operador` responde algo que invalida 3 stories já feitas | Média | Médio | Política de rollback parcial — definir em arquitetura |
| R-4 | BMAD upstream lança breaking change | Alta | Médio | Pin de versão; release atualizado em ciclo de retrospectiva |
| R-5 | Acumulação de interrupts não resolvidos | Média | Médio | Métrica visível "interrupts pendentes" no log; alerta em critérios M1 |
| R-6 | Loop de sub-agente / consumo descontrolado de janela | Média | Alto | Cost cap por workflow (% janela); FR-061/062 |
| R-7 | Token leak em logs do gateway | Baixa | Crítico | Vault externo + redaction automática (NFR-S2) |
| R-8 | Perda de workspace se disco do VPS falha | Baixa | Crítico | Backup automático para storage remoto (v1.1+) |
| R-9 | Vulnerabilidade em código gerado | Média | Alto | QA com SAST + revisão humana obrigatória em superfícies sensíveis (NFR-S4) |
| R-10 | IP/licenças em código gerado | Média | Médio (Alto se publicar) | Não-objetivo no v1 (não publicar); auditoria em v1.1+ antes de qualquer release público |

> Lista estendida com probabilidade/impacto em `addendum.md §A7` e no addendum do brief.

## 11. Open Questions

### Fechadas em v2 (consolidação brief + PRD v1)
- ~~**O-1**~~ ✅ D-016: Nome = **HORSE DRIVEN DEVELOPMENT (HDD)**
- ~~**O-3**~~ ✅ D-017 / D-050: Budget híbrido — janela Max 20x (planning+fallback) + API metered (impl.)
- ~~**O-4**~~ ✅ D-018: Piloto = `projeto_hdd` (meta-dogfood)
- ~~**O-5**~~ ✅ D-021 (esta versão): Canal primário = **WhatsApp** (sistema proprietário operador), não Slack
- ~~**O-6**~~ ✅ D-022 (esta versão): Default em S3 = **NÃO pausa**, ativa fallback e-mail e prossegue
- ~~**O-7**~~ ✅ D-019: Toda finalização exige revisão humana + Resumo 3-tier
- ~~**O-8**~~ ✅ D-023 (esta versão): Deploy do worker = **VPS própria do operador**

### Abertas — a resolver em `bmad-create-architecture`
- **O-2** — Calibrar quantitativos M1/M3 com piloto real
- **O-9** — Web research formal sobre BMAD_Openclaw upstream + Baileys/whatsapp-web.js (estado actual, breaking changes, ToS Meta)
- **O-10** — Multi-tenancy quando 2º operador entrar (v1.1+; arquitetura tolerar)

### Abertas — herdadas do brief §Open Questions (canónicas para arquitetura)
- **OQ-A** — **Gap detector** no `bmad-code-review`: qual é o sinal exato? Heurística textual / cobertura PRD vs AST / pergunta ao próprio agente "isto está coberto pelo PRD?" → decidir em `bmad-create-architecture`.
- **OQ-B** — **State store**: Redis vs SQLite vs ficheiro vs DB BMAD → decidir em arquitetura.
- **OQ-C** — **Limite de tentativas autónomas** antes de interrupt forçado (S2): `N=5` é default do brief — confirmar / calibrar.
- **OQ-D** — **Política de rollback parcial** se resposta WhatsApp invalida stories feitas → estratégia em arquitetura.
- ~~**OQ-E**~~ ✅ **FECHADO D-031** (WhatsApp API oficial) + **D-033** (via app proprietário do operador `clihelper.example.com`). Sub-OQ-E' (Meta directa vs BSP) — **dispensada**, o clihelper é a camada do operador.
- **OQ-F** — **Provider de e-mail fallback**: Resend / Postmark / SES / SMTP genérico → decidir em arquitetura.
- **OQ-G** — **Worker runtime**: Node vs Python → decidir em arquitetura.
- **OQ-H** — **Invocação programática BMAD**: directo via plugin ou CLI-wrapper → decidir em arquitetura.

## 12. Próximos Workflows BMAD
1. **`bmad-create-architecture`** — converter §7 + §11 OQ-A..H em design técnico com diagrama de componentes, ADRs, seleção definitiva de stack.
2. `bmad-create-epics-and-stories` — decompor features em épicos/stories com critérios de aceitação.
3. `bmad-check-implementation-readiness` — gate antes de transitar para Modo Autónomo.
4. Modo Autónomo: setup do worker no VPS + plugin BMAD_Openclaw + WhatsApp adapter.

## 13. Glossário

- **HDD / HORSE DRIVEN DEVELOPMENT** — Nome oficial da plataforma (D-016).
- **BMAD** — Breakthrough Method of AI-Driven Development; 4 fases (Análise, Planejamento, Solução, Implementação).
- **OpenClaw** — Framework de orquestração de agentes (gateway + sessions + plugins).
- **BMad Master** — Agente top-level no OpenClaw que coordena sub-agentes BMAD.
- **Plugin BMAD_Openclaw** — Repositório `ErwanLorteau/BMAD_Openclaw`; expõe ferramentas BMAD ao worker.
- **Modo Colaborativo** — Fases BMAD 1-2 no Claude Code interactivo com humano-no-loop.
- **Modo Autónomo** — Fases BMAD 3-4 no worker OpenClaw em VPS própria, sem supervisão contínua excepto interrupts.
- **Worker** — Processo Node ou Python em VPS que executa o loop de stories no Modo Autónomo.
- **Interrupt** — Evento não-planeado em que o worker pausa e contacta o operador (P1, S1, S2).
- **Trigger P1** — Gap entre código e PRD/arquitetura detetado pelo `bmad-code-review`.
- **Triggers S1/S2/S3** — Watchdogs: timeout, falha reincidente, canal indisponível.
- **Watchdog** — Monitor passivo que dispara um trigger quando uma condição é detetada.
- **Webhook listener** — Endpoint HTTP que recebe mensagens entrantes do sistema WhatsApp e injeta no contexto do agente.
- **WhatsApp adapter** — Módulo do worker que fala com o sistema proprietário WhatsApp via REST interna.
- **BMAD invoker** — Componente do worker que dispara skills BMAD (programaticamente ou via CLI-wrapper).
- **State store** — Persistência do estado do worker (story-id, status, paused flags, retry counts) — Redis ou SQLite.
- **Audit log JSONL** — Trilha estruturada (1 evento por linha) em `_bmad-output/audit/`.
- **Implementation Readiness Check** — Skill `bmad-check-implementation-readiness`; gate de transição Colab→Auton.
- **Gate de qualidade** — Validação obrigatória num handoff entre agentes (PRD→Arq, Story→Dev, Dev→Review, Review→QA).
- **Idempotência por story** — Re-execução da mesma story não duplica side-effects.
- **Superfície sensível** — NFR-S4: handlers de rede, auth, privilege, credenciais, migrações de dados.
- **BIMED** — Codinome obsoleto do documento de origem; substituído por HDD (D-016).

## 14. Index de Assumptions

| # | Localização | Conteúdo | Estado | Origem |
|---|---|---|---|---|
| ~~A-01~~ | §1 | Naming = HDD | ✅ D-016 |
| A-02 | §3 M0 | Baseline = ? dias úteis | ⏳ pendente registo `operador` |
| ~~A-03~~ | §3 M3 | 4× mais rápido que baseline | confirmado pelo brief |
| ~~A-04~~ | §3 | Budget em janela, não USD | ✅ D-017 |
| ~~A-05~~ | §5 | Single-operator no v1 | ✅ brief + D-018 |
| ~~A-06~~ | §3.1 | Canal = WhatsApp | ✅ brief P-3 + D-021 |
| ~~A-07~~ | §5.2 | Anthropic single-provider; Max 20x (planning+fallback) + API (impl.) | ✅ D-017 / D-050 |
| A-08 | §7.2 FR-012 | Default 5 retries em S2 | confirmar com brief OQ-C |
| A-09 | §7.7 FR-064 | Opus/Sonnet/Haiku por papel | mantido |
| A-10 | §8.2 NFR-R2 | Retry exp 2s/5/60s | calibrar em arquitetura |
| A-11 | §8.4 NFR-P1/P2 | Cold start ≤30s; latência ≤10s | calibrar com piloto |
| ~~A-12~~ | §4 | Persona = solo `operador` | ✅ brief explícito |
| A-13 | §7.2 FR-011 | Watchdog default 30 min | confirmar com brief |
| A-14 | §7.4 FR-030 | Worker em VPS própria | ✅ brief + D-023 |

> **Nota:** `[ASSUMPTION]` no v1 do PRD referente a Slack/local foi **removida**; brief autoritativo resolve esses pontos.
