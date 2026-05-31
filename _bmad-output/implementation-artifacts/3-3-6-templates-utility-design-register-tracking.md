# Story 3.3: 6 templates UTILITY — design + register tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador` (operations),
I want especificação e tracking de submissão dos 6 templates UTILITY (`hdd_interrupt_p1`, `hdd_interrupt_s1`, `hdd_interrupt_s2`, `hdd_summary_finalization`, `hdd_heartbeat`, `hdd_release_final`),
so that submeto a Meta no clihelper UI e o M1 mínimo (3 aprovados) é trackable.

## Acceptance Criteria

1. **(binary — checklist de tracking)** **Given** a spec dos 6 templates em `whatsapp-templates-utility.md` + `template-catalog.ts`
   **When** corro `scripts/template-submission-status.ts`
   **Then** lê o catálogo + um estado de submissão (manual, sem API) e produz um checklist com o estado por template (`pending|submitted|approved|rejected`).

2. **(binary — M1 threshold gate)** **Given** os 3 templates mínimos aprovados (`hdd_interrupt_p1`, `hdd_summary_finalization`, `hdd_heartbeat`)
   **When** o script avalia o threshold
   **Then** sinaliza "M1 minimum viable met" (exit 0 + mensagem); se faltar ≥1 dos 3 → "not met" (exit ≠ 0) — gate para E7.b.

3. **(binary — catálogo tipado fiel)** **Given** o `template-catalog.ts`
   **When** é consumido (script agora; adapter na reconciliação)
   **Then** modela os 6 templates fielmente (name, trigger, var counts, button payloads, `m1Required`) **alinhado com o shape real documentado** (Q-3.3-1) — não com o shape assumido (errado) da 3.1.

## Tasks / Subtasks

