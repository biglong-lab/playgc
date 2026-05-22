import type { Express } from "express";
import type { Server } from "http";
import { adminAuthMiddleware } from "../adminAuth";
import { setupWebSocket } from "./websocket";
import { registerAuthRoutes } from "./auth";
import { registerTestOnlyRoutes } from "./test-only";
import { registerAdminFieldRoutes } from "./admin-fields";
import { registerAdminRoleRoutes } from "./admin-roles";
import { registerAdminGameRoutes } from "./admin-games";
import { registerVariantPoolRoutes } from "./admin-variant-pool";
import { registerExemplarRoutes } from "./admin-exemplar";
import { registerGameGeneratorRoutes } from "./admin-game-generator";
import { registerAdminCopilotRoutes } from "./admin-copilot";
import { registerAdminDevToolsRoutes } from "./admin-dev-tools";
import { registerAdminSystemHealthRoutes } from "./admin-system-health";
import { registerAdminChangelogRoutes } from "./admin-changelog";
import { registerAdminMultiSessionsRoutes } from "./admin-multi-sessions";
import { registerAdminSessionReplayRoutes } from "./admin-session-replay";
import { registerAdminTriviaRoutes } from "./admin-trivia";
import { registerAdminReportsRoutes } from "./admin-reports";
import { registerComponentTelemetryRoutes } from "./component-telemetry";
import { registerAdminFeatureFlagsRoutes } from "./admin-feature-flags";
import { registerAdminGameRoutesRoutes } from "./admin-game-routes";
import { registerPlayerFeedbackRoutes } from "./player-feedback";
import { registerVariantPickerServerRoutes } from "./variant-picker-server";
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
import { registerAdminRescueRoutes } from "./admin-rescue";
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
import { registerPlatformAiCenterRoutes } from "./platform-ai-center";
import { registerPlatformTicketRoutes } from "./platform-tickets";
import { registerRevenueRoutes } from "./revenue";
import { registerFieldRoutes } from "./field";
import { registerApplicationRoutes } from "./applications";
import { registerFieldMembershipRoutes } from "./field-memberships";
import { registerBookingRoutes } from "./bookings";
import { registerAdminBookingRoutes } from "./admin-bookings";
import { registerWalkieRoutes } from "./walkie";
import { registerAdminWalkieRoutes } from "./admin-walkie";
import { registerClientLogsRoutes, startClientLogsCleanup } from "./client-logs";
import { registerSitemapRoute } from "./sitemap";
import { registerErrorLogRoutes } from "./error-log";
import { registerSquadsCoreRoutes } from "./squads-core";
import { registerHostSessionRoutes } from "./host-sessions";
import { registerScenarioRoutes } from "./scenarios";
import { registerScenarioHealthRoutes } from "./scenario-health";
import { registerPaymentsRoutes } from "./payments";
import { registerPublicApiV1Routes } from "./api/v1";
import { registerLineWebhookRoutes } from "./line-webhook";
import { registerCronEndpoints } from "./cron-endpoints";
import { registerAdminPilotHealthRoutes } from "./admin-pilot-health";
import { registerAdminMetricsCompletionRoutes } from "./admin-metrics-completion";
import { registerAdminTimingsRoutes } from "./admin-timings";
import { registerAdminLineBotMetricsRoutes } from "./admin-line-bot-metrics";
import { registerAdminReportsHealthRoutes } from "./admin-reports-health";
import { registerAdminLineConfigRoutes } from "./admin-line-config";
import { registerAdminLineLoginConfigRoutes } from "./admin-line-login-config";
import { registerLineLoginRoutes } from "./auth-line-login";
import { registerAdminActivitiesRoutes } from "./admin-activities";
import { registerPublicActivitiesRoutes } from "./public-activities";
import { registerPosRoutes } from "./pos";
import { registerAdminTroubleshootRoutes } from "./admin-troubleshoot";
import { registerBattleSelfReportRoutes } from "./battle-self-report";
import { registerSquadRecordsRoutes } from "./squad-records";
import { registerSquadInvitesRoutes } from "./squad-invites";
import { registerSquadLeaderboardsRoutes } from "./squad-leaderboards";
import { registerWelcomeSquadsRoutes } from "./welcome-squads";
import { registerSquadSeoRoutes } from "./squad-seo";
import { registerRewardsRoutes } from "./rewards";
import { registerAdminRewardsRoutes } from "./admin-rewards";
import { registerAdminEngagementRoutes } from "./admin-engagement";
import { registerAdminAbExperimentsRoutes } from "./admin-ab-experiments";
import { registerTeamRaceRoutes, ensureTeamRaceSchema } from "./team-race";
import { registerTeamPhotoGatherRoutes, ensureTeamPhotoGatherSchema } from "./team-photo-gather";
import { registerTeamShootingRoutes, ensureTeamShootingSchema } from "./team-shooting";
import { registerTeamLockCoopRoutes, ensureTeamLockCoopSchema } from "./team-lock-coop";
import { registerTeamGameStateRoutes, ensureTeamGameStateSchema } from "./team-game-state";

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

  // 🧪 E2E 測試專用路由（僅本地 / CI 啟用，生產禁用）
  // 必須先註冊（不依賴 admin auth），給 Playwright 自包含建測試資料
  registerTestOnlyRoutes(app);

  // 註冊各模組路由
  registerAuthRoutes(app);
  registerAdminFieldRoutes(app);
  registerAdminRoleRoutes(app);
  registerAdminGameRoutes(app);
  registerVariantPoolRoutes(app);
  registerExemplarRoutes(app);
  registerGameGeneratorRoutes(app);
  registerAdminCopilotRoutes(app);
  registerAdminDevToolsRoutes(app);
  registerAdminSystemHealthRoutes(app);
  registerAdminChangelogRoutes(app);
  registerAdminMultiSessionsRoutes(app);
  registerAdminSessionReplayRoutes(app);
  registerAdminTriviaRoutes(app, ctx);
  registerAdminReportsRoutes(app);
  registerComponentTelemetryRoutes(app);
  registerAdminFeatureFlagsRoutes(app);
  registerAdminGameRoutesRoutes(app);
  registerPlayerFeedbackRoutes(app);
  registerVariantPickerServerRoutes(app);
  registerAdminContentRoutes(app);
  registerPlayerGameRoutes(app, ctx);
  registerDeviceRoutes(app, ctx);
  registerLeaderboardRoutes(app);
  registerMediaRoutes(app);
  registerLocationRoutes(app, ctx);
  registerTeamRoutes(app, ctx);
  // 🆕 2026-05-05: 多人搶答 server-side 持久化（state + answers）
  await ensureTeamRaceSchema();
  registerTeamRaceRoutes(app, ctx);
  // 🆕 2026-05-05: 集合模式合照 server-side 持久化（隊長一人拍、全隊共享）
  await ensureTeamPhotoGatherSchema();
  registerTeamPhotoGatherRoutes(app, ctx);
  // 🆕 2026-05-05: ShootingTeam 命中持久化
  await ensureTeamShootingSchema();
  registerTeamShootingRoutes(app, ctx);
  // 🆕 2026-05-05: LockCoop 協作解鎖持久化
  await ensureTeamLockCoopSchema();
  registerTeamLockCoopRoutes(app, ctx);
  // 🆕 2026-05-05: 通用多人遊戲狀態（RelayMission/TerritoryCapture/CollectiveScore/RoleAssign/QuestChain 等）
  await ensureTeamGameStateSchema();
  registerTeamGameStateRoutes(app, ctx);
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
  registerAdminRescueRoutes(app, ctx);
  registerAiScoringRoutes(app);

  // 水彈對戰 PK 擂台
  registerBattleVenueRoutes(app);
  registerBattleSlotRoutes(app);
  registerBattleRegistrationRoutes(app);
  registerBattleMatchmakingRoutes(app, ctx);
  registerBattleResultRoutes(app, ctx);
  registerBattleRankingRoutes(app);
  registerBattleClanRoutes(app);
  registerSquadsCoreRoutes(app);
  registerHostSessionRoutes(app);
  registerScenarioRoutes(app);
  registerScenarioHealthRoutes(app);
  registerPaymentsRoutes(app);
  registerPublicApiV1Routes(app);
  registerLineWebhookRoutes(app);
  registerCronEndpoints(app);
  registerAdminPilotHealthRoutes(app);
  registerAdminMetricsCompletionRoutes(app);
  registerAdminTimingsRoutes(app);
  registerAdminLineBotMetricsRoutes(app);
  registerAdminReportsHealthRoutes(app);
  registerAdminLineConfigRoutes(app);
  registerAdminLineLoginConfigRoutes(app);
  registerLineLoginRoutes(app);
  registerAdminActivitiesRoutes(app);
  registerPublicActivitiesRoutes(app);
  registerPosRoutes(app);
  registerAdminTroubleshootRoutes(app);
  registerBattleSelfReportRoutes(app);
  registerSquadRecordsRoutes(app);
  registerSquadInvitesRoutes(app);
  registerSquadLeaderboardsRoutes(app);
  registerWelcomeSquadsRoutes(app);
  registerSquadSeoRoutes(app);
  registerRewardsRoutes(app);
  registerAdminRewardsRoutes(app);
  registerAdminEngagementRoutes(app);
  // 🔬 A/B 實驗（P14-5）
  registerAdminAbExperimentsRoutes(app);
  registerBattleNotificationRoutes(app);
  registerAdminBattleRoutes(app);
  registerAdminBattleSeasonRoutes(app);
  registerBattleSeasonRoutes(app);
  registerBattleAchievementRoutes(app);

  // 🌐 SaaS 平台層（Phase 1 基礎）
  registerPlatformRoutes(app);
  registerPlatformAiCenterRoutes(app);
  // 🎫 客服工單系統（P0-2）
  registerPlatformTicketRoutes(app);

  // 💰 財務中心 Facade（Phase 3）
  registerRevenueRoutes(app);

  // 🏢 場域訂閱 / 用量 / 平台費用（Phase 6）
  registerFieldRoutes(app);

  // 📋 場域申請（公開 + 平台審核 Phase 8）
  registerApplicationRoutes(app);

  // 🎫 場域會員（玩家身份 + 管理員授權開關）
  registerFieldMembershipRoutes(app);

  // 📅 預約系統（Phase δ — 2026-05-07）
  registerBookingRoutes(app);
  registerAdminBookingRoutes(app);

  return httpServer;
}
