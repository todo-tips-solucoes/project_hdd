# Story 3.4: InboundCommandPort + Hono /callback + Quick Reply parsing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador`,
I want endpoint `POST /callback` (Hono) que recebe callbacks (via n8n — `[[project-hdd-n8n-topology]]`), valida Zod minimal schema **drop-at-ingress**, parseia Quick Reply payloads contra `interrupt-commands.ts`,
so that respostas no telemóvel chegam ao worker como events tipados.

## Acceptance Criteria

1. **(binary — webhook-mock AO-86)** **Given** `webhook-mock=true` (escalation se schema real não recebido)
   **When** `POST /callback` chega com payload de fixture
   **Then** o stub `z.unknown()` é permitido (o minimal schema extrai só o que o HDD precisa) + audit warning `[OPEN AO-86]`.

2. **(binary — Quick Reply parse)** **Given** payload com Quick Reply `payload:"p1_continuar_assim"` + `wa_id` operador (allowlist)
   **When** o parser corre
   **Then** retorna `ok({kind:'P1Continuar', wa_id, runId, storyId})` (via `parseInterruptCommand` + correlation).

3. **(binary — drop-at-ingress, defense in depth)** **Given** payload de `wa_id` **não**-allowlisted
   **When** chega ao listener
   **Then** **200** (não 401 — não vazar info) + audit `UnauthorizedInbound`; o comando **não** é processado.

