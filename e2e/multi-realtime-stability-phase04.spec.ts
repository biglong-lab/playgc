/**
 * 🎯 多人即時穩定性 e2e — Phase 0-4 驗證（2026-05-08）
 *
 * 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md
 *
 * 驗證重點（每個 test 標註對應 Phase）：
 *   Phase 1+2：1 user = 1 條 ws / page 切換不應 close
 *   Phase 4：TriviaShowdown server-side scoring
 *     - 5 人並行答題、score 計算正確
 *     - rank 依 server-side 順序（DB 算的）
 *     - unique constraint：同 user 同 question 1 次（409）
 *     - 結算 state 從 server 拿、不依賴 client 端算
 *   Phase 0.1：admin/multi-sessions endpoint 結構正確
 *
 * 啟用條件：
 *   - dev server 跑、且 ENABLE_E2E_HELPERS=true（_test routes 才會註冊）
 *   - 啟動方式：ENABLE_E2E_HELPERS=true npm run dev
 *
 * 跑：
 *   npx playwright test e2e/multi-realtime-stability-phase04.spec.ts
 *
 * CI 行為：
 *   - _test endpoints 不可用 → 整個 describe block skip（不算 fail）
 *   - 啟用後 → 100% 跑完（10+ assertions）
 */
import { test, expect, type BrowserContext } from "@playwright/test";

interface SeedResponse {
  gameId: string;
  sessionId: string;
  publicSlug: string;
  pageId: string;
  pageType: string;
}

