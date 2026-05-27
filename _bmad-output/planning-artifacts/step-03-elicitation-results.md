---
title: "Step 03 — Elicitation Results · HDD Starter Template"
workflow: bmad-create-architecture
step: 3
date: 2026-05-20
techniques: [bun-validation-research, party-mode-dx-maintenance-tooling]
status: pending-synthesis-approval
---

# Step 03 — Elicitation Results

## A — Bun Validation Research

**Insight crítico não-óbvio:** A **Anthropic adquiriu o Bun** em 2026 — agora é a infra oficial do Claude Code e Claude Agent SDK. Para um projecto que depende do `@anthropic-ai/sdk` + Claude Max 20x, isto é signal forte.

**Dados-chave:**
- Bun 1.3 estável; ~98% npm compat geral; **34% native dependency compat** (risco)
- `bun:sqlite` built-in: 4-6× mais rápido que `better-sqlite3`; API inspirada nele; sem N-API marshaling overhead
- Real workload perf: Bun ≈ Node ≈ Deno (~12k req/s); diferença está em **cold start** (Bun 8-15ms vs Node 60-120ms)
- 24/7 long-running daemon: V8 (Node) tem 13 anos battle-testing; Bun tem 2-3 anos pós-1.0
- Anthropic SDK: ✅ Bun 1.0+ é first-class supported
- pino, dockerode, Hono: ✅ todos funcionam em Bun
- systemd: padrão documentado

## P — Party Mode Round 3 (DX · Maintenance · Tooling Fit)

### DX Operator Daily

- First-day setup: 30-45 min com Node+tsx+better-sqlite3 (compilar addon nativo, 7-9 env vars).
- Inner loop: `tsx watch` ok 90%; mas FSM persistente em SQLite torna reset manual.
- **Sobre Bun:** "Bun v1 se Docker sandbox adiado v1.1+; Node 22 LTS se dockerode entrar desde sprint 1"
- **7 findings críticos:** mock-webhook.ts urgente; `better-sqlite3` native addon = setup pain; verify-audit-chain.ts; prompt caching invisível; migration workflow manual = avaliar Drizzle; FSM recovery não documentada; Biome gaps em type-aware (no-floating-promises).

### Maintenance Path

- Lifecycle: Hono v4 alto risco breaking changes em v5; Litestream single maintainer (~18m abandono plausível, rclone D-034 absorve); `better-sqlite3` Node major upgrades exigem rebuild; Anthropic SDK alto risco externo (ToS Max 20x D-032).
- **Sobre Bun:** "obriga a substituir better-sqlite3 por bun:sqlite imediatamente... bun.lockb é binário, difícil de rever em PRs... **o ganho de Bun não justifica o risco**. Recomendação: Node 22 LTS até maturidade; reavaliar Bun em v1.2."
- **7 findings:** native rebuild ponto de ruptura; Litestream runbook switch; schema migrations append-only disciplinada desde v1; comentários `// CUT:` em FRs cortados; **LLMAdapter interface para plan B switch**; `hdd audit replay` CLI; **maintenance 2-4h/mês**.

### Tooling Fit

- Verdict: stack acumula **6 ferramentas que Bun tornaria redundantes**, gap real em secrets management, dualidade `tsx`+`tsc` é ruído.
- **Sobre Bun:** "estável para produção single-process... **Bun é a escolha correcta para v1 se `dockerode` for substituído por `child_process`**... Corte de 4 dependências explícitas. Cold start ≤30s do NFR-P1 — Bun arranca ~10× mais rápido."
- **8 findings:** ESM/CJS tension better-sqlite3 (resolve com bun:sqlite); tsx+tsc redundância; noUncheckedIndexedAccess força boilerplate em SQLite rows (avaliar Drizzle ou Zod); Biome falta type-aware (adicionar typescript-eslint só para 4 regras async); **systemd 1 unit via `litestream run -- node worker.js`**; audit JSONL escrever ~80 linhas in-house (nativo); **substituir dockerode por `child_process.spawn('docker')`**; remover `undici` (Node 22 tem fetch nativo).
- **Stack minimalista se reagrupasses:** Bun + TS strict + Hono + bun:sqlite + Litestream + pino + Biome + typescript-eslint (4 regras) + systemd. ~7 deps runtime vs 13 actuais.

---

## Synthesis — convergências resolvem 2 das 3 tensões

### Convergência forte (todas as 3 perspectivas alinham)

