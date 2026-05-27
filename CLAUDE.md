# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Natureza do repositório

Este diretório **não é um codebase de aplicação** — é um workspace BMAD-METHOD recém-instalado. O propósito é planejar e executar projetos de software (do PRD ao código) de forma autônoma usando agentes BMAD invocados via Claude Code. O artefato de partida é `documentos/Solução OpenClaw BIMED.docx`, que descreve em português a metodologia adotada.

Não há `package.json`, build system ou suíte de testes neste diretório raiz — todos os "comandos" são **skills BMAD** invocadas dentro do Claude Code. Não invente targets de `npm run`/`make`.

## Instalação

BMAD-METHOD **v6.7.1** instalado em `2026-05-20` via `npx bmad-method install`. Para re-rodar o instalador (atualizar módulos, mudar respostas, registrar novo IDE), execute novamente no terminal — as respostas anteriores ficam salvas como defaults:

```bash
npx bmad-method install
```

Manifesto autoritativo em `_bmad/_config/manifest.yaml`.

### Módulos instalados

| Módulo | Versão | Origem | Função |
|---|---|---|---|
| `core` | 6.7.1 | built-in | núcleo do método |
| `bmm` | 6.7.1 | built-in | **BMad Method** — fluxo Análise→Planejamento→Solução→Implementação |
| `tea` | v1.19.0 | `bmad-method-test-architecture-enterprise` | arquitetura de testes (Playwright/Pact, traceability, NFR) |
| `bmb` | v1.8.1 | `bmad-builder` | construção de novos agentes/skills/módulos |
| `automator` | main | `bmad-story-automator` | automação do ciclo story→dev→QA→review |
| `cis` | v0.2.1 | `bmad-creative-intelligence-suite` | brainstorming, design thinking, storytelling |
| `wds` | v0.4.3 | `bmad-method-wds-expansion` | Web Design System / produto digital |

### IDEs registrados

`claude-code`, `codex`, `cursor`, `github-copilot`, `gemini`, `antigravity`, `openclaw`, `opencode`, `openhands` — cada um recebeu sua própria árvore de comandos/skills.

## Configuração do projeto

- **Idioma de saída de documentos:** Portuguese (`_bmad/config.toml → [core].document_output_language`).
- **Idioma de comunicação:** Portuguese (`_bmad/config.user.toml → [core].communication_language`).
- **`project_name`:** `projeto_hdd`.
- **`user_name`:** `operador`.
- **Skill level do usuário (bmm):** `intermediate`.
- **Pastas de saída:**
  - `_bmad-output/planning-artifacts/` — PRD, arquitetura, épicos, histórias
  - `_bmad-output/implementation-artifacts/` — código gerado, revisões
  - `_bmad-output/test-artifacts/` — test design, reviews, traceability
  - `docs/` — knowledge base do projeto (bmm + wds usam para input)
  - `design-artifacts/` — outputs do módulo WDS
  - `skills/` — destino de skills construídas pelo BMB

### Onde editar configuração (regra crítica)

`_bmad/config.toml`, `_bmad/config.user.toml` e os `_bmad/<módulo>/config.yaml` são **gerados pelo instalador e sobrescritos a cada `bmad-method install`**. Não edite a mão. Para overrides persistentes use:

- `_bmad/custom/config.toml` — pinos do time (committable)
- `_bmad/custom/config.user.toml` — pinos pessoais (gitignored)

O diretório `_bmad/custom/` nunca é tocado pelo instalador.

## Como invocar agentes/skills via Claude Code

As skills BMAD são expostas como skills nativas do Claude Code em `.claude/skills/bmad-*`. Há ~88 skills divididas pelos módulos. As mais usadas, agrupadas por fase BMM:

