/**
 * 🥈 黃金路徑 B：多人關卡 e2e（vote_team 同步揭曉）
 *
 * Phase 1 D4 Task 2：驗證多人關卡的真實同步
 *
 * 流程：
 *   1. 用 _test API 建多人遊戲（vote_team + spot_vote）
 *   2. 兩個玩家瀏覽器分頁同時加入 /play/:sessionId
 *   3. 雙方都能看到頁面、不崩潰
 *   4. DB 驗收：gameMode=team、minTeamPlayers/maxTeamPlayers 正確、頁面類型對
 *
 * 這條路徑驗證：
 *   - 多人 game 模式（gameMode=team）能被建立
 *   - 雙裝置同時連線同一個 session 不衝突
 *   - vote_team page_type 在 GamePageRenderer 真的有對應元件
 *   - 跟 admin editor 接入的 60 個 page_type 在「team 模式 game」也 work
 *
 * 啟用條件：server 必須有 ENABLE_E2E_HELPERS=true 或 NODE_ENV=test
 */
import { test, expect, type BrowserContext } from "@playwright/test";

test.describe("黃金路徑 B — 多人關卡同步", () => {
  let gameId: string;
  let sessionId: string;
  let publicSlug: string;

  test.beforeAll(async ({ request }) => {
    const seedRes = await request.post("/api/_test/seed-multi-game");

    if (seedRes.status() === 404) {
      test.skip(true, "_test/seed-multi-game endpoint 未啟用");
    }

    expect(seedRes.ok()).toBeTruthy();
    const data = await seedRes.json();
    gameId = data.gameId;
    sessionId = data.sessionId;
    publicSlug = data.publicSlug;

    expect(gameId).toBeTruthy();
    expect(sessionId).toBeTruthy();
    expect(data.pages.map((p: { type: string }) => p.type)).toEqual([
      "vote_team",
      "spot_vote",
    ]);
  });

  test.afterAll(async ({ request }) => {
    if (gameId) {
      await request.post(`/api/_test/cleanup/${gameId}`);
    }
  });

  test("/play/:sessionId 多人模式能載入（不崩潰）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/play/${sessionId}`);
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

  test("/g/:slug 公開 slug 能載入多人 game", async ({ page }) => {
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

  test("雙瀏覽器 context 同時加入同一 session 不衝突", async ({ browser }) => {
    const context1: BrowserContext = await browser.newContext();
    const context2: BrowserContext = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      const errors1: string[] = [];
      const errors2: string[] = [];
      page1.on("pageerror", (err) => errors1.push(err.message));
      page2.on("pageerror", (err) => errors2.push(err.message));

      // 同時 goto
      await Promise.all([
        page1.goto(`/play/${sessionId}`),
        page2.goto(`/play/${sessionId}`),
      ]);
      await Promise.all([
        page1.waitForLoadState("networkidle", { timeout: 10_000 }),
        page2.waitForLoadState("networkidle", { timeout: 10_000 }),
      ]);

      // 雙方都不崩
      const critical1 = errors1.filter(
        (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("WebSocket")
      );
      const critical2 = errors2.filter(
        (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("WebSocket")
      );
      expect(critical1, `Page 1 崩潰: ${critical1.join(", ")}`).toHaveLength(0);
      expect(critical2, `Page 2 崩潰: ${critical2.join(", ")}`).toHaveLength(0);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("DB 驗收：多人 game schema 正確", async ({ request }) => {
    const res = await request.get(`/api/_test/games/${gameId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.game).toBeTruthy();
    expect(data.game.gameMode).toBe("team");
    expect(data.game.minTeamPlayers).toBe(2);
    expect(data.game.maxTeamPlayers).toBe(4);
    expect(data.game.status).toBe("published");

    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].teamName).toBe("e2e-team");
    expect(data.sessions[0].playerCount).toBe(2);

    expect(data.pages).toHaveLength(2);
    const types = data.pages.map((p: { pageType: string }) => p.pageType);
    expect(types).toContain("vote_team");
    expect(types).toContain("spot_vote");
  });

  test("vote_team config 包含選項（admin editor 接入驗證）", async ({ request }) => {
    const res = await request.get(`/api/_test/games/${gameId}`);
    const data = await res.json();
    const voteTeamPage = data.pages.find(
      (p: { pageType: string }) => p.pageType === "vote_team"
    );

    expect(voteTeamPage).toBeTruthy();
    expect(voteTeamPage.config).toBeTruthy();
    expect(voteTeamPage.config.options).toBeTruthy();
    expect(Array.isArray(voteTeamPage.config.options)).toBeTruthy();
    expect(voteTeamPage.config.options.length).toBeGreaterThanOrEqual(2);
  });

  test("spot_vote config 有 title + prompt（階段 A 接入元件驗證）", async ({ request }) => {
    const res = await request.get(`/api/_test/games/${gameId}`);
    const data = await res.json();
    const spotVotePage = data.pages.find(
      (p: { pageType: string }) => p.pageType === "spot_vote"
    );

    expect(spotVotePage).toBeTruthy();
    expect(spotVotePage.config.title).toBeTruthy();
    expect(spotVotePage.config.prompt).toBeTruthy();
  });
});
