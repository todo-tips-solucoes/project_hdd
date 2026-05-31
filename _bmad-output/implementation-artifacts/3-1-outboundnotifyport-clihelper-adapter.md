# Story 3.1: OutboundNotifyPort + clihelper adapter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `worker`,
I want um `OutboundNotifyPort` + `clihelper.adapter.ts` que faz POST aos endpoints do clihelper com `Authorization` header + payload Zod-validado,
so that o worker tem uma porta única para enviar mensagens, com adapter swappable (Telegram, Signal v1.1+).

## Acceptance Criteria

1. **(binary — send template)** **Given** o adapter configurado com `CLIHELPER_BASE_URL` + `CLIHELPER_TOKEN`
   **When** chamo `notify.sendTemplate({template:'hdd_interrupt_p1', vars:{...}, queueId})`
   **Then** faz POST ao endpoint clihelper correcto com header `Authorization: <token>` e body Zod-validado (number, name, language='pt_BR', openTicket, queueId, template[]).

2. **(binary — dry-run)** **Given** `NOTIFY_DRY_RUN=true`
   **When** `sendTemplate(...)` é chamado
   **Then** loga o request (endpoint + payload redacted) **sem** POST real (útil pré-aprovação dos templates Meta).

3. **(binary — selecção de endpoint)** **Given** um send **com** `vars` vs **sem** `vars`
   **When** o adapter constrói o request
   **Then** usa `api-oficial-mensagem-template` (com variáveis) vs `api-oficial-mensagem-template-sem-variavel` (sem) conforme a presença de `vars` (arch:653).

4. **(binary — payload inválido rejeitado)** **Given** um payload que viola o schema Zod (e.g. `language` ≠ 'pt_BR', campo em falta)
   **When** o adapter valida antes do POST
   **Then** retorna `err` sem POST (fail-closed; não envia lixo ao clihelper).

## Tasks / Subtasks

