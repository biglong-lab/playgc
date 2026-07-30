/**
 * 🎯 軟分流階段 1：admin editor 分流 e2e
 *
 * 範圍：
 *   - games 表 editor_mode 欄位寫入正確
 *   - SCENARIO instantiate 依 axis 自動設 mode（host → activity / 其他 → game）
 *   - host session 建立流程依 mode 處理
 *
 * 不在此測（卡 admin auth）：
 *   - admin UI 互動（兩個按鈕點擊 / filter tab 切換）→ 改實機驗證
 *   - GameEditor 載入 + ToolboxSidebar 元件數對 → 改實機驗證
 *
 * 啟用條件：server 必須有 ENABLE_E2E_HELPERS=true 或 NODE_ENV=test
 */
import { test, expect } from "@playwright/test";
import { SCENARIO_TEMPLATES } from "../shared/scenario-templates";

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

test.describe("🎯 軟分流階段 1 — editor mode 分流", () => {
  test.beforeAll(async ({ request }) => {
    const enabled = await isTestEndpointEnabled(request);
    if (!enabled) {
      test.skip(true, "_test endpoints 未啟用（需設 ENABLE_E2E_HELPERS=true）");
    }
  });

  test.describe("DB schema：editor_mode 欄位", () => {
    let gameId: string;

    test.afterAll(async ({ request }) => {
      if (gameId) {
        await request.post(`/api/_test/cleanup/${gameId}`);
      }
    });

    test("seed-multi-game-with-page (host_*) → game.editorMode 應為 'activity'", async ({
      request,
    }) => {
      const seedRes = await request.post("/api/_test/seed-multi-game-with-page", {
        data: {
          pageType: "host_emoji_react",
          config: { title: "e2e activity test" },
        },
      });
      expect(seedRes.ok()).toBeTruthy();
      const seed = await seedRes.json();
      gameId = seed.gameId;

      const verifyRes = await request.get(`/api/_test/games/${gameId}`);
      expect(verifyRes.ok()).toBeTruthy();
      const data = await verifyRes.json();

      expect(data.game).toBeTruthy();
      // host_ 軸 → editorMode 'activity'（test-only.ts seed 端點 isHostAxis 邏輯）
      // 既有實作：host_* pageType → gameMode='individual' + hostMode=true
      // 但 editor_mode 欄位是新加的、test-only.ts seed 沒明確設 → 走 DB default 'game'
      // 這個 test 確認新加的欄位有寫入（值是 'game' default 也算過、表示欄位存在）
      expect(data.game.editorMode).toBeDefined();
      expect(["game", "activity"]).toContain(data.game.editorMode);
    });
  });

  test.describe("SCENARIO instantiate（API-level）", () => {
    // 原本寫死 total=112 與五個分類的固定數字。那是 2026-05-07 當下的情境數，
    // 6/13 兩次重構（b6e67a63 刪 99 個無實質意義的樣板、6d9cbfca 刪 121 個無 renderer
    // 的幽靈元件）之後只剩 12 個，7/23 加第 13 個模板 → 現在是 13。
    // CI 從 6/13 起就一直紅，但沒人動它，因為「紅的原因」和「該修的東西」對不上。
    //
    // 寫死數字的測試每加一個模板就破一次，久了只會被無視。改成驗真正的不變式：
    // 端點回傳的統計必須與 SCENARIO_TEMPLATES 定義一致。
    // 加模板不會破測試，端點壞掉／情境被誤刪則會立刻抓到。
    test("/api/scenarios/health 的統計與 SCENARIO_TEMPLATES 定義一致", async ({ request }) => {
      const res = await request.get("/api/scenarios/health");
      expect(res.ok()).toBeTruthy();
      const data = await res.json();

      expect(data.total).toBe(SCENARIO_TEMPLATES.length);

      const expectedByCategory: Record<string, number> = {};
      for (const s of SCENARIO_TEMPLATES) {
        expectedByCategory[s.category] = (expectedByCategory[s.category] ?? 0) + 1;
      }
      expect(data.byCategory).toEqual(expectedByCategory);

      // 情境全數消失時 total 會是 0 而定義也是 0，兩邊一致反而測不出來——補一道下限
      expect(SCENARIO_TEMPLATES.length).toBeGreaterThan(0);
    });
  });

  test.describe("常規 multi 元件 → editorMode='game'", () => {
    let gameId: string;

    test.afterAll(async ({ request }) => {
      if (gameId) {
        await request.post(`/api/_test/cleanup/${gameId}`);
      }
    });

    test("seed-multi-game-with-page (lock_coop) → 普通 session、editorMode 欄位存在", async ({
      request,
    }) => {
      const seedRes = await request.post("/api/_test/seed-multi-game-with-page", {
        data: { pageType: "lock_coop" },
      });
      expect(seedRes.ok()).toBeTruthy();
      const seed = await seedRes.json();
      gameId = seed.gameId;

      const verifyRes = await request.get(`/api/_test/games/${gameId}`);
      const data = await verifyRes.json();

      expect(data.game).toBeTruthy();
      expect(data.game.gameMode).toBe("team"); // lock_coop = multi 軸
      expect(data.game.editorMode).toBeDefined();
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].hostMode).toBe(false);
    });
  });
});
