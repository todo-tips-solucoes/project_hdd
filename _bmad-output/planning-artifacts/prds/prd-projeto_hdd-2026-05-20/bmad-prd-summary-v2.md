---
title: "Resumo de Finalização — bmad-prd v2 · HDD"
workflow: bmad-prd
workflow_id: prd-projeto_hdd-2026-05-20
version: 2
project: projeto_hdd
project_name_official: "HORSE DRIVEN DEVELOPMENT (HDD)"
phase: Planejamento
date: 2026-05-20
status: ready-for-review
supersedes: bmad-prd-summary.md (v1)
---

# Resumo de Finalização — `bmad-prd` v2 · HDD

> **v2:** reconciliação do PRD com o `brief.md` que existia desde 2026-05-20 02:37 mas não tinha sido descoberto. Detectado em `bmad-create-architecture` Step-01 Input Discovery. PRD v1 estava finalizado mas continha drift material (Slack/local/CP-1..7) face ao brief autoritativo (WhatsApp/VPS/P1+S1+S2+S3).

---

## Tier-A — Glance

```
[⚠️] bmad-prd v2 · projeto_hdd · 2026-05-20

PRD v1 era válido mas drift com brief autoritativo (WhatsApp vs Slack, VPS vs local, regra interrupt P1+S1+S2+S3 vs CP-1..7 fixos). v2 reconcilia brief verbatim onde conflita; preserva D-016..D-019 do operador. 10 decisões novas (D-020..D-029), 7 Open Items fechados, 8 OQ-A..H herdadas do brief para arquitetura.

Decisões críticas:
• Brief é autoritativo; PRD v1 foi sobreposto (não duplicado) — mesma path
• Modelo bimodal substitui CP-1..7: Fases 1-2 sempre Colab; 3-4 Auton após Readiness
• Canal = WhatsApp (sistema próprio do operador), VPS = própria do operador
• Regra de interrupt = 1 trigger P1 (gap código↔PRD) + 3 watchdogs S1/S2/S3
• S3 (canal indisponível) NÃO pausa — fallback automático para e-mail
• Marcos M0/M1/M3/M6/Q4-2026 substituem KPI-1..6 genéricas
• 3 princípios não-negociáveis adoptados como Goal G-5 (gate, não nice-to-have)

Estado: ready-for-review · Open items: 11 (3 do v1 mantidos + 8 OQ herdadas do brief) · Janela usada: ~5% [estimativa cumulativa]

→ Tier-B: ./bmad-prd-summary-v2.md#tier-b-briefing · Aprovar: `approve prd-projeto_hdd-2026-05-20-v2`
```

**(195 palavras)**

---

## Tier-B — Briefing

### Contexto
PRD v2 do projeto HDD foi forçado por descoberta de drift contra brief autoritativo durante init de `bmad-create-architecture`. v1 foi criado a partir de `documentos/Solução OpenClaw BIMED.docx` sem descobrir o `brief.md` que existia desde 2026-05-20 02:37 (3 horas antes do meu turn no bmad-prd v1). v1 tinha consequências materiais: assumiu Slack onde brief diz WhatsApp; assumiu local onde brief diz VPS; tinha 7 CPs distribuídos onde brief tem bimodal estrito + 4 triggers explícitos.

### O que foi feito
- **`prd.md` v2** (status:final, ~430 linhas) — reescrito em ~14 secções com modelo bimodal, regra de interrupt P1+S1+S2+S3 (substitui CP-1..7), canal WhatsApp + fallback e-mail S3, deploy VPS, marcos M0..Q4-2026, 3 princípios não-negociáveis como G-5, glossário e Assumptions Index actualizados.
- **`addendum.md` v2** — §A2 esboço arquitetural reescrito (Modo Colab + Modo Auton + diagrama lógico ASCII); §A3 substitui CP-1..7 por separação **Finalizações planeadas (F-PRD..F-RELEASE)** + **Interrupts (P1/S1/S2/S3)**.
- **`.decision-log.md`** — D-020 a D-029 adicionados; Open Items reestruturados (3 herdados v1 abertos + 8 OQ-A..H do brief + 7 fechados).
- **`bmad-prd-summary-v2.md`** (este ficheiro) — Resumo v2.
- **`feedback-bmad-prd-discover-brief.md`** em memória persistente — regra para que futuras invocações de bmad-prd descubram briefs prévios.

### Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---|---|---|
| 1 | Brief é autoritativo; refazer PRD em vez de reconciliar em arquitetura | Operador escolheu Option A; zero drift downstream; custo = 1 sessão extra de PRD | D-021 |
| 2 | Modelo bimodal Colab(F1-2)/Auton(F3-4) substitui CP-1..7 | Brief explicita "execução é o gargalo"; CP distribuído não captura o split | D-024 |
| 3 | Canal primário = WhatsApp do sistema próprio (não Slack) | Brief P-3: "canal onde user REALMENTE responde rápido" — Slack era assumption sem base | D-021 |
| 4 | S3 não pausa; fallback automático para e-mail | Brief explícito: pipeline NÃO para quando o canal falha — canal falhar não é erro do trabalho | D-022 |
| 5 | Worker em VPS própria (não local) | Brief pré-requisito; local-only do v1 era assumption sem base | D-023 |
| 6 | 3 princípios não-negociáveis promovidos a G-5 (gate) | Violação = bloqueia release; não são nice-to-have | D-025 |
| 7 | Marcos M0..Q4-2026 substituem KPIs | Brief tem âncoras temporais reais (1 mês, 3 meses, 6 meses, Q4); v1 era genérico | D-026 |
| 8 | 8 OQ-A..H herdadas do brief para arquitetura | Brief deixou 5 explícitas; PRD v2 adiciona 3 derivadas (library WhatsApp, e-mail provider, runtime worker) | D-027 |
| 9 | Persona "Revisor Convidado" removida | Brief: WhatsApp é direto ao operador único; não há revisor convidado no v1 | D-028 |
| 10 | Preservados: HDD naming (D-016), Max 20x (D-017), piloto=projeto_hdd (D-018), revisão obrigatória (D-019) | Decisões explícitas do operador posteriores ao brief; sobrepõem-se | (mantidos) |

### Trade-offs aplicados

- **Reescrever PRD vs reconciliar inline em arquitetura.** Escolhido: reescrever. Custo: 1 sessão extra; ganho: zero drift downstream, todas as 8 OQ herdadas do brief têm âncora explícita no PRD v2.
- **Manter mesmo ficheiro (`prd.md`) vs criar `prd-v2.md` separado.** Escolhido: mesmo ficheiro com `version: 2` + `supersedes` no frontmatter. Custo: v1 só sobrevive via git history + Resumo v1 + decision-log. Ganho: nome estável para downstream skills referenciarem.
- **Fork (a) BMAD interno vs (b) SaaS vs (c) Notion SOP.** Brief já tinha decidido (a); v2 confirma e adiciona explicitamente N-5 ("não empacotar como produto open-source ou comercial no v1").
- **Piloto = `projeto_hdd` (D-018) vs deixar aberto como brief Q-1 sugere.** Mantido D-018 — operador respondeu "esse projeto" explicitamente. Brief Q-1 fechada por D-018.
- **WhatsApp não-oficial (Baileys/whatsapp-web.js) vs Cloud API oficial.** Adoptada via brief: sistema proprietário do operador (já existente), com risco de ban Meta como R-1; mitigação via S3 fallback. Cloud API oficial implicaria templates aprovados e lock-in — descartada.

### Open items deferidos (11)

**Mantidos do v1:**
- O-2 calibrar M1/M3 com piloto
- O-9 web research formal (BMAD_Openclaw + Baileys/whatsapp-web.js + ToS Meta)
- O-10 multi-tenancy v1.1+

**Herdados do brief (canónicos para arquitetura):**
- OQ-A gap detector no `bmad-code-review`
- OQ-B state store (Redis vs SQLite vs ...)
- OQ-C limite retries S2 (default 5 — calibrar)
- OQ-D política de rollback parcial
- OQ-E library WhatsApp
- OQ-F provider e-mail
- OQ-G worker runtime (Node vs Python)
- OQ-H invocação programática BMAD (directa vs CLI-wrapper)

### Reviewer findings

**Self-review delta v1→v2** (sem novo reviewer gate completo — escala desproporcional ao incremento; rubric pode ser re-aplicada se operador quiser).

Dimensões com mudança material:
- **Strategic coherence:** ⬆️ improved — tese agora ancorada em brief verbatim ("execução pós-escopo-definido é o gargalo"); v1 inferia.
- **Scope honesty:** ⬆️ improved — brief tem "Inclui / Não inclui" explícitos; v2 adopta.
- **Done-ness clarity:** = unchanged — FRs continuam testáveis.
- **Shape fit:** ⬆️ improved — modelo bimodal é a shape correcta; CP-1..7 era over-formalizado.
- **Decision-readiness:** ⬆️ improved — trade-offs do brief (fork a vs b vs c) agora visíveis.
- **Mechanical:** ⚠ — Assumptions Index tem mistura de marcas (✅/~~/⏳); standardizar em re-review.

### Métricas
- Janela LLM: ~5% cumulativo (estimativa; instrumentação real é OQ pendente em arquitetura).
- Duração: 2 sessões (v1 + v2 update); v2 ~30 min de tool calls.
- Artefactos gerados/alterados: 7 ficheiros (4 no workspace + 1 memória nova + 2 actualizados).
- Decisões: 29 totais (10 novas em v2: D-020..D-029).
- Open items: 11 abertos (vs 6 no fim do v1).

### Próximos passos sugeridos
1. **Retomar `bmad-create-architecture`** — agora com brief + PRD v2 + addendum v2 + brief addendum como inputs canónicos confirmados. As 8 OQ-A..H têm de ser resolvidas neste workflow.
2. *Antes de (1) — opcional:* fechar **O-9** (web research formal de BMAD_Openclaw upstream + Baileys ToS).
3. `bmad-create-epics-and-stories` — só após arquitetura aprovada.

