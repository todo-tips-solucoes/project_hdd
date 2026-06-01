// Dirige o painel HDD: autentica via cookie de sessão forjado, abre o dashboard,
// screenshota o formulário "Iniciar feature", submete uma feature e captura o sucesso.
//
// Playwright é CommonJS e pode estar instalado fora deste dir — resolve via PW_BASE
// (dir que contém node_modules/playwright). Default: resolução relativa a este arquivo.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const WORK = process.env.WORK || "/tmp/hdd-run";
const base = process.env.PW_BASE ? `${process.env.PW_BASE}/` : import.meta.url;
const require = createRequire(base);
const { chromium } = require("playwright");

const cookie = readFileSync(`${WORK}/cookie.txt`, "utf8").trim();
const FRONT = process.env.HDD_FRONT_BASE || "http://localhost:3000";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([
  { name: "session", value: cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
]);
const page = await ctx.newPage();
page.on("console", (m) => console.log("  [browser]", m.type(), m.text()));

// networkidle nunca resolve com next dev (HMR websocket) — domcontentloaded + selector.
await page.goto(`${FRONT}/`, { waitUntil: "domcontentloaded" });

await page.waitForSelector('h2:has-text("Iniciar feature")', { timeout: 15000 });
console.log("OK: dashboard autenticado renderizou (formulário presente)");
await page.screenshot({ path: `${WORK}/01-dashboard.png`, fullPage: true });

await page.fill("textarea", "smoke via UI: adicionar endpoint /health ao serviço X");
await page.click('button:has-text("Iniciar onda")');

await page.waitForSelector("text=enfileirada", { timeout: 15000 });
const msg = (await page.textContent(".text-success")) || "(sem texto)";
console.log("OK: submissão bem-sucedida ->", msg.trim());
await page.screenshot({ path: `${WORK}/02-submitted.png`, fullPage: true });

await browser.close();
console.log("DONE");
