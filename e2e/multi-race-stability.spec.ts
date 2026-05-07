/**
 * 🧪 多人遊戲穩定性 race condition e2e
 *
 * 範圍（Phase A 真實驗證）：
 *   - A1：team_lock_states 樂觀鎖（兩玩家同時寫 code、應一個 200 一個 409）
 *   - A2：useTeamGameState UPDATE 0 row 衝突回 409
 *   - A3：GpsTeamMission 持久化（重整還原 reachedUserIds）
 *
 * 為什麼重要：
 *   之前 72/72 e2e 全綠是「smoke 級」（只測 page 載入不崩）
 *   這個 spec 補「互動級」+「race condition」
 *   驗證 fork 報告的 R1 R2 R6 真的解了
 *
 * 啟用：ENABLE_E2E_HELPERS=true
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

interface SeedResult {
  gameId: string;
  sessionId: string;
  teamId: string;
  pageId: string;
  userIds: string[];
}

async function isTestEndpointEnabled(request: APIRequestContext): Promise<boolean> {
  try {
    const probe = await request.post("/api/_test/seed-team-with-members");
    if (!probe.ok()) return false;
    const ctype = probe.headers()["content-type"] ?? "";
    if (!ctype.includes("application/json")) return false;
    const data = await probe.json();
    if (data.gameId) {
      await request.post("/api/_test/cleanup-team", {
        data: { gameId: data.gameId, userIds: data.userIds },
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

test.describe("🧪 多人 race condition stability", () => {
  test.beforeAll(async ({ request }) => {
    const enabled = await isTestEndpointEnabled(request);
    if (!enabled) {
      test.skip(true, "_test endpoints 未啟用（需 ENABLE_E2E_HELPERS=true）");
    }
  });

  test.describe("A1: LockCoop 樂觀鎖 race", () => {
    let seed: SeedResult;

    test.beforeEach(async ({ request }) => {
      const res = await request.post("/api/_test/seed-team-with-members");
      expect(res.ok()).toBeTruthy();
      seed = await res.json();
    });

    test.afterEach(async ({ request }) => {
      if (seed?.gameId) {
        await request.post("/api/_test/cleanup-team", {
          data: { gameId: seed.gameId, userIds: seed.userIds },
        });
      }
    });

    test("第一次寫入：rowCount > 0、回 200 + state.version=2", async ({ request }) => {
      // 初始 state version=1（INSERT 後 default）
      const res = await request.post("/api/_test/lock-coop-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          action: "code",
          payload: { code: "12" },
          expectedVersion: 1,
        },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.state.shared_code).toBe("12");
      expect(data.state.version).toBe(2);
    });

    test("樂觀鎖衝突：兩玩家同時用 expectedVersion=1 寫、一個 200 一個 409", async ({
      request,
    }) => {
      // 玩家 A 跟玩家 B 都用 expectedVersion=1 並發寫
      const [resA, resB] = await Promise.all([
        request.post("/api/_test/lock-coop-update", {
          data: {
            teamId: seed.teamId,
            sessionId: seed.sessionId,
            pageId: seed.pageId,
            action: "code",
            payload: { code: "AA" },
            expectedVersion: 1,
          },
        }),
        request.post("/api/_test/lock-coop-update", {
          data: {
            teamId: seed.teamId,
            sessionId: seed.sessionId,
            pageId: seed.pageId,
            action: "code",
            payload: { code: "BB" },
            expectedVersion: 1,
          },
        }),
      ]);

      // 一個 200、一個 409（順序不保證）
      const statuses = [resA.status(), resB.status()].sort();
      expect(statuses).toEqual([200, 409]);

      // 衝突方收到 server 最新 state
      const conflictRes = resA.status() === 409 ? resA : resB;
      const conflictData = await conflictRes.json();
      expect(conflictData.conflict).toBe(true);
      expect(conflictData.state).toBeTruthy();
      // version 已被勝者推進到 2
      expect(conflictData.state.version).toBe(2);
    });

    test("重試流程：衝突方拉新版本、用新 expectedVersion=2 重送 → 200", async ({
      request,
    }) => {
      // 第一次寫：A 寫 "12" 成功
      const res1 = await request.post("/api/_test/lock-coop-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          action: "code",
          payload: { code: "12" },
          expectedVersion: 1,
        },
      });
      expect(res1.status()).toBe(200);

      // 第二次寫：B 用 expectedVersion=1（過舊）→ 409
      const res2 = await request.post("/api/_test/lock-coop-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          action: "code",
          payload: { code: "34" },
          expectedVersion: 1,
        },
      });
      expect(res2.status()).toBe(409);
      const conflict = await res2.json();
      expect(conflict.state.version).toBe(2);

      // 第三次：B 用 expectedVersion=2 重送 → 200
      const res3 = await request.post("/api/_test/lock-coop-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          action: "code",
          payload: { code: "34" },
          expectedVersion: 2,
        },
      });
      expect(res3.status()).toBe(200);
      const data3 = await res3.json();
      expect(data3.state.shared_code).toBe("34");
      expect(data3.state.version).toBe(3);
    });

    test("不帶 expectedVersion：盲寫（後到者覆蓋）— 向後相容", async ({ request }) => {
      // 不帶 expectedVersion 的 client（舊版）走盲寫、不檢樂觀鎖
      const [resA, resB] = await Promise.all([
        request.post("/api/_test/lock-coop-update", {
          data: {
            teamId: seed.teamId,
            sessionId: seed.sessionId,
            pageId: seed.pageId,
            action: "code",
            payload: { code: "XX" },
          },
        }),
        request.post("/api/_test/lock-coop-update", {
          data: {
            teamId: seed.teamId,
            sessionId: seed.sessionId,
            pageId: seed.pageId,
            action: "code",
            payload: { code: "YY" },
          },
        }),
      ]);
      // 都成功（沒檢樂觀鎖）— 但後到者覆蓋前者
      expect(resA.status()).toBe(200);
      expect(resB.status()).toBe(200);
    });
  });

  test.describe("DB 持久化驗收", () => {
    let seed: SeedResult;

    test.beforeAll(async ({ request }) => {
      const res = await request.post("/api/_test/seed-team-with-members");
      seed = await res.json();
    });

    test.afterAll(async ({ request }) => {
      if (seed?.gameId) {
        await request.post("/api/_test/cleanup-team", {
          data: { gameId: seed.gameId, userIds: seed.userIds },
        });
      }
    });

    test("seed-team 建出來：team / 2 members / session 都正確", async ({ request }) => {
      expect(seed.teamId).toBeTruthy();
      expect(seed.userIds).toHaveLength(2);
      expect(seed.sessionId).toBeTruthy();
      expect(seed.pageId).toBeTruthy();
    });

    test("寫入後 GET 回讀：state 確實在 DB", async ({ request }) => {
      // 寫一次
      await request.post("/api/_test/lock-coop-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          action: "code",
          payload: { code: "ZZ" },
        },
      });
      // 讀回
      const res = await request.get("/api/_test/team-lock-state", {
        params: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
        },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.state.shared_code).toBe("ZZ");
      expect(data.state.version).toBeGreaterThanOrEqual(2);
    });
  });

  // 🆕 P.2: A2 useTeamGameState 衝突回應驗證
  test.describe("A2: team_game_states 衝突 + retry", () => {
    let seed: SeedResult;

    test.beforeEach(async ({ request }) => {
      const res = await request.post("/api/_test/seed-team-with-members");
      seed = await res.json();
    });

    test.afterEach(async ({ request }) => {
      if (seed?.gameId) {
        await request.post("/api/_test/cleanup-team", {
          data: { gameId: seed.gameId, userIds: seed.userIds },
        });
      }
    });

    test("第一次寫入 → 200 + 拿回 saved state", async ({ request }) => {
      const res = await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "collective_score",
          state: { score: 10 },
          version: 2,
        },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.state.version).toBe(2);
    });

    test("舊 version 寫入 → 409 + 拿回 server 最新", async ({ request }) => {
      // 先寫 version=5
      await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "collective_score",
          state: { score: 50 },
          version: 5,
        },
      });
      // 再用 version=3 寫（過舊）
      const res = await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "collective_score",
          state: { score: 30 },
          version: 3,
        },
      });
      expect(res.status()).toBe(409);
      const data = await res.json();
      expect(data.conflict).toBe(true);
      expect(data.state.version).toBe(5);
    });

    test("用更高 version 重送 → 200（retry 流程）", async ({ request }) => {
      await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "collective_score",
          state: { score: 50 },
          version: 5,
        },
      });
      // retry 用 version=6
      const res = await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "collective_score",
          state: { score: 70 },
          version: 6,
        },
      });
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.state.version).toBe(6);
    });
  });

  // 🆕 P.2: A3 GpsTeamMission 持久化驗證（reachedUserIds）
  test.describe("A3: GpsTeamMission 持久化", () => {
    let seed: SeedResult;

    test.beforeEach(async ({ request }) => {
      const res = await request.post("/api/_test/seed-team-with-members");
      seed = await res.json();
    });

    test.afterEach(async ({ request }) => {
      if (seed?.gameId) {
        await request.post("/api/_test/cleanup-team", {
          data: { gameId: seed.gameId, userIds: seed.userIds },
        });
      }
    });

    test("玩家 A 抵達 → reachedUserIds 含 A、玩家 B 重整能讀到", async ({ request }) => {
      // 玩家 A 完成（reachedUserIds 加入 A）
      const userA = seed.userIds[0];
      await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "gps_team_mission",
          state: { reachedUserIds: [userA] },
        },
      });
      // 玩家 B 重整、讀回 state
      const res = await request.get("/api/_test/team-state", {
        params: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "gps_team_mission",
        },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.state.state_json.reachedUserIds).toContain(userA);
    });

    test("兩員都抵達 → reachedUserIds 都在", async ({ request }) => {
      const [userA, userB] = seed.userIds;
      // A 先到
      await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "gps_team_mission",
          state: { reachedUserIds: [userA] },
        },
      });
      // B 後到（client 邏輯：拉舊 state、append、寫回）
      await request.post("/api/_test/team-state-update", {
        data: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "gps_team_mission",
          state: { reachedUserIds: [userA, userB] },
        },
      });
      const res = await request.get("/api/_test/team-state", {
        params: {
          teamId: seed.teamId,
          sessionId: seed.sessionId,
          pageId: seed.pageId,
          type: "gps_team_mission",
        },
      });
      const data = await res.json();
      expect(data.state.state_json.reachedUserIds).toContain(userA);
      expect(data.state.state_json.reachedUserIds).toContain(userB);
    });
  });

  // 🆕 P.2: A4 leaveTeam → leftAt（DB 標記）
  test.describe("A4: leaveTeam 標 leftAt", () => {
    let seed: SeedResult;

    test.beforeAll(async ({ request }) => {
      const res = await request.post("/api/_test/seed-team-with-members");
      seed = await res.json();
    });

    test.afterAll(async ({ request }) => {
      if (seed?.gameId) {
        await request.post("/api/_test/cleanup-team", {
          data: { gameId: seed.gameId, userIds: seed.userIds },
        });
      }
    });

    test("leave-team → DB 該 member.leftAt 不再 NULL", async ({ request }) => {
      const userB = seed.userIds[1];
      const res = await request.post("/api/_test/leave-team", {
        data: { teamId: seed.teamId, userId: userB },
      });
      expect(res.ok()).toBeTruthy();
      const data = await res.json();
      expect(data.member).toBeTruthy();
      expect(data.member.left_at).toBeTruthy();
    });
  });
});
