/**
 * Playwright E2E 測試設定
 * 測試目錄：./e2e
 * 開發伺服器：http://localhost:3333
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3333",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Pixel 5",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // 開發伺服器（僅本機測試時啟動）
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3333",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