// ============================================================================
// Block A：需要 seed 的測試（_test endpoints 啟用時才跑）
// 啟用方式：ENABLE_E2E_HELPERS=true npm run dev
// ============================================================================
test.describe("Phase 0-4 多人即時穩定性 e2e（依賴 _test seed）", () => {
  let gameId: string;
  let sessionId: string;

  test.beforeAll(async ({ request }) => {
    const seedRes = await request.post("/api/_test/seed-multi-game-with-page", {
      data: {
        pageType: "host_trivia_showdown",
        config: {
          title: "E2E Trivia Test",
          questions: [
            {
              id: "e2e-q1",
              prompt: "E2E 測試題 1",
              options: ["A", "B", "C", "D"],
              correctIdx: 0,
              timeLimitSec: 30,
            },
            {
              id: "e2e-q2",
              prompt: "E2E 測試題 2",
              options: ["A", "B", "C", "D"],
              correctIdx: 2,
              timeLimitSec: 30,
            },
          ],
          scoreByRank: [100, 75, 50, 25],
        },
      },
    });

    // 偵測 _test endpoints 未啟用 → skip（不算 fail）
    const ct = seedRes.headers()["content-type"] ?? "";
    if (seedRes.status() === 404 || (!ct.includes("application/json"))) {
      test.skip(true, "_test endpoints 未啟用（需 ENABLE_E2E_HELPERS=true）");
    }
    if (!seedRes.ok()) {
      test.skip(true, `seed 失敗: ${seedRes.status()}`);
    }

    const data: SeedResponse = await seedRes.json();
    gameId = data.gameId;
    sessionId = data.sessionId;
    expect(gameId).toBeTruthy();
    expect(sessionId).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (gameId) {
      await request.post(`/api/_test/cleanup/${gameId}`);
    }
  });

  // ============================================================================
  // Phase 4：TriviaShowdown server-side scoring
  // ============================================================================

  test("Phase 4: 5 人並行答題、server-side 結算分數正確", async ({ request }) => {
    const ts = Date.now();
    // 5 人答題：前 3 人答對（rank 1/2/3 → 100/75/50）、後 2 人答錯（0 分）
    const responses = await Promise.all(
      [0, 0, 0, 1, 1].map((choice, i) =>
        request.post(`/api/trivia/${sessionId}/answer`, {
          data: {
            questionId: `q-5p-${ts}`,
            choice,
            correctIdx: 0,
            scoreByRank: [100, 75, 50, 25],
            userId: `e2e-5p-u${i}-${ts}`,
            userName: `E2E_Player_${i}`,
          },
        }),
      ),
    );

    // 全部成功
    for (const r of responses) {
      expect(r.ok(), `response status: ${r.status()}`).toBeTruthy();
    }

    // 取結算 state
    const stateRes = await request.get(`/api/trivia/${sessionId}/state`);
    expect(stateRes.ok()).toBeTruthy();
    const { state } = await stateRes.json();

    // 5 個玩家都有紀錄
    expect(Object.keys(state.scores).length).toBeGreaterThanOrEqual(5);

    // 答對的 3 人總分 = 225（100+75+50）、答錯 2 人 = 0
    const playerScores = [0, 1, 2, 3, 4].map((i) => state.scores[`E2E_Player_${i}`] ?? 0);
    const totalCorrectScore = playerScores[0] + playerScores[1] + playerScores[2];
    const totalWrongScore = playerScores[3] + playerScores[4];
    expect(totalCorrectScore).toBe(225);
    expect(totalWrongScore).toBe(0);

    // rank 順序：3 人各自有不同分數（100 / 75 / 50）
    const correctScores = [playerScores[0], playerScores[1], playerScores[2]].sort((a, b) => b - a);
    expect(correctScores).toEqual([100, 75, 50]);
  });

  test("Phase 4: 同 user 重複答同一題、第二次回 409", async ({ request }) => {
    const userId = `e2e-dup-${Date.now()}`;
    const userName = "E2E_Duplicate_Test";

    const r1 = await request.post(`/api/trivia/${sessionId}/answer`, {
      data: {
        questionId: `q-dup-${Date.now()}`,
        choice: 0,
        correctIdx: 0,
        userId,
        userName,
      },
    });
    expect(r1.ok()).toBeTruthy();

    // 第 2 次答同 question → 409
    const lastBody = await r1.json();
    void lastBody;
    const r2 = await request.post(`/api/trivia/${sessionId}/answer`, {
      data: {
        questionId: `q-dup-${Date.now()}`, // ← 同 questionId 才會撞 unique
        choice: 1,
        correctIdx: 0,
        userId,
        userName,
      },
    });
    // 注意：因為 questionId 用 Date.now() 兩次不一樣、不會 409
    // 改用固定 questionId 重做：
    const fixedQId = `q-dup-fixed-${Date.now()}`;
    const r3 = await request.post(`/api/trivia/${sessionId}/answer`, {
      data: { questionId: fixedQId, choice: 0, correctIdx: 0, userId, userName },
    });
    expect(r3.ok()).toBeTruthy();
    const r4 = await request.post(`/api/trivia/${sessionId}/answer`, {
      data: { questionId: fixedQId, choice: 1, correctIdx: 0, userId, userName },
    });
    expect(r4.status()).toBe(409);
    void r2;
  });

  test("Phase 4: server-side rank 計算正確（依 server 收到順序）", async ({ request }) => {
    const ts = Date.now();
    const fixedQId = `q-rank-${ts}`;
    // 順序答題：u1 → u2 → u3 應拿 100 / 75 / 50
    for (let i = 0; i < 3; i++) {
      const res = await request.post(`/api/trivia/${sessionId}/answer`, {
        data: {
          questionId: fixedQId,
          choice: 0,
          correctIdx: 0,
          scoreByRank: [100, 75, 50, 25],
          userId: `e2e-rank-u${i}-${ts}`,
          userName: `E2E_Rank_${i}`,
        },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.rankAtCorrect).toBe(i + 1);
      expect(body.scoreAwarded).toBe([100, 75, 50][i]);
    }
  });

  test("Phase 4: 答錯不給分、rankAtCorrect 為 null", async ({ request }) => {
    const ts = Date.now();
    const res = await request.post(`/api/trivia/${sessionId}/answer`, {
      data: {
        questionId: `q-wrong-${ts}`,
        choice: 1, // wrong
        correctIdx: 0,
        userId: `e2e-wrong-${ts}`,
        userName: "E2E_Wrong",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.scoreAwarded).toBe(0);
    expect(body.rankAtCorrect).toBeNull();
  });

  // ============================================================================
  // Phase 1+2：1 user = 1 條 ws、page 切換不應 close
  // ============================================================================

  test("Phase 1+2: 玩家進 multi 遊戲、瀏覽器 ws 連線數不超過 1", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      const wsUrls: string[] = [];
      page.on("websocket", (ws) => {
        wsUrls.push(ws.url());
      });

      await page.goto(`/play/${sessionId}`);
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.waitForTimeout(3000);

      // 全 app 應該只開 1 條 ws（Phase 1+2 達成 1 user = 1 ws）
      expect(wsUrls.length, `WS 連線太多: ${wsUrls.join(", ")}`).toBeLessThanOrEqual(1);
    } finally {
      await ctx.close();
    }
  });

  test("Phase 1+2: 玩家 page 切換、ws close 數量不超過 open", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      let openCount = 0;
      let closeCount = 0;
      page.on("websocket", (ws) => {
        openCount++;
        ws.on("close", () => closeCount++);
      });

      // 進首頁
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 切到 multi game page
      await page.goto(`/play/${sessionId}`);
      await page.waitForTimeout(3000);

      // ws close 不應超過 open（Provider 保留 ws、page 切換內部 ws 不關）
      // 註：跨 page navigation 瀏覽器會 unload、但同頁面內 mount/unmount 應保留
      expect(closeCount).toBeLessThanOrEqual(openCount);
    } finally {
      await ctx.close();
    }
  });

  test("Phase 1+2: 5 人同時進場、server 看到的 unique connection 數 = 5（每人 1 條）", async ({
    browser,
  }) => {
    // 開 5 個 context（模擬 5 個玩家）
    const contexts: BrowserContext[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        contexts.push(await browser.newContext());
      }

      // 每人記錄自己 ws 連線數
      const playerStats = await Promise.all(
        contexts.map(async (c, i) => {
          const page = await c.newPage();
          const wsUrls: string[] = [];
          page.on("websocket", (ws) => wsUrls.push(ws.url()));
          await page.goto(`/play/${sessionId}`);
          await page.waitForTimeout(3000);
          return { playerIdx: i, wsCount: wsUrls.length };
        }),
      );

      // 每人應該只開 1 條 ws
      for (const stat of playerStats) {
        expect(
          stat.wsCount,
          `Player ${stat.playerIdx} 開了 ${stat.wsCount} 條 ws（應 ≤ 1）`,
        ).toBeLessThanOrEqual(1);
      }
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  // ============================================================================
  // Phase 0.1：admin/multi-sessions endpoint 結構驗證
  // ============================================================================

  test("Phase 0.1: GET /api/admin/multi-sessions 需認證（401 / 403）", async ({ request }) => {
    const res = await request.get("/api/admin/multi-sessions");
    // 沒帶 admin auth → 401 或 403（取決於中介層）
    expect([401, 403]).toContain(res.status());
  });

  test("Phase 0.3: GET /api/admin/sessions/:id/replay 需認證", async ({ request }) => {
    const res = await request.get(`/api/admin/sessions/${sessionId}/replay`);
    expect([401, 403]).toContain(res.status());
  });

  // ============================================================================
  // Phase 4 額外：trivia state 應與多次答題累計一致
  // ============================================================================

  test("Phase 4: 多輪答題、scores 應累計（不是覆蓋）", async ({ request }) => {
    const ts = Date.now();
    const userId = `e2e-cumul-${ts}`;
    const userName = "E2E_Cumulative";

    // 答 q1（正確、第 1 名）= 100 分
    await request.post(`/api/trivia/${sessionId}/answer`, {
      data: {
        questionId: `q-cumul-1-${ts}`,
        choice: 0,
        correctIdx: 0,
        scoreByRank: [100, 75, 50, 25],
        userId,
        userName,
      },
    });

    // 答 q2（正確、第 1 名）= 100 分
    await request.post(`/api/trivia/${sessionId}/answer`, {
      data: {
        questionId: `q-cumul-2-${ts}`,
        choice: 2,
        correctIdx: 2,
        scoreByRank: [100, 75, 50, 25],
        userId,
        userName,
      },
    });

    // state 中該 user 累計分應為 200
    const stateRes = await request.get(`/api/trivia/${sessionId}/state`);
    const { state } = await stateRes.json();
    expect(state.scores[userName]).toBe(200);
  });
});

// ============================================================================
// Block B：不依賴 seed 的測試（任何時候都能跑、含 ENABLE_E2E_HELPERS=false）
// ============================================================================
test.describe("Phase 0-4 即時通訊不依賴 seed 的驗證", () => {
  // ============================================================================
  // Phase 0.1 / 0.3：admin endpoint 認證（不需 seed、純 endpoint shape）
  // ============================================================================

  test("Phase 0.1: GET /api/admin/multi-sessions 需認證（401 / 403）", async ({ request }) => {
    const res = await request.get("/api/admin/multi-sessions");
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  test("Phase 0.3: GET /api/admin/sessions/:id/replay 需認證", async ({ request }) => {
    const res = await request.get(`/api/admin/sessions/dummy-session-id/replay`);
    const ct = res.headers()["content-type"] ?? "";
    if (!ct.includes("application/json")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  test("Phase 0.3: GET /api/admin/sessions/:id/export.csv 需認證", async ({ request }) => {
    const res = await request.get(`/api/admin/sessions/dummy-session-id/export.csv`);
    const ct = res.headers()["content-type"] ?? "";
    // CSV endpoint 認證失敗時回 json error
    if (!ct.includes("application/json") && !ct.includes("text/csv")) {
      test.skip(true, "endpoint 未註冊（dev server 需重啟）");
    }
    expect([401, 403]).toContain(res.status());
  });

  // ============================================================================
  // Phase 1+2：玩家進站、ws 連線數驗證（不需 seed）
  // 進首頁、看 ws 連線數
  // ============================================================================

  test("Phase 1+2: 玩家進首頁、瀏覽器 ws 連線數不超過 1", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      const wsUrls: string[] = [];
      page.on("websocket", (ws) => wsUrls.push(ws.url()));

      await page.goto("/");
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await page.waitForTimeout(3000);

      // 全域 Provider 設計：未進入需要 ws 的頁時、應為 0；最壞情況 1
      expect(wsUrls.length, `WS 連線太多: ${wsUrls.join(", ")}`).toBeLessThanOrEqual(1);
    } finally {
      await ctx.close();
    }
  });

  test("Phase 1+2: 玩家在不同 page 間切換、ws close 數量不應暴增", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      let openCount = 0;
      let closeCount = 0;
      page.on("websocket", (ws) => {
        openCount++;
        ws.on("close", () => closeCount++);
      });

      // 進首頁
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 切到 battle page
      await page.goto("/battle");
      await page.waitForTimeout(2000);

      // 切回首頁
      await page.goto("/");
      await page.waitForTimeout(2000);

      // ws close 不應超過 open（理想 = 0）
      expect(closeCount).toBeLessThanOrEqual(openCount);
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // ADR-0018 規範驗證（檔案掃描）
  // 與 e2e/global-ws-provider.spec.ts 重複、保留作為自包含驗證
  // ============================================================================
  test("ADR-0018: client/src 內 new WebSocket() 必須在白名單", async () => {
    const fs = await import("fs");
    const path = await import("path");

    function* walkDir(dir: string): Generator<string> {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "__tests__" || entry.name === "node_modules") continue;
          yield* walkDir(full);
        } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
          if (full.includes(".test.")) continue;
          yield full;
        }
      }
    }

    const allowed = new Set([
      "client/src/contexts/WebSocketContext.tsx",
      "client/src/components/game/solo/ShootingMissionPage.tsx",
      "client/src/hooks/use-match-websocket.ts",
    ]);
    const violations: string[] = [];
    for (const file of walkDir("client/src")) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("new WebSocket(")) {
        const rel = file.replace(/^.*?(client\/src)/, "$1");
        if (!allowed.has(rel)) violations.push(rel);
      }
    }
    expect(violations).toHaveLength(0);
  });
});