| # | Convergência | Acção |
|---|---|---|
| **C1** | **Substituir `dockerode` por `child_process.spawn('docker')`** | DX: simpler debug; Maintenance: dockerode single-maintainer risk; Tooling: cuts dependency + simplifies Bun adoption |
| **C2** | **`better-sqlite3` é dor** | Native addon, ESM/CJS tension, rebuild on Node major. Solução: `bun:sqlite` (se Bun) OR aceitar dor (se Node) |
| **C3** | **Migrations runner explícito desde v1** | DX evalua Drizzle; Maintenance exige disciplina append-only; Tooling sugere `better-sqlite3-migrate` ou 40 linhas custom |
| **C4** | **Biome não cobre type-aware async safety** | Adicionar `typescript-eslint` v8+ APENAS para 4 regras (no-floating-promises, no-misused-promises, no-unsafe-assignment, await-thenable) |
| **C5** | **systemd como 1 unit via `litestream run -- worker`** | Elimina race condition WAL; supervisor unificado |
| **C6** | **Secrets validation no boot** (envalid OR Zod) | Falhar fast em vez de descobrir env var faltante em produção |
| **C7** | **`undici` é redundante** com Node 22 fetch nativo | Remover dependência explícita |
| **C8** | **`scripts/` directory com utilitários:** mock-webhook, verify-audit-chain, verify-native, reconcile-stuck-runs, audit-replay | Cobrir os gaps de DX que cada perspectiva identificou |
| **C9** | **LLMAdapter interface desde v1** | Plan B Anthropic Max 20x → API pay-per-token requer 3 ficheiros, não refactor |
| **C10** | **Renovate com patch automerge** + ADR `docs/decisions/` discipline | Sustentar maintenance ≤ 2-4h/mês |

### Tensão sobre Bun adoption v1

| Perspectiva | Posição |
|---|---|
| **DX** | "Bun v1 se Docker sandbox adiado v1.1+; Node 22 LTS se dockerode entrar desde sprint 1" — **conditional YES** |
| **Maintenance** | "Recomendação: Node 22 LTS até maturidade; reavaliar Bun em v1.2" — **NO** |
| **Tooling Fit** | "Bun é a escolha correcta para v1 se `dockerode` for substituído por `child_process`" — **conditional YES** |

**Convergência sob substituição C1:** se `dockerode` → `child_process` (C1, todos concordam), então **DX e Tooling viram YES claro**. Maintenance permanece cético mas a sua razão principal (`better-sqlite3` vs `bun:sqlite` instability) é discutível em 2026 dado que `bun:sqlite` está em produção há 1.5+ anos.

**Anthropic ownership** muda materialmente o cálculo: Bun **é a infra oficial do Claude Code**; HDD usa Anthropic SDK. Alinhamento estratégico forte.

### Resolução proposta: **Bun em v1** com substituição `dockerode→child_process`

**Bases:**
- 2/3 perspectivas dizem YES sob C1 (que todas concordam)
- Anthropic ownership signal
- Tooling consolidation real (corta 4 deps: tsx, Vitest, better-sqlite3, undici)
- Plan B Node documentado tornará a reversão trivial se algo correr mal

**Riscos honestos:**
- 24/7 daemon stability menos provada (V8 13 anos vs Bun 2-3 anos)
- `bun.lockb` binário menos amigável em git review (mitigação: `bun pm whoami` na CI)
- Edge cases em `@anthropic-ai/sdk` SSE / cache_control — improvável dado mesma org, mas a confirmar com smoke test no piloto

---

## Stack revista (final synthesis)

| Layer | Era (Step 03 v1) | Agora (synthesis) | Razão da mudança |
|---|---|---|---|
| Runtime | Node.js 22 LTS | **Bun 1.3+** | Anthropic ownership; tooling consolidation; cold start |
| Language | TypeScript strict | TypeScript strict + noUncheckedIndexedAccess | — |
| HTTP framework | Hono | **Hono** (Bun-native) | — |
| CLI | Commander.js | **Commander.js** | works in Bun |
| State store | better-sqlite3 | **`bun:sqlite`** built-in | Zero N-API; ESM nativo; 4-6× faster |
| ORM/queries | (raw SQL) | **Drizzle ORM** (driver bun:sqlite) | Type-safe; migrations runner integrado; resolve noUncheckedIndexedAccess pain |
| Backup | Litestream systemd separado | **Litestream como supervisor** (`litestream run -- bun src/main.ts`) | 1 unit; zero race WAL |
| LLM client | @anthropic-ai/sdk | **@anthropic-ai/sdk** com prompt caching | — |
| LLM interface | (direct) | **LLMAdapter interface** wrapper | Plan B switch trivial |
| HTTP client | undici | **fetch nativo Bun** | undici redundante |
| Docker sandbox | dockerode | **`Bun.spawn('docker', [...])`** | Cuts dep; simpler; sem daemon socket risk |
| Logger | pino | **pino** + audit JSONL custom (~80 linhas, sem dep) | — |
| Testing | Vitest | **`bun test`** | All-in-one Bun |
| Dev runner | tsx | **`bun --hot`** | — |
| Build | tsc | **`bun build`** | — |
| Linter+Formatter | Biome | **Biome** + **typescript-eslint** (4 regras async-safety apenas) | Type-aware rules gap |
| Migrations | (custom 40 linhas) | **drizzle-kit generate + migrate** | Type-safe schema diff; CI gate |
| Secrets validation | (implícito) | **envalid** OR **Zod schema** no boot | Fail fast |
| Watchdog | systemd Restart=on-failure | **systemd `WatchdogSec=1800` + `sd_notify` heartbeat** | Detect deadlocks not just crashes |
| Process manager | systemd | **systemd (1 unit: litestream-wrapped)** | C5 |
| Dependencies updates | (manual) | **Renovate** com patch-automerge + ADR | Maintenance 2-4h/mês |

