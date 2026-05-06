/**
 * 🧪 A2 多人元件 L3 持久化 smoke e2e
 *
 * 範圍（按 ADR-0017）：
 *   - 對 9 個 L3 持久化元件分別建場
 *   - 驗 /play/:sessionId 載入不崩潰
 *   - DB 驗收：page 真有寫入 + pageType / config 正確
 *
 * 不在此測：
 *   - 真實玩家操作（卡 Firebase auth、改用實機驗證）
 *   - ws 即時同步（卡 auth + isTeamMember 檢查）
 *   - 重整後狀態還原（同上）
 *
 * 對應實機驗證：docs/runbooks/a2-l3-manual-verification.md
 *
 * 啟用條件：server 必須有 ENABLE_E2E_HELPERS=true 或 NODE_ENV=test
 */
import { test, expect } from "@playwright/test";

// 9 個 L3 持久化元件（2026-05-05 升級完成）
const L3_COMPONENTS = [
  // ws 即時同步 + DB 持久化（高風險）
  { pageType: "lock_coop", required: ["digits", "combination", "clues"] },
  { pageType: "relay_mission", required: ["segments"] },
  { pageType: "territory_capture", required: ["points"] },

  // DB 持久化（2026-05-05 L3 升級）
  { pageType: "collective_score", required: ["goal", "mode"] },
  { pageType: "role_assign", required: ["roles"] },
  { pageType: "quest_chain", required: ["quests"] },
  { pageType: "jigsaw_puzzle", required: ["pieces"] },
  { pageType: "treasure_hunt", required: ["clues"] },
  { pageType: "gps_cascade", required: ["checkpoints"] },
];

// 判斷 test-only endpoint 是否啟用（dev server 沒帶 ENABLE_E2E_HELPERS=true 時，
// Express SPA fallback 會把 /api/_test/* 當前端路由 → 回 200 + HTML，不是 404）
async function isTestEndpointEnabled(request: import("@playwright/test").APIRequestContext): Promise<boolean> {
  try {
    const probe = await request.post("/api/_test/seed-multi-game-with-page", {
      data: { pageType: "lock_coop" },
    });
    if (!probe.ok()) return false;
    const ctype = probe.headers()["content-type"] ?? "";
    if (!ctype.includes("application/json")) return false;
    const data = await probe.json();
    if (data.gameId) {
      // 清理 probe 建的資料
      await request.post(`/api/_test/cleanup/${data.gameId}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

test.describe("A2 多人元件 L3 持久化 smoke", () => {
  test.beforeAll(async ({ request }) => {
    const enabled = await isTestEndpointEnabled(request);
    if (!enabled) {
      test.skip(true, "_test endpoints 未啟用（需設 ENABLE_E2E_HELPERS=true）");
    }
  });

  for (const comp of L3_COMPONENTS) {
    test.describe(`${comp.pageType}`, () => {
      let gameId: string;
      let sessionId: string;
      let pageId: string;

      test.beforeAll(async ({ request }) => {
        const res = await request.post("/api/_test/seed-multi-game-with-page", {
          data: { pageType: comp.pageType },
        });
        // 若 endpoint 未啟用（HTML response），跳過此 describe
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

        // Firebase / WebSocket / auth / network error 不算關鍵（玩家未登入是預期）
        const critical = errors.filter(
          (e) =>
            !e.includes("Firebase") &&
            !e.includes("auth") &&
            !e.includes("network") &&
            !e.includes("WebSocket") &&
            !e.includes("login") &&
            !e.includes("permission")
        );
        expect(critical, `${comp.pageType} 關鍵 error: ${critical.join(", ")}`).toHaveLength(0);
      });

      test(`DB 驗收：page schema 正確`, async ({ request }) => {
        const res = await request.get(`/api/_test/games/${gameId}`);
        expect(res.ok()).toBeTruthy();
        const data = await res.json();

        expect(data.game).toBeTruthy();
        expect(data.game.gameMode).toBe("team");
        expect(data.game.status).toBe("published");

        expect(data.pages).toHaveLength(1);
        const p = data.pages[0];
        expect(p.pageType).toBe(comp.pageType);
        expect(p.config).toBeTruthy();

        // 驗 default config 必要欄位
        for (const field of comp.required) {
          expect(
            p.config[field],
            `${comp.pageType} config 缺欄位 ${field}`
          ).toBeDefined();
        }
      });
    });
  }
});
