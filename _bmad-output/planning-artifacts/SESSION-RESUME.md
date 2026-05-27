---
title: "Session Resume — HDD Architecture Workflow"
project: projeto_hdd (HORSE DRIVEN DEVELOPMENT)
paused_at: 2026-05-20
last_completed_step: Step 03 (Starter Template Evaluation)
next_step: Step 04 (Architectural Decisions)
current_workflow: bmad-create-architecture
operator: operador
---

# SESSION RESUME — HDD

## Onde paramos

Durante `bmad-create-architecture` no `projeto_hdd` (codinome **HORSE DRIVEN DEVELOPMENT / HDD**).

**Step 03 finalizado** em 2026-05-20 com stack v2 Bun-first adoptada (D-035). **Próximo: Step 04 — Architectural Decisions.**

## Estado do workflow `bmad-create-architecture`

```
Step 01 ✅ Init e descoberta de inputs (D-001..D-015 + brief reconciliation)
Step 02 ✅ Project Context Analysis (pre-mortem + party mode 2 rounds, 44 AOs)
Step 03 ✅ Starter Template Evaluation (stack v2 Bun-first, 56 AOs total)
Step 04 ⏳ Architectural Decisions ← RESUME AQUI
Step 05 ⏸ Patterns
Step 06 ⏸ Structure
Step 07 ⏸ Validation
Step 08 ⏸ Completion & Handoff
```

## Artefactos canónicos (todos persistidos)

| Path | Descrição |
|---|---|
| `_bmad-output/planning-artifacts/architecture.md` | Documento principal. Frontmatter `stepsCompleted: [1, 2, 3]`. Project Context Analysis + 56 AOs + Schema SQLite + Audit JSONL format + Starter Template (Bun v2 stack completa) |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/prd.md` | PRD v2 final (D-030 approved); reconciliado com brief |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/addendum.md` | Addendum v2 final |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/.decision-log.md` | 36 decisões D-001..D-036 |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/bmad-prd-summary-v2.md` | Resumo Finalização Tier-A/B/C |
| `_bmad-output/planning-artifacts/prds/prd-projeto_hdd-2026-05-20/finalization-summary-templates.md` | Spec dos 3 tiers |
| `_bmad-output/planning-artifacts/briefs/brief-projeto_hdd-2026-05-20/brief.md` | Brief autoritativo (NÃO editar) |
| `_bmad-output/planning-artifacts/step-02-elicitation-results.md` | Round 1: pre-mortem + Arquiteto/SRE/Security/PM |
| `_bmad-output/planning-artifacts/step-02-elicitation-round2.md` | Round 2: constraint mapping + CDM + UX/FinOps/Compliance/DataEng |
| `_bmad-output/planning-artifacts/step-03-elicitation-results.md` | Bun validation + DX/Maintenance/Tooling Fit |
| `_bmad-output/planning-artifacts/whatsapp-templates-utility.md` | 6 templates UTILITY desenhados; operador cria no clihelper |
| `documentos/Solução OpenClaw BIMED.docx` | Input de origem (legado v1, não usar) |

## Memórias persistentes (auto-loaded em qualquer sessão)

Em `/root/.claude/projects/-var-lib-projeto-hdd/memory/`:
- `project-hdd-naming.md` — produto = HDD
- `project-hdd-vision.md` — visão bimodal + meta-dogfood
- `project-hdd-llm-budget.md` — Anthropic Max 20x
- `project-hdd-whatsapp-api.md` — Cloud API oficial (não Baileys)
- `project-hdd-clihelper-integration.md` — via app proprietário do operador
- `project-hdd-stack-v2-bun.md` — Bun 1.3+ adoptado
- `feedback-hdd-mandatory-review.md` — revisão obrigatória em toda finalização
- `feedback-bmad-prd-discover-brief.md` — descobrir briefs prévios em bmad-prd

## Decisões fechadas (D-001..D-036)

**Chave do que decidir é:**
- D-016 Nome = HDD
- D-017 Anthropic Max 20x exclusivo
- D-018 Piloto = projeto_hdd (meta-dogfood)
- D-019 Revisão obrigatória em finalizações
- D-021..D-024 Brief autoritativo; modelo bimodal; WhatsApp; VPS; gates qualidade
- D-031 WhatsApp API oficial
- D-032 Max 20x para automação = `[ACCEPTED RISK]`
- D-033 Integração via clihelper.example.com (app do operador)
- D-034 Backup Litestream primário + rclone secundário
- D-035 Stack v2 Bun-first (Bun 1.3 + Hono + bun:sqlite + Drizzle + Litestream supervisor)
- D-036 Convergências Step 03 aplicadas (AO-47..AO-56)

## 56 Architectural Obligations activas (AO-1..AO-56; AO-25 dispensada)

