import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock battleStorageMethods
const mockStorage = vi.hoisted(() => ({
  getNotificationsByUser: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

vi.mock("../storage/battle-storage", () => ({
  battleStorageMethods: mockStorage,
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      const headers = req.headers as Record<string, string>;
      if (headers["x-user-id"]) {
        req.user = {
          claims: { sub: headers["x-user-id"] },
          dbUser: {
            id: headers["x-user-id"],
            displayName: "測試玩家",
          },
        };
        return next();
      }
      return (
        _res as { status: (n: number) => { json: (o: unknown) => void } }
      )
        .status(401)
        .json({ error: "未認證" });
    },
  ),
}));

import express from "express";
import request from "supertest";
import { registerBattleNotificationRoutes } from "../routes/battle-notifications";

const userHeaders = {
  "x-user-id": "user-1",
};

function createApp() {
  const app = express();
  app.use(express.json());
  registerBattleNotificationRoutes(app);
  return app;
}

describe("對戰通知 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/battle/notifications
  // =========================================================================
  describe("GET /api/battle/notifications", () => {
    it("未認證回傳 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/battle/notifications");
      expect(res.status).toBe(401);
    });

    it("成功回傳通知列表", async () => {
      const notifications = [
        { id: "n1", type: "match_ready", isRead: false },
        { id: "n2", type: "result_posted", isRead: true },
      ];
      mockStorage.getNotificationsByUser.mockResolvedValue(notifications);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/notifications")
        .set(userHeaders);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.getNotificationsByUser).toHaveBeenCalledWith(
        "user-1",
        20,
      );
    });
  });

  // =========================================================================
  // GET /api/battle/notifications/unread-count
  // =========================================================================
  describe("GET /api/battle/notifications/unread-count", () => {
    it("成功回傳未讀數量", async () => {
      mockStorage.getUnreadCount.mockResolvedValue(5);

      const app = createApp();
      const res = await request(app)
        .get("/api/battle/notifications/unread-count")
        .set(userHeaders);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(5);
      expect(mockStorage.getUnreadCount).toHaveBeenCalledWith("user-1");
    });
  });

  // =========================================================================
  // POST /api/battle/notifications/:id/read
  // =========================================================================
  describe("POST /api/battle/notifications/:id/read", () => {
    it("成功標記單則已讀", async () => {
      mockStorage.markNotificationAsRead.mockResolvedValue(undefined);

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/notifications/n1/read")
        .set(userHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockStorage.markNotificationAsRead).toHaveBeenCalledWith(
        "n1",
        "user-1",
      );
    });
  });

  // =========================================================================
  // POST /api/battle/notifications/read-all
  // =========================================================================
  describe("POST /api/battle/notifications/read-all", () => {
    it("成功全部標記已讀", async () => {
      mockStorage.markAllNotificationsAsRead.mockResolvedValue(undefined);

      const app = createApp();
      const res = await request(app)
        .post("/api/battle/notifications/read-all")
        .set(userHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockStorage.markAllNotificationsAsRead).toHaveBeenCalledWith(
        "user-1",
      );
    });
  });
});
