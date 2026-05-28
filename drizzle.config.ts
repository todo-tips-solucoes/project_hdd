// Story 1.a.5 — Drizzle Kit config (AO-49 + AR-013).
// Schema = single source of truth (`src/db/schema.ts`); migrations
// committable em `src/db/migrations/`. HDD_DB_PATH override permite
// `:memory:` em testes + path custom em CI/prod.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env["HDD_DB_PATH"] ?? "./.hdd-state.db",
  },
  strict: true,
});
