// 水彈對戰 PK 擂台 — 成就路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import {
  getAllAchievementDefs,
  getPlayerAchievements,
  seedAchievements,
} from "../storage/battle-storage-achievements";
import type { AuthenticatedRequest } from "./types";

export function registerBattleAchievementRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/achievements — 所有成就定義
  // ============================================================================
  app.get("/api/battle/achievements", async (_req, res) => {
    try {
      // 確保種子資料已插入
      await seedAchievements();

      const defs = await getAllAchievementDefs();

      // 隱藏成就不顯示描述
      const result = defs.map((d) => ({
        ...d,
        description: d.isHidden ? "???" : d.description,
      }));

      res.json(result);
    } catch {
      res.status(500).json({ error: "取得成就列表失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/my/achievements — 我的已解鎖成就
  // ============================================================================
  app.get(
    "/api/battle/my/achievements",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }

        const achievements = await getPlayerAchievements(req.user.dbUser.id);
        res.json(achievements);
      } catch {
        res.status(500).json({ error: "取得成就失敗" });
      }
    },
  );
}
