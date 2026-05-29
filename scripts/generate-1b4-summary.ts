/**
 * Story 1.b.4 — DOGFOOD: gera summary via summaryGenerator.finalize() (6ª vez).
 *
 * Lesson O-A9-5: Tier-B trim AGRESSIVO. 4ª story do Epic 1.b.
 */

import type { SummaryInput } from "../src/services/summary-generator.service.ts";
import { createSummaryGenerator } from "../src/services/summary-generator.service.ts";

const input: SummaryInput = {
  workflowId: "story-1b4",
  workflowName: "Story 1.b.4 — Sandbox Bun.spawn docker --network=none",
  phase: "implementation-artifacts",
  projectName: "projeto_hdd",
  date: "2026-05-29",
  contexto:
    "4ª story do Epic 1.b (Safety). Código LLM-generated passa a correr dentro de docker run endurecido (--network=none + non-root + cap-drop + read-only), não no host. Combina com 1.b.1 (path safety) para conter o blast-radius. AR-015 + AO-47.",
  whatWasDone: [
    { artifact: "src/ports/sandbox.port.ts", description: "SandboxPort + tipos; SandboxError = SpawnError|SandboxImageMissing|UnsafeMount." },
    {
      artifact: "src/adapters/sandbox/docker-spawn.adapter.ts",
      description:
        "~95L. buildDockerArgs hardened; checkSandboxImageSync (Bun.spawnSync inspect 400ms); isSafeMountDir (AO-174); factory injecta SpawnPort.",
    },
    { artifact: "docker/sandbox/Dockerfile", description: "alpine:3.20 + USER 65534, sem ferramentas de rede." },
    { artifact: "scripts/prepull-sandbox-image.sh", description: "docker build + inspect verify; idempotente." },
    { artifact: "tests/adapters/sandbox.security.test.ts", description: "21 specs: AC1/AC2/AC3 escape table; spawn spy." },
    { artifact: "src/bootstrap.ts + src/main.ts", description: "MODIFY: image fail-closed (BootSandboxImageMissing) + switch case." },
  ],
  decisions: [
    { n: 1, decision: "Image check sync via Bun.spawnSync.", reason: "Mantém bootstrap() sync; <500ms; injectável.", id: "Q-B4-1" },
    { n: 2, decision: "Dockerfile próprio alpine:3.20 + USER 65534.", reason: "Controlo do threat-model; tag hdd-sandbox:0.0.1.", id: "Q-B4-2" },
    { n: 3, decision: "Mount read-only por defeito (rw opt-in).", reason: "Menor privilégio; código LLM não escreve no host sem opt-in.", id: "Q-B4-3" },
    { n: 4, decision: "Mock-only nos testes unit.", reason: "Política 1.a.10; sem docker no CI; spawn spy assere args.", id: "Q-B4-4" },
    { n: 5, decision: "+UnsafeMount no SandboxError.", reason: "AO-174: mountDir com :/,/espaço/.. é vector de escape; rejeitar antes do spawn." },
  ],
  tradeoffs: [
    "Quis bootstrap async para usar SpawnPort, fiquei com Bun.spawnSync (Q-B4-1): refactor do contrato sync tocaria main.ts + 14 testes 1.a.7.",
    "Quis escapes reais no CI, fiquei com mock-only (Q-B4-4): docker no CI viola política + flakiness; PT-1 real fica para 1.b.5.",
  ],
  openItems: [
    { id: "O-B4-1", description: "Execução REAL dos escapes PT-1 (curl bloqueado, escape de volume/cap/pid) com docker presente — Story 1.b.5/integração." },
    { id: "O-B4-2", description: "Wiring do sandbox no worker loop real (Epic 4.x orquestração)." },
    { id: "O-B4-3", description: "Tuning de --memory/--pids-limit por workload — valores conservadores agora." },
    { id: "O-B1-1 acumula", description: "Numeração PT (epics PT-1 vs architecture) — Story 1.b.5 materializa docs/pre-m1-pentest-tasks.md." },
  ],
  metrics: [
    { key: "Tests", value: "226 pass / 0 fail (was 205; +21)" },
    { key: "Type-check", value: "clean" },
    { key: "Lint", value: "exit 0 (23 infos pré-existentes)" },
    { key: "Linhas novas", value: "~95 adapter + port + Dockerfile + script + 21 specs" },
    { key: "Deps adicionadas", value: "0" },
    { key: "Regressão corrigida", value: "bootstrap 1.a.7 — +sandboxImageCheck stub nas 5 chamadas VALID_KEY" },
    { key: "Token usage approx", value: "dentro estimated 64-96K" },
  ],
  nextSteps: [
    {
      n: 1,
      description:
        "Operador aprova `approve story-1b4` → marco done + commit. Mensagem: `feat(story-1b4): sandbox docker --network=none (3 ACs verde; isolamento exec)`. Push toca .github/workflows → scope workflow já refrescado.",
    },
    { n: 2, description: "Sprint 0: 15/22 done. Epic 1.b: 4/5. Última: Story 1.b.5 (8 Pentest Tasks PT-1..PT-8 — reconcilia numeração PT, fecha O-B1-1)." },
  ],
  diffAgainst: "HEAD",
  diffPaths: ["src/adapters/sandbox/docker-spawn.adapter.ts", "src/ports/sandbox.port.ts", "src/bootstrap.ts"],
};

const gen = createSummaryGenerator({ repoRoot: "/var/lib/projeto_hdd" });
const result = gen.finalize(input);

if (result.isErr()) {
  console.error("FAILED:", JSON.stringify(result.error, null, 2));
  process.exit(1);
}
console.log("OK:", JSON.stringify(result.value, null, 2));
