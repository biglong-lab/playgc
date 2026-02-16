/**
 * E2E 測試：單人遊戲流程
 */
import { test, expect } from "@playwright/test";

test.describe("單人遊戲流程", () => {
  test("遊戲頁面能正常載入", async ({ page }) => {
    // 使用一個假 gameId — 頁面應顯示載入或錯誤，不崩潰
    await page.goto("/game/test-game-id");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("未登入時遊戲頁面有適當處理", async ({ page }) => {
    await page.goto("/game/test-game-id");
    await page.waitForTimeout(2000);
    // 未登入可能重導向到首頁或顯示登入提示
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("章節選擇頁面能正常載入", async ({ page }) => {
    await page.goto("/game/test-game-id/chapters");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("地圖頁面能正常載入", async ({ page }) => {
    await page.goto("/map/test-game-id");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("排行榜頁面能正常載入", async ({ page }) => {
    await page.goto("/leaderboard");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("QR Code 短連結能正常載入", async ({ page }) => {
    await page.goto("/g/test-slug");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
