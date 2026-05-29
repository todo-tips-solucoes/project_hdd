> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

---

<!--
  Tier-B template — briefing 600-900 palavras, target ≤715 para folga.

  Story 1.a.8 (F8 FR-070..076, D-019, AO-146 defer p/ Tier-A).
  Renderizado por `summaryGenerator.finalize()` em src/services/summary-generator.service.ts.

  Anti-padrões a EVITAR (per finalization-summary-templates canon):
    × "Foi feito muito trabalho" — usar ARTEFACTOS como prova
    × Listas FR sem dizer o que ficou diferente — mostrar CONSEQUÊNCIA, não actividade
    × "Várias decisões foram tomadas" — enumerá-las (tabela)
    × Tier-B sem Trade-offs — sinal de processo low-judgment
    × "Tudo correu bem" — preferir verdict formal (ready-to-merge etc.)

  Mantém: artefactos como prova, decisões enumeradas, trade-offs narrativos,
  open items distintos das próximas etapas.
-->
---
workflowId: story-1c2
workflowName: Story 1.c.2 — Secrets management EnvironmentFile
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: b
---

# Story 1.c.2 — Secrets management EnvironmentFile · projeto_hdd · 2026-05-29

> **Tier-A:** pending `hdd_summary_finalization` Meta template (Story 7.b.1).

## Contexto

2ª story de operações do Epic 1.c. Secrets em /etc/hdd/secrets.env (systemd EnvironmentFile, fora do repo), perm 0600 + user hdd-worker, validação Zod fail-closed. Complementa redaction (1.b.3) e a unit/healthz (1.c.1). NFR-S1/AR-019/D-04.6'.

## O que foi feito

- **src/lib/env.ts** — MODIFY: +CLIHELPER_TOKEN required; +checkSecretsFilePerms (rejeita mode & 0o077), SecretsError.
- **systemd/hdd-worker.service + .env.example** — MODIFY: ExecStartPre gate stat 0600; +CLIHELPER_TOKEN.
- **scripts/install-secrets.sh** — install 0600+owner + verify + recusa origem laxa; idempotente; não cria user.
- **tests/lib/env-secrets.test.ts** — 9 specs: parseEnv required + checkSecretsFilePerms (fs reais chmod).
- **docs/runbooks/secret-rotation.md** — install/rotação/revogação + troubleshooting.

## Decisões críticas

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | CLIHELPER_TOKEN REQUIRED já. | Decisão do operador (não-Recommended); fail-closed total. Custo: regressão 10 sites de teste (corrigida). | Q-C2-1 |
| 2 | Perm gate via systemd ExecStartPre. | Sem churn em BootError/main/CLI; checkSecretsFilePerms in-code p/ defesa-em-profundidade. | Q-C2-2 |
| 3 | install-secrets.sh: install+verify, não cria user. | Separar gestão de secret de provisioning de host. | Q-C2-3 |
| 4 | Rejeitar mode & 0o077. | Permite 0600/0400; foca 'ninguém além do owner lê'. | Q-C2-4 |

## Trade-offs aplicados

- Quis perm-check no boot (bootstrap), fiquei com ExecStartPre (Q-C2-2): evitar novo BootError + churn nos switches; in-code fica disponível.
- CLIHELPER required (Q-C2-1) custou 10 fixes de teste, mas alinha com fail-closed e o pedido explícito.

## Open items deferidos

- **O-C2-1:** Wiring de CLIHELPER_TOKEN no cliente HTTP clihelper — Epic 3 (outbound).
- **O-C2-2:** Opcional: wire checkSecretsFilePerms no boot in-code (defesa extra além do ExecStartPre) — story de hardening.
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema.

## Reviewer findings

_(nenhum)_

## Métricas

- **Tests:** 279 pass / 1 skip / 0 fail (was 270; +9 env-secrets). Regressão CLIHELPER: 10 sites corrigidos.
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Deps adicionadas:** 0
- **Segurança:** secrets 0600 (ExecStartPre + checkSecretsFilePerms); .gitignore cobre *.env; redaction cobre os 2 tokens
- **Token usage approx:** dentro estimated 40-56K

## Próximos passos sugeridos

1. Operador aprova `approve story-1c2` → marco done + commit. Mensagem: `feat(story-1c2): secrets EnvironmentFile 0600 + CLIHELPER_TOKEN required (NFR-S1)`. Push NÃO toca .github/workflows.
2. Sprint 0: 18/22 done. Epic 1.c: 3/7. Próxima: 1.c.3 (Litestream/R2 — candidato a integração real, precisa creds R2).

→ Tier-C: ver mais abaixo no mesmo ficheiro · Aprovar: `hdd-worker review approve story-1c2` · Pedir alterações: `hdd-worker review request-changes story-1c2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c2 --reason "<razão>"`


---