4. **(binary — AI Safety, Pre-Mortem #2)** **Given** payload com `Authorization: Bearer <token>` ou `wa_id: 55…` raw
   **When** o listener faz `audit.append({type:'InboundCallback', payload})`
   **Then** a linha JSONL já sai **redacted** (redaction pre-write da Story 1.b.3 no audit adapter — nunca pós-write).
   **And** fixture com 3 secrets injectados → **0 occurrences raw** no JSONL (3/3).

## Tasks / Subtasks

- [x] **Task 1 — `src/ports/inbound-command.port.ts` (NEW)** (AC: #2) — `InboundCommand = InterruptCommand & {waId, runId?, storyId?}` + `InboundCommandError` + `InboundCommandHandler`. Reusa `interrupt-commands.ts`. 28 linhas.
- [x] **Task 2 — `src/adapters/whatsapp/callback-schema.ts` (NEW)** (AC: #1) — `minimalInboundSchema` (`{wa_id, payload?, runId?, storyId?}` + `.passthrough()`=z.unknown() resto) + `parseCallback` (wa_id ausente→MalformedPayload). 36 linhas.
- [x] **Task 3 — `src/adapters/whatsapp/callback-listener.adapter.ts` (NEW)** (AC: #1-#4) — `createCallbackApp(deps): Hono`; `POST /callback`: Bearer auth (n8n) → audit `InboundCallback` raw (adapter redige) → mock warning → allowlist → `parseInterruptCommand`. **Sempre 200**. `emit` com runId explícito. 90 linhas.
- [x] **Task 4 — `src/cli/start.command.ts` (MODIFY)** (AC: #3) — `createCallbackApp` (audit de `boot.value.audit`) + `app.route("/", callbackApp)` no mesmo `Bun.serve`. Config via env (`HDD_ALLOWED_WAIDS`/`HDD_WEBHOOK_MOCK`/`N8N_CALLBACK_TOKEN`; fail-closed: allowlist vazia → tudo dropped; mock default). `/healthz` intacto.
- [x] **Task 5 — `tests/adapters/callback-listener.test.ts` (NEW)** (AC: #1-#3) — `app.request` (sem socket). AC1 mock+warning; AC2 P1Continuar{waId,runId,storyId}; AC3 não-allowed→200+Unauthorized; + button não-mapeado→UnknownCommand (O-3.3-1), Bearer ok/errado, sem wa_id→drop. 7 specs.
- [x] **Task 6 — `tests/adapters/callback.security.test.ts` (NEW)** (AC: #4) — audit adapter **REAL** (`:memory:`+temp dir, D-053) + 3 secrets (Bearer, wa_id 55…, sk-ant-…) → JSONL **0 raw (3/3)** + `***REDACTED***` presente. Prova redaction pre-write.
- [x] **Task 7 — gates**: type-check clean · lint exit 0 · `bun test` 391 pass / 3 skip / 0 fail (+8) · integração 16 pass / 3 skip.
- [x] **Task 8 (FINAL) — Tier-B summary (24ª dogfood)**: `scripts/generate-34-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-3-4): …` (`1c29095`, Tier-B **580 words** ≤715). `workflowId: "story-3-4"`. Sprint-status `3-4 → review`.

## Dev Notes

### Spot-check AI-E2-3 (antes desta story — achados)

- **Inbound = n8n→HDD** (não clihelper→HDD): a arquitectura (658) diz "clihelper → HDD" mas o `ao_subset` lista explicitamente `[[project-hdd-n8n-topology]]` (n8n.todo-tips.com = inbound aggregator + **trust boundary**; HDD subscreve a n8n). A memória é autoritativa → o listener confia em n8n (Bearer token); n8n trata o `X-Hub-Signature-256` da Meta. Divergência de texto registada (Q-3.4-1).
- **AC4 já está quase-wired:** `redaction.ts` (1.b.3) existe E o `jsonl-hash-chain.adapter` **já chama `redactPayload(event.payload)` pre-write** (linha 135). A AC4 é **wiring + prova**: o listener encaminha o audit pelo adapter real; a security test prova 0-raw end-to-end. **NÃO duplicar redaction no listener** (Q-3.4-4).
- **AO-86:** schema inbound real ainda não recebido → `webhook-mock=true` (z.unknown()). O minimal schema extrai só `{wa_id, payload, runId?, storyId?}`.
- **O-3.3-1:** `p1_continuar_assim` (AC2) **está** no `PAYLOAD_MAP`; os restantes buttons do catálogo (3.3) não → reconciliação total = Q-3.4-3.

### Reuso (NÃO reinventar)

- **`interrupt-commands.ts`** (1.a.4): `parseInterruptCommand(raw): Result<InterruptCommand, UnknownCommand>` via `PAYLOAD_MAP` (match exacto). **É o parser da AC2.** `InterruptCommand` tagged union (P1Continuar, …).
- **`healthz.handler.ts`** (1.c.1): **padrão Hono** — `createXApp(deps): Hono`; `app.post(...)`; `c.req.json()`/`c.json()`; `app.request()` testa sem socket; `app.fetch` liga ao `Bun.serve`. Replicar.
- **`redaction.ts`** (1.b.3): `redactPayload` (pre-write) — **já aplicado pelo audit adapter**. Patterns: bearer, `wa-id` (`55\d{10,11}`), `sk-ant-…`, generic-secret. **`AuditPort`/`jsonl-hash-chain.adapter`** (1.a.6): redige pre-write.
- **`start.command.ts`** (2.1/3.x): monta `createHealthzApp` + `Bun.serve`. `connection.ts` (`:memory:`+migrations) + audit adapter para a security test.
- **`env.ts`**: token/allowlist (config injectado, como 3.1 — não tocar `env.ts` se possível). `Result`/`ResultAsync`; factory pattern.

### Fronteiras (o que NÃO fazer aqui)

- **Story 3.5 (NLP):** texto livre → intent via Haiku. A 3.4 só faz Quick Reply parsing; `UnknownCommand` (texto livre / button não-mapeado) é o ponto de entrada do fallback NLP (3.5 modifica este adapter).
- **Reconciliação total do `PAYLOAD_MAP`** (O-3.3-1): Q-3.4-3.
- **FSM:** o `InboundCommand` produzido alimenta a FSM/interrupt handling no **Epic 4**. A 3.4 só produz o event tipado.
- **Outbound** (3.1/3.2): a 3.4 é inbound puro.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-3.4-1 [RESOLVED — (a) n8n→HDD, Bearer token]:** o listener confia em n8n via Bearer token (vs env); n8n é o trust boundary e trata o `X-Hub-Signature-256` da Meta — HDD **não** o verifica. Divergência de texto da arquitectura ("clihelper→HDD") registada.
- **Q-3.4-2 [RESOLVED — (a) minimal + z.unknown()]:** `minimalInboundSchema` extrai `{wa_id, payload, runId?, storyId?}`; resto `z.unknown()` (drop-at-ingress mesmo sob mock) + warning `[OPEN AO-86]`. Apertar quando o schema real chegar.
- **Q-3.4-3 [RESOLVED — (a) diferir]:** `parseInterruptCommand` as-is; buttons não-mapeados → `UnknownCommand` (→ NLP 3.5). **Não** toca `interrupt-commands.ts`. O-3.3-1 mantém-se p/ reconciliação dedicada.
- **Q-3.4-4 [RESOLVED — (a) só no audit adapter]:** o listener passa o payload raw; a redaction é uma vez, pre-write, no `jsonl-hash-chain.adapter` (1.b.3, já wired). A security test usa o adapter REAL → 0-raw. Single source of truth.

### Project Structure Notes

- `files_created`: `inbound-command.port.ts`, `callback-listener.adapter.ts`, `callback-schema.ts`, `callback-listener.test.ts`, `callback.security.test.ts`. `files_modified`: `start.command.ts`.
- `ao_subset`: FR-024, AR-101, `[[project-hdd-n8n-topology]]`, AO-86 (mock flag). Biome `maxLines:200` HARD (listener separado do schema).

### References

- [Source: epics.md#Story-3.4] (1519-1548 — StorySpec + 4 ACs)
- [Source: architecture.md] (658-660 inbound /callback + AO-86; nota: "clihelper→HDD" desactualizado vs n8n memory — Q-3.4-1)
- [Source: src/core/domain/interrupt-commands.ts] (PAYLOAD_MAP + parseInterruptCommand — parser AC2)
- [Source: src/cli/healthz.handler.ts] (padrão Hono) · [Source: src/cli/start.command.ts] (mount point)
- [Source: src/lib/redaction.ts] (1.b.3 — redactPayload) · [Source: src/adapters/audit/jsonl-hash-chain.adapter.ts:135] (redaction pre-write JÁ wired)
- Memórias: `[[project-hdd-n8n-topology]]` (n8n inbound, trust boundary, drop-at-ingress), `[[project-hdd-whatsapp-api]]` (X-Hub-Signature — n8n trata), `[[feedback-hdd-composition-risks]]` (AI Safety)
- readiness-open-items.md (O-3.3-1 reconciliação parser; O-B5-3/AO-86 webhook-mock)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0.
- `bun test` → 391 pass / 3 skip / 0 fail (era 383; +8). `bun run test:integration` → 16 pass / 3 skip.
- `commands.test.ts` (start) intacto (boot fixture já tinha audit; só muda a mensagem started).

### Completion Notes List

- **AC1 (AO-86):** `webhookMock=true` → audit `InboundSchemaPending` `[OPEN AO-86]`; minimal schema + `.passthrough()` (z.unknown() resto).
- **AC2:** `p1_continuar_assim` + wa_id allowed → `onCommand({kind:'P1Continuar', waId, runId, storyId})` (via `parseInterruptCommand`).
- **AC3 (drop-at-ingress):** wa_id não-allowed → **200** (não 401) + audit `UnauthorizedInbound`; comando não processado.
- **AC4 (AI Safety):** security test com audit adapter REAL prova **0/3 secrets raw** no JSONL — a redaction é pre-write no adapter (1.b.3); o listener passa raw (Q-3.4-4). `***REDACTED***` confirmado.
- **Q-3.4-1=(a):** n8n→HDD, Bearer token; HDD não verifica X-Hub-Signature (n8n trata). Divergência da arquitectura ("clihelper→HDD") registada.
- **Q-3.4-3=(a):** button não-mapeado (`p1_mudar_rumo`) → `UnknownCommand` (→ NLP 3.5); O-3.3-1 mantém-se. `interrupt-commands.ts` não tocado.
- **Fronteiras:** sem NLP (3.5), sem wiring FSM (Epic 4), sem reconciliação PAYLOAD_MAP. `env.ts` não tocado (config via process.env directo). Sem deps novas.

### File List

- `src/ports/inbound-command.port.ts` (NEW)
- `src/adapters/whatsapp/callback-schema.ts` (NEW)
- `src/adapters/whatsapp/callback-listener.adapter.ts` (NEW)
- `src/cli/start.command.ts` (MODIFY — mount /callback)
- `tests/adapters/callback-listener.test.ts` (NEW)
- `tests/adapters/callback.security.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/3-4-...md` (story file) · `sprint-status.yaml` · `readiness-open-items.md` (divergência inbound source)
- `scripts/generate-34-summary.ts` (NEW — Task 8, dogfood)
