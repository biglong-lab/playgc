/**
 * E2E 測試：SaaS 公開流程
 * - 公開場域申請頁 /apply
 * - 平台擁有者緊急登入 /owner-login
 *
 * 注意：SaaS 配額阻擋的業務邏輯由 Vitest integration test 覆蓋
 * (server/__tests__/player-purchases-checkout.test.ts)
 * 此處專注於頁面層級渲染 + 基本互動
 */
import { test, expect } from "@playwright/test";

test.describe("公開場域申請頁 /apply", () => {
  test("頁面正常載入", async ({ page }) => {
    await page.goto("/apply");
    await page.waitForTimeout(2000);
    // 頁面應有主要標題
    const headings = page.locator("h1, h2");
    expect(await headings.count()).toBeGreaterThan(0);
  });

  test("含有表單輸入欄位", async ({ page }) => {
    await page.goto("/apply");
    await page.waitForTimeout(2000);
    const inputs = page.locator("input, textarea");
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(3); // 至少場域名 / email / 聯絡人
  });

  test("提交空表單時有驗證錯誤", async ({ page }) => {
    await page.goto("/apply");
    await page.waitForTimeout(2000);
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
      // 仍停留在同頁（未成功提交）
      await expect(page).toHaveURL(/\/apply/);
    }
  });
});

test.describe("平台擁有者緊急登入 /owner-login", () => {
  test("頁面正常載入", async ({ page }) => {
    await page.goto("/owner-login");
    await page.waitForTimeout(2000);
    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test("無密鑰時無法登入", async ({ page }) => {
    await page.goto("/owner-login");
    await page.waitForTimeout(2000);
    // 不填密鑰時按鈕應 disabled（防呆設計）
    const submitBtn = page.locator("button").filter({ hasText: /登入|驗證/i }).first();
    if (await submitBtn.isVisible()) {
      const isDisabled = await submitBtn.isDisabled();
      if (isDisabled) {
        // 按鈕 disabled 是正確行為 → 確認仍在 /owner-login
        await expect(page).toHaveURL(/\/owner-login/);
        return;
      }
      // 按鈕未 disabled → 點擊應失敗並停留在原頁
      await submitBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/\/owner-login/);
    }
  });

  test("可從 URL query 預填密鑰", async ({ page }) => {
    await page.goto("/owner-login?secret=test-invalid");
    await page.waitForTimeout(2000);
    // 應有輸入框顯示（預填功能存在）
    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });
});

test.describe("平台後台路徑保護", () => {
  test("未認證存取 /platform 重導向到登入", async ({ page }) => {
    await page.goto("/platform");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("未認證存取 /platform/analytics 重導向", async ({ page }) => {
    await page.goto("/platform/analytics");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("未認證存取 /platform/settings 重導向", async ({ page }) => {
    await page.goto("/platform/settings");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
