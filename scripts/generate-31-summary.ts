/**
 * Story 3.1 — DOGFOOD: gera summary via summaryGenerator.finalize() (21ª vez).
 * Lesson O-A9-5: Tier-B trim AGRESSIVO (cap ≤715 words). 1ª story do Epic 3.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-3-1",
  workflowName: "Story 3.1 — OutboundNotifyPort + clihelper adapter",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-31",
  contexto:
    "1ª story do Epic 3 (canal WhatsApp). Entrega a porta de saída do worker: adapter HTTP nu sobre o app proprietário do operador (clihelper), que envuelve a Meta Cloud API. POST + Authorization + payload Zod-validado + dry-run. O leaky-bucket 1 req/s + retry + circuit breaker são da 3.2 (envolvem este adapter). Precedido pelo spot-check AI-E2-3 (arquitectura×epics×memórias) que confirmou clear-to-implement.",
  whatWasDone: [
    { artifact: "src/ports/outbound-notify.port.ts", description: "NEW: OutboundNotifyPort (transporte; sendTemplate) + OutboundNotifyError. Distinto do NotifyPort de domínio (1.a.3). 38 linhas." },
    { artifact: "src/adapters/whatsapp/payload-schema.ts", description: "NEW: clihelperBodySchema .strict() (number, name, language=pt_BR, openTicket, queueId, template[]). 37 linhas." },
    { artifact: "src/adapters/whatsapp/clihelper.adapter.ts", description: "NEW: createClihelperAdapter(config, deps); HttpPort injectável; selectEndpoint (vars→endpoint), dry-run redacted, mapStatus (429/5xx/4xx). 129 linhas." },
    { artifact: "tests/adapters/clihelper.test.ts", description: "NEW: 10 specs — AC1-4 + status HTTP + transporte. Fake HttpPort spy, sem rede real (D-053)." },
  ],
  decisions: [
    { n: 1, decision: "OutboundNotifyPort (transporte) distinto do NotifyPort (domínio).", reason: "Spot-check apanhou: NotifyPort 1.a.3 existe; a 3.1 constrói o transporte (files_created). Mapper NotifyEvent→template = story posterior.", id: "Q-3.1-1" },
    { n: 2, decision: "vars named (Record<string,string>); template[] = assumção documentada.", reason: "Arquitectura lista template[] sem estrutura interna; vars named alinha a AC; shape interno é O-3.1-1 (pendente confirmação operador).", id: "Q-3.1-2" },
    { n: 3, decision: "Endpoint derivado de vars (vazio→sem-variavel).", reason: "arch:653 tem dois endpoints; derivar de vars evita parâmetro redundante.", id: "Q-3.1-3" },
    { n: 4, decision: "HttpPort injectável; idempotency diferida p/ 3.2; env.ts não tocado.", reason: "Espelha SpawnPort (testável sem rede); idempotency pareia com retry (3.2); adapter recebe config injectado.", id: "Q-3.1-4" },
  ],
  tradeoffs: [
    "Spot-check AI-E2-3 antes de implementar apanhou o layering NotifyPort vs OutboundNotifyPort (classe do conflito verdict da 2.7) — cedo, não no fim do épico. Confirmou também que O-B5-3 (inbound) NÃO bloqueia a 3.1 (outbound especificado).",
    "Dry-run redacted por omissão: o log não contém values de vars nem o token (testado). Fail-closed: payload inválido → 0 POSTs (não envia lixo ao clihelper).",
  ],
  openItems: [
    { id: "O-3.1-1", description: "Shape interno de template[] é assumção ({name, parameters:[{key,value}]}); confirmar quando o clihelper outbound real for sondado (análogo a O-B5-3, mas outbound)." },
    { id: "fronteiras", description: "3.2 (bucket 1 req/s + retry + CB + idempotency key, envolve este adapter), 3.3 (6 templates UTILITY + tracking Meta), inbound/n8n (story posterior). Wiring env→config = integração." },
  ],
  metrics: [
    { key: "Tests", value: "361 pass / 3 skip / 0 fail (era 351; +10 unit)" },
    { key: "Integração", value: "16 pass / 3 skip" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0" },
    { key: "Deps adicionadas", value: "0" },
  ],
  nextSteps: [
    { n: 1, description: "Operador aprova `approve story-3.1` → marco done + commit `feat(story-3.1): OutboundNotifyPort + clihelper adapter`. Não toca workflows → push normal; verificar CI verde." },
    { n: 2, description: "Epic 3: 1/6. Próxima: Story 3.2 (leaky bucket 1 req/s + retry + circuit breaker; envolve este adapter; idempotency key)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/ports/outbound-notify.port.ts", "src/adapters/whatsapp/clihelper.adapter.ts", "src/adapters/whatsapp/payload-schema.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
