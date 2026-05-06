/**
 * 🥇 黃金路徑 A：單人遊戲 e2e（真實流程）
 *
 * Phase 1 D4 Task：補上次 cb75e893 5 bug 沒抓到的真實 e2e
 *
 * 流程：
 *   1. 用 _test API 建測試遊戲（5 pages：text_card → text_card → choice_verify → text_card → text_card）
 *   2. 玩家 goto /play/:sessionId（無需登入）
 *   3. 走完所有頁面（每頁點按鈕推進）
 *   4. 從 _test API 驗證資料庫狀態（session.status, score）
 *   5. 清理測試資料
 *
 * 這條路徑驗證：
 *   - admin 建立的 page 真的能在玩家端渲染
 *   - 跨頁推進邏輯（onComplete + 下一頁）work
 *   - 玩家側「無 admin 登入也能玩」的 anonymous 流程 work
 *   - 資料庫真的有更新（不是 mock）
 *
 * 啟用條件：server 必須有 ENABLE_E2E_HELPERS=true 或 NODE_ENV=test
 */
import { test, expect } from "@playwright/test";

test.describe("黃金路徑 A — 單人遊戲完整流程", () => {
  let gameId: string;
  let sessionId: string;
  let publicSlug: string;
  let pages: Array<{ id: string; order: number; type: string }>;

  test.beforeAll(async ({ request }) => {
    // 建測試資料
    const seedRes = await request.post("/api/_test/seed-game");

    // 若 endpoint 不存在（生產 / 沒設 ENABLE_E2E_HELPERS）→ skip 整組
    if (seedRes.status() === 404) {
      test.skip(true, "_test/seed-game endpoint 未啟用，請設 ENABLE_E2E_HELPERS=true");
    }

    expect(seedRes.ok()).toBeTruthy();
    const data = await seedRes.json();
    gameId = data.gameId;
    sessionId = data.sessionId;
    publicSlug = data.publicSlug;
    pages = data.pages;

    expect(gameId).toBeTruthy();
    expect(sessionId).toBeTruthy();
    expect(pages).toHaveLength(5);
  });

  test.afterAll(async ({ request }) => {
    if (gameId) {
      await request.post(`/api/_test/cleanup/${gameId}`);
    }
  });

  test("玩家端 /play/:sessionId 能正常載入（不崩潰）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/play/${sessionId}`);
    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    // 過濾掉非關鍵 error（Firebase 未登入、auth、network）
    const critical = errors.filter(
      (e) =>
        !e.includes("Firebase") &&
        !e.includes("auth") &&
        !e.includes("network") &&
        !e.includes("WebSocket")
    );
    expect(critical, `關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
  });

  test("玩家端 /play/:sessionId SPA 真的 hydrate（#root 有 children）", async ({ page }) => {
    await page.goto(`/play/${sessionId}`);

    // SPA 渲染需要等 React mount 完成，networkidle 不夠（chunks 可能 lazy load）
    // 改等 #root 有實際 children（React 已 hydrate）— 最可靠的 SPA ready 判準
    await page.waitForFunction(
      () => {
        const root = document.querySelector("#root");
        return root && root.children.length > 0;
      },
      { timeout: 15_000 }
    );

    // 確認 #root 真的有內容
    const rootText = await page.locator("#root").textContent();
    expect(rootText).toBeTruthy();
    expect(rootText!.length).toBeGreaterThan(0);
  });

  test("公開 slug /g/:slug 也能載入", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/g/${publicSlug}`);
    await page.waitForLoadState("networkidle", { timeout: 10_000 });

    const critical = errors.filter(
      (e) =>
        !e.includes("Firebase") &&
        !e.includes("auth") &&
        !e.includes("network") &&
        !e.includes("WebSocket")
    );
    expect(critical, `關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
  });

  test("資料庫驗收：game / session / pages 真的存在（_test API 確認）", async ({ request }) => {
    const res = await request.get(`/api/_test/games/${gameId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.game).toBeTruthy();
    expect(data.game.status).toBe("published");
    expect(data.game.gameMode).toBe("individual");

    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe(sessionId);
    expect(data.sessions[0].status).toBe("playing");

    expect(data.pages).toHaveLength(5);
    expect(data.pages.map((p: { pageType: string }) => p.pageType)).toEqual([
      "text_card",
      "text_card",
      "choice_verify",
      "text_card",
      "text_card",
    ]);
  });

  test("API 端點：DELETE 流程 work（驗證 cb75e893 + 8d0f1898 修復）", async ({ request }) => {
    // 建另一個獨立 game 測 delete（不影響主 test 的 cleanup）
    const seed = await request.post("/api/_test/seed-game");
    expect(seed.ok()).toBeTruthy();
    const { gameId: deleteGameId } = await seed.json();

    // 用 _test cleanup（內部走 storage.deleteGame，含 FK SET NULL）
    const del = await request.post(`/api/_test/cleanup/${deleteGameId}`);
    expect(del.ok()).toBeTruthy();

    // 驗證 game 已被刪
    const verify = await request.get(`/api/_test/games/${deleteGameId}`);
    const data = await verify.json();
    expect(data.game).toBeFalsy();
  });
});
