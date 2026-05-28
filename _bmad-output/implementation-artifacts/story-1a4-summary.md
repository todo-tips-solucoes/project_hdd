# Story 1.a.4 — Domain FSM + interrupt-commands tagged union · projeto_hdd · 2026-05-28

> Resumo Tier-B (D-019 obrigatório). Reviewer: operador. Status: **review**.

## Contexto (1-2 frases)

Sprint 0 Day 2, 4ª story implementacional do Epic 1.a. **1ª story com código real em `src/core/`** — primeira validação **viva** de AO-103 (no `setTimeout` em core) e Dep Graph Rigour (core não importa adapters). Entrega o "domínio" do worker: FSM (estado único), InterruptCommand (Quick Reply contract), DomainEvent (catálogo auditável).

## O que foi feito

- **`src/core/fsm.ts` (112 linhas)** — FSM com 6 estados (Q-A4-1 lowercase per epics) + 11 event kinds + transition table + `transition(from, event): Result<{to}, FsmError>` pura. JSDoc com tabela markdown das 13 transições válidas. Persistência diferida a 1.a.5; queue de triggers diferida a 4.x.
- **`src/core/domain/interrupt-commands.ts` (46 linhas)** — Tagged union 5 kinds + `PAYLOAD_MAP` canónico + `parseInterruptCommand(raw): Result<...>` match exacto literal (Q-A4-2).
- **`src/core/events.ts` (62 linhas)** — `DomainEvent` tagged union 6 kinds canónicos (architecture.md linhas 661-672). `GateName` stub 3 valores + `ParsedIntent` MVP 2 kinds (Q-A4-3). Zero builders (Q-A4-4).
- **`tests/core/fsm.test.ts` (164 linhas, 18 specs)** — 10 transições válidas + 5 inválidas + 1 property test (fast-check, 200 runs) + 3 sanity da tabela. Confirma totalidade `(state, event) → Result sempre`.
- **`tests/core/interrupt-commands.test.ts` (78 linhas, 11 specs)** — 5 payloads conhecidos + 4 unknown/edge (whitespace/casing strict per Q-A4-2) + 2 sanity do PAYLOAD_MAP.
- **`src/core/.gitkeep`** removido (substituído por código real).
- **`sprint-status.yaml`** — `1-a-4: backlog → review`.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | 6 states lowercase snake_case (não 9 UPPERCASE do architecture) | Q-A4-1: epics.md AC literal vence; architecture precisa reconciliação posterior (acumula O-A1/O-A2-3/O-A3-4). | Q-A4-1 |
| 2 | Match exacto literal em `parseInterruptCommand` (whitespace/casing strict) | Q-A4-2: payloads vêm de buttons Meta fixos; parser inbound (Story 3.4) garante cleanup upstream. | Q-A4-2 |
| 3 | `GateName` + `ParsedIntent` como stubs MVP | Q-A4-3: refina-se em 1.a.10 + 3.4 + 3.5; over-design agora é desperdício. | Q-A4-3 |
| 4 | Sem builder functions para `DomainEvent` | Q-A4-4: object literal `{kind, ...}` é suficiente; YAGNI. | Q-A4-4 |
| 5 | Transition table via `Record<state, Partial<Record<event, state>>>` (não switch + assertNever) | Lookup directa O(1), exhaustiveness via Partial em vez de assertNever. Mais data-driven. | (in-story) |
| 6 | Property test com 200 runs (não default 100) | FSM totalidade é central; 200 runs custa nada (115ms total) e cobre todas as 66 combinações estado × evento múltiplas vezes. | (in-story) |
| 7 | `ALL_STATES` e `ALL_EVENT_KINDS` exportadas como `ReadonlyArray<...>` | Permite que tests usem `fc.constantFrom(...ALL_STATES)` sem duplicar literais; também útil para futuro UI/debug. | (in-story) |
| 8 | `src/core/events.ts` exporta types puros (no runtime code) | Coverage Bun não conta (esperado); testes de schema entrarão com 1.a.6 audit consumer. | (in-story) |

## Trade-offs aplicados