→ Tier-C: ./bmad-prd-summary-v2.md#tier-c-full · Aprovar: `approve prd-projeto_hdd-2026-05-20-v2` · Pedir alterações: `request_changes <nota>`

**(795 palavras)**

---

## Tier-C — Full

### 1. Tier-B inline
*(repetido acima)*

### 2. Decision log integral
**Fonte canónica:** `./.decision-log.md` (29 entradas D-001..D-029 + Open Items v2).

Resumo cronológico de v2:
- **D-020** Brief descoberto post-PRD-v1 (bug do bmad-prd)
- **D-021** Operador escolheu "Brief é autoritativo"; fecha O-5 (canal=WhatsApp)
- **D-022** S3 não pausa; fecha O-6
- **D-023** Worker em VPS própria; fecha O-8
- **D-024** Bimodal substitui CP-1..7
- **D-025** 3 princípios não-negociáveis como G-5
- **D-026** Marcos M0..Q4-2026 substituem KPI-1..6
- **D-027** 8 OQ-A..H herdadas do brief
- **D-028** Persona Revisor Convidado removida
- **D-029** v2 finalize

### 3. Reviewer Gate completo
**v1:** `./review-rubric.md` (rubric oficial 7 dimensões; verdict adequate; 0 critical, 3 high resolvidos, 5 medium resolvidos, 2 low diferidos).
**v2 delta:** auto-review acima na secção "Reviewer findings". Rubric formal não foi re-corrida — operador pode pedir se quiser confiança formal.

### 4. Diff vs estado anterior (v1)
**Linhas alteradas:** essencialmente reescrita de §1-§14 do prd.md. Estrutura preservada; substância actualizada.

**Ficheiros novos em v2:**
- `bmad-prd-summary-v2.md` (este)
- `/root/.claude/projects/-var-lib-projeto-hdd/memory/feedback-bmad-prd-discover-brief.md`

**Ficheiros alterados em v2:**
- `prd.md` — reescrita substantiva (~330 linhas alteradas)
- `addendum.md` — §A2 reescrito, §A3 reescrito, frontmatter v2
- `.decision-log.md` — D-020..D-029 + Open Items reestruturados
- `/root/.claude/projects/-var-lib-projeto-hdd/memory/MEMORY.md` — entrada nova

**Ficheiros preservados sem alteração:**
- `review-rubric.md` v1 (histórico)
- `bmad-prd-summary.md` v1 (histórico)
- `finalization-summary-templates.md` (templates não dependem do conteúdo do PRD)
- `.source-extract.md` (extracção do .docx)

### 5. Inventário de artefactos

| Path | Versão | Status |
|---|---|---|
| `prd.md` | v2 | final |
| `addendum.md` | v2 | final |
| `.decision-log.md` | 29 entradas | imutável após D-029 |
| `review-rubric.md` | v1 | imutável (histórico) |
| `bmad-prd-summary.md` | v1 | imutável (histórico) |
| `bmad-prd-summary-v2.md` | v2 | ready-for-review |
| `finalization-summary-templates.md` | draft | input para arquitetura |
| `.source-extract.md` | imutável | input v1 |

### 6. Inputs consumidos em v2

- `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/brief.md` — **canónico**; todas as decisões v2 derivam dele.
- `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/addendum.md` — detalhe técnico (stack WhatsApp, RNFs, arquitetura proposta, riscos).
- `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/.decision-log.md` — trilha do brief (intent → fork → first principles → correções → shark tank).
- `documentos/Solução OpenClaw BIMED.docx` (legado v1) — não consultado em v2; o brief é o estágio downstream do .docx.

### 7. Assumptions Index actualizado (v2)

Ver §14 do `prd.md` — 14 entradas, 8 resolvidas (✅), 6 ainda abertas/calibrar.

### 8. Trilha de aprovações anteriores

- 2026-05-20 PRD v1 — `bmad-prd-summary.md` ready-for-review; **aprovação implícita** quando operador respondeu Open Items (O-1/O-3/O-4/O-7) e disse "Avançar para /bmad-architecture". Esta aprovação está agora superada pela v2.
- 2026-05-20 PRD v2 — **pendente** (este resumo).

### 9. Apêndices

- **Bug detetado e arquivado:** `bmad-prd` v6.7.1 não faz discovery proactiva de briefs em `planning-artifacts/briefs/`. Documentado em `feedback-bmad-prd-discover-brief.md` na memória persistente; futuras invocações já terão a regra. Vale considerar fork interno da skill ou PR upstream para o `bmad-method` corrigir isto.
- **Anti-padrões evitados em v2:** ❌ não-duplicado de v1 sem indicar versão; ❌ não-ignorado o brief; ❌ não-misturado interrupts (eventos) com finalizações (planeadas) — separação clara em §A3.

---

## Estado final do workflow

**`paused-awaiting-review`** desde 2026-05-20.
Aguardando `approve prd-projeto_hdd-2026-05-20-v2` ou `request_changes <nota>` para retomar `bmad-create-architecture` com inputs limpos.
