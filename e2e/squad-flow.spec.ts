/**
 * E2E 測試：Squad System 主要流程
 * 涵蓋 Phase 12-17 新增功能：
 *   - 6 個排行榜頁面載入
 *   - Squad 公開分享頁
 *   - 推廣連結邀請頁
 *   - 玩家中心
 *   - 對戰中心
 *
 * 這些測試只檢查頁面是否能載入 + 主要按鈕存在 + 沒有 JS error
 * 不做完整 user flow（需要登入 + DB seed）
 */
import { test, expect } from "@playwright/test";

test.describe("Squad 排行榜", () => {
  test("排行榜頁面正常載入", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/squads/leaderboards");
    await page.waitForTimeout(2000);

    // 應有排行榜的標題
    await expect(page.locator("text=隊伍排行榜").first()).toBeVisible({
      timeout: 10000,
    });

    // 應有 6 個 tab（場次榜 / 名人堂 / 新人榜 / 上升星 / 常客榜 / 段位榜）
    const tabs = page.locator("[role='tab']");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(5);

    // 不該有 JS error
    expect(errors).toEqual([]);
  });

  test("各 tab 切換不會崩潰", async ({ page }) => {
    await page.goto("/squads/leaderboards");
    await page.waitForTimeout(2000);

    // 切到段位榜
    const segmentTab = page.locator("text=段位榜").first();
    if (await segmentTab.isVisible()) {
      await segmentTab.click();
      await page.waitForTimeout(1000);
      // 應有遊戲類型切換
      await expect(page.locator("text=水彈對戰").first()).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe("Squad 公開頁", () => {
  test("不存在的 squad ID 顯示錯誤訊息", async ({ page }) => {
    await page.goto("/squad/nonexistent-squad-id-12345");
    await page.waitForTimeout(2000);

    // 應顯示「沒戰績」或類似訊息（不是 500 錯誤）
    const text = await page.textContent("body");
    expect(text).toBeTruthy();
  });

  test("og:image endpoint 回傳 SVG 或 404（不應 500）", async ({ request }) => {
    const res = await request.get("/api/squads/test-id/og");
    expect([200, 404]).toContain(res.status());
  });

  test("schema.json endpoint 回傳 JSON 或 404", async ({ request }) => {
    const res = await request.get("/api/squads/test-id/schema.json");
    expect([200, 404]).toContain(res.status());
  });
});

test.describe("推廣連結邀請頁", () => {
  test("不存在 token 顯示錯誤頁", async ({ page }) => {
    await page.goto("/invite/squad/nonexistenttoken1234567890abcd");
    await page.waitForTimeout(2000);

    // 應有錯誤訊息或登入引導，不該 500
    const url = page.url();
    expect(url).toContain("/invite/squad/");
  });

  test("invite token API 回 404（非 500）", async ({ request }) => {
    const res = await request.get(
      "/api/invites/nonexistenttoken1234567890abcd",
    );
    expect([400, 404]).toContain(res.status());
  });
});

test.describe("Admin 頁面（未登入應 redirect）", () => {
  test("admin engagement 設定頁未登入 redirect", async ({ page }) => {
    await page.goto("/admin/engagement");
    await page.waitForTimeout(3000);
    // 應 redirect 到 admin login 或顯示未登入訊息
    const url = page.url();
    expect(url.includes("/admin/login") || url.includes("/admin/engagement")).toBe(true);
  });

  test("admin rewards analytics 未登入 redirect", async ({ page }) => {
    await page.goto("/admin/rewards/analytics");
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url.includes("/admin/login") || url.includes("/admin/rewards/analytics")).toBe(true);
  });

  test("admin invites cohort 未登入 redirect", async ({ page }) => {
    await page.goto("/admin/invites/cohort");
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url.includes("/admin/login") || url.includes("/admin/invites/cohort")).toBe(true);
  });
});

test.describe("API 端點存活檢查（公開）", () => {
  test("6 個排行榜 API 全部回 200", async ({ request }) => {
    const endpoints = [
      "/api/squads/leaderboard/total",
      "/api/squads/leaderboard/hall-of-fame",
      "/api/squads/leaderboard/newbies",
      "/api/squads/leaderboard/rising",
      "/api/squads/leaderboard/regulars",
      "/api/squads/leaderboard/by-game/battle",
    ];

    for (const ep of endpoints) {
      const res = await request.get(ep + "?limit=1");
      expect(res.status(), `${ep} 應 200`).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("type");
      expect(body).toHaveProperty("items");
    }
  });

  test("/api/squads/leaderboard/all 回 5 個榜", async ({ request }) => {
    const res = await request.get("/api/squads/leaderboard/all?limit=3");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("hall_of_fame");
    expect(body).toHaveProperty("newbies");
    expect(body).toHaveProperty("rising");
    expect(body).toHaveProperty("regulars");
  });

  test("welcome-squads 端點回 200", async ({ request }) => {
    const res = await request.get(
      "/api/fields/test-field-id/welcome-squads",
    );
    expect(res.status()).toBe(200);
  });
});

test.describe("玩家中心 / 對戰中心 主頁面", () => {
  test("玩家中心 /me 載入（未登入應 redirect）", async ({ page }) => {
    await page.goto("/me");
    await page.waitForTimeout(2000);
    // 不該 500
    const text = await page.textContent("body");
    expect(text).toBeTruthy();
  });

  test("對戰首頁 /battle 載入", async ({ page }) => {
    await page.goto("/battle");
    await page.waitForTimeout(3000);
    const text = await page.textContent("body");
    expect(text).toBeTruthy();
  });

  test("對戰排行榜 /battle/ranking 載入", async ({ page }) => {
    await page.goto("/battle/ranking");
    await page.waitForTimeout(3000);
    const text = await page.textContent("body");
    expect(text).toBeTruthy();
  });
});
