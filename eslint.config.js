import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "supabase/**"] },
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
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Context/provider and shadcn primitives intentionally export helpers beside components.
      // Fast Refresh remains active; this advisory rule is not a production correctness check.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Tip hijyeni: yeni `any` kullanımlarını engelle (mevcut ~106 kullanım kademeli temizleniyor).
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      // Depolama tek noktadan yönetilir: window.localStorage doğrudan erişimi yerine
      // src/lib/safe-storage.ts (SafeStorage adaptörü) kullanılmalı.
      "no-restricted-globals": ["error", { name: "localStorage", message: "Use safeStorage from @/lib/safe-storage instead of raw localStorage." }],
      "no-restricted-properties": ["error", { object: "window", property: "localStorage", message: "Use safeStorage from @/lib/safe-storage instead of window.localStorage." }],
    },
  },
  {
    // safe-storage adaptörünün kendisi ve servis worker ham depolamaya erişmek ZORUNDA.
    files: ["src/lib/safe-storage.ts", "src/lib/cache-manager.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },
);
