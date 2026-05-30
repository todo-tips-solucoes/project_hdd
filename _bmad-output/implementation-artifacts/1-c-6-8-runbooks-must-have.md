# Story 1.c.6: 8 Runbooks must-have

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `operador` (futuro 1 ano depois, ou colaborador eventual),
I want 8 runbooks de incident-response em `docs/runbooks/` + um `index.md`, cada um com as 5 secções canónicas, validados por um scanner automático,
so that incident response não depende da memória de um único humano (AR-110, D-04.24, lição `feedback-hdd-soft-convention-rot`).

## Acceptance Criteria

1. **(binary — completude ≥5/5)** **Given** os 8 runbooks committed
   **When** corre `scripts/runbook-completeness.sh`
   **Then** cada um dos 8 runbooks must-have tem as 5 secções: **Sintoma · Diagnóstico · Passos de Recuperação · Verificação · Post-mortem** (≥5/5 por runbook); o scanner sai ≠0 se faltar alguma. (Idioma PT — Q-C6-2.)

2. **(binary — cobertura dos 8 + index)** **Given** `docs/runbooks/`
   **When** se listam os runbooks
   **Then** existem os 8 nomes do spec (`secret-rotation`, `ban-anthropic-emergency`, `litestream-restore`, `hash-chain-corruption`, `whatsapp-template-rejection`, `clihelper-endpoint-down`, `vps-disk-full`, `manual-rollback`) + `index.md` que os lista (+ os operacionais já existentes).

## Tasks / Subtasks