- [x] **Task 1 — `src/ports/outbound-notify.port.ts` (NEW)** (AC: #1) — `OutboundNotifyPort` (transporte); `sendTemplate({template, vars?, queueId}): ResultAsync<SendResult, OutboundNotifyError>`. `OutboundNotifyError = Transient|Permanent|RateLimited|PayloadInvalid`. Distinto do `NotifyPort` (Q-3.1-1=a). 38 linhas.
- [x] **Task 2 — `src/adapters/whatsapp/payload-schema.ts` (NEW)** (AC: #1, #3, #4) — `clihelperBodySchema` `.strict()` (number, name, language=`z.literal('pt_BR')`, openTicket, queueId, template[]) + `clihelperTemplateEntrySchema` (`{name, parameters:[{key,value}]}` — assumção O-3.1-1). 37 linhas.
- [x] **Task 3 — `src/adapters/whatsapp/clihelper.adapter.ts` (NEW)** (AC: #1-#4) — `createClihelperAdapter(config, deps)`. `config={baseUrl,token,dryRun,number,name,openTicket}` injectado (env.ts NÃO tocado). `deps={http: HttpPort, log?}`. `selectEndpoint` (vars→endpoint), `buildBody`, valida → (dryRun? loga redacted : POST Authorization) → `mapStatus` (429→RateLimited, 5xx→Transient, 4xx→Permanent). 129 linhas.
- [x] **Task 4 — `tests/adapters/clihelper.test.ts` (NEW)** (AC: #1-#4) — fake `HttpPort` (spy url/headers/body). AC1 endpoint+Authorization+pt_BR; AC2 dryRun 0 POSTs + log sem var-values/token; AC3 vars vs `{}` vs sem-vars → endpoints; AC4 number vazio→PayloadInvalid 0 POSTs; +5xx/4xx/429/transporte. Sem rede real (D-053). 10 specs.
- [x] **Task 5 — gates**: type-check clean · lint exit 0 · `bun test` 361 pass / 3 skip / 0 fail (+10) · integração 16 pass / 3 skip.
- [x] **Task 6 (FINAL) — Tier-B summary (21ª dogfood)**: `scripts/generate-31-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-3-1): …` (`d0a2713`, Tier-B **544 words** ≤715). `workflowId: "story-3-1"`. Sprint-status `3-1 → review`.

## Dev Notes

### Spot-check AI-E2-3 (executado antes desta story — achados)

Cruzamento arquitectura × epics × memórias do clihelper. **Veredicto: clear to implement** — o **outbound está totalmente especificado** (arch:653-655); o blocker **O-B5-3/AO-86 é INBOUND** (webhook `/callback`) e **NÃO bloqueia a 3.1**. Achados que viraram Open Questions: (1) layering `NotifyPort` vs `OutboundNotifyPort`; (2) shape de `template[]`; (3) injeção de transporte HTTP. Domínio via `CLIHELPER_BASE_URL` (env, não hardcoded — `clihelper.example.com` da arch é placeholder; real = `chatmasterveloz.com`).

### Big picture

Primeira story do Epic 3 (canal WhatsApp). Entrega a **porta de saída** do worker: um adapter HTTP simples sobre o app proprietário do operador (clihelper), que envuelve a Meta Cloud API. A 3.1 é o **adapter nu** (POST + auth + payload validado + dry-run); o leaky-bucket 1 req/s + retry + circuit breaker são da **Story 3.2** (que envolve este adapter). `[[project-hdd-clihelper-integration]]`, `[[project-hdd-whatsapp-api]]`.

### Reuso (NÃO reinventar)

- **`env.ts`** (1.c.2): `CLIHELPER_TOKEN` **já existe** no schema Zod (O-C2-1 — wire nesta story). Adicionar `CLIHELPER_BASE_URL` + `NOTIFY_DRY_RUN` se ausentes (verificar antes — pode ser files_modified implícito; registar se sim).
- **`NotifyPort`** (`src/ports/notify.port.ts`, 1.a.3): port **de domínio** (`notify(NotifyEvent)` — Interrupt/Summary/Heartbeat). A docstring diz "whatsapp.adapter implements NotifyPort (3.1)" — mas a epics 3.1 estrutura como `OutboundNotifyPort` (transporte). **Ver Q-3.1-1** (a docstring de 1.a.3 está layered de forma diferente).
- **`AdapterError`** (arch:618): `Transient|Permanent|RateLimited|WindowExhausted|Unauthorized`. **`SpawnPort`** é o padrão de transporte injectável (real + fake) — replicar para HTTP (Q-3.1-4). **`branded.ts`**, `Result`/`ResultAsync`, factory `createXAdapter(config, deps)`.
- Outbound payload **concreto** (arch:653-655): `POST {baseUrl}/principal/apis/mensagem/api-oficial-mensagem-template{,-sem-variavel}/`, `Authorization: <token>`, body `{number, name, language=pt_BR, openTicket, queueId, template[]}`, rate-limit 1 req/s (AO-45, mas isso é 3.2).

### Fronteiras (o que NÃO fazer aqui)

- **Story 3.2 (bucket/retry/CB):** leaky-bucket 1 req/s, retry expo (2s base, max 5, 60s), circuit breaker (5/1min). A 3.1 faz **um POST directo** — sem fila, sem retry, sem CB. A 3.2 envolve este adapter.
- **Inbound/webhook (`/callback`):** O-B5-3/AO-86 — schema inbound TBD, é story posterior (n8n inbound, `[[project-hdd-n8n-topology]]`). A 3.1 é **só outbound**.
- **Story 3.3 (templates):** os 6 templates UTILITY + tracking de aprovação Meta. A 3.1 aceita um `template` string genérico — não valida contra a lista dos 6 (isso é 3.3).
- **Idempotency key** (AO-39, arch:584): pareia com retry → **Story 3.2** (Q-3.1-4). A 3.1 não computa a chave.
- **NotifyEvent→template mapper:** a tradução domínio→transporte é story posterior (Q-3.1-1).

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-3.1-1 [RESOLVED — (a) dois ports distintos]:** `OutboundNotifyPort` (transporte, `sendTemplate`) é o que a 3.1 constrói; `NotifyPort` (1.a.3, domínio) fica **intacto**; o mapper NotifyEvent→template é story posterior. Docstring de 1.a.3 re-layered — registado (AI-E2-3).
- **Q-3.1-2 [RESOLVED — (a) named Record]:** port expõe `vars: Record<string,string>`; o adapter constrói o `template[]`. A estrutura interna exacta de cada elemento é **assumção documentada pendente de confirmação do operador** (outbound, análogo a O-B5-3) — schema `.strict()` validado + open item O-3.1-1 com trigger de re-check.
- **Q-3.1-3 [RESOLVED — (a) derivar de `vars`]:** `vars` vazio/ausente → endpoint `…-template-sem-variavel`; presente → `…-template` (arch:653).
- **Q-3.1-4 [RESOLVED — (a) transporte injectado, idempotency diferida]:** `HttpPort` injectável (fake nos testes, `Bun.fetch` em produção; espelha `SpawnPort`). Idempotency key (AO-39) **diferida para 3.2** (pareia com retry). `env.ts` **não tocado** — o adapter recebe `config` injectado (wiring env→config = integração posterior).

### Project Structure Notes

- `files_created`: `src/ports/outbound-notify.port.ts`, `src/adapters/whatsapp/clihelper.adapter.ts`, `src/adapters/whatsapp/payload-schema.ts`, `tests/adapters/clihelper.test.ts`. `files_modified: —` (mas `env.ts` pode precisar `CLIHELPER_BASE_URL`/`NOTIFY_DRY_RUN` — verificar; se sim, registar divergência).
- **Naming:** a arquitectura usa `WhatsAppPort`/`whatsapp.adapter`/`createWhatsAppAdapter`; a epics usa `OutboundNotifyPort`/`clihelper.adapter` em `src/adapters/whatsapp/`. **Seguir a epics** (files_created explícito); divergência de naming registada (AI-E2-3).
- Biome `maxLines:200` HARD. `ao_subset`: FR-020, FR-021, FR-022, FR-023, AR-100.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] (linhas 1448-1465 — StorySpec + ACs)
- [Source: _bmad-output/planning-artifacts/architecture.md] (179/207 D-033+AO-45 · 580-585 outbound auth/idempotency · 652-655 endpoint+body · 642 retry table)
- [Source: src/ports/notify.port.ts] (1.a.3 — NotifyPort domínio; layering Q-3.1-1)
- [Source: src/lib/env.ts] (1.c.2 — CLIHELPER_TOKEN existe) · [Source: src/ports/spawn.port.ts] (padrão transporte injectável real+fake)
- Memórias: `[[project-hdd-clihelper-integration]]` (HTTP client, rate-limit 1 req/s), `[[project-hdd-n8n-topology]]` (clihelper só outbound; inbound=n8n), `[[project-hdd-whatsapp-api]]` (Meta Cloud API; templates pré-aprovados; pt_BR)
- readiness-open-items.md (O-B5-3 inbound NÃO bloqueia 3.1; O-C2-1 wire CLIHELPER_TOKEN)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0.
- `bun test` → 361 pass / 3 skip / 0 fail (era 351; +10).
- `bun run test:integration` → 16 pass / 3 skip.

### Completion Notes List

- **AC1:** `sendTemplate` → POST ao endpoint clihelper + `Authorization: <token>` + body Zod-validado (language=`pt_BR`). `HttpPort` injectado captura o request no teste.
- **AC2 (dry-run):** `dryRun:true` → 0 POSTs + 1 log `[NOTIFY_DRY_RUN]`. Redaction por omissão: o log **não** contém values de `vars` nem o token (testado explicitamente).
- **AC3:** `vars` ausente **e** `{}` → endpoint `-sem-variavel`; `vars` com chaves → endpoint com variável (derivado de `vars`, Q-3.1-3).
- **AC4 (fail-closed):** body inválido (`number` vazio) → `err(PayloadInvalid)` + **0 POSTs** (não envia lixo). Status HTTP: 5xx→Transient, 4xx→Permanent, 429→RateLimited(retryAfterMs); erro de transporte propagado.
- **Q-3.1-1=(a):** `NotifyPort` (1.a.3) intacto; `OutboundNotifyPort` é o transporte. **Q-3.1-4=(a):** `HttpPort` injectável; idempotency diferida p/ 3.2; `env.ts` não tocado (config injectado).
- **Fronteiras:** sem bucket/retry/CB (3.2), sem idempotency key (3.2), sem inbound (n8n), sem validação dos 6 templates (3.3). Sem deps novas.
- **O-3.1-1:** shape interno de `template[]` é assumção (`{name, parameters:[{key,value}]}`) pendente de confirmação do operador — re-check quando o clihelper outbound real for sondado.

### File List

- `src/ports/outbound-notify.port.ts` (NEW)
- `src/adapters/whatsapp/payload-schema.ts` (NEW)
- `src/adapters/whatsapp/clihelper.adapter.ts` (NEW)
- `tests/adapters/clihelper.test.ts` (NEW)
- `_bmad-output/implementation-artifacts/3-1-outboundnotifyport-clihelper-adapter.md` (story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status 3-1 + epic-3)
- `_bmad-output/planning-artifacts/readiness-open-items.md` (O-3.1-1)
- `scripts/generate-31-summary.ts` (NEW — Task 6, dogfood)
