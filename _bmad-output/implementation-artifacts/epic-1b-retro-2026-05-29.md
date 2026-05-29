# Retrospectiva — Epic 1.b: Safety BLOCKERS

- **Data:** 2026-05-29 · **Facilitador:** Amelia (Developer) · **Project Lead:** paulo (solo-op)
- **Formato:** retro adaptada a solo-operator (sem party-mode fictício — alinha com `feedback-hdd-soft-convention-rot`).
- **1ª retrospectiva do projecto** (epic-1a-retro foi `optional`, não corrida).

## 1. Sumário do épico

| Métrica | Valor |
|---|---|
| Stories | **5/5 done** (1.b.1 → 1.b.5) |
| ACs | 20 binary/coverage — todos verdes |
| Tests | 155 → **265 pass / 1 skip / 0 fail** (+110 specs) |
| Deps adicionadas | **0** (tudo composto sobre o existente) |
| Regressões deixadas | 0 (2 apanhadas+corrigidas in-flight) |
| DRB | 3 Hard-Condition BLOCKERS (#1 path, #2 confirmation, #3 redaction) materializados + sandbox + suite pentest |

Entregas: 1.b.1 path traversal (`sanitizeRelPath` + `apply-diff`), 1.b.2 two-step
confirmation (`confirmation-gate`), 1.b.3 audit redaction multi-pattern, 1.b.4
sandbox docker `--network=none`, 1.b.5 8 Pentest Tasks PT-1..PT-8 + report + Day-7 gate.

## 2. O que correu bem

1. **Composição > reimplementação** — a suite 1.b.5 prova as defesas existentes em vez de duplicar lógica (DRY, alto sinal de assurance).
2. **Defesas honestas, não checkboxes** — `WaIdMismatch` não-consome (anti-DoS), hash sobre payload redigido (never-store-raw), `--network=none` por construção.
3. **Contrato sync do bootstrap preservado** (1.b.4) via `Bun.spawnSync` em vez de refactor async grande.
4. **Dogfood do summary generator estável** — 5 stories, Tier-B 470–530 words, sempre dentro do cap (lição O-A9-5 internalizada).
5. **Q's delegadas com Recommended justificado** — fluxo de decisão rápido e auditável; o operador validou todas.

## 3. O que custou / fricções

1. **Gotcha do Write tool com control chars** (1.b.1) — 2 reescritas até detectar por `charCodeAt`. → memória `feedback-write-tool-control-chars`.
2. **Scope `workflow` do token** (1.b.3) — push do 1º `ci.yml` recusado 2×. → memória `project-hdd-git-workflow-scope` + refresh feito.
3. **2 regressões em testes pré-existentes** ao tocar ficheiros partilhados (interrupt-commands sanity 5→7; default sandboxImageCheck partia bootstrap) — apanhadas pela suite completa, mas mostram acoplamento de testes a invariantes hard-coded.
4. **Vectores sem implementação prévia** (PT-4 SSRF, PT-5 prompt-injection) — abordados pela defesa estrutural e diferidos; honesto mas deixou "meio-AC" documentado.

## 4. 🔑 Insight central da retro — mock-only escondia bugs reais

O operador levantou: *"podemos parar de mockar e testar com dados reais?"* Ao
investigar **com docker real** (disponível neste ambiente), descobrimos
imediatamente um bug que **226 testes mock não viam**:

> O `docker/sandbox/Dockerfile` tinha `ENTRYPOINT ["/bin/sh"]`; o adapter
> acrescenta `sh -c <script>` → o exec real ficava `/bin/sh sh -c ...` →
> `can't open 'sh'`. **O container nunca corria** — mas todos os testes (spawn
> spy) estavam verdes porque nunca executavam docker.

Corrigido (remover ENTRYPOINT) e validado ao vivo: egress `Network unreachable`,
`/etc` `Read-only file system`, `id -u`=65534, happy-path rc=0. **Lição:** o
mock prova *construção*, não *comportamento*. Faltava uma camada de integração.

## 5. Decisão registada — D-053: camada de integração híbrida

**Manter `bun test` mock-only como gate rápido/determinístico** (CI, custo, segurança)
**+ adicionar `tests/integration/` opt-in** que corre serviços reais, com
`describe.skipIf(!hasImage)` para o CI sem docker ficar verde. Não substitui os
mocks — acrescenta verdade por cima.

**Implementado nesta sessão (ação da retro, já feita):**
- `src/adapters/spawn/system-spawn.adapter.ts` (NEW) — o `SpawnPort` real via
  `Bun.spawn` que faltava desde 1.a.3 (só existia o fake).
- `tests/integration/sandbox.integration.test.ts` — docker REAL: egress
  bloqueado, read-only, non-root, cap-drop (fecha **O-B5-1**).
- `tests/integration/safety-e2e.integration.test.ts` — fs+SQLite+audit reais:
  apply-diff escreve ficheiro real, bloqueia symlink real, audit JSONL redigido
  no disco + verifyChain.
- `docker/sandbox/Dockerfile` — fix do ENTRYPOINT.
- `package.json` — `test:integration`; `.github/workflows/ci.yml` — job `integration`.
- Resultado: **265 pass / 1 skip / 0 fail**; integração real verde com docker 28.1.1.

## 6. Action items

| # | Ação | Estado |
|---|---|---|
| A1 | Camada de integração híbrida (D-053) | ✅ FEITO nesta sessão |
| A2 | `system-spawn.adapter.ts` real | ✅ FEITO |
| A3 | Fix Dockerfile ENTRYPOINT | ✅ FEITO |
| A4 | Sandbox real (O-B5-1) | ✅ FEITO (egress/ro/non-root validados ao vivo) |
| A5 | PT-5 rebuff semântico (classificador) | ⏳ Epic 4 (O-B5-2) |
| A6 | clihelper/WhatsApp reais (AO-86 + templates Meta) | ⛔ bloqueado externo (O-B5-3) |
| A7 | Litestream/R2 backup real | ⏳ Story 1.c.3 (precisa creds R2) |
| A8 | Reconciliar epics `ao_subset` vs canon architecture | ⏳ `docs:` futuro (O-A6-6) |

## 7. Preparação Epic 1.c (Bootstrap & Operations)

- Próxima: **1.c.1** (systemd + /healthz) — precisa de **Hono** (dep nova).
- 1.c.3 (Litestream/R2) é candidato natural a estender a camada de integração real.
- 1.c.4 (CI) vai mexer no workflow → scope `workflow` já activo.
- **Dependência externa aberta:** AO-86 (schema clihelper) — `webhook-mock=true`;
  re-correr `bun run check:webhook-schema` quando chegar. Não bloqueia 1.c.

## 8. Readiness assessment

| Dimensão | Estado |
|---|---|
| Testes/qualidade | ✅ 265 pass; mock (determinístico) + integração real (docker/fs/audit) |
| Segurança | ✅ 3 DRB BLOCKERS + sandbox validado ao vivo |
| CI | ✅ build-and-test + secret-scan + security-suite + **integration** (novo) |
| Bloqueadores p/ 1.c | nenhum interno; AO-86 externo não-bloqueante |
| Deploy real / Litestream | ⏳ Epic 1.c |

## 9. Key takeaways

1. **Mock prova construção; integração prova comportamento.** Sem a camada real, um container que nunca arrancava passava 226 testes.
2. **Composição é a unidade de valor da segurança** — os BLOCKERS isolados só valem compostos (o capstone 1.b.5 é a prova).
3. **Tocar ficheiros partilhados quebra invariantes de testes vizinhos** — correr a suite completa entre tasks é não-negociável.
4. **Gotchas de tooling (control chars, workflow scope) viram memórias** — não voltam a custar tempo.

---
*Retro gerada por `bmad-retrospective`. Decisão D-053 a propagar para a memória do projecto.*
