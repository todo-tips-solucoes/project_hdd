/**
 * PT-4 — SSRF (Story 1.b.5).
 *
 * O HDD não tem HTTP client server-side: n8n é o inbound aggregator e clihelper
 * é outbound (1 req/s). A defesa SSRF concreta no Sprint 0 é o ISOLAMENTO DE
 * REDE do sandbox (--network=none): mesmo que código LLM-generated tente
 * resolver/contactar uma URL atacante, não há egress. Rebuff semântico de URLs
 * (allowlist de egress) fica para Epic 3 quando o canal HTTP for construído.
 */

import { describe, expect, test } from "bun:test";
import { buildDockerArgs, SANDBOX_IMAGE } from "../../src/adapters/sandbox/docker-spawn.adapter.ts";

describe("PT-4 SSRF — egress bloqueado por isolamento de rede", () => {
  test("script com URL atacante corre sob --network=none (sem egress)", () => {
    const args = buildDockerArgs(
      { script: "curl http://169.254.169.254/latest/meta-data/" },
      SANDBOX_IMAGE,
    );
    expect(args).toContain("--network=none");
    // nenhuma flag reabre a rede
    expect(args.includes("--network=host")).toBe(false);
    expect(args.some((a) => a.startsWith("--network") && a !== "--network=none")).toBe(false);
  });

  test("sem network namespace partilhado nem dns custom", () => {
    const args = buildDockerArgs({ script: "x" }, SANDBOX_IMAGE);
    expect(args.includes("--dns")).toBe(false);
    expect(args.includes("--add-host")).toBe(false);
  });
});
