# PRD — HORSE DRIVEN DEVELOPMENT (HDD) v2

> **Orquestração Autônoma de Software com Auditoria**
> Projeto: `projeto_hdd` · Versão do PRD: 2.0 · Data: 2026-05-31
> Status: rascunho para fase de Arquitetura (BMAD)
> Fonte: `documentos/Plano PRD detalhado.docx`, materializado e tornado coerente com as decisões do operador (2026-05-31).

---

## 0. Notas de coerência (correções sobre o documento-fonte)

Este PRD corrige incoerências do documento-fonte conforme decisões do operador em 2026-05-31:

1. **Provider LLM único (Claude).** O documento-fonte separava planejamento (OpenAI) e desenvolvimento (Claude). **Decisão: usar exclusivamente a API da Claude em todas as fases** (análise, planejamento, implementação, revisão). Mantém-se o roteamento por *complexidade de tarefa* (modelos menores/maiores da família Claude — Haiku/Sonnet/Opus) em vez de roteamento por *provider*. Isto simplifica credenciais, SDKs e governança.
2. **WhatsApp mantido como canal.** Além de CLI e Painel Web, o **WhatsApp (Cloud API, via camada clihelper + agregador n8n)** permanece como canal assíncrono de comunicação com o operador — preserva a tese de externalização de memória de contexto (silence > noise, narrativa > logs crus).
3. **Reinício de stack para Python.** Linguagem principal: **Python**. O trabalho anterior (Bun/TypeScript) foi arquivado na tag git `legacy/bun-whatsapp-v1`.
4. **Motor de execução = conta Claude (assinatura), não a API — por enquanto.** Todo o desenvolvimento é conduzido de forma **autônoma com controle de sessão**, invocando o **Claude Code headless (`claude -p`) autenticado com a conta de assinatura** (reaproveita D-052), em vez de API key metered. A troca para a **API da Claude** ocorre **ao escalar**, e deve ser uma mudança de *configuração*, não de arquitetura (camada de abstração de provider obrigatória). Consequência: o custo deixa de ser *por token* e passa a ser **assinatura fixa + infra**.

---

## 1. Visão e Objetivos

### Problema
O desenvolvimento manual de software consome tempo do programador em tarefas repetitivas (planejar, implementar boilerplate, escrever testes, revisar). Falta rastreabilidade sobre *por que* cada decisão técnica foi tomada e *qual* agente/modelo a produziu.

### Visão
Uma plataforma de **orquestração autônoma de software** que conduz o ciclo PRD→código de forma **observável, auditável e em conformidade (LGPD/GDPR)**, com revisão humana nos pontos de alto impacto. O primeiro projeto-piloto é o próprio `projeto_hdd` (meta-dogfood).

### Objetivos
1. **Automação e eficiência** — automatizar planejamento, implementação, testes e revisão via agentes de IA, liberando o operador para tarefas de maior valor.
2. **Auditoria e rastreabilidade** — registrar cada decisão, ação e interação da IA em um banco de conhecimento auditável (quem/qual modelo/por quê).
3. **Conformidade de dados** — controles LGPD/GDPR: coleta mínima, consentimento, pseudonimização, direito à exclusão.
4. **Segurança e governança** — avaliação de risco pré-implantação, privilégio mínimo, revisão humana para ações de alto impacto.
5. **Escalabilidade modular** — evoluir por módulos (agentes/ferramentas) isolados.
6. **Observabilidade e métricas** — medir tempo, custo, intervenções humanas, erros e eficácia; realimentar o banco de conhecimento.

---

## 2. Contexto e Usuários

### Personas
- **Desenvolvedor/Operador (primário)** — interage com o orquestrador para criar projetos/features, revisar código gerado e responder dúvidas da IA. Canais: CLI, Painel Web, WhatsApp.
- **Administrador/DevOps** — provisiona a VPS, integra CI/CD, gere credenciais e monitora segurança/custos.
- **Auditor de Segurança/Conformidade** — acessa logs, relatórios de auditoria e verifica aderência a LGPD/GDPR.

### Workflow atual (a substituir)
Desenvolvimento manual em GitHub, sem rastreabilidade estruturada de decisões nem orquestração de agentes.

---

## 3. Premissas e Dependências

