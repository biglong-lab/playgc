import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  // 全域忽略
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "attached_assets/**",
      "server/public/**",
      "*.config.js",
      "*.config.ts",
      "script/**",
    ],
  },

  // 基礎規則
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,

  // 全域規則設定
  {
    rules: {
      // 禁止 console.log（允許 warn/error 作為漸進式遷移）
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // TypeScript 規則
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
    },
  },

  // React Hooks 規則（僅前端）
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // 伺服器端特定規則
  {
    files: ["server/**/*.ts"],
    rules: {
      // 伺服器的結構化日誌函式（log()）允許使用 console.log
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // 腳本檔案放寬規則
  {
    files: ["server/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
