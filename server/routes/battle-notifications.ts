// 水彈對戰 PK 擂台 — 通知 API 路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import type { AuthenticatedRequest } from "./types";

export function registerBattleNotificationRoutes(app: Express): void {
  // ========================================================================
  // GET /api/battle/notifications — 取得我的通知列表
  // ========================================================================
  app.get(
    "/api/battle/notifications",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "未登入" });
        }
        const userId = req.user.dbUser.id;
        const limit = Math.min(
          parseInt(req.query.limit as string) || 20,
          50,
        );

        const notifications =
          await battleStorageMethods.getNotificationsByUser(userId, limit);

        res.json(notifications);
      } catch (err) {
        res.status(500).json({
          message: "取得通知列表失敗",
          error: err instanceof Error ? err.message : "未知錯誤",
        });
      }
    },
  );

  // ========================================================================
  // GET /api/battle/notifications/unread-count — 取得未讀數量
  // ========================================================================
  app.get(
    "/api/battle/notifications/unread-count",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "未登入" });
        }
        const userId = req.user.dbUser.id;
        const count = await battleStorageMethods.getUnreadCount(userId);
        res.json({ count });
      } catch (err) {
        res.status(500).json({
          message: "取得未讀數量失敗",
          error: err instanceof Error ? err.message : "未知錯誤",
        });
      }
    },
  );

  // ========================================================================
  // POST /api/battle/notifications/:id/read — 標記單則已讀
  // ========================================================================
  app.post(
    "/api/battle/notifications/:id/read",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "未登入" });
        }
        const { id } = req.params;
        const userId = req.user.dbUser.id;
        await battleStorageMethods.markNotificationAsRead(id, userId);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({
          message: "標記已讀失敗",
          error: err instanceof Error ? err.message : "未知錯誤",
        });
      }
    },
  );

  // ========================================================================
  // POST /api/battle/notifications/read-all — 全部標記已讀
  // ========================================================================
  app.post(
    "/api/battle/notifications/read-all",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "未登入" });
        }
        const userId = req.user.dbUser.id;
        await battleStorageMethods.markAllNotificationsAsRead(userId);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({
          message: "全部標記已讀失敗",
          error: err instanceof Error ? err.message : "未知錯誤",
        });
      }
    },
  );
}