### Premissas
- **Motor LLM = conta Claude de assinatura** acionada via **Claude Code headless (`claude -p`)**, autenticada com OAuth da conta (não API key). Único provedor: Claude. Migração para **API da Claude** prevista apenas na fase de escala, via troca de configuração (ver Nota de Coerência 4 e RF-11/RF-12).
- **VPS Hetzner** (Linux) disponível para o MVP, com Claude Code instalado e autenticado na conta.
- Módulos do **BMad Method** reaproveitáveis para o pipeline spec-driven.
- Camada **clihelper** (`clihelper.chatmasterveloz.com`) para outbound WhatsApp (rate-limit ~1 req/s); **n8n** (`n8n.todo-tips.com`) como agregador inbound.

### Dependências externas
- GitHub (versionamento, PRs), CI/CD, Prometheus/Grafana (observabilidade), PostgreSQL.

### Fora de escopo (v1)
- Orquestração de infraestrutura de terceiros.
- Gestão financeira/faturamento.
- Multi-tenant (vários usuários simultâneos) — previsto apenas para fase de escala.

---

## 4. Escopo (MVP)

1. **Pipeline SDD com BMad** — da especificação ao planejamento, decomposição de tarefas, implementação e testes.
2. **CLI** — iniciar sessões, gerir memória, acionar agentes, recuperar estados.
3. **Painel Web** — visualização de ondas de execução, decisões e logs (inspirado no painel do *cstk*); construído com a skill de UI/UX (Framer Motion, templates 21st Dev).
4. **Canal WhatsApp** — comunicação assíncrona com o operador (perguntas de clarificação, resumos narrativos, aprovações), via clihelper (outbound) e n8n (inbound).
5. **Banco de conhecimento (PostgreSQL)** — decisões, bloqueios, métricas; alimenta o contexto da IA e a auditoria.
6. **Integração GitHub + CI/CD** — branches, commits, PRs, pipelines de teste/validação.
7. **Observabilidade** — métricas de uso, erros e performance (Prometheus/Grafana).

---

## 5. Requisitos Funcionais

- **RF-01 Orquestrador de agentes** — fluxo spec-driven baseado em BMad: redigir requisitos, decompor tarefas, gerar código, executar testes, revisar. Escolhe modelos/ferramentas dinamicamente por tarefa (*tool routing*).
- **RF-02 Tool routing (modelos Claude)** — escolha em runtime do modelo Claude conforme complexidade (Haiku p/ tarefas simples, Sonnet/Opus p/ complexas). **Sem troca de provider.** No driver `subscription` (MVP) o roteamento é **best-effort** via `--model` quando o Claude Code o honrar, com **fallback determinístico para "modelo único da conta"** (scheduler vira no-op de modelo) — a viabilidade real é validada na PoC do Sprint 0. No driver `api` (escala) o roteamento é por chamada. A política de seleção é a mesma em ambos.
- **RF-03 Autonomia por padrão + verificação automática** — os agentes operam com **autonomia total** por padrão. A verificação primária é **automática**: cada saída é validada por outro agente verificador e/ou por testes, linters e scanners de segurança antes de ser aceita. **Não há gate humano de finalização** — o humano só é convocado nos gates críticos do RF-03b. Tudo o que não estiver nessa lista (gerar código, escrever/rodar testes, commits locais, abrir PR como rascunho, loops de correção, refactor) é executado sem aprovação humana.
- **RF-03b Gates de decisão humana (lista fechada)** — o agente **suspende e convoca o humano** (assíncrono, via WhatsApp/Painel) **apenas** quando atinge um destes gates:
  1. **Merge em branch protegida / deploy em produção** — ação irreversível no repo/ambiente principal.
  2. **Operação destrutiva de dados** — DROP, DELETE em massa, `rm` fora do workspace, truncamento de tabela.
  3. **Gasto ou credenciais** — pagamento, rotação/criação de secret, mudança de billing/plano.
  4. **Infra sensível** — alteração de DNS, firewall, ou escalonamento que afete custo material.
  5. **Decisão de produto** — criar projeto/feature novo, ou mudar o escopo de uma spec aprovada (intenção, não execução).
  6. **Escalada por falha** — após **N loops de correção** sem sucesso (N configurável) ou conflito irresolúvel; o agente reconhece o próprio limite em vez de insistir.

  A lista é **fechada e versionada** (governança no nível de ferramentas, RNF 6.1): adicionar/remover gate é mudança explícita de configuração, auditada. Convocações de gate têm **timeout configurável** — expirado, a ação fica pendente (nunca auto-aprovada para itens 1–4).

  **Enforcement determinístico (não por juízo do LLM):** os gates 1–4 (ações com efeito externo destrutivo) são impostos por um **capability broker** no Control Plane que classifica a ação **por regra** e força a suspensão **antes** do efeito — o agente não decide se "isto é um gate". O worker não tem shell livre: efeitos privilegiados são capabilities mediadas. Redes de segurança independentes: FS read-only fora do workspace e branch protection no GitHub.

  **Canal de aprovação:** a **decisão de gate ocorre no Painel autenticado (GitHub OAuth)**; o WhatsApp apenas **notifica** (deep link) — o segredo de aprovação não trafega pelo trust boundary n8n.
