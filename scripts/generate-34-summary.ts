/**
 * Story 3.4 — DOGFOOD: gera summary via summaryGenerator.finalize() (24ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words).
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-3-4",
  workflowName: "Story 3.4 — InboundCommandPort + Hono /callback + Quick Reply parsing",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "O lado INBOUND: POST /callback (Hono) recebe respostas do operador via n8n (trust boundary), valida Zod minimal drop-at-ingress, parseia Quick Reply contra interrupt-commands.ts (1.a.4) → InboundCommand tipado. Feature de segurança: allowlist wa_id, Bearer auth, e AC4 (AI Safety) = redaction pre-write. O spot-check AI-E2-3 confirmou inbound=n8n (não clihelper) e que a AC4 já estava quase-wired (1.b.3).",
  whatWasDone: [
    { artifact: "src/ports/inbound-command.port.ts + callback-schema.ts", description: "NEW: InboundCommand (InterruptCommand + correlation) + minimalInboundSchema (.passthrough()=z.unknown() resto sob AO-86) + parseCallback." },
    { artifact: "src/adapters/whatsapp/callback-listener.adapter.ts", description: "NEW: createCallbackApp(Hono); POST /callback: Bearer auth (n8n) → audit InboundCallback raw → mock warning → allowlist drop-at-ingress → parseInterruptCommand. Sempre 200 (AC3). 90 linhas." },
    { artifact: "src/cli/start.command.ts", description: "MODIFY: monta /callback (audit de boot.value.audit) no mesmo Bun.serve; config via env (fail-closed: allowlist vazia → tudo dropped)." },
    { artifact: "tests: callback-listener.test.ts + callback.security.test.ts", description: "NEW: 7 specs (AC1-3 + auth) + 1 security (audit REAL, 3 secrets → 0 raw, D-053)." },
  ],
  decisions: [
    { n: 1, decision: "Inbound = n8n→HDD, Bearer token; HDD não verifica X-Hub-Signature.", reason: "Memória n8n-topology + ao_subset autoritativos (n8n=trust boundary, trata a assinatura Meta). Arquitectura 'clihelper→HDD' desactualizada. Divergência registada.", id: "Q-3.4-1" },
    { n: 2, decision: "Minimal schema extrai {wa_id, payload, runId?, storyId?} + z.unknown() resto.", reason: "Drop-at-ingress mesmo sob webhook-mock (AO-86); aperta quando o schema real chegar.", id: "Q-3.4-2" },
    { n: 3, decision: "Diferir reconciliação do PAYLOAD_MAP (O-3.3-1).", reason: "AC2 só pede p1_continuar_assim (já mapeado); buttons não-mapeados → UnknownCommand (→ NLP 3.5). Não toca interrupt-commands.ts.", id: "Q-3.4-3" },
    { n: 4, decision: "Redaction só no audit adapter (listener passa raw).", reason: "Pre-write no jsonl-hash-chain (1.b.3, já wired); single source of truth, nunca pós-write. Security test prova 0-raw com adapter REAL.", id: "Q-3.4-4" },
  ],
  tradeoffs: [
    "AC4 (AI Safety, Pre-Mortem #2) é wiring enforcement: o listener NÃO redige — encaminha raw ao audit adapter que redige pre-write (1.b.3). A security test usa o adapter REAL (não fake) + 3 secrets reais (Bearer, wa_id, sk-ant) → prova 0/3 raw no JSONL end-to-end (D-053).",
    "Drop-at-ingress: wa_id não-allowlisted → 200 (não 401, não vazar) + UnauthorizedInbound. Fail-closed: allowlist vazia por defeito → tudo dropped até o operador configurar HDD_ALLOWED_WAIDS.",
  ],
  openItems: [
    { id: "O-3.3-1", description: "Reconciliar PAYLOAD_MAP (1.a.4) com os buttons do catálogo — buttons não-mapeados caem em UnknownCommand; reconciliação dedicada ou via NLP (3.5)." },
    { id: "AO-86/O-B5-3", description: "Schema inbound real ainda não recebido → webhook-mock=true (z.unknown()). Apertar minimalInboundSchema quando o operador partilhar o payload n8n real." },
  ],
  metrics: [
    { key: "Tests", value: "391 pass / 3 skip / 0 fail (era 383; +8 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-3.4` → marco done + commit `feat(story-3.4): inbound /callback + Quick Reply parsing`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "Epic 3: 4/6. Próxima: Story 3.5 (NLP fallback livre via Haiku — texto livre → intent; modifica este listener no UnknownCommand)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/adapters/whatsapp/callback-listener.adapter.ts", "src/adapters/whatsapp/callback-schema.ts", "src/ports/inbound-command.port.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
