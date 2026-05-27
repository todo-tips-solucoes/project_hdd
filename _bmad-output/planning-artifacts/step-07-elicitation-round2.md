---
title: "Step 07 — Elicitation Round 2 · HDD Final Validation"
workflow: bmad-create-architecture
step: 7
round: 2
date: 2026-05-22
techniques: [pre-mortem-cirurgico-blockers, party-mode-pentester-incident-responder-drb]
status: pending-synthesis-approval
---

# Step 07 — Elicitation Round 2 · Final Validation

## A — Pre-mortem cirúrgico nos 3 BLOCKERS

Assumindo FM-1, FM-4, FM-6 ocorrem em produção apesar de AO-155/158/160. Identificados **gaps residuais** mesmo com mitigações actuais:

**FM-1 residual:** 4-digit codes (AO-155 original) = 10K combos brute-forçáveis em 10s; texto livre social-engineerable
→ **AO-164:** 6-char alphanumeric (não 4-digit) + single-use + expira 60s + tied `wa_id` + rate-limit 3/hora

**FM-4 residual:** `startsWith(targetRoot)` permite cross-run contamination; symlinks; null-bytes em path
→ **AO-165:** per-run workspace check + realpath + reject control chars/null + serialização file ops + tmpfs

**FM-6 residual:** redaction regex falha em formato unusual; tokens em error msg não headers; state.db cached tokens
→ **AO-166:** multi-pattern (header+msg+state.db) + never-store-raw + validate ALL backups + periodic ACL audit

## P — 3 perspectivas paralelas

### Adversarial Pentester (8 attack paths, 3 CRITICAL)

**Top 3 Most Practical Attacks (low sophistication, high impact):**

1. **AP-5 — Redaction bypass via Litestream/rclone error logs.** First failed R2 sync leaks `LITESTREAM_SECRET_ACCESS_KEY` to systemd journal. Zero exploit skill needed.
2. **AP-3 — Audit JSONL disk exhaustion via oversized DevOutput.** Single compromised story execution fills 40GB → audit trail destroyed.
3. **AP-1 — Brute-force confirmation code if 4-digit variant deploys.** 10s SIM swap + 10K combos at 100 req/s inbound (no rate-limit per `wa_id`).

**8 new AOs (renumbered to AO-171..AO-178):**

| # | Vector mitigado | Defesa concreta |
|---|---|---|
| **AO-171** | Brute-force codes paralelos | Inbound rate-limit per `wa_id` 3 tentativas/60s + lockout 30min |
| **AO-172** | Supply chain via Renovate automerge | Pin hash integrity em `bun.lockb`; DESABILITAR patch-automerge para `@anthropic-ai/sdk`/`bun`/`litestream`/`drizzle-orm`; egress firewall systemd `IPAddressAllow=` |
| **AO-173** | Audit JSONL disk exhaustion | DevOutput payload ≤1MB validation; `runs/` quota systemd `RuntimeDirectorySize=`; JSONL streaming a R2 (não só SQLite via Litestream) |
| **AO-174** | Docker `-v` argument injection | `realpath + startsWith(RUNS_BASE)` antes de construir Bun.spawn args; `run_id` = `crypto.randomUUID()` only; reject `:`/`,`/spaces em paths |
| **AO-175** | Redaction bypass (Litestream/Git PAT/sk-ant) | Value-based redaction patterns: `sk-ant-`, `ghp_`, `AKIA`, S3 secret pattern; pino transport intercepta TODAS as mensagens |
| **AO-176** | RFC 3161 TSA spoofing via clock manipulation | NTP drift check no boot+horária (>5s = P1 + recusa append); validate TSA root cert; cross-ref Litestream WAL timestamps |
| **AO-177** | Litestream credentials over-permissioned (state rollback attack) | R2 IAM write-only (`s3:PutObject` only) para Litestream; restore credentials offline; validate via `aws s3api get-object` → 403 |
| **AO-178** | `bun --hot` em produção via copy-paste | Systemd unit CI check `grep -v '\-\-hot'`; SQLite `BEGIN EXCLUSIVE` lock no boot |

**Pre-M1 Mandatory Pentest Tasks (PT-1..PT-8):** 8 tasks concretos com testes verificáveis.

**Verdict:** "Não-deployável sem resolver AP-1, AP-3, AP-5 antes M1". Sistema resiliente a outsiders mas vulnerável a insider-bounded + adversarial LLM output.

### Incident Responder Day 15 M1 (cenário F: Litestream silent stop)

**14 dias sem replicação descobertos por restore test rotineiro acidental.** Near-miss real.

**Findings críticos:**
- Audit JSONL útil **forense não em tempo real** — 18 min grep manual sob fadiga
- `restore-from-backup.md` não cobre cenário "last backup > 24h" — operador self-debugou
- Litestream entra em backoff silencioso indefinido após timeouts; nenhum alerta
- Confidence pós-incident: **6/10** (volta a 8 só após 72h de alerts automatizados rodando)

**4 new AOs (AO-167..AO-170):**

| # | Obrigação |
|---|---|
| **AO-167** | Litestream health check cron: alert se last replication > 60min via WhatsApp P1 (10 linhas bash) |
| **AO-168** | `hdd status --full` aggregated command: Litestream sync age + disk usage + R2 connectivity + Anthropic quota — single source of truth morning check |
| **AO-169** | `hdd audit replay` filters obrigatórios: `--severity`, `--component`, `--last Nh` antes do primeiro sprint |
| **AO-170** | Backup restore test como story **recorrente** no calendar (não no backlog), SLA máximo 7 dias entre testes |

### Deployment Review Board — VERDICT FINAL

