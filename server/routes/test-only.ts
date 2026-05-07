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
