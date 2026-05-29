/**
 * `verify-redaction.ts` — CI/local gate (Story 1.b.3, AC4).
 *
 * Constrói um payload com as 9 categorias de segredo, corre `redactPayload`, e
 * scaneia o resultado serializado por assinaturas de segredo conhecidas. Se
 * alguma sobrevive → exit 1; senão exit 0. Complementa o truffleHog do CI
 * (que scaneia o repo/log dir em GH Actions).
 */

import { redactPayload } from "../src/lib/redaction.ts";

const SECRETS: Readonly<Record<string, string>> = {
  anthropicKey: "sk-ant-api03-VERIFYsecret1234567890",
  githubToken: "ghp_0123456789abcdefghijABCDEFGHIJ0123",
  awsAkia: "AKIAIOSFODNN7EXAMPLE",
  bearer: "Authorization: Bearer eyJhbGciOiJIUzI1NiADMIN.token.value",
  basic: "Authorization: Basic dXNlcjpzdXBlcnNlY3JldA==",
  waId: "5511912345678",
  phonePt: "+351 912 345 678",
  phoneBr: "+55 11 98765-4321",
  generic: 'password="hunter2supersecretvalue"',
};

const fixture = {
  level: "info",
  nested: { headers: SECRETS, list: [{ env: "ANTHROPIC_API_KEY=sk-ant-api03-NESTEDleak123456" }] },
};

const redacted = JSON.stringify(redactPayload(fixture));

const SIGNATURES: ReadonlyArray<string> = [
  "sk-ant-api03-VERIFYsecret1234567890",
  "sk-ant-api03-NESTEDleak123456",
  "ghp_0123456789abcdefghijABCDEFGHIJ0123",
  "AKIAIOSFODNN7EXAMPLE",
  "dXNlcjpzdXBlcnNlY3JldA==",
  "5511912345678",
  "+351 912 345 678",
  "+55 11 98765-4321",
  "hunter2supersecretvalue",
];

const leaks = SIGNATURES.filter((sig) => redacted.includes(sig));

if (leaks.length > 0) {
  console.error(`FAIL: ${leaks.length} secret(s) sobreviveram à redaction:`);
  for (const l of leaks) console.error(`  - ${l}`);
  process.exit(1);
}

console.log(`OK: ${SIGNATURES.length} assinaturas testadas, 0 leaks.`);
