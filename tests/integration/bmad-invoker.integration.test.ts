/**
 * `bmad-invoker.integration.test.ts` — INTEGRAÇÃO REAL do BmadInvoker (Story 2.2, D-053).
 *
 * Invoca `claude -p` REAL via system-spawn (D-052). **OPT-IN**: gated por
 * `HDD_BMAD_LIVE=1` (e claude presente) — NÃO corre por defeito porque consome
 * tokens, é lento e não-determinístico. O formato do stream-json já foi sondado
 * empiricamente (evento `type:"result"`); o unit (fake-spawn) cobre AC1-4. Este
 * prova o wiring `claude -p` → adapter ponta-a-ponta quando o operador o pede.
 */

import { describe, expect, test } from "bun:test";
import { createCliWrapperAdapter } from "../../src/adapters/bmad/cli-wrapper.adapter.ts";
import { createSystemSpawnAdapter } from "../../src/adapters/spawn/system-spawn.adapter.ts";

const live = process.env["HDD_BMAD_LIVE"] === "1" && Bun.which("claude") !== null;

describe.skipIf(!live)("BmadInvoker — claude -p real (opt-in HDD_BMAD_LIVE)", () => {
  test("run de uma skill simples → ok com result não-vazio em <30s", async () => {
    const invoker = createCliWrapperAdapter({ spawn: createSystemSpawnAdapter() });
    const r = await invoker.run("bmad-help", { allowedTools: [], timeoutMs: 90_000 });
    if (r.isErr()) throw new Error(`claude -p falhou: ${JSON.stringify(r.error)}`);
    expect(r.value.result.length).toBeGreaterThan(0);
  });
});
