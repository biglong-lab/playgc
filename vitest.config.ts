import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./client/src/test/setup.ts"],
    include: [
      "client/src/**/*.{test,spec}.{ts,tsx}",
      "server/**/*.{test,spec}.{ts,tsx}",
      "shared/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", ".git", "attached_assets", ".cache"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/test/**",
        "attached_assets/**",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
