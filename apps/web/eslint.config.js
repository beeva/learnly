import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", "public/mockServiceWorker.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "no-console": ["warn", { allow: ["warn", "error", "debug"] }],
      // Lists styled with `list-style: none` lose their semantics in Safari/VoiceOver
      // unless role="list" is set explicitly.
      "jsx-a11y/no-redundant-roles": ["error", { ul: ["list"], ol: ["list"] }],
      // Scrollable tables sit in a focusable region so keyboard users can scroll them, and
      // tab panels are focusable per the WAI-ARIA tabs pattern.
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region", "tabpanel"], tags: [] }],
      // Later history chunks reference types inline because they can't add top-level imports.
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports", disallowTypeAnnotations: false }],
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ["e2e/**/*.ts", "*.config.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
