// ESLint flat config (typescript-eslint v8+).
// Story 1.a.1 (Q-2 resolvido 2026-05-28) — preferimos flat config sobre legacy
// .eslintrc.json porque é o padrão suportado pela major v8+ do typescript-eslint.
//
// O scope desta config nesta story é DELIBERADAMENTE estreito:
//   * 5 regras async-safety (Q-1 union AR-018 ∪ AO-50, 2026-05-28).
//   * Restantes regras de qualidade ficam para Biome (formatação, lint base,
//     max-lines 200 via noExcessiveLinesPerFile em biome.json).
//
// Stories futuras (1.a.2 e seguintes) acrescentam:
//   * AO-66 no-restricted-syntax: ThrowStatement (Story 1.a.2 + Result whitelist)
//   * AO-103 no-restricted-globals: setTimeout, setInterval em src/core/ (Story 1.a.3 + ClockPort)

import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".smoke-evidence/**",
      "_bmad/**",
      "_bmad-output/**",
      "tests/integration/*.sh",
      "**/*.sh",
      "**/*.md",
      "eslint.config.js",
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Union AR-018 (epics.md) ∪ AO-50 (architecture.md) — Q-1 resolvido union.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
    },
  },
);
