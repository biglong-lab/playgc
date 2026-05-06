// E2E 測試專用路由（僅限本地 / CI 啟用，生產絕對禁用）
//
// 啟用條件：NODE_ENV === "test" 或 ENABLE_E2E_HELPERS === "true"
// 生產環境（NODE_ENV === "production"）強制 disabled，即使 ENABLE_E2E_HELPERS=true
//
// 端點：
//   POST /api/_test/seed-game        建立測試 game + 5 pages + session（回傳 IDs）
//   POST /api/_test/cleanup/:gameId  清理測試 game（連同 sessions / pages）
//   POST /api/_test/seed-multi-game  建立多人模式 game + vote_team 頁
//
// 用途：給 Playwright e2e 自包含建立資料、跳過 admin Firebase auth
//
// 安全：
//   - 生產 disabled（registerTestOnlyRoutes() 會 early return）
//   - 路徑前綴 /_test/ 明確標示
//   - 寫入 server log 以便監控（若意外啟用會被發現）

import type { Express } from "express";
import { db } from "../db";
import { games, pages, gameSessions } from "@shared/schema";
import { eq } from "drizzle-orm";
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
