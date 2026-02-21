import type { Express } from "express";
import type { Server } from "http";
import { adminAuthMiddleware } from "../adminAuth";
import { setupWebSocket } from "./websocket";
import { registerAuthRoutes } from "./auth";
import { registerAdminFieldRoutes } from "./admin-fields";
import { registerAdminRoleRoutes } from "./admin-roles";
import { registerAdminGameRoutes } from "./admin-games";
import { registerAdminContentRoutes } from "./admin-content";
import { registerPlayerGameRoutes } from "./player-games";
import { registerDeviceRoutes } from "./devices";
import { registerLeaderboardRoutes } from "./leaderboard";
import { registerMediaRoutes } from "./media";
import { registerLocationRoutes } from "./locations";
import { registerTeamRoutes } from "./teams";
import { registerPlayerChapterRoutes } from "./player-chapters";
import { registerAdminChapterRoutes } from "./admin-chapters";
import { registerAdminModuleRoutes } from "./admin-modules";
import { registerMatchRoutes } from "./matches";
import { registerAdminRedeemCodeRoutes } from "./admin-redeem-codes";
import { registerAdminPurchaseRoutes } from "./admin-purchases";
import { registerPlayerPurchaseRoutes } from "./player-purchases";
import { registerAdminSessionRoutes } from "./admin-sessions";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(adminAuthMiddleware);

  // WebSocket 設定
  const ctx = setupWebSocket(httpServer);

  // 註冊各模組路由
  registerAuthRoutes(app);
  registerAdminFieldRoutes(app);
  registerAdminRoleRoutes(app);
  registerAdminGameRoutes(app);
  registerAdminContentRoutes(app);
  registerPlayerGameRoutes(app);
  registerDeviceRoutes(app, ctx);
  registerLeaderboardRoutes(app);
  registerMediaRoutes(app);
  registerLocationRoutes(app, ctx);
  registerTeamRoutes(app, ctx);
  registerPlayerChapterRoutes(app);
  registerAdminChapterRoutes(app);
  registerAdminModuleRoutes(app);
  registerMatchRoutes(app, ctx);
  registerAdminRedeemCodeRoutes(app);
  registerAdminPurchaseRoutes(app);
  registerPlayerPurchaseRoutes(app);

  return httpServer;
}