- [x] **Task 1 — 6 runbooks novos (NEW)** (AC: #1, #2) — `ban-anthropic-emergency`, `hash-chain-corruption`, `whatsapp-template-rejection`, `clihelper-endpoint-down`, `vps-disk-full`, `manual-rollback`. 5 secções PT cada; comandos reais (`verify-audit-chain.ts`, `systemctl stop`, `df -h`, `deploy.sh`); whatsapp/clihelper marcados `[quando implementado]` (Q-C6-4), sem inventar comandos.
- [x] **Task 2 — 2 runbooks existentes (MODIFY — Q-C6-3)** (AC: #1) — `secret-rotation.md` reescrito sob os 5 headings (conteúdo preservado: tabela secrets, install/rotação, garantias, troubleshooting). `litestream-restore.md`: +camada de 5 secções de incident-response no topo, apontando para o detalhe numerado §1-6 (preservado 100%).
- [x] **Task 3 — `scripts/runbook-completeness.sh` (NEW, +x)** (AC: #1) — valida os 8 must-have (Q-C6-1) × 5 headings PT (`grep -qF`); N/5 por ficheiro; exit≠0 se <5 ou ausente. `set -euo pipefail`; `bash -n` OK. **Run: 8/8 com 5/5, rc=0.**
- [x] **Task 4 — `docs/runbooks/index.md` (NEW)** (AC: #2) — tabela dos 8 must-have (com *Epic …* nos futuros) + secção operacional (ssh-deploy, systemd-deploy, fora do gate) + comando do scanner.
- [x] **Task 5 — gates**: scanner exit 0 (8/8 × 5/5) · `bash -n` OK · type-check clean · lint exit 0 · `bun test` 285 pass / 2 skip / 0 fail (sem regressão — story só docs+1 script bash).
- [x] **Task 6 (FINAL) — Tier-B summary via generator (13ª dogfood)**: `scripts/generate-1c6-summary.ts` → `gen.finalize(input)` → auto-commit `summary(story-1c6): ...`. Sprint-status `1-c-6 → review`. **Encerra o Epic 1.c e o Sprint 0.**

## Dev Notes

### Big picture

6ª e última story de operações do Epic 1.c — **fecha o Sprint 0**. Materializa a lição `feedback-hdd-soft-convention-rot` ("long-form docs vira archive morto"; "incident response não depende de memória de um único humano"): runbooks curtos, accionáveis, uniformes e **validados por scanner** (anti-rot — o gate impede que um runbook degrade abaixo das 5 secções).

### Scope delimitation (LER)

- **IN-SCOPE:** 6 runbooks novos + 2 existentes conformados + scanner + index.
- **OUT-OF-SCOPE / DIFERIDO:**
  - **Automação de recovery** — os runbooks são procedimentos HUMANOS; nada de auto-remediation.
  - **Runbooks de features ainda não implementadas** — `whatsapp-template-rejection` (Epic WhatsApp) e `clihelper-endpoint-down` (Epic 3) escrevem-se com o conhecimento arquitectural disponível; secções dependentes de código futuro marcadas `[quando implementado]` (Q-C6-4) — NÃO inventar comandos/paths que não existem.
  - **ssh-deploy/systemd-deploy** — runbooks operacionais (how-to), não incident-response; entram no `index.md` mas ficam **fora** do gate das 5 secções (Q-C6-1).
  - **Código TS / src** — story de pura documentação + 1 script bash.

### AO / requirement matrix

| Código | Obrigação | Onde |
|---|---|---|
| **AR-110 / D-04.24** | runbooks must-have de incident-response | 8 runbooks + template 5 secções |
| **`feedback-hdd-soft-convention-rot`** | docs curtos + gate anti-rot | scanner `runbook-completeness.sh` |

### Template canónico (5 secções — AC1)

```markdown
# Runbook — <nome>
## Sintoma            # como o operador percebe que há um incidente
## Diagnóstico        # comandos/sinais para confirmar a causa
## Passos de Recuperação   # acções ordenadas para resolver
## Verificação        # como confirmar que resolveu
## Post-mortem        # template: timeline, causa-raiz, prevenção
```

O scanner procura estes 5 headings (PT). Os 6 novos nascem assim; os 2 existentes são conformados aditivamente.

### Conteúdo por runbook (fontes conhecidas — NÃO inventar)

- **ban-anthropic-emergency:** corte de acesso/custo Anthropic. Cost model D-051 (cap $30/m, API metered; teto ~R$1150/m) + D-050 (roteamento por fase). Memórias `[[project-hdd-llm-budget]]`, `[[project-hdd-cost-optimal-llm]]`. Recovery: desligar o worker (`systemctl stop`), rotar/revogar `ANTHROPIC_API_KEY` (cruzar `[[secret-rotation]]`). **Verificar** se há kill-switch/feature-flag real antes de o documentar; senão, `[quando implementado]`.
- **hash-chain-corruption:** `verifyChain` devolve `ChainBreak{atLine,expected,actual}` (audit 1.a.6). A chain é tamper-evident: corrupção = **detecção**, não reparação silenciosa. Recovery: preservar evidência (não apagar), identificar a linha, restaurar de backup Litestream (`[[litestream-restore]]`, 1.c.3), documentar a quebra. NÃO "consertar" a chain.
- **whatsapp-template-rejection:** Meta Cloud API rejeita template (memória `[[project-hdd-whatsapp-api]]`: templates pré-aprovados, janela 24h). `[quando implementado]` — Epic WhatsApp; esqueleto com re-submissão + fallback.
- **clihelper-endpoint-down:** clihelper outbound (`[[project-hdd-clihelper-integration]]`: rate 1 req/s; `[[project-hdd-n8n-topology]]`: n8n inbound). Sintoma: outbound falha. Recovery: verificar endpoint, degradação graceful, retry. `[quando implementado]` parcial — Epic 3.
- **vps-disk-full:** WAL Litestream + audit JSONL + sqlite crescem. Diagnóstico `df -h`/`du`. Recovery: rotar/comprimir audit antigo, checkpoint WAL, verificar Litestream a replicar. Cruzar `[[litestream-restore]]`.
- **manual-rollback:** re-deploy de um sha anterior via `deploy.sh` (1.c.5: `ssh hdd-worker@vps deploy <sha-anterior>`). Forward-only re-aplicado a um commit estável. Cruzar `[[ssh-deploy]]`.

### Previous story intelligence

- **1.c.2 (secret-rotation):** existe; estrutura procedural (Secrets/Instalar/Rotação/Garantias/Troubleshooting) — sem as 5 secções. MODIFY aditivo.
- **1.c.3 (litestream-restore):** existe (eu escrevi); secções próprias (prereqs/R2/deploy/restore/drill/troubleshooting). MODIFY aditivo.
- **1.c.4 (scanner pattern):** como o `ci.yml`/`measure-ci-time.sh` — um script de gate; aqui valida completude de docs. `[[project-hdd-bun-spawn-ci-gotcha]]` não se aplica (bash puro, sem spawn de bun).
- **1.c.5 (deploy):** `manual-rollback` liga directamente ao `deploy.sh`.

### Anti-pattern guardrails (NÃO fazer)

- ❌ **NÃO** inventar comandos/kill-switches/paths para features não implementadas — marcar `[quando implementado]` e descrever o procedimento conceptual.
- ❌ **NÃO** reescrever destrutivamente secret-rotation/litestream-restore — MODIFY aditivo (preservar o conteúdo testado).
- ❌ **NÃO** documentar "reparar" a hash-chain — corrupção preserva-se como evidência + restore de backup.
- ❌ **NÃO** fazer runbooks long-form (lição soft-convention-rot) — curtos, accionáveis, scan-áveis.
- ❌ **NÃO** pôr os operacionais (ssh-deploy/systemd-deploy) no gate dos 8 se Q-C6-1 disser só-must-have.

### Project Structure Notes

- NEW: 6× `docs/runbooks/<name>.md`, `docs/runbooks/index.md`, `scripts/runbook-completeness.sh`, `scripts/generate-1c6-summary.ts`.
- MODIFY: `docs/runbooks/secret-rotation.md`, `docs/runbooks/litestream-restore.md` (conformar template — Q-C6-3), `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### References

- [Source: epics.md#Story-1.c.6] (linhas 1199-1217) — StorySpec, ACs (5 secções, scanner).
- [Source: docs/runbooks/secret-rotation.md, litestream-restore.md] — existentes (MODIFY).
- [Memórias: `[[project-hdd-llm-budget]]`, `[[project-hdd-cost-optimal-llm]]`, `[[project-hdd-whatsapp-api]]`, `[[project-hdd-clihelper-integration]]`, `[[project-hdd-n8n-topology]]`, `[[feedback-hdd-soft-convention-rot]]`].

## Open Questions for Operator

- **Q-C6-1 (scope do scanner):** [RESOLVED — **só os 8 must-have**] ssh-deploy/systemd-deploy ficam no index mas fora do gate (são how-to operacional, não incident-response).
- **Q-C6-2 (idioma das 5 secções):** [RESOLVED — **PT**] Sintoma/Diagnóstico/Passos de Recuperação/Verificação/Post-mortem; scanner reconhece PT.
- **Q-C6-3 (os 2 existentes):** [RESOLVED — **MODIFY aditivo**] conformar secret-rotation + litestream-restore ao template preservando conteúdo.
- **Q-C6-4 (features futuras):** [RESOLVED — **escrever agora + `[quando implementado]`**] accionável com o conhecido; partes de código futuro marcadas, sem inventar comandos/paths.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD Dev agent (Amelia persona).

### Debug Log References

- Comandos reais confirmados antes de escrever: `scripts/verify-audit-chain.ts <date>` (chain), `_bmad-output/feature-flags.json` (só webhook-mock — sem kill-switch LLM → ban-anthropic marca `[quando implementado]`).
- scanner: 1ª execução já 8/8 com 5/5 (headings PT bateram à primeira).
- Edit do litestream-restore falhou 1ª vez (título "binário" vs "binários") → corrigido após re-Read.
- type-check clean; lint exit 0; `bun test` 285 pass / 2 skip / 0 fail (sem regressão — story não toca src/TS).

### Completion Notes List

- **AR-110/D-04.24 + anti-rot materializados:** 8 runbooks must-have com template uniforme de 5 secções + `runbook-completeness.sh` como gate (impede degradação futura — lição soft-convention-rot).
- **Q-C6-1 só-8:** scanner valida a lista canónica; ssh-deploy/systemd-deploy no index como operacionais (fora do gate).
- **Q-C6-2 PT:** headings Sintoma/Diagnóstico/Passos de Recuperação/Verificação/Post-mortem (coerente com CLAUDE.md).
- **Q-C6-3 MODIFY aditivo:** secret-rotation reescrito sob os 5 headings (conteúdo preservado); litestream-restore ganhou camada de incident-response no topo + detalhe §1-6 intacto.
- **Q-C6-4 [quando implementado]:** whatsapp-template-rejection e clihelper-endpoint-down accionáveis com a arquitectura conhecida; partes de código futuro marcadas, sem inventar comandos.
- Runbooks ligados entre si (`[[…]]`) e a comandos reais (`deploy.sh`, `verify-audit-chain.ts`, Litestream restore).
- **Encerra o Epic 1.c (7/7) e o Sprint 0 (22/22).** Sem deps, sem código TS.

### File List

- `docs/runbooks/ban-anthropic-emergency.md` (NEW)
- `docs/runbooks/hash-chain-corruption.md` (NEW)
- `docs/runbooks/whatsapp-template-rejection.md` (NEW)
- `docs/runbooks/clihelper-endpoint-down.md` (NEW)
- `docs/runbooks/vps-disk-full.md` (NEW)
- `docs/runbooks/manual-rollback.md` (NEW)
- `docs/runbooks/index.md` (NEW)
- `docs/runbooks/secret-rotation.md` (MODIFY — conformado ao template)
- `docs/runbooks/litestream-restore.md` (MODIFY — +5 secções no topo)
- `scripts/runbook-completeness.sh` (NEW, +x — gate de completude)
- `scripts/generate-1c6-summary.ts` (NEW — dogfood)
- `_bmad-output/implementation-artifacts/1-c-6-8-runbooks-must-have.md` (NEW — story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFY)

## Change Log

| Data | Mudança |
|---|---|
| 2026-05-30 | Story 1.c.6 criada (`ready-for-dev`); 4 Open Questions. AC exige scanner de 5 secções (não listado em files_created). 2 dos 8 já existem. |
| 2026-05-30 | Q's resolvidas: Q-C6-1=só-8; Q-C6-2=PT; Q-C6-3=MODIFY aditivo; Q-C6-4=escrever+[quando implementado]. Implementação: 6 novos + 2 conformados + scanner (8/8 5/5) + index. Sem regressão (285 pass). Summary `61d344d`. Status → `review`. Encerra Epic 1.c (7/7) + Sprint 0 (22/22). |
