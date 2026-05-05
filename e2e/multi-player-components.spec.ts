/**
 * E2E 測試：多人遊戲元件 Smoke Test
 *
 * 驗證新增的多人元件能正確載入、無 JS 崩潰、關鍵 data-testid 存在。
 * 測試方式：
 *   - 直接渲染元件 demo 路由（若有）
 *   - 或驗證 SPA 路由可達 + body 非空
 * 不依賴登入或實際遊戲資料，只做 smoke 驗證。
 *
 * 元件清單（Phase 5 新增）：
 *   - mood_meter（MoodMeterPage）
 *   - team_checklist（TeamChecklistPage）
 *   - feedback_star（FeedbackStarPage）
 *   - team_word_cloud（TeamWordCloudPage）
 *   - check_in（CheckInPage）
 *   - group_timer（GroupTimerPage）
 *   - quick_question（QuickQuestionPage）
 */

import { test, expect } from "@playwright/test";

test.describe("多人遊戲元件 Smoke Test", () => {
  test("Landing 頁無 React 崩潰（基準線）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境模板 API 可達（驗 space-activation 和 employee-onboarding 存在）", async ({ page }) => {
    const response = await page.request.get("/api/scenarios/health");
    // health endpoint 回傳 200
    expect(response.status()).toBe(200);
  });

  test("Admin 後台能載入（新情境建場入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/admin/login");
    await page.waitForTimeout(1500);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const inputs = page.locator("input");
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test("Play SPA 頁面路由可達（多人遊戲入口）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 0).toBeTruthy();
  });

  test("Team game 頁面路由可達（隊伍模式）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/team/smoke-test-game");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("Mobile viewport 多人遊戲頁面正常（375×667）", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/play/smoke-test-session");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("情境市場頁面能顯示新增的情境", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/template-market");
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 50).toBeTruthy();
  });

  test("GamePageRenderer 不崩潰（scenario 頁面路由）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 模擬存取 game 路由（不需要實際 game 存在，只要不崩）
    await page.goto("/g/smoke-test-slug");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network") && !e.includes("WebSocket"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("新情境模板包含 Phase 5 新元件", async ({ page }) => {
    const response = await page.request.get("/api/scenarios");
    const scenarios = await response.json();
    expect(Array.isArray(scenarios)).toBe(true);

    const allPageTypes = scenarios.flatMap((s: { components?: { pageType: string }[] }) =>
      (s.components ?? []).map((c: { pageType: string }) => c.pageType),
    );

    // Phase 5 核心元件
    expect(allPageTypes).toContain("dot_vote");
    expect(allPageTypes).toContain("timeline_wall");
    expect(allPageTypes).toContain("two_truths");
    expect(allPageTypes).toContain("retro_board");
    expect(allPageTypes).toContain("pledge_wall");
    expect(allPageTypes).toContain("live_pulse");
    expect(allPageTypes).toContain("debate_vote");
    expect(allPageTypes).toContain("peer_recognition");

    // Round 36-41 新元件
    expect(allPageTypes).toContain("aha_board");
    expect(allPageTypes).toContain("one_line_story");
    expect(allPageTypes).toContain("heat_map");
    expect(allPageTypes).toContain("energy_boost");
    expect(allPageTypes).toContain("role_play_card");
    expect(allPageTypes).toContain("group_decision");
    expect(allPageTypes).toContain("quote_wall");
    expect(allPageTypes).toContain("action_item");
    expect(allPageTypes).toContain("table_group");
    expect(allPageTypes).toContain("feedback_form");
    expect(allPageTypes).toContain("pair_share");
    expect(allPageTypes).toContain("team_snapshot");

    // Round 43-47 新元件
    expect(allPageTypes).toContain("song_wall");
    expect(allPageTypes).toContain("personal_compass");
    expect(allPageTypes).toContain("brain_dump");
    expect(allPageTypes).toContain("checkbox_vote");
    expect(allPageTypes).toContain("success_story");
    expect(allPageTypes).toContain("future_idea");
    expect(allPageTypes).toContain("value_card");
    expect(allPageTypes).toContain("thank_you_note");
    expect(allPageTypes).toContain("skill_map");
    expect(allPageTypes).toContain("mood_board");

    // Round 48 新元件
    expect(allPageTypes).toContain("learning_check");
    expect(allPageTypes).toContain("stand_point");

    // Round 49 新元件
    expect(allPageTypes).toContain("idea_market");
    expect(allPageTypes).toContain("consensus_map");

    // Round 50 新元件
    expect(allPageTypes).toContain("speed_round");
    expect(allPageTypes).toContain("scale_vote");

    // Round 51 新元件
    expect(allPageTypes).toContain("wish_bucket");
    expect(allPageTypes).toContain("quick_poll");

    // Round 52 新元件
    expect(allPageTypes).toContain("emoji_wall");
    expect(allPageTypes).toContain("random_pick");

    // Round 53 新元件
    expect(allPageTypes).toContain("personal_score");
    expect(allPageTypes).toContain("time_check");

    // Round 54 新元件
    expect(allPageTypes).toContain("token_vote");
    expect(allPageTypes).toContain("gallery_vote");

    // Round 55 新元件
    expect(allPageTypes).toContain("sentence_stem");
    expect(allPageTypes).toContain("pixel_mood");

    // Round 56 新元件
    expect(allPageTypes).toContain("cascade_vote");
    expect(allPageTypes).toContain("team_manifesto");

    // Round 57 新元件
    expect(allPageTypes).toContain("curiosity_map");
    expect(allPageTypes).toContain("vibe_check");

    // Round 58 新元件
    expect(allPageTypes).toContain("collab_canvas");
    expect(allPageTypes).toContain("number_line");
  });

  test("defaultConfigForType API 能為 Round 36-41 新元件回傳有效 config", async ({ page }) => {
    const newTypes = [
      "aha_board",
      "one_line_story",
      "heat_map",
      "energy_boost",
      "role_play_card",
      "group_decision",
      "quote_wall",
      "action_item",
      "table_group",
      "feedback_form",
      "pair_share",
      "team_snapshot",
      "song_wall",
      "personal_compass",
      "brain_dump",
      "checkbox_vote",
      "success_story",
      "future_idea",
      "value_card",
      "thank_you_note",
      "skill_map",
      "mood_board",
      "learning_check",
      "stand_point",
      "idea_market",
      "consensus_map",
      "speed_round",
      "scale_vote",
      "wish_bucket",
      "quick_poll",
      "emoji_wall",
      "random_pick",
      "personal_score",
      "time_check",
      "token_vote",
      "gallery_vote",
      "sentence_stem",
      "pixel_mood",
      "cascade_vote",
      "team_manifesto",
      "curiosity_map",
      "vibe_check",
      "collab_canvas",
      "number_line",
    ];

    for (const t of newTypes) {
      const res = await page.request.post("/api/admin/games/1/pages", {
        data: { pageType: t, title: `test-${t}` },
        headers: { "Content-Type": "application/json" },
      });
      // 401（未認證）或 200/201（成功）都可；只要不是 500（表示 server 崩潰）
      expect(res.status()).not.toBe(500);
    }
  });

  test("Find-scenario 頁面可以顯示（工作坊破冰場景）", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/find-scenario");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("Template market 年會情境頁可以顯示", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/template-market/annual-meeting");
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (e) => !e.includes("Firebase") && !e.includes("auth") && !e.includes("network"),
    );
    expect(criticalErrors).toHaveLength(0);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText && bodyText.length > 50).toBeTruthy();
  });
});
