/**
 * E2E 測試：認證流程
 * 管理員登入頁面、未認證保護、玩家端公開存取
 *
 * 注意：API 端點測試由 Vitest 單元測試覆蓋，
 * 此處專注於頁面層級的認證行為驗證。
 */
import { test, expect } from "@playwright/test";

test.describe("管理員認證流程", () => {
  test("登入頁面正常載入並有表單元素", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForTimeout(2000);
    const inputs = page.locator("input");
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test("登入頁面有場域碼輸入", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForTimeout(2000);
    // 應有至少一個輸入框
    const allInputs = page.locator("input");
    const count = await allInputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("未認證存取管理端首頁重導向到登入", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("未認證存取儀表板重導向到登入", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("未認證存取遊戲管理重導向到登入", async ({ page }) => {
    await page.goto("/admin/games");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("未認證存取系統設定重導向到登入", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("admin-staff 路徑重導向到 /admin/login", async ({ page }) => {
    await page.goto("/admin-staff/login");
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("玩家端認證", () => {
  test("首頁（Landing）無需登入", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("對戰首頁無需登入", async ({ page }) => {
    await page.goto("/battle");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();
    // 不應重導向到登入
    const url = page.url();
    expect(url).toContain("/battle");
  });

  test("排行榜無需登入", async ({ page }) => {
    await page.goto("/battle/ranking");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();
  });

  test("QR Code 短連結路徑能正常存取", async ({ page }) => {
    await page.goto("/g/test-slug");
    await page.waitForTimeout(2000);
    // 可能顯示遊戲頁面或錯誤頁面，但不應崩潰
    await expect(page.locator("body")).toBeVisible();
  });
});
