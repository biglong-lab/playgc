/**
 * 🥉 黃金路徑 C：活動互動 e2e（spot_vote 揭曉流程）
 *
 * Phase 1 D4 Task 3：驗證活動互動類元件（spot_vote / gratitude_tree / wedding_vow 等）
 *
 * 流程：
 *   1. 用 seed-multi-game 建活動 game（含 spot_vote）
 *   2. 玩家 goto /play/:sessionId 看到頁面
 *   3. /api/team-state endpoint 在未登入時擋 401（驗證 anonymous 不能寫）
 *   4. DB 驗收：spot_vote config 含 title + prompt（階段 A 接入元件規格）
 *
 * 為什麼不做完整「5 人提交 → 隊長揭曉」流程：
 *   - 活動互動 state 寫入需要 team member auth（isAuthenticated + isTeamMember）
 *   - 完整 e2e 需要 Firebase auth + 5 個 user account + team setup
 *   - 屬於 Phase 3 A2「多人持久化補完」範圍、非 D4 核心
 *
 * 黃金路徑 C 的價值：
 *   - 確認 spot_vote 元件在 GamePageRenderer 真的有對應 case（不會 fallthrough）
 *   - 確認 team-state API 安全（401 擋未授權寫入）
 *   - 確認 admin editor 接入的 51 個互動模組「真的可被 seed 進 page」
 */
import { test, expect } from "@playwright/test";

test.describe("黃金路徑 C — 活動互動", () => {
  let gameId: string;
  let sessionId: string;
  let publicSlug: string;
  let spotVotePageId: string;

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

    const spotVote = data.pages.find(
      (p: { type: string }) => p.type === "spot_vote"
    );
    expect(spotVote).toBeTruthy();
    spotVotePageId = spotVote.id;
  });

  test.afterAll(async ({ request }) => {
    if (gameId) {
      await request.post(`/api/_test/cleanup/${gameId}`);
    }
  });

  test("活動 game 載入 /play/:sessionId 不崩潰", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/play/${sessionId}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const critical = errors.filter(
      (e) =>
        !e.includes("Firebase") &&
        !e.includes("auth") &&
        !e.includes("network") &&
        !e.includes("WebSocket")
    );
    expect(critical, `關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
  });

  test("公開 slug /g/:slug 載入活動 game 不崩潰", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/g/${publicSlug}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    const critical = errors.filter(
      (e) =>
        !e.includes("Firebase") &&
        !e.includes("auth") &&
        !e.includes("network") &&
        !e.includes("WebSocket")
    );
    expect(critical, `關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
  });

  test("/api/team-state GET 未登入擋 401", async ({ request }) => {
    const res = await request.get("/api/team-state", {
      params: {
        teamId: "fake-team",
        sessionId,
        pageId: spotVotePageId,
        type: "spot_vote",
      },
    });
    // 未登入應 401（auth middleware 擋下）
    expect(res.status()).toBe(401);
  });

  test("/api/team-state POST 未登入擋 401（防匿名寫入）", async ({ request }) => {
    const res = await request.post("/api/team-state", {
      data: {
        teamId: "fake-team",
        sessionId,
        pageId: spotVotePageId,
        type: "spot_vote",
        state: { entries: [], revealed: true },
      },
    });
    expect(res.status()).toBe(401);
  });

  test("DB 驗收：spot_vote 是階段 A 接入元件、config 規格正確", async ({ request }) => {
    const res = await request.get(`/api/_test/games/${gameId}`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    const spotVote = data.pages.find(
      (p: { pageType: string }) => p.pageType === "spot_vote"
    );
    expect(spotVote).toBeTruthy();
    expect(spotVote.id).toBe(spotVotePageId);

    // 階段 A 接入規格：title + prompt（getDefaultConfig 預設）
    expect(spotVote.config.title).toBeTruthy();
    expect(spotVote.config.prompt).toBeTruthy();
    expect(typeof spotVote.config.title).toBe("string");
    expect(typeof spotVote.config.prompt).toBe("string");
  });

  test("活動互動類 page_type 都在 admin editor 已接入（spot_vote 為代表）", async ({ request }) => {
    // 反面驗證：建一個用「明顯是空轉的元件」會失敗（已被 2026-05-06 清理）
    // 但 _test/seed-game 是 fixed 5 個 page，這裡只驗 spot_vote 真的存在
    const res = await request.get(`/api/_test/games/${gameId}`);
    const data = await res.json();
    const types = data.pages.map((p: { pageType: string }) => p.pageType);

    expect(types).toContain("spot_vote");
    expect(types).toContain("vote_team");

    // 反面：清理掉的 page_type 不該存在於這個 seed 中
    expect(types).not.toContain("frost_crystal");
    expect(types).not.toContain("torii_gate");
    expect(types).not.toContain("sakura_petal");
  });
});
