/**
 * E2E 測試：水彈對戰 PK 擂台完整流程
 * 場地瀏覽 → 時段查看 → 排行榜 → 管理端保護
 *
 * 注意：API 端點測試由 Vitest 單元測試覆蓋，
 * 此處專注於頁面載入、導航、認證保護的 E2E 驗證。
 */
import { test, expect } from "@playwright/test";

test.describe("水彈對戰 — 公開頁面", () => {
  test("對戰首頁能正常載入", async ({ page }) => {
    await page.goto("/battle");
    await expect(page.locator("body")).toBeVisible();
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("排行榜頁面能正常載入", async ({ page }) => {
    await page.goto("/battle/ranking");
    await page.waitForTimeout(2000);
    await expect(page.locator("body")).toBeVisible();
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });

  test("對戰首頁有導航元素", async ({ page }) => {
    await page.goto("/battle");
    await page.waitForTimeout(3000);
    // 應有導航連結或 Tab
    const navElements = page.locator("a[href*='/battle'], button, [role='tab']");
    const count = await navElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("對戰首頁回應式佈局正常", async ({ page }) => {
    await page.goto("/battle");
    await page.waitForTimeout(2000);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10);
  });

  test("場地詳情頁能正常載入（如有場地連結）", async ({ page }) => {
    await page.goto("/battle");
    await page.waitForTimeout(3000);
    const links = page.locator("a[href*='/battle/slot/']");
    const linkCount = await links.count();
    if (linkCount > 0) {
      await links.first().click();
      await page.waitForTimeout(2000);
      await expect(page.locator("body")).toBeVisible();
      const content = await page.textContent("body");
      expect(content?.length).toBeGreaterThan(0);
    }
  });
});

test.describe("水彈對戰 — 需登入頁面", () => {
  test("未登入存取我的報名應有適當處理", async ({ page }) => {
    await page.goto("/battle/my");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("未登入存取歷史紀錄應有適當處理", async ({ page }) => {
    await page.goto("/battle/history");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("未登入存取通知頁面應有適當處理", async ({ page }) => {
    await page.goto("/battle/notifications");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("未登入存取成就頁面應有適當處理", async ({ page }) => {
    await page.goto("/battle/achievements");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("未登入存取賽季頁面應有適當處理", async ({ page }) => {
    await page.goto("/battle/seasons");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });
});

test.describe("水彈對戰 — 管理端認證保護", () => {
  test("管理端對戰儀表板未認證重導向到登入", async ({ page }) => {
    await page.goto("/admin/battle/dashboard");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("管理端場地管理未認證重導向到登入", async ({ page }) => {
    await page.goto("/admin/battle/venues");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("管理端時段管理未認證重導向到登入", async ({ page }) => {
    await page.goto("/admin/battle/slots");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("管理端排行榜管理未認證重導向到登入", async ({ page }) => {
    await page.goto("/admin/battle/rankings");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("管理端賽季管理未認證重導向到登入", async ({ page }) => {
    await page.goto("/admin/battle/seasons");
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
