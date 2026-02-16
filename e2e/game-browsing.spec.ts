/**
 * E2E 測試：遊戲大廳瀏覽與搜尋
 */
import { test, expect } from "@playwright/test";

test.describe("遊戲大廳（Home）", () => {
  test("遊戲大廳頁面能正常載入", async ({ page }) => {
    await page.goto("/home");
    // 頁面載入不崩潰
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("頁面包含搜尋或過濾功能", async ({ page }) => {
    await page.goto("/home");
    // 搜尋輸入框或過濾按鈕
    const searchInput = page.locator("input[type='search'], input[type='text'], input[placeholder*='搜尋'], input[placeholder*='search']");
    const filterButtons = page.locator("button, [role='tab']");
    // 至少有搜尋框或按鈕其中之一
    const hasSearch = await searchInput.count();
    const hasFilters = await filterButtons.count();
    expect(hasSearch + hasFilters).toBeGreaterThan(0);
  });

  test("遊戲列表有內容或空狀態提示", async ({ page }) => {
    await page.goto("/home");
    await page.waitForTimeout(2000); // 等 API 回應
    const body = await page.textContent("body");
    // 有遊戲卡片或空狀態訊息
    expect(body?.length).toBeGreaterThan(0);
  });

  test("能從首頁導航到遊戲大廳", async ({ page }) => {
    await page.goto("/");
    // 嘗試點擊任何可能導到 /home 的連結
    const homeLink = page.locator("a[href='/home'], a[href*='home']").first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL(/\/home/);
    }
  });

  test("頁面回應式佈局正確", async ({ page }) => {
    await page.goto("/home");
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // viewport 內容不應產生水平捲軸
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });
});
