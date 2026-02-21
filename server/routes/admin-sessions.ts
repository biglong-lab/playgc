// 管理端場次路由 — 批次清理卡住場次
import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { z } from "zod";

const cleanupSchema = z.object({
  thresholdHours: z.number().min(1).max(720).default(24),
});

export function registerAdminSessionRoutes(app: Express) {
  /** 批次放棄超時場次 */
  app.post(
    "/api/admin/sessions/cleanup",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { thresholdHours } = cleanupSchema.parse(req.body);
        const abandoned = await storage.abandonStaleSessions(thresholdHours);

        res.json({
          message: `已清理 ${abandoned.length} 個卡住的場次`,
          count: abandoned.length,
          sessions: abandoned.map((s) => ({
            id: s.id,
            gameId: s.gameId,
            teamName: s.teamName,
            startedAt: s.startedAt,
          })),
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "參數錯誤", errors: error.errors });
        }
        res.status(500).json({ message: "清理場次失敗" });
      }
    },
  );
}