- [x] **Task 1 — `whatsapp-templates-utility.md` (REFINE)** (AC: #3) — frontmatter: `{CLIHELPER_BASE_URL}` (env, placeholder), `m1_required:[…3…]`, status refined. Nota de reconciliação: shape `template[]` Meta-component **autoritativo** (O-3.1-1); buttons divergem do `PAYLOAD_MAP` (O-3.3-1, 3.4); catálogo tipado.
- [x] **Task 2 — `src/lib/template-catalog.ts` (NEW)** (AC: #1, #3) — `TEMPLATE_NAMES`/`TemplateName`, `TEMPLATE_CATALOG` (6× {name, trigger, category, var counts, buttons[doc real], m1Required}), `M1_REQUIRED` (derivado), `SUBMISSION_STATUSES`, `parseSubmissionState` (valida; `_`-keys=comentários; ausentes→pending), `evaluateM1`. Puro. 152 linhas.
- [x] **Task 3 — `scripts/template-submission-status.ts` (NEW)** (AC: #1, #2) — lê o JSON de estado (path via `import.meta.dir`) + catálogo → checklist com ícones; `evaluateM1` → exit 0 (M1 met) / exit 1 (not met, lista faltam / estado inválido). Corrido: exit 1 com tudo pending (correcto).
- [x] **Task 4 — estado de submissão (Q-3.3-2)** — `_bmad-output/planning-artifacts/template-submission-status.json` (**JSON, não YAML** — evita dep de parser; 0-deps) com `pending` nos 6 + `_comment`. Operador actualiza.
- [x] **Task 5 — `tests/lib/template-catalog.test.ts` (NEW — adição, fora de files_created; registado)** (AC: #1-#3) — 6 nomes exactos; `m1Required` nos 3; buttons do doc; `parseSubmissionState` (válido/parcial/`_`-keys/desconhecido/status-inválido/não-objecto); `evaluateM1` (tudo pending→3 faltam; 3 approved→met; falta 1→lista). 11 specs.
- [x] **Task 6 — gates**: type-check clean · lint exit 0 · `bun test` 383 pass / 3 skip / 0 fail (+11) · integração 16 pass / 3 skip.
- [x] **Task 7 (FINAL) — Tier-B summary (23ª dogfood)**: `scripts/generate-33-summary.ts` → `gen.finalize(input)` auto-commit `summary(story-3-3): …` (`781097e`, Tier-B **547 words** ≤715). `workflowId: "story-3-3"`. Sprint-status `3-3 → review`.

## Dev Notes

### ⚠️ Spot-check AI-E2-3 — achado crítico (a ler primeiro)

O `whatsapp-templates-utility.md` (pré-existente) documenta o **shape real** do `template[]` outbound (Meta components: `{type:'header'|'body'|'button', sub_type, index, parameters:[{type:'text'|'payload', text|payload}]}`, `name`=nome do template, `openTicket`/`queueId` **números**). Isto **contradiz** o shape assumido na 3.1 (`payload-schema.ts`, O-3.1-1: `{name, parameters:[{key,value}]}`, `openTicket` boolean, `queueId` string, `name`=recipient). A 3.1 corre só em **dry-run** (sem templates aprovados) → **sem dano live**, mas é dívida conhecida. **Q-3.3-1 decide se reconciliamos a 3.1 agora ou diferimos.** Lição meta: o spot-check deve ler **os docs de planning** (não só `architecture.md`).

### Big picture

Story `docs`-pesada: nail a spec dos 6 templates UTILITY + um catálogo tipado + um script de tracking manual da aprovação Meta (sem API — a Meta aprova via UI do clihelper). Gate de negócio: **3 aprovados = M1 mínimo viável** (FR-026, AR-070). É a peça que destrava o envio real (os adapters 3.1/3.2 já existem mas correm em dry-run até haver templates aprovados).

### Reuso (NÃO reinventar)

- **`whatsapp-templates-utility.md`** (existe, draft 2026-05-20): 6 templates completos (body, buttons, payloads, samples) + payload de exemplo com o **shape real** (linhas 248-291). **Refinar**, não reescrever.
- **`interrupt-commands.ts`** (`src/core/domain/`): os payloads dos buttons (`p1_continuar_assim`, etc.) ligam aqui (parser na 3.4). O catálogo deve ser consistente.
- **`clihelper.adapter.ts`/`payload-schema.ts`** (3.1): o shape a reconciliar (Q-3.3-1). **`OutboundNotifyPort.sendTemplate`** aceita um `template: string` — o catálogo dá-lhe os nomes válidos (validação dos 6 não estava na 3.1, é aqui).
- Padrão: `lib` puro; script com paths robustos (`process.execPath`, memória `[[project-hdd-bun-spawn-ci-gotcha]]`). `Zod` (já dep). Sem deps novas.

### Fronteiras (o que NÃO fazer aqui)

- **Story 3.4 (inbound/callback):** o parser dos Quick Reply payloads (`p1_continuar_assim`→`P1Continuar`). A 3.3 só **define** os payloads no catálogo.
- **Envio real:** a 3.3 não envia nada à Meta (manual via UI do clihelper). Só trackeia.
- **Reconciliação do adapter (se Q-3.3-1=defer):** wiring do `buildBody` ao catálogo + shape correcto = follow-up.
- A 3.3 **não** implementa lógica de retry/bucket (3.2) nem FSM.

### Decisões de arquitectura (Open Questions — RESOLVED pelo operador 2026-05-31)

- **Q-3.3-1 [RESOLVED — (b) diferir]:** 3.3 entrega `template-catalog.ts` com o shape **correcto** (fonte da verdade) + tracking; a reconciliação do adapter da 3.1 (`payload-schema.ts`+`buildBody`+test) é **follow-up dedicado** (O-3.1-1 → "shape conhecido, falta wiring"). Respeita o escopo `docs`; sem dano live (dry-run).
- **Q-3.3-2 [RESOLVED — (a) estado manual separado]:** ficheiro de estado separado (`template-submission-status.json` — **JSON, não YAML**, para evitar dep de parser; 0-deps mantido) que o operador actualiza (`pending→submitted→approved/rejected`); o script lê catálogo + estado → checklist (validado). Separa spec imutável de estado mutável.
- **Q-3.3-3 [RESOLVED — (a) exit code gate]:** o script computa "3 `m1Required` aprovados" → exit 0 + PASS; senão exit ≠ 0 + lista os que faltam (gate-able). Como o `runbook-completeness.sh`.

### Spot-check (2º achado) — payloads doc vs interrupt-commands.ts

O `PAYLOAD_MAP` (1.a.4) diverge dos buttons do doc: doc tem `p1_mudar_rumo`/`p1_ver_detalhes`/`fin_rever`/`fin_bloquear` + s1/s2/hb/rel; o map tem `p1_pausar_agora`/`fin_pedir_mudancas`/`fin_rejeitar` e não cobre s1/s2/hb/rel. **Reconciliação = Story 3.4** (o parser consome o `PAYLOAD_MAP`). O catálogo da 3.3 reflecte os buttons **reais do doc**; registado como **O-3.3-1** para a 3.4.

### Project Structure Notes

- `files_created`: `whatsapp-templates-utility.md` (REFINE — já existe), `src/lib/template-catalog.ts`, `scripts/template-submission-status.ts`. `files_modified: —` (mas Q-3.3-1=a tocaria 3.1 → divergência; +`template-submission-status.yaml` e o test são adições prováveis — registar).
- `ao_subset`: FR-026, AR-070. Biome `maxLines:200` HARD.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] (1496-1517 — StorySpec + ACs)
- [Source: _bmad-output/planning-artifacts/whatsapp-templates-utility.md] (6 templates + shape real `template[]` linhas 248-291 — O-3.1-1 resolve aqui)
- [Source: src/adapters/whatsapp/payload-schema.ts] (3.1 — shape assumido a reconciliar; Q-3.3-1)
- [Source: src/core/domain/interrupt-commands.ts] (payloads dos buttons; parser = 3.4)
- [Source: docs/runbooks/whatsapp-template-rejection.md] (runbook de rejeição Meta)
- readiness-open-items.md (O-3.1-1 resolve; O-3.2-1 idempotency)
- Story anterior: `3-2-...md` · Memória `[[project-hdd-bun-spawn-ci-gotcha]]` (paths robustos no script)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m]

### Debug Log References

- `bun run type-check` → clean. `bun run lint` → exit 0 (import órfão `SubmissionState` removido após lint:fix tirar os casts).
- `bun test` → 383 pass / 3 skip / 0 fail (era 372; +11). `bun run test:integration` → 16 pass / 3 skip.
- `bun run scripts/template-submission-status.ts` → exit 1 (tudo pending; M1 not met) — comportamento correcto do gate.

### Completion Notes List

- **AC1:** o script lê o JSON de estado + catálogo → checklist por template (ícones approved/submitted/rejected/pending + tag [M1]).
- **AC2:** `evaluateM1` — 3 `m1Required` approved → "M1 met" exit 0; falta ≥1 → exit 1 + lista. Gate-able (Q-3.3-3=a).
- **AC3:** catálogo tipado fiel — 6 nomes exactos, `m1Required` nos 3 (p1/finalization/heartbeat), buttons = payloads **reais do doc** (não o `PAYLOAD_MAP`).
- **Q-3.3-1=(b):** shape correcto no catálogo + doc autoritativo; **reconciliação do adapter da 3.1 diferida** (O-3.1-1 → "shape conhecido, falta wiring"). Sem dano live (dry-run).
- **Q-3.3-2=(a):** estado em JSON separado (não YAML → 0-deps). **Q-3.3-3=(a):** exit code.
- **2 achados do spot-check:** (1) shape `template[]` errado na 3.1 (O-3.1-1 actualizado); (2) buttons doc vs `PAYLOAD_MAP` (O-3.3-1 p/ 3.4).
- **Fronteiras:** sem parser inbound (3.4), sem envio real (manual via clihelper UI), sem reconciliação do adapter (follow-up). Sem deps novas.

### File List

- `_bmad-output/planning-artifacts/whatsapp-templates-utility.md` (REFINE)
- `src/lib/template-catalog.ts` (NEW)
- `scripts/template-submission-status.ts` (NEW)
- `_bmad-output/planning-artifacts/template-submission-status.json` (NEW — estado manual)
- `tests/lib/template-catalog.test.ts` (NEW — adição fora de files_created; registado)
- `_bmad-output/implementation-artifacts/3-3-...md` (story file) · `sprint-status.yaml` · `readiness-open-items.md` (O-3.1-1 update, O-3.3-1)
- `scripts/generate-33-summary.ts` (NEW — Task 7, dogfood)
