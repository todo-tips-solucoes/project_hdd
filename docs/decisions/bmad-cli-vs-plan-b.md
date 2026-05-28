# ADR: bmad-cli non-interactive vs. Plan B

- **Status:** ACCEPTED — Opção A escolhida pelo operador 2026-05-28
- **Decision ID:** D-052
- **Data:** 2026-05-28
- **Owner:** Amelia (Developer agent, sessão Story 1.c.7)
- **Story:** 1.c.7 — bmad-cli smoke test + Plan B fork docs (Epic 1.c, Sprint 0 Day 1)
- **AOs cobertos:** AR-077, AR-078, FR-006, FR-081, memória `project-hdd-openclaw-substituted-by-bun`
- **Decisões parent:** D-043 (Bun substitui OpenClaw, BMAD via CLI-wrapper), D-035 (Bun stack), D-046 (Cenário B 6-7 sty/sem)
- **Bloqueia:** Story 2.2 (`bmad-invoker` port + adapter), e por transitividade todo o Epic 2

---

## Contexto

A arquitectura D-043 substituiu OpenClaw por um worker Bun nativo que invoca BMAD via "CLI-wrapper". Toda a Story 2.2 e o Epic 2 inteiro assumem que o framework BMAD expõe uma forma **non-interactive, programática** de disparar skills (`bmad-help`, `bmad-dev-story`, `bmad-code-review`, etc.) — sem isso, o worker autónomo é impossível como desenhado.

Story 1.c.7 é o gate Day-1 que valida esse invariante **antes** de qualquer código do Epic 2 ser escrito.

## Resultado do smoke test (AC-1)

**RESULT: FAIL** ✗

Comando: `bash scripts/smoke-bmad-cli.sh` · run_id `20260528T143848Z` · duração total ~11s · exit 1.

| Probe | Descrição | Resultado |
|-------|-----------|-----------|
| 1 | `npx -y bmad-method status` reachability | **PASS** — 3s, retorna manifest v6.7.1 OK |
| 2 | Invocar `bmad-help` non-interactive via `bmad-method` CLI (AC-1 binary) | **FAIL** — 6 tentativas, todas exit 1 |
| 3 | `.claude/skills/bmad-help/SKILL.md` existe como ficheiro | **OK** — 4415 bytes, mas é dados, não executável |

### Evidência verbatim (Probe 2)

```text
----- attempt: npx -y bmad-method bmad-help -----
error: unknown command 'bmad-help'
----- exit=1 -----
----- attempt: npx -y bmad-method help bmad-help -----
Usage: bmad [options] [command]

BMAD Core CLI - Universal AI agent framework

Commands:
  install [options]    Install BMAD Core agents and tools
  status               Display BMAD installation status and module versions
  uninstall [options]  Remove BMAD installation from the current project
  help [command]       display help for command
----- exit=1 -----
```

Tentativas adicionais (`skill`, `run`, `invoke`, `exec`) — todas `error: unknown command`.

Evidence files: `.smoke-evidence/smoke-20260528T143848Z.log`, `.smoke-evidence/p1-status-*.out`, `.smoke-evidence/p2-help-*.out`.

### Interpretação

O pacote npm `bmad-method` v6.7.1 expõe **apenas 4 subcomandos**: `install`, `status`, `uninstall`, `help`. É um installer + status reporter, **não** um runner de skills/agents. As ~88 skills BMAD (`.claude/skills/bmad-*/SKILL.md`) são ficheiros markdown desenhados para serem lidos e executados por um **driver LLM** (Claude Code, Cursor, Codex, etc.) — não por um binário CLI standalone.

A assunção implícita em D-043 ("BMAD via CLI-wrapper") **não é satisfeita** pelo upstream BMAD-METHOD na sua forma actual. Era um risco conhecido (memória `project-hdd-openclaw-substituted-by-bun` exige "Sprint 0 Day 1 validation required") que se materializou exactamente como previsto. Esta story existe precisamente para detectar isto antes de Epic 2 começar.