<!--
  Tier-C template — full briefing, sem limite estricto de palavras.

  Story 1.a.8 (F8 FR-070..076, D-019). Superset do Tier-B + diff opcional.

  Renderizado por `summaryGenerator.finalize()`. Tier-C inclui git diff
  unified dentro de fence ```diff (Q-A8-3 Recommended); side-by-side fica
  para v1.1+. Quando `diffAgainst` é undefined, a section "Diff" exibe
  "(no diff requested)" como placeholder.
-->
---
workflowId: story-1c2
workflowName: Story 1.c.2 — Secrets management EnvironmentFile
date: 2026-05-29
projectName: projeto_hdd
phase: implementation-artifacts
tier: c
---

## Tier-C — Full · Story 1.c.2 — Secrets management EnvironmentFile

### Contexto detalhado

2ª story de operações do Epic 1.c. Secrets em /etc/hdd/secrets.env (systemd EnvironmentFile, fora do repo), perm 0600 + user hdd-worker, validação Zod fail-closed. Complementa redaction (1.b.3) e a unit/healthz (1.c.1). NFR-S1/AR-019/D-04.6'.

### O que foi feito (verbose)

- **src/lib/env.ts** — MODIFY: +CLIHELPER_TOKEN required; +checkSecretsFilePerms (rejeita mode & 0o077), SecretsError.
- **systemd/hdd-worker.service + .env.example** — MODIFY: ExecStartPre gate stat 0600; +CLIHELPER_TOKEN.
- **scripts/install-secrets.sh** — install 0600+owner + verify + recusa origem laxa; idempotente; não cria user.
- **tests/lib/env-secrets.test.ts** — 9 specs: parseEnv required + checkSecretsFilePerms (fs reais chmod).
- **docs/runbooks/secret-rotation.md** — install/rotação/revogação + troubleshooting.

### Full file list

- **src/lib/env.ts** — MODIFY: +CLIHELPER_TOKEN required; +checkSecretsFilePerms (rejeita mode & 0o077), SecretsError.
- **systemd/hdd-worker.service + .env.example** — MODIFY: ExecStartPre gate stat 0600; +CLIHELPER_TOKEN.
- **scripts/install-secrets.sh** — install 0600+owner + verify + recusa origem laxa; idempotente; não cria user.
- **tests/lib/env-secrets.test.ts** — 9 specs: parseEnv required + checkSecretsFilePerms (fs reais chmod).
- **docs/runbooks/secret-rotation.md** — install/rotação/revogação + troubleshooting.

### Decisões críticas (com detalhes + alternativas rejeitadas)

| # | Decisão | Razão / Trade-off | ID |
|---|---------|-------------------|----|
| 1 | CLIHELPER_TOKEN REQUIRED já. | Decisão do operador (não-Recommended); fail-closed total. Custo: regressão 10 sites de teste (corrigida). | Q-C2-1 |
| 2 | Perm gate via systemd ExecStartPre. | Sem churn em BootError/main/CLI; checkSecretsFilePerms in-code p/ defesa-em-profundidade. | Q-C2-2 |
| 3 | install-secrets.sh: install+verify, não cria user. | Separar gestão de secret de provisioning de host. | Q-C2-3 |
| 4 | Rejeitar mode & 0o077. | Permite 0600/0400; foca 'ninguém além do owner lê'. | Q-C2-4 |

### Trade-offs aplicados (narrativa)

- Quis perm-check no boot (bootstrap), fiquei com ExecStartPre (Q-C2-2): evitar novo BootError + churn nos switches; in-code fica disponível.
- CLIHELPER required (Q-C2-1) custou 10 fixes de teste, mas alinha com fail-closed e o pedido explícito.

### Open items deferidos (com onde serão resolvidos)

- **O-C2-1:** Wiring de CLIHELPER_TOKEN no cliente HTTP clihelper — Epic 3 (outbound).
- **O-C2-2:** Opcional: wire checkSecretsFilePerms no boot in-code (defesa extra além do ExecStartPre) — story de hardening.
- **O-B5-3 acumula:** AO-86 schema clihelper: webhook-mock=true; re-correr check:webhook-schema.

### Reviewer findings (rubric completo)

_(nenhum)_

### Métricas

- **Tests:** 279 pass / 1 skip / 0 fail (was 270; +9 env-secrets). Regressão CLIHELPER: 10 sites corrigidos.
- **Type-check:** clean
- **Lint:** exit 0 (23 infos pré-existentes)
- **Deps adicionadas:** 0
- **Segurança:** secrets 0600 (ExecStartPre + checkSecretsFilePerms); .gitignore cobre *.env; redaction cobre os 2 tokens
- **Token usage approx:** dentro estimated 40-56K

### Próximos passos sugeridos

1. Operador aprova `approve story-1c2` → marco done + commit. Mensagem: `feat(story-1c2): secrets EnvironmentFile 0600 + CLIHELPER_TOKEN required (NFR-S1)`. Push NÃO toca .github/workflows.
2. Sprint 0: 18/22 done. Epic 1.c: 3/7. Próxima: 1.c.3 (Litestream/R2 — candidato a integração real, precisa creds R2).

### Diff vs `HEAD`

```diff
diff --git a/src/lib/env.ts b/src/lib/env.ts
index c8f5c8f..b081335 100644
--- a/src/lib/env.ts
+++ b/src/lib/env.ts
@@ -1,29 +1,32 @@
 /**
- * `env.ts` — Zod schema sobre `process.env` (D-04.5', AO-52).
+ * `env.ts` — Zod schema sobre `process.env` (D-04.5', AO-52) + perm-check do
+ * EnvironmentFile de secrets (Story 1.c.2, NFR-S1/AR-019/D-04.6').
  *
- * Story 1.a.7 (Q-A7-1 [RESOLVED — Minimal]). Schema actual contém apenas
- * `ANTHROPIC_API_KEY`. Outras env vars (HDD_DB_PATH, HDD_AUDIT_DIR, …) entram
- * em stories futuras quando consumidas — defaults hardcoded em `bootstrap.ts`
- * por agora.
+ * Story 1.a.7: schema mínimo (`ANTHROPIC_API_KEY`). Story 1.c.2: +`CLIHELPER_TOKEN`
+ * **required** (Q-C2-1, decisão do operador) + `checkSecretsFilePerms`.
  *
- * Fail-closed em missing/empty/whitespace-only via `.trim().min(1)`. Mensagem
- * "ANTHROPIC_API_KEY required" é substring AC-1 binary.
+ * Fail-closed em missing/empty/whitespace-only via `.trim().min(1)`. Mensagens
+ * "<VAR> required" são substrings de AC binary.
  *
- * Returns `Result<Env, EnvValidationError>` — síncrono (Zod safeParse é sync).
- * Sem `throw` (AO-66 categoria #3 boot-time failure permitida mas preferimos
- * `process.exit(1)` directo em `main.ts`).
+ * Returns `Result<…>` — síncrono. Sem `throw` (AO-66).
  */
 
