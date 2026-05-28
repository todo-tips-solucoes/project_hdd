# HDD — HORSE DRIVEN DEVELOPMENT

Worker daemon (Bun 1.3+ TypeScript) que orquestra o pipeline autónomo BMAD-driven
do projecto `projeto_hdd`. Plataforma OpenClaw + BMAD, em estado M0 (Sprint 0 de 3).

> Contexto canónico: `CLAUDE.md` (raiz) e
> `_bmad-output/planning-artifacts/architecture.md`.
> Sprint status corrente: `_bmad-output/implementation-artifacts/sprint-status.yaml`.
> ADRs: `docs/decisions/`.

## Stack

| Camada | Escolha | Decisão |
|--------|---------|---------|
| Runtime | Bun 1.3+ | D-035 / AR-010 |
| Linguagem | TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | AR-018 |
| Formatter + base lint | Biome 2.x (`max-lines: 200` HARD) | AO-50 / AO-122 |
| Type-aware lint | typescript-eslint v8+ (5 regras async-safety) | AR-018 ∪ AO-50 (Q-1 union) |
| Test runner | `bun test` | AR-017 / D-035 |
| BMAD invoker | `claude -p` headless (Claude Code CLI ≥ 2.1.x) | D-052 |

A lista completa (HTTP server Hono, CLI Commander, ORM Drizzle, bun:sqlite,
Litestream supervisor, Bun.spawn sandbox) entra nas stories 1.a.2 .. 1.c.3.

## Comandos

```bash
bun install         # instala deps (lockfile committable)
bun run dev         # bun --hot src/main.ts (stub até Story 1.a.7)
bun run build       # bun build --compile → dist/hdd-worker
bun test            # bun test (specs em tests/**/*.test.ts)
bun run test:coverage
bun run lint        # biome check + eslint (5 regras async-safety)
bun run lint:fix
bun run format
bun run type-check  # tsc --noEmit
```

## Runtime requirements

- **Bun ≥ 1.3.0** (AR-010). Install: `curl -fsSL https://bun.sh/install | bash`.
- **Node 22+** (apenas para Plan B Bun→Node, ver `architecture.md` linha 452).
- **Docker** (apenas após Story 1.b.4 — sandbox `Bun.spawn` ; `--network=none`).
- **Claude Code CLI ≥ 2.1.x** (per D-052; `claude -p` headless é o BMAD-invoker).
  Não é dependência npm — é binário system-level. Install: <https://docs.claude.com/claude-code>.

## Layout

```
hdd-worker/
├── src/{core, ports, adapters, lib, db}/  ← estrutura mínima (AR-002); subdirs entram com stories próprias
├── src/{main.ts, bootstrap.ts}            ← stubs (Story 1.a.7 wires bootstrap)
├── tests/                                  ← bun test specs (*.test.ts)
├── tests/integration/                      ← bash smoke/integration (Story 1.c.7+)
├── scripts/                                ← shell utilities (Story 1.c.7+)
├── docs/decisions/                         ← ADRs (D-NNN-*.md)
├── _bmad/                                  ← BMAD installer output (gitignored, regenerável)
├── _bmad-output/                           ← planning + implementation artefacts (committable)
└── .claude/                                ← skills BMAD para Claude Code
```

## Workflow BMAD

Skills disponíveis em `.claude/skills/bmad-*`. Entry-point típico:
`bmad-help` (orienta próxima skill). Exemplos: `bmad-create-story`,
`bmad-dev-story`, `bmad-code-review`, `bmad-correct-course`, `bmad-retrospective`.

Per **D-019**, toda finalização exige revisão humana + Resumo Tier-B antes de
`done`. Workflow canónico por story:

```
backlog → ready-for-dev (bmad-create-story)
       → in-progress (bmad-dev-story)
       → review     (bmad-dev-story conclui)
       → done       (operator approves + bmad-code-review)
```

## Sprint status (snapshot)

Sprint 0 — Runtime Scaffold & Core Contracts + Safety BLOCKERS + Bootstrap.
22 stories, capacity Cenário B Expected 6-7 sty/sem, ~3-4 semanas.
Estado actualizado em `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Licença

Privado (`"private": true`). Não publicado a registries.
