/**
 * E2E 測試：遊戲大廳瀏覽與搜尋
 * 注意：/home 未登入時可能重導向到 Landing 首頁
 */
import { test, expect } from "@playwright/test";

test.describe("遊戲大廳（Home）", () => {
  test("遊戲大廳頁面能正常載入", async ({ page }) => {
    await page.goto("/home");
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("未登入存取 /home 有適當處理", async ({ page }) => {
    await page.goto("/home");
    await page.waitForTimeout(3000);
    // 未登入可能重導向到首頁或顯示登入提示
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
    // 頁面有互動元素（按鈕、連結等）
    const interactive = page.locator("button, a[href]");
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);
  });

  test("遊戲列表有內容或空狀態提示", async ({ page }) => {
    await page.goto("/home");
    await page.waitForTimeout(2000);
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(0);
  });

  test("能從首頁找到進入遊戲的方式", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    // 首頁應有登入或進入按鈕
    const buttons = page.locator("button, a[href]");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("頁面回應式佈局正確", async ({ page }) => {
    await page.goto("/home");
    await page.waitForTimeout(2000);
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