+import { statSync } from "node:fs";
 import { z } from "zod";
 import { err, ok, type Result } from "./result.ts";
 
 const REQUIRED_MSG = "ANTHROPIC_API_KEY required";
+const CLIHELPER_REQUIRED_MSG = "CLIHELPER_TOKEN required";
 
 export const EnvSchema = z.object({
   ANTHROPIC_API_KEY: z
     .string({ error: () => REQUIRED_MSG })
     .trim()
     .min(1, REQUIRED_MSG),
+  CLIHELPER_TOKEN: z
+    .string({ error: () => CLIHELPER_REQUIRED_MSG })
+    .trim()
+    .min(1, CLIHELPER_REQUIRED_MSG),
 });
 
 export type Env = z.infer<typeof EnvSchema>;
@@ -44,3 +47,32 @@ export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Result<Env, EnvV
   const formatted = issues.map((i) => i.message).join("; ");
   return err({ kind: "EnvValidationError", issues, formatted });
 }
+
+export type SecretsError =
+  | { readonly kind: "SecretsFileMissing"; readonly path: string }
+  | { readonly kind: "SecretsFileInsecure"; readonly path: string; readonly mode: string };
+
+/**
+ * Verifica que o EnvironmentFile de secrets não é acessível a group/world
+ * (Story 1.c.2, AC-1; NFR-S1). Rejeita se `mode & 0o077 !== 0` (permite 0600 /
+ * 0400; Q-C2-4). `statFn` injectável para tests. Sem `throw` (AO-66).
+ *
+ * Defesa-em-profundidade: o gate primário é o `ExecStartPre` do systemd; esta
+ * função é o equivalente in-code, testável e reutilizável.
+ */
+export function checkSecretsFilePerms(
+  path: string,
+  statFn: (p: string) => { mode: number } = statSync,
+): Result<true, SecretsError> {
+  let mode: number;
+  try {
+    mode = statFn(path).mode;
+  } catch {
+    return err({ kind: "SecretsFileMissing", path });
+  }
+  const perm = mode & 0o777;
+  if ((perm & 0o077) !== 0) {
+    return err({ kind: "SecretsFileInsecure", path, mode: perm.toString(8).padStart(4, "0") });
+  }
+  return ok(true);
+}
diff --git a/systemd/hdd-worker.service b/systemd/hdd-worker.service
index d69bec7..8d8af93 100644
--- a/systemd/hdd-worker.service
+++ b/systemd/hdd-worker.service
@@ -20,6 +20,9 @@ Type=simple
 User=hdd-worker
 EnvironmentFile=/etc/hdd/secrets.env
 WorkingDirectory=/opt/hdd
+# Story 1.c.2 (NFR-S1) — gate de permissão: recusa arrancar se secrets.env não
+# for 0600 (ConditionPathExists só verifica existência, não permissões).
+ExecStartPre=/bin/bash -c 'test "$(stat -c %a /etc/hdd/secrets.env)" = "600"'
 ExecStart=/opt/hdd/dist/hdd-worker start
 ExecStartPost=/bin/bash -c 'until curl -sf http://localhost:${PORT}/healthz; do sleep 2; done'
 Restart=on-failure

```

---

→ Aprovar: `hdd-worker review approve story-1c2` · Pedir alterações: `hdd-worker review request-changes story-1c2 --note "<nota>"` · Rejeitar: `hdd-worker review reject story-1c2 --reason "<razão>"`

