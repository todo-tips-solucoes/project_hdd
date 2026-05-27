# NEXT SESSION — Sprint 0 Day 1 · Story 1.c.7

> Copia o bloco abaixo para a próxima sessão limpa Claude Code.
> `MEMORY.md` (16 memórias) + `CLAUDE.md` carregam automaticamente; o resto está
> persistido em artefactos canónicos referenciados.

---

```
És o Developer agent do HDD (HORSE DRIVEN DEVELOPMENT, project_name=projeto_hdd).
Hoje é Sprint 0 Day 1 — primeira sessão pós aprovação completa do pipeline BMAD
(PRD v2 D-030, Architecture D-040, Epics D-045, Readiness D-047, Course
Correction D-049, Sprint Planning concluído). Capacity assumption Cenário B
Expected confirmada (D-046: 6-7 sty/sem, Sprint 0 = 3-4 semanas).

## A tua tarefa

Executar **Story 1.c.7 — bmad-cli smoke test + Plan B fork docs** como Day 1
hard prereq. Esta story bloqueia Epic 2 inteiro: se `bmad-cli` non-interactive
não funcionar, todo o worker autónomo precisa de Plan B antes de continuar.

## Onde estão os detalhes canónicos (lê primeiro, nesta ordem)

1. `_bmad-output/implementation-artifacts/sprint-status.yaml` — estado actual
   (todos `backlog`, story key `1-c-7-bmad-cli-smoke-test-plan-b-fork-docs`)
2. `_bmad-output/planning-artifacts/epics.md` — procura "### Story 1.c.7" para
   StorySpec completo: files_created, files_modified, ao_subset, ACs
   Given/When/Then, estimated_tokens
3. `_bmad-output/planning-artifacts/architecture.md` — referência só se
   precisares desambiguar decisões de stack (D-035 Bun, D-043 Bun substitui
   OpenClaw, D-044 LLM hybrid)
4. `_bmad/_config/manifest.yaml` — versão BMAD canónica (v6.7.1)

NÃO releias o PRD inteiro nem epics.md inteiro — só a secção da Story 1.c.7
e referências adjacentes.

## O que executar

A story declara:
- **files_created:** `scripts/smoke-bmad-cli.sh`, `docs/decisions/bmad-cli-vs-plan-b.md`,
  `tests/integration/bmad-cli.test.sh`
- **blocked_by:** [] (corre primeiro)
- **ao_subset:** [AR-077, AR-078, FR-006, FR-081, project-hdd-openclaw-substituted-by-bun memory]

### Acceptance Criteria (extraídos da story)

**AC-1 (binary):** Smoke test invoca `bmad-help` non-interactive, captura
stdout, exit 0 em ≤30s.

**AC-2 (binary):** Se smoke test falhar, `docs/decisions/bmad-cli-vs-plan-b.md`
decide entre 3 opções (Claude Code headless / re-implement subset / defer worker
autonomous) e regista decisão antes de continuar.

### Ordem sugerida (não dogmática — adapta)

1. **Criar `scripts/` e `docs/decisions/` directories** na raiz `/var/lib/projeto_hdd/`
   (ainda não existem; repo scaffold Bun é Story 1.a.1, posterior).
2. **Escrever `scripts/smoke-bmad-cli.sh`** — bash script que:
   - Verifica BMAD instalado (`ls _bmad/_config/manifest.yaml`)
   - Invoca o que conseguires de BMAD non-interactive (provavelmente algo como
     `npx bmad-method help` ou similar; descobre o command correcto, NÃO inventes)
   - Captura stdout em ficheiro temp
   - Mede tempo (≤30s)
   - Exit 0 sucesso · exit 1 falha com mensagem clara
3. **Correr o smoke test** localmente e ver outcome.
4. **Resultado A (passa):** escreve `docs/decisions/bmad-cli-vs-plan-b.md`
   documentando `PASS` + comando que funcionou + versão BMAD + Plan B status
   "não accionado".
5. **Resultado B (falha):** escreve o mesmo ficheiro com `FAIL`, evidence,
   e propõe Plan B explicit (Opção A/B/C). PARA E PERGUNTA OPERADOR qual Plan
   B activar antes de avançar.
6. **Escrever `tests/integration/bmad-cli.test.sh`** — wraps o smoke + adiciona
   parsing assertions (esse será o teste que CI roda; smoke é one-shot manual).

## Princípios não-negociáveis (D-019 enforced)

- **Single-story-at-a-time** — não tentes adiantar Story 1.a.1 ou outras.
- **NÃO toques em `_bmad/`** (excepto `_bmad/custom/` se precisares overrides).
  É read-only do installer (CLAUDE.md regra crítica).
- **NÃO inventes versões / paths / comandos** — descobre via execução real.
- **Confirma com operador antes de:** (a) decidir Plan B se smoke falhar;
  (b) push/commit qualquer coisa; (c) instalar dependências globais.
- **Resumo de Finalização Tier-B obrigatório** no fim — `summary-generator.service`
  ainda não existe (chega em Story 1.a.8), por isso escreve manualmente em
  `_bmad-output/implementation-artifacts/story-1c7-summary.md` seguindo o
  template em `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md`.
- **Audit log JSONL** ainda não existe (Story 1.a.6) — não fingir que existe.
  Eventos importantes regista em prosa no Resumo Tier-B.

## Outputs esperados desta sessão

1. `scripts/smoke-bmad-cli.sh` (committable)
2. `docs/decisions/bmad-cli-vs-plan-b.md` (committable; PASS ou FAIL+Plan B
   decision)
3. `tests/integration/bmad-cli.test.sh` (committable)
4. `_bmad-output/implementation-artifacts/story-1c7-summary.md` (Resumo
   Tier-B per D-019, antecipado porque generator ainda não existe)
5. Update `_bmad-output/implementation-artifacts/sprint-status.yaml`:
   `1-c-7-bmad-cli-smoke-test-plan-b-fork-docs: backlog → done` + `epic-1c:
   backlog → in-progress`

## Capacity context

Cenário B Expected (D-046): 6-7 stories/semana. Story 1.c.7 deve durar ~1 dia.
Se exceder 2 dias com smoke a falhar repetidamente, escalate via Trigger P1
(WhatsApp ainda não wired — usa apenas mensagem directa ao operador nesta
sessão).

## Plano de comunicação

- **Antes de começar:** confirma em 2-3 linhas o que entendeste + que vais fazer.
- **A meio (após smoke test corrido):** report do outcome (PASS/FAIL) + decisão
  proposta sobre Plan B se aplicável.
- **No fim:** Resumo Tier-B + pedido de aprovação `approve story-1c7` para
  marcar `done` no sprint-status.yaml.

Começa.
```

