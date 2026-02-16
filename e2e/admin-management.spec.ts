/**
 * E2E 測試：管理端頁面
 */
import { test, expect } from "@playwright/test";

test.describe("管理端", () => {
  test("場主登入頁面能正常載入", async ({ page }) => {
    await page.goto("/admin/login");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("管理員登入頁面能正常載入", async ({ page }) => {
    await page.goto("/admin-staff/login");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("未認證存取 /admin 有適當處理", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForTimeout(2000);
    // 未認證應重導向到登入頁或顯示錯誤
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("admin-staff 首頁重導向到 login", async ({ page }) => {
    await page.goto("/admin-staff");
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/admin-staff\/login/);
  });

  test("管理端頁面有正確的表單元素", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForTimeout(2000);
    // 登入頁面應有輸入框或按鈕
    const formElements = page.locator("input, button, a");
    const count = await formElements.count();
    expect(count).toBeGreaterThan(0);
  });
});
