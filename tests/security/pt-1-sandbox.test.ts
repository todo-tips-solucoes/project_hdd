/**
 * PT-1 — Sandbox escape (Story 1.b.5). Compõe a defesa de 1.b.4.
 *
 * Verifica que o comando docker é inescapável por construção: flags protectoras
 * presentes, flags perigosas ausentes, mount injection rejeitado. Mock-only
 * (Q-B4-4): a execução real fica para integração com docker presente.
 */

import { describe, expect, test } from "bun:test";
import {
  buildDockerArgs,
  isSafeMountDir,
  SANDBOX_IMAGE,
} from "../../src/adapters/sandbox/docker-spawn.adapter.ts";

const args = buildDockerArgs({ script: "echo hi", mountDir: "/tmp/work" }, SANDBOX_IMAGE);

describe("PT-1 sandbox escape", () => {
  for (const flag of [
    "--network=none",
    "--cap-drop=ALL",
    "--read-only",
    "no-new-privileges",
    "--rm",
  ]) {
    test(`flag protectora presente: ${flag}`, () => {
      expect(args).toContain(flag);
    });
  }

  for (const flag of ["--privileged", "--cap-add", "--pid=host", "--network=host", "--ipc=host"]) {
    test(`flag perigosa ausente: ${flag}`, () => {
      expect(args.includes(flag)).toBe(false);
    });
  }

  test("corre como user não-privilegiado (65534)", () => {
    expect(args[args.indexOf("--user") + 1]).toBe("65534:65534");
  });

  test("mount injection rejeitado (`:`/`,`/espaço/`..`/relativo)", () => {
    for (const bad of ["/tmp/a:rw", "/tmp/a,z", "/tmp/a b", "/tmp/../etc", "rel/dir"]) {
      expect(isSafeMountDir(bad)).toBe(false);
    }
    expect(isSafeMountDir("/tmp/work")).toBe(true);
  });
});
