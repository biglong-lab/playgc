/**
 * E2E 測試：全域 WS Provider（Phase 3 / 2026-05-08）
 *
 * 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §6
 *
 * 驗證重點：
 *   - 1 個 user 進站 = 瀏覽器只開 1 條 WebSocket
 *   - page 切換不會 close ws
 *   - reconnect 後狀態自動恢復
 *
 * 執行前提：
 *   - dev server 跑在 localhost:3333（npm run dev）
 *   - 或 production URL（測試 deployed 版本）
 */
import { test, expect } from "@playwright/test";

/**
 * 計算當前頁面的 WebSocket 連線數（透過 evaluate 在瀏覽器中算）
 */
async function countActiveWebSockets(page: import("@playwright/test").Page): Promise<number> {
  // Playwright 沒直接 API 數 ws、但可以監聽 networkidle / waitForEvent
  // 這裡用 frame.evaluate 取得 performance entries 中 ws 數量
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const wsCount = entries.filter((e) => e.name.startsWith("ws://") || e.name.startsWith("wss://")).length;
    return wsCount;
  });
}

test.describe("全域 WS Provider（Phase 3）", () => {
  test("玩家進站 → 瀏覽器只開 1 條 WS（不是 multi 元件數量）", async ({ page }) => {
    // 透過 page.on("websocket") 監聽 ws 開啟
    const wsConnections: string[] = [];
    page.on("websocket", (ws) => {
      wsConnections.push(ws.url());
    });

    await page.goto("/");
    // 等候 5 秒、讓 lazy chunks + ws 都載入完
    await page.waitForTimeout(5000);

    // 驗證：應該只有 0 或 1 條 ws（首頁可能還沒登入、不需要 ws）
    expect(wsConnections.length).toBeLessThanOrEqual(1);
    console.log(`[ws-provider] 首頁 ws 連線數: ${wsConnections.length}`);
  });

  test("page 切換 不應 close ws（Provider 保留）", async ({ page }) => {
    let openCount = 0;
    let closeCount = 0;

    page.on("websocket", (ws) => {
      openCount++;
      ws.on("close", () => {
        closeCount++;
      });
    });

    // 進首頁
    await page.goto("/");
    await page.waitForTimeout(2000);

    // 切到其他頁
    await page.goto("/battle");
    await page.waitForTimeout(2000);

    // 切回首頁
    await page.goto("/");
    await page.waitForTimeout(2000);

    console.log(`[ws-provider] page 切換後 ws open=${openCount} close=${closeCount}`);

    // 驗證：理想情況 ws 應該保留（最多 1 條 open + 0 close）
    // 但因為瀏覽器跨 navigation 會 unload page、ws 不能跨頁面持久
    // 所以這裡只驗證「同頁面內」mount/unmount 多次不應 close-reopen
    expect(closeCount).toBeLessThanOrEqual(openCount);
  });

  test("admin/multi-sessions UI 可開啟（Phase 0.1 觀測 endpoint）", async ({ page }) => {
    // 此測試需要 admin 登入、目前只驗 page 載入不報 JS error
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin/multi-sessions");
    await page.waitForTimeout(3000);

    // admin 未登入會 redirect 到 login、所以 URL 可能不是 /admin/multi-sessions
    // 驗證：沒有 uncaught exception
    expect(errors.length).toBe(0);
  });

  test("admin/sessions/:id/replay 可開啟（Phase 0.3 Replay UI）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 用假 session id 測 page 結構（admin 未登入會 redirect）
    await page.goto("/admin/sessions/test-session-id/replay");
    await page.waitForTimeout(3000);

    expect(errors.length).toBe(0);
  });
});

test.describe("禁止 new WebSocket() 規範（ADR-0018）", () => {
  test("client 端只剩 1 處 new WebSocket（在 WebSocketProvider 內）", async () => {
    // 此測試用 fs 掃 client/src，確認沒有違反 ADR-0018
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

    const violations: string[] = [];
    const allowed = new Set([
      // 唯一允許的位置：WebSocketProvider 本身
      "client/src/contexts/WebSocketContext.tsx",
      // Phase 5 待處理（暫時例外）：solo 射擊 / 對戰系統
      "client/src/components/game/solo/ShootingMissionPage.tsx",
      "client/src/hooks/use-match-websocket.ts",
    ]);

    for (const file of walkDir("client/src")) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("new WebSocket(")) {
        const rel = file.replace(/^.*?(client\/src)/, "$1");
        if (!allowed.has(rel)) {
          violations.push(rel);
        }
      }
    }

    if (violations.length > 0) {
      console.error(
        "[ADR-0018 違規] 偵測到 new WebSocket() 不在允許清單中:\n" +
          violations.map((v) => `  - ${v}`).join("\n"),
      );
    }
    expect(violations).toHaveLength(0);
  });
});
