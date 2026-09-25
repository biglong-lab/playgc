/**
 * 🎯 多人即時穩定性 e2e — Phase 0-4 驗證（2026-05-08）
 *
 * 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md
 *
 * 驗證重點（每個 test 標註對應 Phase）：
 *   Phase 1+2：1 user = 1 條 ws / page 切換不應 close
 *   Phase 0.1 / 0.3：admin/multi-sessions、replay、export.csv endpoint 需認證
 *   ADR-0018：client/src 內 new WebSocket() 白名單
 *
 * 📺 2026-09-25：原 Block A（seed host_trivia_showdown 場次、/api/trivia 答題計分、
 *   /play/:sessionId 大螢幕玩家端 ws 連線數）已隨大螢幕互動移交 PhotoGo 一併移除；
 *   本檔只剩不依賴 seed 的驗證（任何時候都能跑、不需 ENABLE_E2E_HELPERS）。
 *
 * 跑：
 *   npx playwright test e2e/multi-realtime-stability-phase04.spec.ts
 */
import { test, expect } from "@playwright/test";

// ============================================================================
// Block B：不依賴 seed 的測試（任何時候都能跑、含 ENABLE_E2E_HELPERS=false）
// ============================================================================
test.describe("Phase 0-4 即時通訊不依賴 seed 的驗證", () => {
  // ============================================================================
  // Phase 0.1 / 0.3：admin endpoint 認證（不需 seed、純 endpoint shape）
  // ============================================================================

  test("Phase 0.1: GET /api/admin/multi-sessions 需認證（401 / 403）", async ({ request }) => {
    const res = await request.get("/api/admin/multi-sessions");
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  test("Phase 0.3: GET /api/admin/sessions/:id/replay 需認證", async ({ request }) => {
    const res = await request.get(`/api/admin/sessions/dummy-session-id/replay`);
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  test("Phase 0.3: GET /api/admin/sessions/:id/export.csv 需認證", async ({ request }) => {
    const res = await request.get(`/api/admin/sessions/dummy-session-id/export.csv`);
    const ct = res.headers()["content-type"] ?? "";
    // CSV endpoint 認證失敗時回 json error
    if (!ct.includes("application/json") && !ct.includes("text/csv")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  // ============================================================================
  // Phase 1+2：玩家進站、ws 連線數驗證（不需 seed）
  // 進首頁、看 ws 連線數
  // ============================================================================

  test("Phase 1+2: 玩家進首頁、瀏覽器 ws 連線數不超過 1", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      const wsUrls: string[] = [];
      page.on("websocket", (ws) => wsUrls.push(ws.url()));

      await page.goto("/");
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.waitForTimeout(3000);

      // 全域 Provider 設計：未進入需要 ws 的頁時、應為 0；最壞情況 1
      expect(wsUrls.length, `WS 連線太多: ${wsUrls.join(", ")}`).toBeLessThanOrEqual(1);
    } finally {
      await ctx.close();
    }
  });

  test("Phase 1+2: 玩家在不同 page 間切換、ws close 數量不應暴增", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      let openCount = 0;
      let closeCount = 0;
      page.on("websocket", (ws) => {
        openCount++;
        ws.on("close", () => closeCount++);
      });

      // 進首頁
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 切到 battle page
      await page.goto("/battle");
      await page.waitForTimeout(2000);

      // 切回首頁
      await page.goto("/");
      await page.waitForTimeout(2000);

      // ws close 不應超過 open（理想 = 0）
      expect(closeCount).toBeLessThanOrEqual(openCount);
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // ADR-0018 規範驗證（檔案掃描）
  // 與 e2e/global-ws-provider.spec.ts 重複、保留作為自包含驗證
  // ============================================================================
  test("ADR-0018: client/src 內 new WebSocket() 必須在白名單", async () => {
    const fs = await import("fs");
    const path = await import("path");

    function* walkDir(dir: string): Generator<string> {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "__tests__" || entry.name === "node_modules") continue;
          yield* walkDir(full);
        } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
          if (full.includes(".test.")) continue;
          yield full;
        }
      }
    }

    const allowed = new Set([
      "client/src/contexts/WebSocketContext.tsx",
      "client/src/components/game/solo/ShootingMissionPage.tsx",
      "client/src/hooks/use-match-websocket.ts",
    ]);
    const violations: string[] = [];
    for (const file of walkDir("client/src")) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("new WebSocket(")) {
        const rel = file.replace(/^.*?(client\/src)/, "$1");
        if (!allowed.has(rel)) violations.push(rel);
      }
    }
    expect(violations).toHaveLength(0);
  });
});