- **RF-04 Registro de decisões e auditoria** — todas as decisões, chamadas de ferramenta, falhas e tempos gravados no banco; painel exibe ondas, decisões e justificativas.
- **RF-05 Memória de contexto** — mecanismo de memória (estilo `knowledge.db`) injeta contexto relevante nas interações da IA.
- **RF-06 CLI** — iniciar projetos/features, recuperar estados, abrir sessão do orquestrador, gerir logs, atualizar modelos/ferramentas.
- **RF-07 Painel Web** — observar execução em tempo real, pausar/retomar, responder clarificações; exibir ondas, decisões, modelo, custo estimado e métricas.
- **RF-08 Canal WhatsApp** — enviar resumos narrativos e **notificações de gate (com deep link para o Painel)** ao operador; receber respostas/clarificações de baixo risco. **A aprovação de gates de alto impacto NÃO é feita no WhatsApp** (ocorre no Painel autenticado, RF-03b). Drop-at-ingress com schema mínimo (Pydantic) + HMAC + idempotency key no inbound; n8n é a fronteira de confiança upstream (conteúdo tratado como não-confiável).
- **RF-09 Integração GitHub/CI** — criar branches, abrir PRs, executar pipelines, merge mediante aprovação; tokens de privilégio mínimo, respeitar políticas de branch.
- **RF-10 Módulos de extensão (porta no MVP; mecanismo pós-MVP)** — o MVP entrega apenas a **interface** (`contracts/ports.py`) que permitirá módulos BMad comunitários/proprietários. O **registry de módulos + o gate de avaliação de risco pré-implantação** (exigido pela RNF 6.1 para cada novo módulo) são entregues **pós-MVP** — instalar módulos arbitrários sem esse gate viola a própria política de segurança.
- **RF-11 Execução autônoma com controle de sessão** — o orquestrador conduz o pipeline (análise→spec→planejamento→execução→revisão) de ponta a ponta **sem intervenção contínua**, gerindo o ciclo de vida das sessões Claude: criar/abrir, persistir `session_id`, **retomar (`--resume`)** após pausa/falha/limite, fazer checkpoint de progresso, e respeitar os **limites de uso da conta de assinatura** (janela/rate). Pausas por limite de janela devem suspender e retomar automaticamente, não abortar. As pausas de **aprovação humana** (RF-03) ocorrem de forma assíncrona (WhatsApp/Painel) sem bloquear a sessão indefinidamente.
- **RF-12 Abstração de provider (conta ↔ API)** — o acesso ao LLM passa por uma camada única com dois *drivers* intercambiáveis por configuração: **`subscription`** (Claude Code headless `claude -p`, padrão do MVP) e **`api`** (API da Claude, fase de escala). Nenhum código de domínio referencia diretamente o mecanismo de invocação; trocar de driver é mudar config, não arquitetura.

---

## 6. Requisitos Não Funcionais