## Opções de Plan B (AC-2 — escolher 1)

### Opção A — Claude Code headless como BMAD-invoker (`claude -p`)

**Mecanismo:** worker spawn-a `claude -p "<prompt>" --output-format stream-json --allowedTools "..."` para cada skill BMAD. Claude Code v2.1.153 (já instalado em `/root/.local/bin/claude`) tem flags `-p/--print`, `--input-format`, `--output-format=stream-json` e `--allowedTools` — suporta headless out-of-the-box.

| Critério | Avaliação |
|----------|-----------|
| Esforço | **4-6h** (smoke test do `claude -p` + adapter wrap + retry/timeout + parser) |
| Custo LLM | Cada invocação = call API/Max20x normal → integra-se com D-044/D-050 hybrid routing (planning Max20x, impl API metered, cap $30/m) |
| Dependências | Adiciona `claude` CLI como runtime requirement do worker (já presente). Implica systemd unit precisa de `claude` no PATH (Story 1.c.1). |
| Risco | **Baixo-Médio.** Claude Code é o driver oficial das skills; é exactamente o uso desenhado. Acopla worker à versão `claude` CLI (2.1.x) — actualização precisa de regression test. |
| Reversibilidade | Alta. Adapter encapsula o spawn; trocar para outro driver = trocar 1 ficheiro. |
| Compatibilidade D-043 | Total — "CLI-wrapper" passa a significar "wrapper sobre `claude -p`" em vez de "wrapper sobre `bmad-method`". |
| Impacto Sprint plan | **Nulo** — Story 2.2 absorve o esforço (já estimada 64K/96K tokens, com folga). |

**Implicações de stack:**
- `package.json` ganha implícita dependência runtime de `claude` CLI ≥ 2.1.x.
- Story 1.c.1 (systemd unit) tem de garantir `PATH` inclui `/root/.local/bin` ou caminho equivalente.
- Pentest tasks (1.b.5) precisam validar sandbox `Bun.spawn` × `claude -p` (subprocess de subprocess, network egress permitido para Anthropic API).

### Opção B — Re-implementar subset BMAD em TS nativo

**Mecanismo:** worker lê `.claude/skills/<nome>/SKILL.md` directamente e implementa o subset de skills críticas (provavelmente só `bmad-dev-story`, `bmad-code-review`, `bmad-sprint-planning`) em TypeScript Bun-nativo, chamando `claude` SDK ou API directamente sem passar pelo prompt-style framework BMAD.

| Critério | Avaliação |
|----------|-----------|
| Esforço | **4-6h** declarado na story, mas **subestimado** — re-escrever lógica de prompts + state machines + outputs schemas de 3-5 skills é provavelmente 2-4 dias |
| Custo LLM | Igual a Opção A; o LLM ainda corre |
| Dependências | **Remove** dependência de `claude` CLI; usa Anthropic SDK directamente (`@anthropic-ai/sdk`) ou fetch raw |
| Risco | **Alto.** (a) Divergimos do upstream BMAD — não recebemos updates v6.8+. (b) Skills BMAD são longas e ricas; bugs subtis. (c) Bloqueia D-019 ("não duplicar skills — usa BMB") em espírito. |
| Reversibilidade | Baixa — re-escrita é caminho de uma só direcção; voltar atrás = recomeçar. |
| Compatibilidade D-043 | Quebra parcialmente — "BMAD via CLI-wrapper" passa a "BMAD-inspired implementation in TS" |
| Impacto Sprint plan | **Médio-Alto** — estoura budget de Story 2.2 + provavelmente puxa 1-2 stories extra |

### Opção C — Defer worker autónomo; manter "Modo Colaborativo" extended