Lista completa em `architecture.md` secções "Architectural Obligations" (Step 02 + Round 2 + Step 03). Cobrem:
- Handoff bimodal com `context-bundle.json` imutável
- FSM explícita persisted single-row + transitions atomic
- Idempotência LLM-aware (hash de artefacto)
- Read-only planning artefacts no VPS; Git unidireccional
- Gap detector "ask-the-agent" plugável
- Branches `story/<id>`; delete-branch = rollback
- WhatsApp health-check de endpoint clihelper (não Meta)
- SQLite WAL + Litestream primário + rclone secundário
- 2º watchdog TTL 4h em paused_for_interrupt
- TTL 24h em fallback e-mail
- `X-Hub-Signature` substituído por `Authorization` header clihelper
- Sandbox: `Bun.spawn('docker' --network=none)` (não dockerode)
- GitHub PAT fine-grained 1 repo + branch protection
- Audit JSONL com prev_hash chain + O_APPEND + RFC 3161 timestamp
- Supply chain: pin de versões com hash integrity
- Worker uid não-privilegiado + systemd EnvironmentFile 0600
- Workspace isolation no meta-dogfood (`/runs/<id>/`)
- Parser NLP-tolerante com confidence threshold 0.7
- Heartbeat com do_not_disturb 23h-8h
- 1ª ocorrência envia parágrafo explicativo (onboarding)
- Quick Reply lembrete 20h; fallback S3 48h
- Drizzle ORM (resolve dor noUncheckedIndexedAccess)
- Schema migrations append-only desde v1
- WhatsApp idempotency key composta SHA-256
- Prompt caching Anthropic SDK (`cache_control: ephemeral`)
- Routing Haiku 4.5 para gap detector + NLP parser
- 2 contadores separados (LLM window + WhatsApp conv)
- Rate-limit leaky bucket 1 req/s no WhatsApp adapter
- Webhook callback URL configurable + parser inbound
- Plan B LLM runbook (D-017 vulnerability)
- Chaos test do worker no piloto
- TTL retention 90d no audit-logger
- DPA Anthropic + SCCs/região EU no R2
- CI gate license-checker (GPL/AGPL bloqueante)
- Disclosure LLM template para v1.1+
- `Bun.spawn('docker')` em vez de dockerode
- `bun:sqlite` em vez de better-sqlite3
- typescript-eslint v8 com 4 regras async-safety
- systemd 1 unit via `litestream run -- bun ...`
- envalid/Zod no boot
- fetch nativo (sem undici)
- `scripts/` com 5 utilitários
- LLMAdapter interface desde v1
- Renovate patch-automerge + ADRs

## Pendências do operador (paralelo, sem bloquear Step 04)

| Item | Estado | Quando |
|---|---|---|
| 6 templates WhatsApp UTILITY | desenhados em `whatsapp-templates-utility.md` | Operador submete 3 essenciais no clihelper (P1, summary, heartbeat) |
| Token Authorization clihelper | pendente | Necessário para implementação; pode partilhar depois |
| Webhook callback URL + estrutura JSON inbound | pendente (AO-46) | Necessário antes de implementar webhook listener |
| VPS recursos (Hetzner CX22 ou equiv: 2vCPU/4GB/40GB) | pendente | Confirmar antes de M0 baseline |
| R2 EU bucket + credentials | pendente | Para Litestream e rclone backups |
| ADRs `docs/decisions/` baseline | a criar | Primeira ADR D-035 quando começar implementação |

## Stack final adoptada

**Runtime:** Bun 1.3+ (não Node)
**HTTP server:** Hono Bun-native
**CLI:** Commander.js
**State store:** `bun:sqlite` built-in
**ORM/Migrations:** Drizzle ORM + drizzle-kit
**Backup:** Litestream supervisor (1 systemd unit via `run --`) + rclone secundário
**LLM:** `@anthropic-ai/sdk` + `cache_control: ephemeral` + LLMAdapter wrapper
**HTTP client:** `fetch` nativo
**Sandbox:** `Bun.spawn('docker', ['run', '--rm', '--network=none', ...])`
**Logger:** pino + audit JSONL hash chain custom
**Tests:** `bun test`
**Build:** `bun build`
**Dev:** `bun --hot`
**Lint:** Biome + typescript-eslint v8 (4 regras async-safety)
**Secrets:** envalid/Zod no boot
**Watchdog:** systemd `WatchdogSec=1800` + `sd_notify`
**Updates:** Renovate patch-automerge + ADR discipline

## Plano para Step 04 (próxima sessão)

Step 04 (`step-04-decisions.md`) é onde decidimos os patterns concretos dentro da stack:
- API contracts internos entre adapters↔core (interfaces TypeScript)
- Error handling strategy (Result<T, E> discriminated unions? throw? mixed?)
- Retry policies por adapter (já temos retry exponencial; calibrar por endpoint)
- Observability conventions (correlation IDs, span attributes pino)
- Configuration management (config layering, override hierarchy)
- Secrets rotation policy
- Logging granularity por componente
- Time/clock abstraction (para testes determinísticos)
- Test strategy (unit vs integration vs e2e; SQLite in-memory ou file)
- Code organization conventions (folder-by-feature vs folder-by-type)

Espera-se mais 1-2 sessões de elicitation se quiseres profundidade, ou directo a C para avançar rápido.

## Preferências do operador (resumo)

- **Modo Auto activo** (work without stopping for clarifying questions when reasonable)
- **Fast path** preferido sobre Coaching
- **Português PT** para comunicação e artefactos
- **Parallel agents** para party mode (multi-perspective)
- **Resumo de Finalização 3-tier** em toda conclusão de fase (D-019)
- **Skill level: intermediate** em BMAD
