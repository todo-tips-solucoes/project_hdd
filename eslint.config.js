// ESLint flat config (typescript-eslint v8+).
// Story 1.a.1 (Q-2 resolvido 2026-05-28) — preferimos flat config sobre legacy
// .eslintrc.json porque é o padrão suportado pela major v8+ do typescript-eslint.
// Story 1.a.2 (Q-A2-1 resolvido 2026-05-28) — adicionada regra no-restricted-syntax
// ThrowStatement (AO-66) com override tests/** (AO-104).
//
// Stories futuras acrescentam:
//   * AO-103 no-restricted-globals: setTimeout, setInterval em src/core/ (Story 1.a.3 + ClockPort)

import tseslint from "typescript-eslint";

const THROW_WHITELIST_MESSAGE =
  "Throw statement disallowed except for AO-66 whitelist (11 items). " +
  "See docs/conventions/errors.md. To allow specific throws, prefix the throw line with: " +
  "// eslint-disable-next-line no-restricted-syntax -- AO-66 #N";

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
      // Union AR-018 (epics.md) ∪ AO-50 (architecture.md) — Q-1 resolvido union (Story 1.a.1).
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      // AO-66: throw restrito à whitelist canónica em docs/conventions/errors.md.
      // Exceções marcadas linha-a-linha com `// eslint-disable-next-line no-restricted-syntax -- AO-66 #N`.
      "no-restricted-syntax": [
        "error",
        { selector: "ThrowStatement", message: THROW_WHITELIST_MESSAGE },
      ],
      // Convenção HDD: parâmetros com prefixo `_` são intencionalmente unused
      // (e.g. interface implementations que ignoram args). Story 1.a.3.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // AO-104: test files isentos da throw whitelist (test runners absorvem expect/assert).
    files: ["tests/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // AO-103 (Story 1.a.3): setTimeout/setInterval em src/core/** só via ClockPort.
    // Adapters PODEM usar globais (são a implementação real); ports são apenas tipos.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "Use ClockPort.setTimeout (AO-103)" },
        { name: "setInterval", message: "Use ClockPort.setInterval (AO-103)" },
      ],
    },
  },
);
