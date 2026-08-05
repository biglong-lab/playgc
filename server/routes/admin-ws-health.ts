// 📊 admin-ws-health — WS 即時狀態（活動當天監控）
//
// GET /api/admin/ws/health
//
// 為什麼需要：2026-08-05 壓測證實瓶頸在廣播扇出而非連線數
// （500 人分散 100 隊 → 7ms；500 人擠同 1 隊 → 5254ms，差 750 倍）。
// 活動當天要盯的是「最大單隊人數」，但這個數字原本完全沒有暴露出來。
//
// 純讀記憶體 Map、不碰 DB，可高頻輪詢。

import type { Express } from "express";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { describeRisk, TEAM_SIZE_WARNING, TEAM_SIZE_CRITICAL } from "../lib/ws-live-stats";
import type { RouteContext } from "./types";

export function registerAdminWsHealthRoutes(app: Express, ctx: RouteContext): void {
  app.get(
    "/api/admin/ws/health",
    requireAdminAuth,
    requirePermission("game:view"),
    (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        if (!ctx.getLiveStats) {
          return res.status(503).json({ message: "WS 尚未初始化" });
        }
        const stats = ctx.getLiveStats();

        res.json({
          ...stats,
          summary: describeRisk(stats),
          thresholds: {
            teamSizeWarning: TEAM_SIZE_WARNING,
            teamSizeCritical: TEAM_SIZE_CRITICAL,
            note: "門檻依 2026-08-05 壓測並對生產打折；壓測環境為本機 Mac，生產 vCPU 較慢",
          },
        });
      } catch (err) {
        console.error("[admin-ws-health]", err);
        res.status(500).json({ message: "取得 WS 狀態失敗" });
      }
    },
  );
}