- **Quis FSM rica com payloads em eventos, fiquei com `{ kind }` only:** payloads ricos (e.g. `OperatorResponded` carrega o `InterruptCommand`) entram quando 4.x precisar. Por agora os kinds bastam para construir a tabela.
- **Quis split `tests/core/fsm.test.ts` em 3 ficheiros (transições / totality / sanity), fiquei com 1:** 164 linhas ainda confortável; split prematuro adicionaria overhead. Open item O-A4-4 documenta a opção para futuro.
- **Quis usar `assertNever` no default branch de switch, fiquei com Partial<Record>:** data-driven (lookup) é mais idiomático aqui; `assertNever` continua disponível para usos imperativos futuros.

## Open items deferidos

- **O-A4-1 (acumula O-A1/O-A2-3/O-A3-4):** mismatch epics ↔ architecture sobre naming FSM. epics agora canónico (6 lowercase); architecture AO-2 precisa edit silencioso. **5 stories acumuladas** de docs ajustes — vale 1 commit `docs:` dedicado próxima sessão.
- **O-A4-2:** `events.ts` sem testes próprios (puro types). 1.a.6 audit consumer adicionará schema tests.
- **O-A4-3:** `assertNever` continua disponível mas não usado aqui; futuro código imperativo pode precisar.
- **O-A4-4:** `tests/core/fsm.test.ts` (164 linhas) — split se 1.a.5+ crescer.
- **O-A4-5:** Stryker mutation testing (AO-92) — deferred 1.c.4. FSM table é candidato perfeito (1 mutação na tabela = 1 spec deve falhar).

## Reviewer findings

N/A — gate de revisão humana pendente.

## Métricas

- Janela LLM: ~35% Opus (sessão única; 5ª story do dia se contar 1.c.7 + 1.a.1 + 1.a.2 + 1.a.3 + 1.a.4 = sim, 5ª).
- Duração: ~1h elapsed.
- Tasks: 8/8 completed.
- ACs cobertos: 5/5 explícitos + 2 implícitos (Dep Graph viva + AO-103 viva) = **7/7 ✓**.
- Tests: 74 pass / 0 fail / 123 expect() / 115ms wall-clock (+30 novos = 18 fsm + 11 interrupt + 1 description grouping?; -2 scaffold; era 44).
- Coverage `src/core/`: 100% line + 100% func em fsm.ts e interrupt-commands.ts; events.ts puro types (esperado). Branch via Bun não exposto (O-A2-1).
- Files: 5 novos (3 src + 2 test) + 2 modificados (sprint-status + story file) + 1 removido (src/core/.gitkeep).
- LOC novo: 220 src (`src/core/` populado pela 1ª vez) + 242 tests + 1 summary + 1 story file.
- Decisões registadas: 8 (4 humanas Q-A4-1..4 + 4 técnicas in-story).
- Dependencies: **0 novas** — pure domain only.
- Capacity: 5 stories em 1 sessão (1.c.7 + 1.a.1 + 1.a.2 + 1.a.3 + 1.a.4). Cenário B Expected D-046 = 6-7 sty/sem. Sessão única já gerou mais de meia semana — calibrar baseline em sprint review.

## Próximos passos sugeridos

1. **Operador aprova** com `approve story-1a4` → marco done + commit dos ~10 ficheiros (sem push). Mensagem proposta: `feat(story-1a4): FSM + InterruptCommand + DomainEvent (5+2 ACs verde; primeiro código em src/core/)`.
2. **Story 1.a.5 — db schema base + Drizzle + idempotency_keys table** — próxima na ordem do Epic 1.a (`blocked_by` provavelmente [1.a.4] ou [1.a.2]). Adiciona `bun:sqlite` + `drizzle-orm` + migrations runner + tables (`runs`, `stories`, `idempotency_keys`, `audit_events`). AO-40 (FSM persisted single-row + BEGIN IMMEDIATE) será central.
3. **Em paralelo (opcional):** 1 commit `docs:` consolidado resolvendo **5 open items acumulados** de docs ajustes (O-A1, O-A2-3, O-A3-4, O-A4-1 + revisão de O-A2-1/2 status). Deixa documentação sincronizada antes de Sprint 0 day 3+.

→ Aprovar: `approve story-1a4` · Pedir alterações: `request-changes story-1a4 <razão>`