**Dependências runtime cortadas:** `better-sqlite3`, `tsx`, `tsc`, `Vitest`, `undici`, `dockerode` = **6 deps cortadas**.
**Dependências adicionadas:** `drizzle-orm`, `envalid` (ou Zod), `typescript-eslint` (dev only, 4 regras) = **2-3 deps add**.

**Net:** -3 a -4 deps de runtime. Stack mais coerente.

### Plan B runbook (Bun → Node migration)

Se Bun mostrar instabilidade, migração tem **5 ficheiros** a editar:
1. `package.json` → trocar `"type": "module"` mantém-se; `bun:sqlite` → `better-sqlite3`
2. `src/db/index.ts` → import `bun:sqlite` → `better-sqlite3`
3. `src/llm/adapter.ts` → testar Anthropic SDK sob Node
4. `scripts/` → `bun run` → `node` + `tsx`
5. `tests/` → `bun test` → `vitest run`
6. `systemd unit` → `litestream run -- bun ...` → `litestream run -- node dist/main.js` (com `tsc` pre-build)

Tempo estimado de switch: **4-6h** (não bloqueador catastrófico).

---

## Scripts utilitários a criar desde v1 (convergência DX+Maintenance+Tooling)

Em `scripts/`:
- **`mock-webhook.ts`** — fixtures para simular callback clihelper
- **`verify-audit-chain.ts`** — valida hash chain JSONL
- **`verify-native.ts`** — postinstall check (se Bun: detecta version; se Node: detecta addon)
- **`reconcile-stuck-runs.ts`** — startup hook para PAUSED sem TTL
- **`audit-replay.ts`** — `hdd audit replay --from <seq> --to <seq>` para time-travel debugging
- **`migration-runner.ts`** — só se preferir custom em vez de Drizzle

---

## Comando de inicialização (v2 — Bun-first)

```bash
# 1. Bun base scaffold
bun create hono@latest hdd-worker --template bun
cd hdd-worker

# 2. Adicionar dependências runtime
bun add commander drizzle-orm @anthropic-ai/sdk pino envalid zod

# 3. Adicionar dependências dev
bun add -d drizzle-kit typescript @biomejs/biome typescript-eslint @typescript-eslint/eslint-plugin

# 4. Estrutura HDD-específica (como v1, sem alterações)
mkdir -p src/{adapters/{whatsapp,email,llm,bmad,sandbox},core/{fsm,interrupts,gates,context-bundle,gap-detector},cli,server,db,audit,workers}
mkdir -p db/migrations
mkdir -p scripts
mkdir -p config

# 5. Litestream binary (separado, systemd supervisor)
# Download Litestream para o VPS, config para wrap o worker:
# ExecStart=/usr/local/bin/litestream run -- /home/hdd-worker/hdd-worker/node_modules/.bin/bun run src/main.ts
```

---

## Comparação final v1 vs v2 do Step 03

| Métrica | v1 (Node) | v2 (Bun-first) |
|---|---|---|
| Cold start | 60-120ms | 8-15ms |
| Dependências runtime | ~13 | ~9 |
| Dev tools | tsx + Vitest + tsc + Biome | bun (all-in-one) + Biome |
| Native addons | better-sqlite3 (rebuild on Node major) | zero |
| Anthropic alignment | standard SDK | Bun é infra oficial Claude Code |
| Risco 24/7 daemon | baixo (V8 13y) | médio (Bun 2-3y pós-1.0) |
| Plan B time-to-switch | n/a | 4-6h documentado |

---

> **Estado:** synthesis pronta. Operador a decidir: aceitar stack v2 Bun-first OR ficar com v1 Node?
