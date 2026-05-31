# Readiness — Open Items

Registo único de itens diferidos + divergências spec-vs-realidade. Cada item tem
um **trigger** (condição de reabertura) — anti `soft-convention-rot` (benefícios
optimistas viram dívida sem TTL). Consolidado na retro do Sprint 0 (AI-S0-3).

## Action items da retro do Epic 2 (AI-E2-*, 2026-05-31)

| ID | Action item | Decisão do Project Lead | Trigger |
|---|---|---|---|
| **AI-E2-1** | Reconciliar `epics.md` com a realidade registada (paga AI-S0-4: divergências 2.1/2.4/2.6/2.7). | **correct-course pass ANTES do Epic 3** | correr antes da Story 3.1; canon alinhado |
| **AI-E2-2** | Extrair abstracções partilhadas: `DiagnosticWriter`→port (O-2.5-1, já 2 callers), `RunStateRepository` (O-2.6-1), reconciliar `devOutputSchema` 2.3↔2.7 (O-2.7-1). | **regra dura: extrair ao 3º caller** | aparecer o 3º consumidor de qualquer uma → extrair nessa story |
| **AI-E2-3** | Spot-check arquitectura×epics×memórias do schema clihelper (O-B5-3) antes de implementar. | **Sim, no create-story da 3.1** | arranque da Story 3.1 |

## Open items diferidos

| ID | Aberto | Descrição | Trigger / TTL |
|---|---|---|---|
| **O-B5-3 / AO-86** | 2026-05-29 | schema clihelper inbound real ainda não recebido; `webhook-mock=true` mantido. | quando o schema chegar → `bun run check:webhook-schema` + remover o mock (cruza AI-E2-3) |
| **O-2.5-1 / O-2.6-1 / O-2.7-1** | 2026-05-31 | extracções diferidas: `DiagnosticWriter` port, `RunStateRepository`, reconciliação `devOutputSchema`. | **AI-E2-2** — extrair ao 3º caller |
| **O-C1-1** | 2026-05-29 | `dev` script (`bun --hot src/main.ts`) não serve `/healthz`; divergente de `hdd-worker start`. | **Epic 2 / Story 2.1** (mexe em `main.ts`/`hdd-worker.ts`) — consolidar entries |
| **O-C2-1** | 2026-05-29 | wire `CLIHELPER_TOKEN` no cliente HTTP clihelper (só está no schema Zod). | Epic 3 (outbound clihelper) |
| **O-C4-2** | 2026-05-30 | `license-checker` no `release.yml` não validado com node_modules do bun. | 1º run do `release.yml` (push de tag `v*`) → ajustar se falhar |
| **O-C4-3** | 2026-05-30 | Renovate App não instalada no repo GitHub → `renovate.json` sem efeito. | instalar a App → confirmar onboarding PR |
| **O-C5-1** | 2026-05-30 | forced-command SSH com sshd real ainda não testado (só via bash+env). | drill de host na 1ª VPS provisionada |
| **O-C5-2** | 2026-05-30 | `hdd-worker` precisa de polkit/sudoers para `systemctl restart`. | host setup na 1ª VPS (runbook ssh-deploy §3) |
| **O-C6-1** | 2026-05-30 | runbooks `whatsapp-template-rejection` e `clihelper-endpoint-down` têm secções `[quando implementado]`. | Epic WhatsApp / Epic 3 → completar + re-correr scanner |
| **O-A6-6** | 2026-05-28 | `epics.md ao_subset` usa AR-NNN; o canon `architecture.md` usa D-04.x/AO-NN. | reconciliação de nomenclatura (baixa prioridade) |
| **O-B5-1** | 2026-05-29 | escapes docker reais ao vivo (parcialmente coberto pela integração 1.b.4). | hardening de segurança dedicado |

**Fechados:** O-C6-2 (scanner de runbooks no CI) — feito na retro do Sprint 0 (`fix(ci)` AI-S0-2, 2026-05-30).

## Divergências spec-vs-realidade conhecidas (AI-S0-4)

O `epics.md` é o canon de **planeamento**; algumas entradas `files_created/modified`
divergem do código real (trabalho antecipado ou implementação diferente). **Não se
reescreve o canon a meio** — regista-se aqui e trata-se via **Open Question no
`create-story`** de cada story (abordagem provada no Sprint 0: ci.yml MODIFY,
`.hdd-state.db`, entry-point real, `.integration.test.ts`).

| Story | StorySpec diz | Realidade | Tratar no create-story como |
|---|---|---|---|
| **2.1** | `files_created: src/cli/hdd-worker.ts` | **já existe** (1.c.1) | **MODIFY**, não NEW |
| **2.1** | `files_created: src/cli/start.command.ts` | não existe — `start` está inline (`registerStartCommand` em hdd-worker.ts) | decidir: extrair p/ ficheiro vs manter inline |
| **2.1** | `files_created: status.command.ts, logs.command.ts` | não existem | NEW (legítimo) |
| **2.4** | `files_modified: src/core/fsm.ts (add gate state)` | feito: +estado `gate_blocked` + evento `GateBlocked` (Q-2.4-1) | MODIFY legítimo (estava na spec) |
| **2.6** | `files_modified: src/cli/hdd-worker.ts` (só) | também modifica `src/core/fsm.ts` (+evento `OperatorPaused`, Q-2.6-1=a) | divergência **aceite**: pause precisa de `running→paused_for_interrupt`; evento honesto vs reusar interrupt. Sem novo estado (enum DB intacto) |
| **2.7** | AC2 do epics: `verdict: 'pass'\|'fail-gap'\|'fail-bug'` | arquitectura (AO-106, Step 05/06): `'APPROVED'\|'APPROVED_WITH_WARNINGS'\|'REJECTED'\|'BLOCKED_P1'` | **conflito resolvido p/ arquitectura** (Q-2.7-1=a); enum do epics-AC era esboço superado; AC2 ("rejeita unsure") preservada |
| **2.x (geral)** | vários `files_created` | verificar caso a caso | **regra: no create-story de cada 2.x, confirmar files_created vs realidade antes de assumir NEW** |

> Princípio (retro Sprint 0): **fidelidade à realidade > spec literal**, com a divergência registada aqui para não apodrecer silenciosamente.
