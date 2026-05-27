---
title: "Templates de Resumo de Finalização — HDD (3-tier)"
status: draft
created: 2026-05-20
applies_to: "FR-070..076 do PRD HDD"
---

# Templates do Resumo de Finalização — 3-tier

> Especificação do conteúdo de cada tier. Não é especificação de **entrega** (canal, parsing de resposta) — isso fica para `bmad-architecture`.

---

## Princípios

1. **Tier-A é o iscar.** Se ler só A, o revisor deve saber decidir em ≤ 30s se precisa abrir B.
2. **Cada tier é standalone.** B repete e estende A (não exige ler A primeiro). C repete e estende B.
3. **Decisões antes de descrições.** O revisor importa-se com **o que foi escolhido e porquê**, não com a narrativa do processo.
4. **Trade-offs explícitos, sempre.** Cada decisão crítica tem o "deu-se ao trabalho de não-X porque...".
5. **Bounded by structure, not length.** Tier-A ≤ 200 palavras é meta, não regra inflexível — se ficar 220 a comunicar 5 decisões, ok.

---

## Tier-A — Glance

**Para:** notificação no canal (Slack DM, e-mail).
**Tamanho-alvo:** 120-200 palavras.
**Tempo de leitura:** ≤ 30s.

### Estrutura

```markdown
**[<emoji-status>] <Workflow>** · <projeto> · <data>

<Frase única descrevendo o que foi entregue, com substantivo concreto>.

**Decisões críticas:**
- <Decisão 1 em formato "X (não Y porque Z)">
- <Decisão 2>
- <Decisão 3>
[máx 5]

**Estado:** <verdict> · **Open items:** N · **Janela usada:** X%

→ Ver Tier-B: `<link>` · Aprovar: `<comando ou botão>`
```

**Conventions:**
- `<emoji-status>`: ✅ ready-for-review · ⚠️ ready-with-flags · 🛑 blocked
- "X (não Y porque Z)" é o formato canónico para mostrar trade-off em 1 linha
- "verdict" ∈ {`ready-to-merge`, `needs-attention`, `phase-blocker`}

---

## Tier-B — Briefing

**Para:** leitura no canal quando A não basta.
**Tamanho-alvo:** ≤ 1 página renderizada (~600-900 palavras).
**Tempo de leitura:** 2-3 minutos.

### Estrutura

```markdown
# <Workflow> — <projeto> · <data>

## Contexto (1-2 frases)
<Onde estamos no ciclo BMAD, qual a fase actual, o que motivou este workflow>

## O que foi feito
- **<Artefacto 1>** (`<path>`) — <1 linha do que contém>
- **<Artefacto 2>** (`<path>`) — <1 linha>
[Todos os ficheiros produzidos ou alterados; max ~10 entradas top-level, com sub-bullets se necessário]

## Decisões críticas (5-10)
| # | Decisão | Razão / Trade-off | ID no log |
|---|---|---|---|
| 1 | <decisão> | <razão + alternativa rejeitada> | D-NNN |

## Trade-offs aplicados (3-7)
- **Quis X, escolheu Y:** <contexto> — <consequência>
[Sumário narrativo de trade-offs estratégicos, distinto da tabela de decisões]

## Open items deferidos
- **O-N:** <pergunta aberta> → <onde será resolvida>
[Apenas os ficaram em aberto; remover os fechados]

## Reviewer findings (se houve gate)
- <verdict da rubric>: <N critical / N high / N medium / N low>
- **Resolvido:** <fixes aplicados in-line>
- **Diferido:** <findings não-bloqueadores>

## Métricas
- Janela LLM: X% (Opus N%, Sonnet N%, Haiku N%)
- Duração: HHh MMm
- Artefactos gerados: N
- Decisões registadas: N (humanas: N / automáticas: N)

## Próximos passos sugeridos
1. <Workflow BMAD candidato> — <porquê>
2. <Workflow alternativo> — <quando faz sentido>

→ Ver Tier-C: `<link>` · Aprovar: `<comando>` · Pedir alterações: `<comando>`
```

---

## Tier-C — Full

**Para:** auditoria, downstream workflows, histórico.
**Tamanho-alvo:** sem limite — completude > brevidade.
**Tempo de leitura:** 10-30 minutos.

### Estrutura

```markdown
# <Workflow> — <projeto> · <data> · Full

[Frontmatter completo do workflow]

## 1. Tier-B inline
[Todo o conteúdo do Tier-B, inalterado]

## 2. Decision log integral
[Conteúdo de `.decision-log.md` do workflow, sem omissões]

## 3. Reviewer Gate completo
[Conteúdo de `review-rubric.md` se aplicável + reviews adicionais]

## 4. Diff vs estado anterior
### 4.1 Ficheiros novos
- `<path>` (+ N linhas)

### 4.2 Ficheiros alterados
[diff resumido por ficheiro, linkado a git diff completo]

### 4.3 Ficheiros removidos
[se aplicável]

## 5. Inventário de artefactos
| Path | Tamanho | Tipo | Status |
|---|---|---|---|
| ... | ... | ... | final/draft |

## 6. Inputs consumidos
- `<path>` — <papel no workflow>

## 7. Assumptions Index
[Tabela completa do PRD, com estado actualizado de cada uma]

## 8. Trilha de aprovações anteriores
[Se este workflow teve revisões parciais antes, lista cronológica]

## 9. Apêndices
[Conteúdo extra que não cabe acima — exploração de alternativas, esboços, etc.]
```

---

## Convenções comuns aos 3 tiers

- **Datas** em ISO 8601 (`2026-05-20T14:32:00Z`)
- **Paths** sempre relativos ao workspace root, dentro de backticks
- **IDs** (D-NNN, FR-NNN, NFR-XN, KPI-N, A-NN, O-N) usam a convenção do PRD HDD
- **Idioma** = `document_output_language` do projeto (HDD: pt-PT)
- **Markdown** padrão CommonMark; tabelas GFM permitidas
- **Frontmatter YAML** opcional em B/C; obrigatório em ficheiro persistido
- **Verdicts** consistentes entre tiers: o Tier-A diz `ready-to-merge`; o Tier-B explica porquê; o Tier-C tem a evidência

---

## Anti-padrões a evitar

- ❌ "Foi feito muito trabalho" — usar **artefactos** como prova
- ❌ Listas de FRs implementados sem dizer **o que ficou diferente** (mostrar consequência, não atividade)
- ❌ "Várias decisões foram tomadas" — enumerá-las
- ❌ Tier-A com 500 palavras (deixa de ser glance)
- ❌ Tier-B sem secção de Trade-offs (sinal de processo low-judgment)
- ❌ Tier-C sem secção de Diff (perde valor de auditoria)
- ❌ "Tudo correu bem" como verdict — preferir `ready-to-merge` ou equivalente formal