**Decision: APPROVE-WITH-CONDITIONS** · **Confidence: Medium**

Razão Medium: AO-164/165/166 referenciadas no mandate mas **não materializadas** no architecture.md (que termina em AO-150) — integrity gap detected pelo próprio DRB. **Necessário fechar antes Sprint 1.**

**4 Sprint 0 hard conditions:**

1. **AO-86 resolution (Day 5 hard gate):** schema clihelper real; substituir `z.unknown()` por Zod validated schema. **Não-negociável SPoF.**
2. **AO-164/165/166 materialization:** formalmente adicionadas ao AO registry com texto, owner, traceability ao pre-mortem. **Ou** declaradas out-of-scope com rationale documentada. Estado actual = integrity gap.
3. **Plan B Bun→Node drill:** rehearsal real em ambiente local; time-box 2h; validar estimate 4-6h.
4. **3 templates Meta submitted antes Day 7:** `hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat` — latência aprovação 1-3 dias por template; failure to submit antes Day 7 = M1 gate bloqueado pela Meta.

**5 DRB Recommendations:**

1. **AO-86 como Day 0 action, não Day 5** — contactar clihelper operator imediatamente
2. **Formalize AO-164/165/166** ou close explicitly — integrity gap actual
3. **NÃO começar Sprint 1 com `z.unknown()` live** — security posture regression
4. **Feature flag no clihelper adapter** em Sprint 0 — pipeline rodar end-to-end com mock-webhook fixtures sem bloquear outras stories
5. **Litestream restore drill antes de qualquer dado real** — custo zero, valida RTO claim

**3 Monitoring metrics post-deploy:**

| Métrica | Threshold | Acção |
|---|---|---|
| AO-86 schema drift | 1× HTTP 4xx clihelper inbound mismatch /1h | DRB re-review clihelper dependency strategy |
| LLM window consumption rate | > 70% nos primeiros 10 dias Sprint 0 (sem load) | Re-review AO-151 cost model; estimate 2-3M tokens/mês pode estar errado |
| Sprint 0 velocity | < 4/7 bootstrap stories no Day 10 | Scope review antes de comprometer M1 date |

### Mandatory Questions Answered

| Q | Resposta DRB |
|---|---|
| A. Harm material a terceiros? | **No scenario identified** (single-operator infra; no public surface) — does NOT trigger REJECT |
| B. Decisão arquitetural fatal 6m? | **No fatal tech debt** mas AO-86 SPoF deve ser resolvido Sprint 0 |
| C. Rollback trivial 1h Day 5? | **Yes, mechanism exists; adequately specified Sprint 0 scope** |
| D. Elicitation custou mais que valeu? | **No.** Process proporcionado à complexidade (87-FR autonomous pipeline solo sem team review). Marginal: AO-164/165/166 não materializadas é ineficiência honesta. |
| E. operador autorizado Sprint 0 amanhã? | **APPROVE-WITH-CONDITIONS** |

---

## Consolidação total Step 07

**28 novas AOs (AO-151..AO-178)** distribuídas:
- Devil's Advocate: AO-151..AO-154 (4)
- AI Safety: AO-155..AO-163 (9)
- Pre-mortem cirúrgico: AO-164..AO-166 (3)
- Incident Responder: AO-167..AO-170 (4)
- Adversarial Pentester: AO-171..AO-178 (8)

**Total: 178 AOs activas** (AO-1..AO-178; AO-25 dispensada + 5 não-aplicáveis pós-D-033 a re-verificar)

**BLOCKERS finais consolidados (4 hard):**

| # | Item | Owner | Deadline |
|---|---|---|---|
| 1 | AO-86 webhook clihelper schema | Operador | Day 5 (recomendado: Day 0) |
| 2 | AO-155+AO-164 two-step confirmation impl | Implementação | Sprint 0 |
| 3 | AO-158+AO-165 path traversal sanitization | Implementação | Sprint 0 |
| 4 | AO-160+AO-166 redaction + R2 publicAccessBlock | Implementação | Sprint 0 |

**8 Pentest Tasks** (PT-1..PT-8) executáveis em Sprint 0 com testes verificáveis.

**Status final:** **APPROVE-WITH-CONDITIONS** (DRB Medium confidence pending AO-164..166 materialization)

### Confidence stratification final

| Dimensão | Level | Justificação |
|---|---|---|
| Arquitetura interna | **HIGH** | 178 AOs coherent, layering sound, schemas formal |
| Safety posture | **MEDIUM-LOW** até AO-155+158+160 implementadas + AO-164/165/166 formalizadas |
| Operational | **MEDIUM-HIGH** pending operator pré-work + AO-167 (Litestream alert) |
| Cost economics | **MEDIUM** — AO-151 model documentado mas não validado contra realidade |
| Plan B preparedness | **MEDIUM-LOW** documented; **CONCERN** until rehearsed (AO-153) |

---

## Implications para Step 08

Step 08 (Completion & Handoff) deve incluir:
- **Sprint 0 implementation plan** com 4 hard conditions + 8 pentest tasks + 5 DRB recommendations
- **3 monitoring metrics** para post-deploy DRB re-review trigger
- **Final architecture summary** consolidado
- **Handoff guidance** para `bmad-create-epics-and-stories` (next workflow)
- **AO-164/165/166 formalization** OR out-of-scope declaration (DRB condition #2)

---

> **Estado:** synthesis Round 2 pronta. 28 novas AOs (AO-151..AO-178). Verdict DRB **APPROVE-WITH-CONDITIONS** com 4 Sprint 0 hard conditions. Marginal returns de mais rounds são agora muito baixos.
