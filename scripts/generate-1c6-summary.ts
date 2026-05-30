/**
 * Story 1.c.6 — DOGFOOD: gera summary via summaryGenerator.finalize() (13ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. Encerra o Epic 1.c e o Sprint 0.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1c6",
  workflowName: "Story 1.c.6 — 8 Runbooks must-have",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-30",
  contexto:
    "6ª e última story do Epic 1.c — encerra o Sprint 0. 8 runbooks de incident-response com template uniforme de 5 secções + scanner anti-rot. Materializa AR-110/D-04.24 e a lição feedback-hdd-soft-convention-rot ('incident response não depende da memória de um único humano').",
  whatWasDone: [
    { artifact: "docs/runbooks/{ban-anthropic-emergency,hash-chain-corruption,vps-disk-full,manual-rollback}.md", description: "NEW: 4 runbooks accionáveis com comandos reais (systemctl, verify-audit-chain.ts, df, deploy.sh)." },
    { artifact: "docs/runbooks/{whatsapp-template-rejection,clihelper-endpoint-down}.md", description: "NEW: features futuras (Epic WhatsApp/3) — accionável + [quando implementado], sem inventar." },
    { artifact: "docs/runbooks/{secret-rotation,litestream-restore}.md", description: "MODIFY: conformados ao template de 5 secções preservando conteúdo (Q-C6-3 aditivo)." },
    { artifact: "scripts/runbook-completeness.sh", description: "NEW: gate — 8 must-have × 5 headings PT; exit≠0 se <5. Run: 8/8 5/5." },
    { artifact: "docs/runbooks/index.md", description: "NEW: 8 must-have + operacionais (ssh-deploy/systemd-deploy) + comando do scanner." },
  ],
  decisions: [
    { n: 1, decision: "Scanner valida só os 8 must-have.", reason: "ssh-deploy/systemd-deploy são how-to operacional (index, fora do gate).", id: "Q-C6-1" },
    { n: 2, decision: "5 secções em PT.", reason: "Sintoma/Diagnóstico/Passos de Recuperação/Verificação/Post-mortem; coerente com CLAUDE.md.", id: "Q-C6-2" },
    { n: 3, decision: "secret-rotation/litestream-restore MODIFY aditivo.", reason: "Estão nos 8; conformar preservando conteúdo testado, não reescrever destrutivo.", id: "Q-C6-3" },
    { n: 4, decision: "Features futuras: escrever agora + [quando implementado].", reason: "Cumpre a tese 'não depender de memória' já; sem inventar comandos de código futuro.", id: "Q-C6-4" },
  ],
  tradeoffs: [
    "O AC exigia um scanner não listado em files_created — criei-o (como o ci.yml na 1.c.4): o gate é o que dá força ao 'must-have' e impede rot futuro.",
    "Forçar secret-rotation (how-to de rotação) ao template Sintoma/Post-mortem é um pouco artificial, mas enquadrei rotação como incidente (planeada/comprometida) — honra o AC sem perder o conteúdo.",
  ],
  openItems: [
    { id: "O-C6-1", description: "whatsapp-template-rejection e clihelper-endpoint-down têm secções [quando implementado] — completar quando Epic WhatsApp/Epic 3 existirem." },
    { id: "O-C6-2", description: "Integrar runbook-completeness.sh no CI (step de gate) — candidato a próxima iteração de ci.yml; hoje corre local." },
    { id: "Sprint 0 close", description: "22/22 done + epic-1c 7/7. Candidato a retrospectiva do Sprint 0 (epic-1c-retrospective: optional) antes de abrir o Sprint 1 / M1." },
  ],
  metrics: [
    { key: "Runbooks", value: "8/8 must-have com 5/5 secções (scanner rc=0) + index + 2 operacionais" },
    { key: "Tests", value: "285 pass / 2 skip / 0 fail (sem regressão — story só docs+bash)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos)" },
    { key: "Deps adicionadas", value: "0; src/ intacto" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1c6` → marco done + commit `feat(story-1c6): 8 runbooks must-have + completeness gate (AR-110)`. Não toca workflows → push normal; verificar CI verde via gh run.",
    },
    { n: 2, description: "**Sprint 0 FECHADO: 22/22 done; Epic 1.c 7/7.** Próximo: retrospectiva opcional do Sprint 0 (bmad-retrospective) e abertura do Sprint 1 (M1) via sprint-planning." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["scripts/runbook-completeness.sh", "docs/runbooks/index.md"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
