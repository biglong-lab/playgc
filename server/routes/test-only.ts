// E2E 測試專用路由（僅限本地 / CI 啟用，生產絕對禁用）
//
// 啟用條件：NODE_ENV === "test" 或 ENABLE_E2E_HELPERS === "true"
// 生產環境（NODE_ENV === "production"）強制 disabled，即使 ENABLE_E2E_HELPERS=true
//
// 端點：
//   POST /api/_test/seed-game                  建立測試 game + 5 pages + session（回傳 IDs）
//   POST /api/_test/seed-multi-game            建立多人模式 game + vote_team 頁
//   POST /api/_test/seed-multi-game-with-page  建立多人 game 含指定 pageType（A2 L3 驗證用）
//   POST /api/_test/cleanup/:gameId            清理測試 game（連同 sessions / pages）
//   GET  /api/_test/games/:gameId              查詢測試 game 狀態
//
// 用途：給 Playwright e2e 自包含建立資料、跳過 admin Firebase auth
//
// 安全：
//   - 生產 disabled（registerTestOnlyRoutes() 會 early return）
//   - 路徑前綴 /_test/ 明確標示
//   - 寫入 server log 以便監控（若意外啟用會被發現）

import type { Express } from "express";
import { db } from "../db";
import { games, pages, gameSessions, teams, teamMembers, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "../storage";

export function registerTestOnlyRoutes(app: Express) {
  // 生產絕對禁用（雙重防護）
  if (process.env.NODE_ENV === "production") {
    return;
  }
  // 必須明確開啟（避免本機開發誤啟用）
  if (process.env.NODE_ENV !== "test" && process.env.ENABLE_E2E_HELPERS !== "true") {
    return;
  }

  console.warn("[test-only routes] ⚠️ E2E test endpoints ENABLED — DO NOT use in production");

  // POST /api/_test/seed-game — 建立 5 頁單人遊戲 + session
  app.post("/api/_test/seed-game", async (_req, res) => {
    try {
      // 1. 建 game
      const [game] = await db.insert(games).values({
        title: "E2E 測試遊戲",
        description: "Playwright e2e 自動建立、可被 cleanup 清除",
        difficulty: "easy",
        estimatedTime: 5,
        maxPlayers: 1,
        status: "published",
        gameMode: "individual",
        publicSlug: `e2e-${Date.now()}`,
      }).returning();

      // 2. 建 5 頁
      const pageData = [
        { pageType: "text_card", config: { title: "歡迎", content: "E2E 測試開始", layout: "center" } },
        { pageType: "text_card", config: { title: "第二頁", content: "繼續走", layout: "center" } },
        {
          pageType: "choice_verify",
          config: {
            question: "選擇正確答案",
            options: [
              { text: "正確", correct: true },
              { text: "錯誤", correct: false },
            ],
          },
        },
        { pageType: "text_card", config: { title: "差不多了", content: "最後一頁", layout: "center" } },
        { pageType: "text_card", config: { title: "完成", content: "🎉 完成測試", layout: "center" } },
      ];

      const insertedPages = await db.insert(pages).values(
        pageData.map((p, i) => ({ gameId: game.id, pageOrder: i + 1, pageType: p.pageType, config: p.config }))
      ).returning();

      // 3. 建 session
      const [session] = await db.insert(gameSessions).values({
        gameId: game.id,
        playerName: "e2e-player",
        status: "playing",
      }).returning();

      res.json({
        gameId: game.id,
        sessionId: session.id,
        publicSlug: game.publicSlug,
        pages: insertedPages.map((p) => ({ id: p.id, order: p.pageOrder, type: p.pageType })),
      });
    } catch (err) {
      console.error("[test-only seed-game] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/_test/seed-multi-game — 建立隊伍模式 game + vote_team 頁
  app.post("/api/_test/seed-multi-game", async (_req, res) => {
    try {
      const [game] = await db.insert(games).values({
        title: "E2E 多人測試遊戲",
        description: "Playwright e2e 多人關卡測試",
        difficulty: "medium",
        estimatedTime: 5,
        maxPlayers: 6,
        status: "published",
        gameMode: "team",
        minTeamPlayers: 2,
        maxTeamPlayers: 4,
        publicSlug: `e2e-multi-${Date.now()}`,
      }).returning();

      const insertedPages = await db.insert(pages).values([
        {
          gameId: game.id,
          pageOrder: 1,
          pageType: "vote_team",
          config: {
            title: "隊伍投票測試",
            question: "你支持哪個方案？",
            options: [{ text: "方案 A" }, { text: "方案 B" }],
            showResults: true,
          },
        },
        {
          gameId: game.id,
          pageOrder: 2,
          pageType: "spot_vote",
          config: { title: "現場投票", prompt: "選一個" },
        },
      ]).returning();

      const [session] = await db.insert(gameSessions).values({
        gameId: game.id,
        teamName: "e2e-team",
        playerCount: 2,
        status: "playing",
      }).returning();

      res.json({
        gameId: game.id,
        sessionId: session.id,
        publicSlug: game.publicSlug,
        pages: insertedPages.map((p) => ({ id: p.id, order: p.pageOrder, type: p.pageType })),
      });
    } catch (err) {
      console.error("[test-only seed-multi-game] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/_test/seed-multi-game-with-page — 建多人 game 含指定 pageType（A2 L3 驗證用）
  // body: { pageType: string, config?: object }
  // 回傳：gameId / sessionId / publicSlug / pageId / pageType / config
  //
  // 支援 9 個 L3 持久化元件：
  //   lock_coop / relay_mission / territory_capture（ws 即時同步 + DB 持久化）
  //   collective_score / role_assign / quest_chain（DB 持久化，2026-05-05 升級）
  //   jigsaw_puzzle / treasure_hunt / gps_cascade（DB 持久化，2026-05-05 升級）
  app.post("/api/_test/seed-multi-game-with-page", async (req, res) => {
    try {
      const { pageType, config: customConfig } = (req.body ?? {}) as {
        pageType?: string;
        config?: Record<string, unknown>;
      };

      if (!pageType || typeof pageType !== "string") {
        return res.status(400).json({ error: "pageType 必填" });
      }

      // 優先用內建 default、否則用 caller 提供的 customConfig、都沒有才報錯
      const defaultConfig = getMultiPageDefaultConfig(pageType);
      if (!defaultConfig && !customConfig) {
        return res.status(400).json({
          error: `不支援的 pageType: ${pageType}（無內建 default、需在 body.config 提供）`,
          supported: Object.keys(MULTI_L3_DEFAULT_CONFIGS),
        });
      }

      const finalConfig = { ...(defaultConfig ?? {}), ...(customConfig ?? {}) };

      // host_ 開頭的 pageType 走 ADR-0004 host 軸線（gameMode=individual、玩家匿名）
      // 其他走 multi 軸（gameMode=team、要登入要組隊）
      const isHostAxis = pageType.startsWith("host_");

      const [game] = await db.insert(games).values({
        title: `E2E ${pageType} 測試`,
        description: `Playwright e2e — ${pageType}`,
        difficulty: "medium",
        estimatedTime: 5,
        maxPlayers: 6,
        status: "published",
        gameMode: isHostAxis ? "individual" : "team",
        minTeamPlayers: isHostAxis ? null : 2,
        maxTeamPlayers: isHostAxis ? null : 4,
        publicSlug: `e2e-${pageType}-${Date.now()}`,
      }).returning();

      const [insertedPage] = await db.insert(pages).values({
        gameId: game.id,
        pageOrder: 1,
        pageType,
        config: finalConfig,
      }).returning();

      // host 軸 session 加 hostMode=true（ADR-0004：HostScreen 模式）
      const [session] = await db.insert(gameSessions).values({
        gameId: game.id,
        teamName: isHostAxis ? null : `e2e-${pageType}`,
        playerCount: isHostAxis ? 0 : 2,
        status: "playing",
        hostMode: isHostAxis,
      }).returning();

      res.json({
        gameId: game.id,
        sessionId: session.id,
        publicSlug: game.publicSlug,
        pageId: insertedPage.id,
        pageType: insertedPage.pageType,
        config: finalConfig,
      });
    } catch (err) {
      console.error("[test-only seed-multi-game-with-page] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 🆕 2026-05-07 多人 e2e 補強用端點群（O.1 ~ O.2）

  // POST /api/_test/seed-team-with-members — 建 game + team + 2 dummy users + members
  // 回傳：gameId / sessionId / teamId / userIds[]
  // 用途：測 A1 LockCoop race / A2 team_game_state 衝突 / A3 GpsTeamMission 持久化
  app.post("/api/_test/seed-team-with-members", async (_req, res) => {
    try {
      const ts = Date.now();
      // 1. game (team 模式)
      const [game] = await db.insert(games).values({
        title: `E2E race test ${ts}`,
        description: "Playwright multi e2e",
        difficulty: "medium",
        estimatedTime: 5,
        maxPlayers: 6,
        status: "published",
        gameMode: "team",
        minTeamPlayers: 2,
        maxTeamPlayers: 4,
        publicSlug: `e2e-team-${ts}`,
      }).returning();

      // 2. 兩個 dummy users
      const [u1] = await db.insert(users).values({
        id: `e2e-u1-${ts}`,
        email: `e2e-u1-${ts}@test`,
        firstName: "玩家A",
      }).returning();
      const [u2] = await db.insert(users).values({
        id: `e2e-u2-${ts}`,
        email: `e2e-u2-${ts}@test`,
        firstName: "玩家B",
      }).returning();

      // 3. team
      const [team] = await db.insert(teams).values({
        gameId: game.id,
        name: `e2e-team-${ts}`,
        accessCode: `E${ts.toString().slice(-5)}`,
        leaderId: u1.id,
        status: "playing",
      }).returning();

      // 4. team members
      await db.insert(teamMembers).values([
        { teamId: team.id, userId: u1.id, role: "leader" },
        { teamId: team.id, userId: u2.id, role: "member" },
      ]);

      // 5. session
      const [session] = await db.insert(gameSessions).values({
        gameId: game.id,
        teamName: team.name,
        playerCount: 2,
        status: "playing",
      }).returning();

      // 6. 一個 page（lock_coop 測 race 用）
      const [page] = await db.insert(pages).values({
        gameId: game.id,
        pageOrder: 1,
        pageType: "lock_coop",
        config: {
          title: "E2E race test",
          digits: 4,
          combination: "1234",
          clues: [{ text: "前 12" }, { text: "後 34" }],
        },
      }).returning();

      res.json({
        gameId: game.id,
        sessionId: session.id,
        teamId: team.id,
        pageId: page.id,
        userIds: [u1.id, u2.id],
      });
    } catch (err) {
      console.error("[test-only seed-team-with-members] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/_test/lock-coop-update — bypass auth 直接寫 team_lock_states
  // body: { teamId, sessionId, pageId, userId, action, payload?, expectedVersion? }
  // 模擬「玩家 X 透過 server 寫狀態」、不需 Firebase JWT
  // 跑跟正式 endpoint 同樣的樂觀鎖邏輯（驗 A1）
  app.post("/api/_test/lock-coop-update", async (req, res) => {
    try {
      const { teamId, sessionId, pageId, action, payload, expectedVersion } = req.body ?? {};
      if (!teamId || !sessionId || !pageId || !action) {
        return res.status(400).json({ error: "missing params" });
      }

      // 確保記錄存在
      await db.execute(sql`
        INSERT INTO team_lock_states (team_id, session_id, page_id)
        VALUES (${teamId}, ${sessionId}, ${pageId})
        ON CONFLICT (team_id, session_id, page_id) DO NOTHING
      `);

      let updateResult: { rowCount?: number | null } | undefined;
      if (action === "code" && payload?.code !== undefined) {
        if (expectedVersion !== undefined) {
          updateResult = await db.execute(sql`
            UPDATE team_lock_states SET shared_code=${payload.code}, version=version+1, updated_at=NOW()
            WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
              AND version=${expectedVersion}
          `);
        } else {
          updateResult = await db.execute(sql`
            UPDATE team_lock_states SET shared_code=${payload.code}, version=version+1, updated_at=NOW()
            WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId}
          `);
        }
      } else {
        return res.status(400).json({ error: `unsupported action: ${action}` });
      }

      const rowCount = updateResult?.rowCount ?? 0;
      if (expectedVersion !== undefined && rowCount === 0) {
        const result = await db.execute(sql`
          SELECT * FROM team_lock_states WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} LIMIT 1
        `);
        const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
        return res.status(409).json({ conflict: true, state: rows[0] ?? null });
      }

      const result = await db.execute(sql`
        SELECT * FROM team_lock_states WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} LIMIT 1
      `);
      const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
      res.json({ state: rows[0] ?? null });
    } catch (err) {
      console.error("[test-only lock-coop-update] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 🆕 P.2 A2 互動級 e2e：bypass auth 操作 team_game_states
  // POST /api/_test/team-state-update
  // 跑跟正式 endpoint 同邏輯（version < EXCLUDED.version 才更新 / 0 row → 409）
  app.post("/api/_test/team-state-update", async (req, res) => {
    try {
      const { teamId, sessionId, pageId, type, state, version } = req.body ?? {};
      if (!teamId || !sessionId || !pageId || !type) {
        return res.status(400).json({ error: "missing params" });
      }
      const stateJson = JSON.stringify(state ?? {});
      let upsertResult: { rowCount?: number | null } | undefined;
      if (typeof version === "number") {
        upsertResult = await db.execute(sql`
          INSERT INTO team_game_states (team_id, session_id, page_id, component_type, state_json, version)
          VALUES (${teamId}, ${sessionId}, ${pageId}, ${type}, ${stateJson}::jsonb, ${version})
          ON CONFLICT (team_id, session_id, page_id, component_type) DO UPDATE
            SET state_json = EXCLUDED.state_json,
                version = EXCLUDED.version,
                updated_at = NOW()
            WHERE team_game_states.version < EXCLUDED.version
          RETURNING id
        `);
      } else {
        upsertResult = await db.execute(sql`
          INSERT INTO team_game_states (team_id, session_id, page_id, component_type, state_json, version)
          VALUES (${teamId}, ${sessionId}, ${pageId}, ${type}, ${stateJson}::jsonb, 1)
          ON CONFLICT (team_id, session_id, page_id, component_type) DO UPDATE
            SET state_json = EXCLUDED.state_json,
                version = team_game_states.version + 1,
                updated_at = NOW()
          RETURNING id
        `);
      }
      const fetchResult = await db.execute(sql`
        SELECT * FROM team_game_states
        WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} AND component_type=${type}
        LIMIT 1
      `);
      const rows = (fetchResult as unknown as { rows?: unknown[] }).rows ?? [];
      const saved = rows[0] ?? null;
      const rowCount = upsertResult?.rowCount ?? 0;
      if (typeof version === "number" && rowCount === 0) {
        return res.status(409).json({ conflict: true, state: saved });
      }
      res.json({ state: saved });
    } catch (err) {
      console.error("[test-only team-state-update] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/_test/team-state — 直接讀（A2 / A3 用）
  app.get("/api/_test/team-state", async (req, res) => {
    try {
      const { teamId, sessionId, pageId, type } = req.query as Record<string, string>;
      if (!teamId || !sessionId || !pageId || !type) {
        return res.status(400).json({ error: "missing query" });
      }
      const result = await db.execute(sql`
        SELECT * FROM team_game_states
        WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} AND component_type=${type}
        LIMIT 1
      `);
      const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
      res.json({ state: rows[0] ?? null });
    } catch (err) {
      console.error("[test-only team-state] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // 🆕 P.2 A4 互動級 e2e：模擬 leaveTeam（標 leftAt）
  // POST /api/_test/leave-team
  app.post("/api/_test/leave-team", async (req, res) => {
    try {
      const { teamId, userId } = req.body ?? {};
      if (!teamId || !userId) return res.status(400).json({ error: "missing params" });
      await db.execute(sql`
        UPDATE team_members SET left_at=NOW()
        WHERE team_id=${teamId} AND user_id=${userId} AND left_at IS NULL
      `);
      const result = await db.execute(sql`
        SELECT id, role, joined_at, left_at FROM team_members
        WHERE team_id=${teamId} AND user_id=${userId} LIMIT 1
      `);
      const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
      res.json({ member: rows[0] ?? null });
    } catch (err) {
      console.error("[test-only leave-team] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/_test/team-lock-state — 直接讀（驗 A1 寫入有沒有真的進 DB）
  app.get("/api/_test/team-lock-state", async (req, res) => {
    try {
      const { teamId, sessionId, pageId } = req.query as Record<string, string>;
      if (!teamId || !sessionId || !pageId) return res.status(400).json({ error: "missing query" });
      const result = await db.execute(sql`
        SELECT * FROM team_lock_states WHERE team_id=${teamId} AND session_id=${sessionId} AND page_id=${pageId} LIMIT 1
      `);
      const rows = (result as unknown as { rows?: unknown[] }).rows ?? [];
      res.json({ state: rows[0] ?? null });
    } catch (err) {
      console.error("[test-only team-lock-state] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/_test/cleanup-team — 清測試 team / users（含關聯 game）
  // 用 gameId cascade 刪到 teams / teamMembers / sessions / pages
  // 額外清 dummy users（避免累積）
  app.post("/api/_test/cleanup-team", async (req, res) => {
    try {
      const { gameId, userIds } = req.body ?? {};
      if (gameId) {
        await storage.deleteGame(gameId);
      }
      if (Array.isArray(userIds)) {
        for (const uid of userIds) {
          if (typeof uid === "string") {
            await db.delete(users).where(eq(users.id, uid));
          }
        }
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[test-only cleanup-team] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/_test/cleanup/:gameId — 清除測試 game
  app.post("/api/_test/cleanup/:gameId", async (req, res) => {
    try {
      // 用 storage.deleteGame 走完整 FK SET NULL 流程
      await storage.deleteGame(req.params.gameId);
      res.json({ ok: true });
    } catch (err) {
      console.error("[test-only cleanup] 失敗:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/_test/games/:gameId — 確認資料庫狀態（給 e2e 驗收用）
  app.get("/api/_test/games/:gameId", async (req, res) => {
    try {
      const game = await db.query.games.findFirst({ where: eq(games.id, req.params.gameId) });
      const sessions = await db.query.gameSessions.findMany({ where: eq(gameSessions.gameId, req.params.gameId) });
      const pageList = await db.query.pages.findMany({ where: eq(pages.gameId, req.params.gameId) });
      res.json({ game, sessions, pages: pageList });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

// 9 個 L3 持久化元件的最小可用 default config（給 seed-multi-game-with-page 用）
// 來源：shared/schema/games.ts 各 *Config interface + client/src/pages/game-editor/getDefaultConfig.ts
const MULTI_L3_DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  // ws 即時同步 + DB 持久化（3 個高風險）
  lock_coop: {
    title: "E2E 協作解鎖",
    digits: 4,
    combination: "1234",
    clues: [
      { text: "前兩位是 12", label: "線索 A" },
      { text: "後兩位是 34", label: "線索 B" },
    ],
    maxAttempts: 5,
  },
  relay_mission: {
    title: "E2E 接力任務",
    segments: [
      { title: "第一段", prompt: "答 A", answer: "A" },
      { title: "第二段", prompt: "答 B", answer: "B" },
    ],
    segmentOrder: "sequential",
  },
  territory_capture: {
    title: "E2E 地盤戰",
    points: [
      { id: "p1", name: "點 1", lat: 24.4, lng: 118.3, radius: 30 },
      { id: "p2", name: "點 2", lat: 24.5, lng: 118.4, radius: 30 },
    ],
    timeLimitSec: 300,
    capturePoints: 5,
  },

  // DB 持久化（2026-05-05 L3 升級）
  collective_score: {
    title: "E2E 集體分數",
    goal: 100,
    mode: "additive",
  },
  role_assign: {
    title: "E2E 角色分派",
    roles: ["隊長", "記錄", "計時", "發言"],
  },
  quest_chain: {
    title: "E2E 任務鏈",
    prompt: "依序完成連鎖任務",
    quests: [
      { id: "q1", title: "任務 1", question: "答 X", answer: "X" },
      { id: "q2", title: "任務 2", question: "答 Y", answer: "Y" },
    ],
  },
  jigsaw_puzzle: {
    title: "E2E 拼圖協作",
    pieces: 9,
    timeLimit: 300,
  },
  treasure_hunt: {
    title: "E2E 尋寶任務",
    clues: [
      { id: "c1", text: "線索 1", answer: "A" },
      { id: "c2", text: "線索 2", answer: "B" },
    ],
    timeLimit: 600,
  },
  gps_cascade: {
    title: "E2E GPS 連鎖",
    checkpoints: [
      { id: "g1", name: "點 1", lat: 24.4, lng: 118.3 },
      { id: "g2", name: "點 2", lat: 24.5, lng: 118.4 },
    ],
    radius: 30,
  },
};

function getMultiPageDefaultConfig(pageType: string): Record<string, unknown> | null {
  return MULTI_L3_DEFAULT_CONFIGS[pageType] ?? null;
}