### 6.1 Segurança
- Avaliação de risco pré-implantação de cada novo agente/módulo (mapear sistemas, APIs, permissões).
- Privilégio mínimo + credenciais separadas por agente. **Coerência:** no driver `subscription` (MVP) todos os agentes compartilham UMA conta Claude — "cada agente como principal" é **aspiracional até o driver `api`**; no MVP a separação é real no **nível de ferramentas e de SO** (GitHub tokens escopados, roles de DB, isolamento de papéis: ingestão de conteúdo não-confiável separada do papel com token de escrita, em containers/uids distintos).
- Arquitetura Zero-Trust (autenticação/autorização por ação; gateways no nível de infraestrutura).
- Sandbox para agentes/módulos recém-implantados até avaliação de comportamento.
- Validação de entrada e criptografia em trânsito e repouso.
- Aprovação humana **restrita à lista fechada de gates do RF-03b** (merge/deploy, dados destrutivos, gasto/credenciais, infra sensível, decisão de produto, escalada por falha). Fora desses gates, os agentes têm autonomia total.
- Monitoramento contínuo de comportamento e estado de memória dos agentes.
- Inventário de agentes (proprietário, sistemas acessados, nível de autonomia).
- Cada agente tratado como principal de segurança; governança definida **antes** de o agente se tornar crítico.
- Governança no nível de ferramentas: função mínima, validação de I/O, aprovação para ações irreversíveis.

### 6.2 Conformidade LGPD/GDPR
- Coleta mínima; anonimização/pseudonimização quando possível.
- Consentimento e transparência; revogação para dados de usuários finais.
- Direitos do titular: acesso, correção, exclusão. **Mecanismo:** como o `audit` é imutável (append-only/hash-chain), a "exclusão" de dados pessoais usa **crypto-shredding** (descarte da chave `pgcrypto`); PII nunca entra no audit em claro (só referência pseudonimizada); política específica para embeddings em `memory`.
- Retenção e descarte seguro de logs/dados sensíveis.
- Transferência internacional: avaliar cláusulas se VPS/Claude API estiverem fora do Brasil/UE.

### 6.3 Escalabilidade e Performance
- Arquitetura modular: serviços (agentes) independentes, isolados por falha.
- Implantação containerizada com **Docker Swarm** (escalonamento, atualização, tolerância a falhas).
- Tool routing por complexidade (modelos Claude) para eficiência de custo.
- Planner–executor loops e decomposição hierárquica para paralelizar subtarefas.
- Monitoramento de custos (tempo, tokens, chamadas de API) com limites de execução.

### 6.4 Manutenibilidade e Testabilidade
- **Python** como linguagem principal (ecossistema IA maduro; integração com frameworks de orquestração). Node.js apenas em componentes pontuais com benefício claro.
- Testes unitários e de integração por módulo do orquestrador; suíte de integração real (não apenas mock) — mock prova construção, integração prova comportamento.
- Para código gerado pela IA: linters + scanners (OWASP) antes de merge.
- Observabilidade: logs estruturados, métricas e traces; endpoints Prometheus.

---

## 7. Arquitetura Proposta (alto nível)

Todas as camadas empacotadas como contêineres em cluster **Docker Swarm** na Hetzner.

1. **Interface (CLI + Painel Web + WhatsApp)** — recebe comandos, exibe progresso, coleta respostas/aprovações. Consome a camada de orquestração via APIs internas.
2. **Orquestrador de Agentes** — núcleo spec-driven (inspirado em cstk + BMad): cria/carrega projetos; invoca agentes de análise/planejamento/implementação/teste/revisão (sequencial/paralelo); aplica tool routing (modelos Claude); insere guardrails; grava eventos e publica métricas.
3. **Módulos de agentes (BMad/custom)** — skills especializadas (elicitação, geração de código, análise de performance).
4. **Camada de Integração** — adaptadores GitHub, CI/CD e observabilidade; broker central (MCP) para controlar acesso a APIs externas sob políticas de segurança.
5. **Armazenamento e Memória** — **PostgreSQL** autohospedado (sessões, decisões, logs, métricas); arquivos versionados no GitHub; injeção de memória no contexto dos agentes.
6. **Serviços de segurança e governança** — avaliação de risco, autorização, auditoria de logs, classificação de ações, aprovação humana.