**Mecanismo:** Aceitar que worker autónomo (Epic 2) não arranca em Sprint 1. Operador continua a invocar skills BMAD manualmente via Claude Code (modo colaborativo dogfood actual). M1 sign-off adia-se até resolução upstream.

| Critério | Avaliação |
|----------|-----------|
| Esforço | **0h imediato**, mas adia M1 |
| Custo LLM | Igual à baseline actual |
| Dependências | Nenhuma nova |
| Risco | **Médio-Alto stratégico.** Toda a tese HDD assenta em automação; "extended colaborativo" é praticamente o status quo pré-projeto. M1 deadline (1.0-1.3 mês per D-046) escorrega indefinidamente. |
| Reversibilidade | Alta — pode voltar a Opção A/B mais tarde |
| Compatibilidade D-043 | Pausa indefinida |
| Impacto Sprint plan | **Severo** — Epic 2 inteiro (7 stories) sai do plano; Epic 4, 5, 6.a, 7.b ficam parcialmente bloqueados (todos dependem de worker) |

## Recomendação

**Opção A — Claude Code headless (`claude -p`).**

Razões:
1. **Custo de implementação igual à story planeada** (4-6h cabe no orçamento de Story 2.2).
2. **Zero quebra de D-043** — apenas refina semântica do "CLI-wrapper".
3. **Mantém upstream BMAD intacto** — actualizações v6.8+ vêm de graça; respeita D-019 (não duplicar skills).
4. **Dependência runtime `claude` já existe** no ambiente do operador (é o IDE primário).
5. **Reversível** — se Anthropic mudar headless API, troca-se o adapter sem tocar no worker core.

Trade-off aceite: acoplamento à versão `claude` CLI (regression test obrigatório em cada bump).

## Decisão (D-052)

**Opção A — Claude Code headless (`claude -p`) como BMAD-invoker.** Confirmada pelo operador em 2026-05-28 nesta sessão Story 1.c.7.

### Implicações imediatas (downstream)

1. **Story 2.2** (`bmad-invoker` port + adapter) é re-escopada: o adapter `cli-wrapper.adapter.ts` passa a fazer wrap de `claude -p ... --output-format stream-json --allowedTools <subset>` em vez de `npx bmad-method <skill>`. Sem alteração de estimativa (64K/96K tokens permanecem).
2. **Story 1.c.1** (systemd unit) tem de garantir `claude` no `PATH` da unit (e.g. `Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin`).
3. **Story 1.b.4** (sandbox `Bun.spawn` + Docker network none) — adicionar caso de teste: `claude -p` é subprocess permitido com egress filtrado para `api.anthropic.com`.
4. **Story 1.b.5** (pentest tasks) — incluir vector: hosted prompt injection via skill markdown alterado tentando exfil via `claude -p`.
5. **Renovate / CI (Story 1.c.4)** — pinar `claude` CLI version, adicionar regression smoke em cada bump.
6. **Cost model (AO-151, `docs/cost-model.md`)** — adicionar item "claude CLI runtime invocations" às assunções; o roteamento por fase (D-050) permanece válido.

Plano `tests/integration/bmad-cli.test.sh` (criado nesta story) actua como guardrail contra regressão: corre em CI e falha se o smoke (incluindo Probe 2) voltar a falhar — sinal de que algo no upstream BMAD mudou ou que `claude -p` parou de funcionar.

---

### Apêndice A — referências

- `_bmad/_config/manifest.yaml` — versão BMAD pinada (v6.7.1)
- `_bmad-output/planning-artifacts/architecture.md` D-043, D-035, D-044, D-050
- `_bmad-output/planning-artifacts/epics.md#story-1c7`
- Memória `project-hdd-openclaw-substituted-by-bun` (Sprint 0 Day 1 validation required)
- Memória `project-hdd-cost-optimal-llm` (D-044/D-050 hybrid routing — Opção A integra)
- Evidence: `.smoke-evidence/smoke-20260528T143848Z.log`
