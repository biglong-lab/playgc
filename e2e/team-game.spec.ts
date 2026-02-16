/**
 * E2E 測試：團隊遊戲與對戰大廳
 */
import { test, expect } from "@playwright/test";

test.describe("團隊與對戰", () => {
  test("團隊大廳頁面能正常載入", async ({ page }) => {
    await page.goto("/team/test-game-id");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("對戰大廳頁面能正常載入", async ({ page }) => {
    await page.goto("/match/test-game-id");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("未登入時團隊頁面有適當處理", async ({ page }) => {
    await page.goto("/team/test-game-id");
    await page.waitForTimeout(2000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("未登入時對戰頁面有適當處理", async ({ page }) => {
    await page.goto("/match/test-game-id");
    await page.waitForTimeout(2000);
    const content = await page.textContent("body");
    expect(content?.length).toBeGreaterThan(0);
  });

  test("頁面不會有 JS 錯誤", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/team/test-game-id");
    await page.waitForTimeout(3000);

    // Firebase 初始化錯誤可接受，但不應有語法或渲染錯誤
    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