- **1 — Análise:** `bmad-brainstorming`, `bmad-domain-research`, `bmad-market-research`, `bmad-product-brief`, `bmad-prfaq`
- **2 — Planejamento:** `bmad-create-prd`, `bmad-prd`, `bmad-edit-prd`, `bmad-generate-project-context`
- **3 — Solução:** `bmad-create-architecture`, `bmad-create-epics-and-stories`, `bmad-create-ux-design`, `bmad-check-implementation-readiness`
- **4 — Implementação:** `bmad-sprint-planning`, `bmad-create-story`, `bmad-dev-story`, `bmad-code-review`, `bmad-correct-course`, `bmad-retrospective`
- **Test architecture (TEA):** `bmad-testarch-framework`, `bmad-testarch-nfr`, `bmad-qa-generate-e2e-tests`, `bmad-review-edge-case-hunter`, `bmad-eval-runner`
- **Meta:** `bmad-help` (orienta qual skill rodar a seguir), `bmad-customize`, `bmad-index-docs`, `bmad-document-project`

Para descoberta autoritativa de skills e seus codes de menu, leia:
- `_bmad/_config/bmad-help.csv` — catálogo completo (módulo, skill, action, args, fase, outputs)
- `_bmad/_config/skill-manifest.csv` — manifesto canônico
- `_bmad/_config/files-manifest.csv` — todos os arquivos rastreados pelo instalador

Cada skill tem seu `SKILL.md` em `.claude/skills/<nome>/` (e cópia em `.agent/skills/`, `.agents/skills/`, `.opencode/commands/`, etc., uma por IDE).

## Agentes BMAD (personas)

Definidos em `_bmad/config.toml → [agents.*]`. Cada um pertence a um módulo e tem persona fixa:

- **Mary** (Business Analyst, bmm) — `bmad-agent-analyst`
- **John** (Product Manager, bmm) — `bmad-agent-pm`
- **Sally** (UX Designer, bmm) — `bmad-agent-ux-designer`
- **Paige** (Technical Writer, bmm) — `bmad-agent-tech-writer`
- **Amelia** (Senior Software Engineer, bmm) — `bmad-agent-dev`
- (+ arquiteto, builder, CIS coaches, WDS Freya/Saga/Mimir, etc.)

Use a persona ao invocar a skill correspondente — eles esperam ser tratados pelo nome.

## Layout do diretório

```
/var/lib/projeto_hdd
├── CLAUDE.md                    # este arquivo
├── documentos/                  # documento de origem (.docx) — NÃO TOCADO pelo BMAD
├── _bmad/                       # config + skills brutas dos módulos (gerado, read-only)
│   ├── _config/                 # manifest.yaml + CSVs de help/skills/files
│   ├── config.toml              # respostas team do instalador
│   ├── config.user.toml         # respostas pessoais do instalador
│   ├── custom/                  # overrides persistentes (editáveis aqui)
│   └── {core,bmm,tea,bmb,automator,cis,wds}/
├── _bmad-output/                # artefatos gerados pelos workflows
│   ├── planning-artifacts/
│   ├── implementation-artifacts/
│   └── test-artifacts/
├── docs/                        # knowledge base (input para bmm e wds)
├── design-artifacts/            # outputs do módulo WDS
├── .claude/skills/bmad-*        # skills expostas ao Claude Code (USE ESTAS)
├── .agent/skills/, .agents/skills/   # cópias para outros agentes
├── .opencode/commands/          # comandos slash do OpenCode
└── .github/                     # integração GitHub Copilot
```

## Convenções ao trabalhar aqui

- **Idioma:** todos os artefatos gerados (PRD, arquitetura, histórias) devem sair em **português**. Está fixado em `[core].document_output_language`.
- **Não edite arquivos sob `_bmad/` (exceto `_bmad/custom/`)** — serão sobrescritos no próximo `npx bmad-method install`.
- **Não duplique skills.** Se faltar funcionalidade, use o **BMad Builder (`bmb`)** — skills `bmad-agent-builder`, `bmad-workflow-builder`, `bmad-module-builder` — para criar uma nova; o output vai para `skills/`.
- **Comece pelo `bmad-help`** quando incerto sobre a próxima skill.
- **`documentos/Solução OpenClaw BIMED.docx`** é a fonte de contexto original (em PT, com referências `[1]`–`[12]`); use como entrada para `bmad-product-brief` ou `bmad-prd` se quiser materializar a proposta em PRD formal.
