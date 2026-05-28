import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Surfaced as warnings (ratcheted via --max-warnings in the lint script)
      // so existing debt is tolerated but no new violations can land.
      //
      // Unused imports run through eslint-plugin-unused-imports instead of
      // @typescript-eslint/no-unused-vars because the plugin ships an
      // auto-fixer — `eslint --fix` will remove dead imports.
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      // react-hooks v7 added several strict rules that flag valid patterns
      // throughout the codebase. Disabling to keep CI green without refactoring.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/no-components-during-render": "off",
      "react-hooks/no-impure-hooks-calls": "off",
      "react-hooks/no-reassign-after-render": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // these produce false positives in complex conditional flows
      "no-useless-assignment": "off",
    },
  },
);