---

## Como usar

1. **Abre uma nova sessão Claude Code** em `/var/lib/projeto_hdd`
2. **Cola o bloco delimitado por triple-backticks acima** (entre as linhas `---`)
3. Claude Code vai auto-carregar `MEMORY.md` + `CLAUDE.md` no contexto
4. O prompt direciona-te para os 4 artefactos canónicos críticos (sprint-status, epics §1.c.7, architecture quando preciso, manifest)
5. Confirma a 1ª resposta (2-3 linhas) antes de deixá-lo prosseguir

## O que **não** precisa no prompt (já no contexto base)

- 16 memórias persistentes (`MEMORY.md` auto-loaded) — incluindo D-046 capacity, D-044 LLM hybrid, Bun-first stack, sd_notify gotcha, mandatory review, externalização thesis
- Convenções projeto (CLAUDE.md auto-loaded) — não tocar `_bmad/`, idioma PT, BMAD v6.7.1, paths canónicos
- Identidade operador (paulotodo, operador@example.com)

## Riscos identificados para essa sessão

| Risco | Mitigação no prompt |
|---|---|
| Claude inventar comando `bmad-cli` que não existe | Instrução explícita "descobre o command correcto, NÃO inventes" |
| Claude saltar para Story 1.a.1 (scaffold) | Princípio "Single-story-at-a-time" |
| Claude tentar criar audit JSONL antes de Story 1.a.6 | Instrução explícita "Audit log JSONL ainda não existe (Story 1.a.6) — não fingir" |
| Claude auto-aprovar smoke FAIL e seguir | Instrução explícita "PARA E PERGUNTA OPERADOR qual Plan B" |
| Claude push/commit sem confirmação | Princípio "Confirma com operador antes de push/commit" |
| Resumo Tier-B esquecido | Output #4 explícito + template path |

**Ficheiro guardado:** `_bmad-output/planning-artifacts/NEXT-SESSION-PROMPT-S1c7.md` — podes consultá-lo de novo quando arrancares.