### Fluxo (simplificado)
1. Operador inicia projeto/feature (CLI/Painel/WhatsApp); orquestrador recupera contexto da memória.
2. **Análise** (Claude) — brainstorming/pesquisa técnica, perguntas de clarificação.
3. **Especificação** (Claude) — agente redige spec funcional.
4. **Planejamento/decomposição** (Claude) — planner–executor loops dividem em ondas; tool routing seleciona o modelo Claude apropriado.
5. **Execução** (Claude) — agentes implementam código + testes + commits locais **autonomamente**; verificação automática (agente verificador + testes/linters/scans); falhas geram loops de correção autônomos, e **só escalam ao humano após N tentativas** (gate RF-03b.6).
6. **GitHub/CI** — onda validada vira branch + PR (rascunho, autônomo); CI reexecuta testes/scans. **O merge em branch protegida é gate humano (RF-03b.1).**
7. **Revisão e auditoria** — painel/WhatsApp exibe o **Resumo narrativo** das ondas/decisões/justificativas para transparência (leitura opcional); o humano **decide apenas nos gates RF-03b**; tudo registrado.
8. **Deploy e monitoramento** — pós-merge, agentes de suporte monitoram produção e alertam anomalias/violações.

---

## 8. Métricas e Indicadores de Sucesso

- **Tempo médio por feature** (wallclock e tempo efetivo de agentes).
- **Taxa de convocação de gates** por feature (RF-03b) — quantas vezes o pipeline precisou de decisão humana e em qual gate. Meta: convocações raras e concentradas nos gates 1–5; convocações por escalada (gate 6) são sinal de fragilidade a investigar.
- **Aderência ao orçamento** — custo real vs. teto de **US$ 200/mês**. No MVP (driver `subscription`) o custo é **fixo** (assinatura Claude + VPS Hetzner), não por token; a métrica relevante passa a ser **consumo da janela/limites da conta** (quão perto dos limites de uso da assinatura o pipeline opera) e **utilização da infra**. Tokens metered só voltam a ser métrica de custo no driver `api` (escala).
- **Saúde das sessões** — taxa de retomadas (`--resume`) por limite de janela vs. por falha; tempo perdido em pausas; sessões abortadas sem checkpoint.
- **Bloqueios/falhas** — ciclos de correção por feature e motivos.
- **Qualidade e cobertura** — métricas de linters/scanners.
- **Conformidade** — violações de acesso/dados detectadas e corrigidas.

---

## 9. Roadmap (referência do documento-fonte)

| Fase | Duração (sem.) | Principais entregas |
|---|---|---|
| 1. Preparação | 1–2 | Requisitos detalhados, arquitetura, escolha Python, provisionar VPS, criar repo. |
| 2. BMad + PoC | 2–3 | Instalar BMad, fluxo mínimo análise→planejamento→implementação com Claude. |
| 3. Orquestrador | 4–6 | Integração GitHub/CI, banco de conhecimento, tool routing, guardrails básicos, CLI, logs/métricas. |
| 4. Segurança e Governança | 3–4 | Least privilege, sandboxing, monitoramento, LGPD/GDPR, credenciais separadas, aprovadores humanos. |
| 5. Painel Web + Observabilidade | 2–3 | UI de execuções/decisões, Prometheus/Grafana, performance. |
| 6. Piloto e Ajustes | 2–4 | Piloto em projeto real, métricas, otimização de custo/performance. |
| 7. Documentação e Escala | 1–2 | Docs (segurança/conformidade), treinamento, plano de expansão. |

---

## 10. Questões em Aberto

- **Customização do BMad** — quais módulos reaproveitar vs. desenvolver sob medida.
- **ToS / limites da conta de assinatura (risco D-032)** — usar a assinatura Claude para automação contínua de servidor pode esbarrar nos termos de uso e nos limites de janela/rate da conta (ex.: Max 20x). Validar comportamento real (quantas sessões paralelas a conta tolera, frequência de bloqueio por janela) **no Sprint 0** antes de comprometer o pipeline autônomo. Plano B: driver `api` antecipado.
- **Controle de sessão headless** — confirmar que `claude -p --resume` em ambiente headless preserva contexto de forma confiável após pausa por limite; definir paralelismo máximo de sessões sob uma única conta.
- **Tool routing Claude** — política concreta de seleção Haiku/Sonnet/Opus por tipo de tarefa (e o que disso é controlável via Claude Code no driver `subscription`).
- **Hospedagem WhatsApp** — formalizar contrato clihelper/n8n e limites de rate.
- **Conformidade internacional** — adequações se houver transferência de dados para fora do país.
- **Orçamento** — modelo de custo de tokens Claude para manter ≤ US$ 200/mês (recomputar a partir do antigo AO-151).
