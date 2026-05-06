/**
 * 📺 Host 軸線 17 個元件 smoke e2e（A2 補接 admin editor 後）
 *
 * 範圍：
 *   - 對 17 個 host 元件分別建場（pageType + 內建 default config）
 *   - 驗 /play/:sessionId 載入不崩潰
 *   - DB 驗收：page 真有寫入 + pageType 正確 + game 是 hostMode=true
 *
 * 不在此測：
 *   - admin editor UI 拖入體驗（卡 admin auth）→ 改實機驗證
 *   - HostScreen 大螢幕端互動（卡 hostToken 簽發）→ 改實機驗證
 *   - host_screen_pulse / state ws 廣播 → 改實機驗證
 *
 * 啟用條件：server 必須有 ENABLE_E2E_HELPERS=true 或 NODE_ENV=test
 */
import { test, expect } from "@playwright/test";

// 17 個 host 元件（檔案系統現況）
// default config 走 caller 提供（test-only seed 端點 fallback 邏輯）
const HOST_COMPONENTS: Array<{ pageType: string; minimalConfig: Record<string, unknown> }> = [
  {
    pageType: "host_poll_live",
    minimalConfig: {
      question: "e2e poll",
      options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
    },
  },
  { pageType: "host_emoji_react", minimalConfig: { title: "e2e emoji" } },
  { pageType: "host_wave_response", minimalConfig: { title: "e2e wave" } },
  { pageType: "host_crowd_gather", minimalConfig: { title: "e2e gather", targetCount: 5 } },
  { pageType: "host_trivia_showdown", minimalConfig: { title: "e2e trivia", questions: [] } },
  { pageType: "host_live_leaderboard", minimalConfig: { title: "e2e leaderboard" } },
  {
    pageType: "host_team_battle_score",
    minimalConfig: { title: "e2e battle", teams: [{ id: "a", name: "A", score: 0 }, { id: "b", name: "B", score: 0 }] },
  },
  { pageType: "host_progress_quest", minimalConfig: { title: "e2e quest", totalTasks: 10 } },
  { pageType: "host_polaroid_collage", minimalConfig: { title: "e2e polaroid" } },
  { pageType: "host_guestbook_digital", minimalConfig: { title: "e2e guestbook" } },
  { pageType: "host_blessing_wall", minimalConfig: { title: "e2e blessing" } },
  { pageType: "host_knowledge_map", minimalConfig: { title: "e2e map", points: [] } },
  { pageType: "host_scoreboard_announcement", minimalConfig: { title: "e2e announcement" } },
  { pageType: "host_lottery_wheel", minimalConfig: { title: "e2e lottery", items: [] } },
  {
    pageType: "host_bingo_board",
    minimalConfig: {
      title: "e2e bingo",
      tasks: Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, label: i === 12 ? "自由" : `任務${i}` })),
    },
  },
  { pageType: "host_blessing_wall", minimalConfig: { title: "e2e blessing 2" } }, // 重複避免、改下一個
  { pageType: "host_micro_qa", minimalConfig: { title: "e2e qa" } },
  { pageType: "host_word_cloud", minimalConfig: { title: "e2e word cloud", prompt: "輸入" } },
];

// 去重（同 pageType 只測一次）
const UNIQUE_COMPONENTS = Array.from(
  new Map(HOST_COMPONENTS.map((c) => [c.pageType, c])).values()
);

async function isTestEndpointEnabled(request: import("@playwright/test").APIRequestContext): Promise<boolean> {
  try {
    const probe = await request.post("/api/_test/seed-multi-game-with-page", {
      data: { pageType: "host_emoji_react", config: { title: "probe" } },
    });
    if (!probe.ok()) return false;
    const ctype = probe.headers()["content-type"] ?? "";
    if (!ctype.includes("application/json")) return false;
    const data = await probe.json();
    if (data.gameId) {
      await request.post(`/api/_test/cleanup/${data.gameId}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

test.describe("📺 Host 軸線元件 smoke", () => {
  test.beforeAll(async ({ request }) => {
    const enabled = await isTestEndpointEnabled(request);
    if (!enabled) {
      test.skip(true, "_test endpoints 未啟用（需設 ENABLE_E2E_HELPERS=true）");
    }
  });

  for (const comp of UNIQUE_COMPONENTS) {
    test.describe(`${comp.pageType}`, () => {
      let gameId: string;
      let sessionId: string;
      let pageId: string;

      test.beforeAll(async ({ request }) => {
        const res = await request.post("/api/_test/seed-multi-game-with-page", {
          data: { pageType: comp.pageType, config: comp.minimalConfig },
        });
        const ctype = res.headers()["content-type"] ?? "";
        if (!res.ok() || !ctype.includes("application/json")) {
          test.skip(true, `_test endpoint 未啟用，跳過 ${comp.pageType}`);
        }
        const data = await res.json();
        gameId = data.gameId;
        sessionId = data.sessionId;
        pageId = data.pageId;
        expect(gameId).toBeTruthy();
        expect(sessionId).toBeTruthy();
        expect(pageId).toBeTruthy();
      });

      test.afterAll(async ({ request }) => {
        if (gameId) {
          await request.post(`/api/_test/cleanup/${gameId}`);
        }
      });

      test(`/play/:sessionId 載入不崩潰`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(err.message));

        await page.goto(`/play/${sessionId}`);
        await page.waitForLoadState("networkidle", { timeout: 10_000 });

        const critical = errors.filter(
          (e) =>
            !e.includes("Firebase") &&
            !e.includes("auth") &&
            !e.includes("network") &&
            !e.includes("WebSocket") &&
            !e.includes("login") &&
            !e.includes("permission") &&
            !e.includes("token")
        );
        expect(critical, `${comp.pageType} 關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
      });

      test(`DB 驗收：game.gameMode=individual + session.hostMode=true + pageType 正確`, async ({ request }) => {
        const res = await request.get(`/api/_test/games/${gameId}`);
        expect(res.ok()).toBeTruthy();
        const data = await res.json();

        expect(data.game).toBeTruthy();
        expect(data.game.gameMode).toBe("individual"); // host 軸不走 team mode
        expect(data.game.status).toBe("published");

        expect(data.sessions).toHaveLength(1);
        expect(data.sessions[0].hostMode).toBe(true); // ADR-0004 HostScreen 模式

        expect(data.pages).toHaveLength(1);
        const p = data.pages[0];
        expect(p.pageType).toBe(comp.pageType);
        expect(p.config).toBeTruthy();
      });
    });
  }
});
