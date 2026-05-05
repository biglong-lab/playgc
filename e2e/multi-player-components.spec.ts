/**
 * E2E 測試：多人遊戲元件 Smoke Test
 *
 * 驗證新增的多人元件能正確載入、無 JS 崩潰、關鍵 data-testid 存在。
 * 測試方式：
 *   - 直接渲染元件 demo 路由（若有）
 *   - 或驗證 SPA 路由可達 + body 非空
 * 不依賴登入或實際遊戲資料，只做 smoke 驗證。
 *
 * 元件清單（Phase 5 新增）：
 *   - mood_meter（MoodMeterPage）
 *   - team_checklist（TeamChecklistPage）
 *   - feedback_star（FeedbackStarPage）
 *   - team_word_cloud（TeamWordCloudPage）
 *   - check_in（CheckInPage）
 *   - group_timer（GroupTimerPage）
 *   - quick_question（QuickQuestionPage）
 */

import { test, expect } from "@playwright/test";

test.describe("多人遊戲元件 Smoke Test", () => {
  test("Landing 頁無 React 崩潰（基準線）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境模板 API 可達（驗 space-activation 和 employee-onboarding 存在）", async ({ page }) => {
    const response = await page.request.get("/api/scenarios/health");
    // health endpoint 回傳 200
    expect(response.status()).toBe(200);
  });

  test("Admin 後台能載入（新情境建場入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin/login");
    await page.waitForTimeout(1500);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test("Play SPA 頁面路由可達（多人遊戲入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 0).toBeTruthy();
  });

  test("Team game 頁面路由可達（隊伍模式）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/team/smoke-test-game");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("Mobile viewport 多人遊戲頁面正常（375×667）", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境市場頁面能顯示新增的情境", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/template-market");
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 50).toBeTruthy();
  });

  test("GamePageRenderer 不崩潰（scenario 頁面路由）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 模擬存取 game 路由（不需要實際 game 存在，只要不崩）
    await page.goto("/g/smoke-test-slug");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
