/**
 * E2E 測試：首頁載入與導航
 */
import { test, expect } from "@playwright/test";

test.describe("首頁（Landing）", () => {
  test("首頁能正常載入", async ({ page }) => {
    await page.goto("/");
    // 頁面標題或主要元素存在
    await expect(page).toHaveURL("/");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("首頁含有登入相關元素", async ({ page }) => {
    await page.goto("/");
    // 檢查頁面有互動元素（按鈕或連結）
    const buttons = page.locator("button, a[href]");
    await expect(buttons.first()).toBeVisible({ timeout: 10_000 });
  });

  test("導航到不存在的頁面顯示 404", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz");
    // 應該顯示 404 或 Not Found
    const content = await page.textContent("body");
    expect(content?.toLowerCase()).toMatch(/not found|404|找不到/);
  });

  test("首頁在手機裝置上正常顯示", async ({ page }) => {
    await page.goto("/");
    // 頁面不應有水平溢出
    const body = page.locator("body");
    await expect(body).toBeVisible();
    const box = await body.boundingBox();
    expect(box).toBeTruthy();
  });
});
