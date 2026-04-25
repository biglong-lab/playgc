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
import { registerAdminChapterTemplateRoutes } from "./admin-chapter-templates";
import { registerAdminModuleRoutes } from "./admin-modules";
import { registerMatchRoutes } from "./matches";
import { registerAdminRedeemCodeRoutes } from "./admin-redeem-codes";
import { registerAdminPurchaseRoutes } from "./admin-purchases";
import { registerPlayerPurchaseRoutes } from "./player-purchases";
import { registerAdminSessionRoutes } from "./admin-sessions";
import { registerAdminSettingsRoutes } from "./admin-settings";
import { registerRecurWebhookRoutes } from "./webhook-recur";
import { registerAiScoringRoutes } from "./ai-scoring";
import { registerBattleVenueRoutes } from "./battle-venues";
import { registerBattleSlotRoutes } from "./battle-slots";
import { registerBattleRegistrationRoutes } from "./battle-registration";
import { registerBattleMatchmakingRoutes } from "./battle-matchmaking";
import { registerBattleResultRoutes } from "./battle-results";
import { registerBattleRankingRoutes } from "./battle-rankings";
import { registerBattleClanRoutes } from "./battle-clans";
import { registerBattleNotificationRoutes } from "./battle-notifications";
import { registerAdminBattleRoutes } from "./admin-battle";
import { registerAdminBattleSeasonRoutes } from "./admin-battle-seasons";
import { registerBattleSeasonRoutes } from "./battle-seasons";
import { registerBattleAchievementRoutes } from "./battle-achievements";
import { registerPlatformRoutes } from "./platform";
import { registerRevenueRoutes } from "./revenue";
import { registerFieldRoutes } from "./field";
import { registerApplicationRoutes } from "./applications";
import { registerFieldMembershipRoutes } from "./field-memberships";
import { registerWalkieRoutes } from "./walkie";
import { registerAdminWalkieRoutes } from "./admin-walkie";
import { registerClientLogsRoutes, startClientLogsCleanup } from "./client-logs";
import { registerSitemapRoute } from "./sitemap";
import { registerErrorLogRoutes } from "./error-log";
import { registerSquadRecordsRoutes } from "./squad-records";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Webhook 路由必須在 adminAuthMiddleware 之前（外部服務呼叫，用自己的簽名驗證）
  registerRecurWebhookRoutes(app);

  // 🌐 Sitemap 公開端點（搜尋引擎爬取用，無需認證）
  registerSitemapRoute(app);

  // 🆕 /api/error-log — 前端錯誤上報（公開、rate-limited、永遠 200）
  // 必須在 adminAuthMiddleware 之前，避免誤擋沒登入的錯誤上報
  registerErrorLogRoutes(app);

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
  registerAdminChapterTemplateRoutes(app);
  registerAdminModuleRoutes(app);
  // 📻 對講機（LiveKit）
  registerWalkieRoutes(app);
  registerAdminWalkieRoutes(app);
  // 📊 前端日誌收集
  registerClientLogsRoutes(app);
  startClientLogsCleanup();
  registerMatchRoutes(app, ctx);
  registerAdminRedeemCodeRoutes(app);
  registerAdminPurchaseRoutes(app);
  registerPlayerPurchaseRoutes(app);
  registerAdminSessionRoutes(app);
  registerAdminSettingsRoutes(app);
  registerAiScoringRoutes(app);

  // 水彈對戰 PK 擂台
  registerBattleVenueRoutes(app);
  registerBattleSlotRoutes(app);
  registerBattleRegistrationRoutes(app);
  registerBattleMatchmakingRoutes(app, ctx);
  registerBattleResultRoutes(app, ctx);
  registerBattleRankingRoutes(app);
  registerBattleClanRoutes(app);
  registerSquadRecordsRoutes(app);
  registerBattleNotificationRoutes(app);
  registerAdminBattleRoutes(app);
  registerAdminBattleSeasonRoutes(app);
  registerBattleSeasonRoutes(app);
  registerBattleAchievementRoutes(app);

  // 🌐 SaaS 平台層（Phase 1 基礎）
  registerPlatformRoutes(app);

  // 💰 財務中心 Facade（Phase 3）
  registerRevenueRoutes(app);

  // 🏢 場域訂閱 / 用量 / 平台費用（Phase 6）
  registerFieldRoutes(app);

  // 📋 場域申請（公開 + 平台審核 Phase 8）
  registerApplicationRoutes(app);

  // 🎫 場域會員（玩家身份 + 管理員授權開關）
  registerFieldMembershipRoutes(app);

  return httpServer;
}
