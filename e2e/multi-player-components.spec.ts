/**
 * E2E Smoke：template-market 12 情境 + 玩家端渲染
 *
 * 2026-06-13 重寫：原檔（874 行）建立在上一輪 loop 塞入的 112 情境 / 338 元件
 * 之上，248 個 toContain 斷言中有 217 個指向「沒有 renderer 的幽靈元件」。
 * 瘦身（只留 12 情境、全部可渲染）後改為精簡 smoke：
 *   - /api/scenarios/health 回 12 情境、每情境 ≥3 元件
 *   - /template-market 顯示 12 張情境卡、無 JS 崩潰
 *   - 情境詳情頁可載入、列出元件
 *   - 玩家路由 /play、/g 可達不崩潰
 *
 * pageType 是否都有 renderer 的不變式由 shared/__tests__/scenario-renderable.test.ts
 * 以靜態方式鎖死（更快更穩），這裡只做瀏覽器層 smoke。
 */
import { test, expect } from "@playwright/test";

/** 過濾掉與本測試無關的環境噪音錯誤 */
function criticalOnly(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !e.includes("Firebase") &&
      !e.includes("auth") &&
      !e.includes("network") &&
      !e.includes("WebSocket"),
  );
}

test.describe("template-market 12 情境 smoke", () => {
  test("Landing 頁無 React 崩潰（基準線）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(criticalOnly(errors)).toHaveLength(0);
  });

  test("/api/scenarios/health 回 12 情境、每情境 ≥3 元件", async ({ page }) => {
    const res = await page.request.get("/api/scenarios/health");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(12);
    expect(Array.isArray(data.scenarios)).toBe(true);
    expect(data.scenarios).toHaveLength(12);
    for (const s of data.scenarios as { id: string; componentCount: number }[]) {
      expect(s.componentCount, `${s.id} 元件數`).toBeGreaterThanOrEqual(3);
    }
  });

  test("/template-market 顯示 12 張情境卡、無崩潰", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/template-market");
    await page.waitForLoadState("networkidle");
    const cards = page.locator('[data-testid^="card-scenario-"]');
    await expect(cards).toHaveCount(12);
    expect(criticalOnly(errors)).toHaveLength(0);
  });

  test("情境詳情頁可載入並列出元件", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/template-market/wedding");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("text-scenario-name")).toBeVisible();
    const comps = page.locator('[data-testid^="component-"]');
    expect(await comps.count()).toBeGreaterThanOrEqual(3);
    expect(criticalOnly(errors)).toHaveLength(0);
  });

  test("玩家路由 /play 可達不崩潰", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(1500);
    expect(criticalOnly(errors)).toHaveLength(0);
  });

  test("玩家路由 /g 可達不崩潰（GamePageRenderer）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/g/smoke-test-slug");
    await page.waitForTimeout(1500);
    expect(criticalOnly(errors)).toHaveLength(0);
  });

  test("Mobile viewport (375×667) template-market 正常", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/template-market");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid^="card-scenario-"]').first()).toBeVisible();
    expect(criticalOnly(errors)).toHaveLength(0);
  });
});
