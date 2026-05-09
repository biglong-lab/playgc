import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
// 🌐 Phase 1 (2026-05-08)：全域 WS Provider — 全 app 共用 1 條 WebSocket
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import { FieldThemeProvider } from "@/providers/FieldThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedAdminRoute from "@/components/shared/ProtectedAdminRoute";
import PageLoader from "@/components/shared/PageLoader";
import OfflineBanner from "@/components/shared/OfflineBanner";
import SmartRedirect from "@/components/shared/SmartRedirect";
import { ThemePreviewBanner } from "@/components/shared/ThemePreviewBanner";
import PlayerBottomNav from "@/components/PlayerBottomNav";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import FloatingHomeButton from "@/components/shared/FloatingHomeButton";
import FloatingFontScale from "@/components/shared/FloatingFontScale";
import FloatingBgmMute from "@/components/shared/FloatingBgmMute";
import AppUpdateChecker from "@/components/AppUpdateChecker";
import WelcomeSquadsTrigger from "@/components/WelcomeSquadsTrigger";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuth } from "@/hooks/useAuth";
import { useErrorReport } from "@/hooks/useErrorReport";
import { useFontScale } from "@/hooks/useFontScale";
import { BgmPlayerProvider } from "@/hooks/useBgmPlayer";

// 首屏路由 — 靜態 import（不需 lazy）
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import FieldEntry from "@/pages/FieldEntry";
import PlatformHome from "@/pages/PlatformHome";

// 玩家端 — lazy import
const GamePlay = lazy(() => import("@/pages/GamePlay"));
const MapView = lazy(() => import("@/pages/MapView"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
const TeamLobby = lazy(() => import("@/pages/TeamLobby"));
const ChapterSelect = lazy(() => import("@/pages/ChapterSelect"));
const GameBySlug = lazy(() => import("@/pages/GameBySlug"));
const MatchLobby = lazy(() => import("@/pages/MatchLobby"));
const PurchaseGate = lazy(() => import("@/pages/PurchaseGate"));
const PurchaseSuccess = lazy(() => import("@/pages/PurchaseSuccess"));
const MyPurchases = lazy(() => import("@/pages/MyPurchases"));
const Checkout = lazy(() => import("@/pages/Checkout"));
// 🆕 v2: Session 相簿頁 + 個人相簿
const SessionAlbum = lazy(() => import("@/pages/SessionAlbum"));
const MyPhotos = lazy(() => import("@/pages/MyPhotos"));

// 水彈對戰 PK 擂台
const BattleHome = lazy(() => import("@/pages/BattleHome"));
const BattleSlotDetail = lazy(() => import("@/pages/BattleSlotDetail"));
const BattleResult = lazy(() => import("@/pages/BattleResult"));
const BattleRanking = lazy(() => import("@/pages/BattleRanking"));
const BattleHistory = lazy(() => import("@/pages/BattleHistory"));
const BattleClanDetail = lazy(() => import("@/pages/BattleClanDetail"));
const BattleClanCreate = lazy(() => import("@/pages/BattleClanCreate"));
const BattleMyProfile = lazy(() => import("@/pages/BattleMyProfile"));
const BattleNotifications = lazy(() => import("@/pages/BattleNotifications"));

// 管理端 — 統一在 /admin/* 下
const FieldAdminLogin = lazy(() => import("@/pages/FieldAdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminGames = lazy(() => import("@/pages/AdminGames"));
const AdminLive = lazy(() => import("@/pages/AdminLive"));
const JoinWalkie = lazy(() => import("@/pages/JoinWalkie"));
const AdminDevices = lazy(() => import("@/pages/admin-devices"));
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminSessions = lazy(() => import("@/pages/AdminSessions"));
const AdminBookings = lazy(() => import("@/pages/admin/AdminBookings"));
const AdminSuspiciousLog = lazy(() => import("@/pages/AdminSuspiciousLog"));
const AdminLeaderboard = lazy(() => import("@/pages/AdminLeaderboard"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminTemplates = lazy(() => import("@/pages/AdminTemplates"));
const GameEditor = lazy(() => import("@/pages/game-editor"));
const LocationEditor = lazy(() => import("@/pages/LocationEditor"));
const ItemEditor = lazy(() => import("@/pages/ItemEditor"));
const AchievementEditor = lazy(() => import("@/pages/AchievementEditor"));
const GameSettings = lazy(() => import("@/pages/GameSettings"));
const AdminRedeemCodes = lazy(() => import("@/pages/admin-redeem-codes"));
const FieldSettingsPage = lazy(() => import("@/pages/admin/FieldSettingsPage"));
const TicketsOverview = lazy(() => import("@/pages/admin/TicketsOverview"));
const ExemplarLibrary = lazy(() => import("@/pages/admin/ExemplarLibrary"));
const GameGenerator = lazy(() => import("@/pages/admin/GameGenerator"));
const GameRoutesEditor = lazy(() => import("@/pages/admin/GameRoutesEditor"));
const ManualPage = lazy(() => import("@/pages/admin/ManualPage"));
const DevTools = lazy(() => import("@/pages/admin/DevTools"));
const TestImpersonate = lazy(() => import("@/pages/TestImpersonate"));
const AdminStaffFields = lazy(() => import("@/pages/AdminStaffFields"));
const AdminStaffRoles = lazy(() => import("@/pages/AdminStaffRoles"));
const AdminStaffAccounts = lazy(() => import("@/pages/AdminStaffAccounts"));
const AdminStaffAuditLogs = lazy(() => import("@/pages/AdminStaffAuditLogs"));
const AdminStaffPlayers = lazy(() => import("@/pages/AdminStaffPlayers"));
const AdminStaffQRCodes = lazy(() => import("@/pages/AdminStaffQRCodes"));
const AdminBattleVenues = lazy(() => import("@/pages/AdminBattleVenues"));
const AdminBattleSlots = lazy(() => import("@/pages/AdminBattleSlots"));
const AdminBattleDashboard = lazy(() => import("@/pages/AdminBattleDashboard"));
const AdminBattleRankings = lazy(() => import("@/pages/AdminBattleRankings"));
const AdminBattleSeasons = lazy(() => import("@/pages/AdminBattleSeasons"));
const AdminRewardsRules = lazy(() => import("@/pages/AdminRewardsRules"));
const BattleAchievements = lazy(() => import("@/pages/BattleAchievements"));
const BattleSeasonHistory = lazy(() => import("@/pages/BattleSeasonHistory"));

// 🌐 SaaS 平台後台（v4.0 Phase 5）
const PlatformDashboard = lazy(() => import("@/pages/platform/PlatformDashboard"));
const PlatformFields = lazy(() => import("@/pages/platform/PlatformFields"));
const PlatformPlans = lazy(() => import("@/pages/platform/PlatformPlans"));
const PlatformFeatureFlags = lazy(() => import("@/pages/platform/PlatformFeatureFlags"));
const PlatformRevenue = lazy(() => import("@/pages/platform/PlatformRevenue"));
const PlatformApplications = lazy(() => import("@/pages/platform/PlatformApplications"));
const PlatformAnalytics = lazy(() => import("@/pages/platform/PlatformAnalytics"));
const PlatformSettingsPage = lazy(() => import("@/pages/platform/PlatformSettings"));
// 🆕 2026-04-30 — 跨場域管理員 + 角色管理 + 稽核日誌 + 客服工單 + 計費警示
const PlatformAdmins = lazy(() => import("@/pages/platform/PlatformAdmins"));
const PlatformRoles = lazy(() => import("@/pages/platform/PlatformRoles"));
const PlatformAuditLogs = lazy(() => import("@/pages/platform/PlatformAuditLogs"));
const PlatformTickets = lazy(() => import("@/pages/platform/PlatformTickets"));
const PlatformBillingAlerts = lazy(() => import("@/pages/platform/PlatformBillingAlerts"));
const PlatformUsage = lazy(() => import("@/pages/platform/PlatformUsage"));
const PlatformBulkOps = lazy(() => import("@/pages/platform/PlatformBulkOps"));
const PlatformInsights = lazy(() => import("@/pages/platform/PlatformInsights"));
const PlatformAiCenter = lazy(() => import("@/pages/platform/PlatformAiCenter"));
const PlatformSecurity = lazy(() => import("@/pages/platform/PlatformSecurity"));
const PlatformErrorLogs = lazy(() => import("@/pages/platform/PlatformErrorLogs"));
const PlatformHealth = lazy(() => import("@/pages/platform/PlatformHealth"));
const PlatformIpWhitelist = lazy(() => import("@/pages/platform/PlatformIpWhitelist"));
const PlatformApiKeys = lazy(() => import("@/pages/platform/PlatformApiKeys"));
const PlatformLoginConfig = lazy(() => import("@/pages/platform/PlatformLoginConfig"));
const PlatformPwa = lazy(() => import("@/pages/platform/PlatformPwa"));
const PlatformNotifications = lazy(() => import("@/pages/platform/PlatformNotifications"));
const PlatformMenu = lazy(() => import("@/pages/platform/PlatformMenu"));

// 📝 公開申請頁（Phase 8）
const Apply = lazy(() => import("@/pages/Apply"));

// 🔑 平台擁有者緊急登入
const OwnerLogin = lazy(() => import("@/pages/OwnerLogin"));

// 💰 財務中心（v4.0 Phase 3）
const RevenueOverview = lazy(() => import("@/pages/revenue/RevenueOverview"));
const RevenueProducts = lazy(() => import("@/pages/revenue/RevenueProducts"));
const RevenueCodes = lazy(() => import("@/pages/revenue/RevenueCodes"));
const RevenueTransactions = lazy(() => import("@/pages/revenue/RevenueTransactions"));

// 💳 玩家會員中心（v4.0 Phase 4）
const MeCenter = lazy(() => import("@/pages/me/MeCenter"));

// 🎁 我的獎勵（Squad System Phase 7）
const MyRewards = lazy(() => import("@/pages/me/MyRewards"));

// 🔔 我的通知（Squad System Phase 11.4）
const MyInbox = lazy(() => import("@/pages/me/MyInbox"));

// 🌟 公開 Squad 分享頁（Squad System Phase 9.5）
const SquadPublic = lazy(() => import("@/pages/SquadPublic"));

// 🎫 推廣連結邀請頁（Squad System Phase 12.1）
const SquadInvite = lazy(() => import("@/pages/SquadInvite"));

// ⚙️ Squad 設定頁（Phase 16.1 + 16.3）
const SquadSettings = lazy(() => import("@/pages/SquadSettings"));

// 🏆 6 個排行榜（Squad System Phase 12.2）
const SquadLeaderboards = lazy(() => import("@/pages/SquadLeaderboards"));

// 🛡 Squad 系統一次到位（PR1）— 建立 / 我的隊伍
const SquadCreate = lazy(() => import("@/pages/SquadCreate"));
const MySquads = lazy(() => import("@/pages/MySquads"));

// 📺 ADR-0004: HostScreen 主控大螢幕模式（W1 D3 骨架）
const HostScreen = lazy(() => import("@/pages/HostScreen"));
const HostPlay = lazy(() => import("@/pages/HostPlay"));

// 🎬 ShowcaseHub 元件展示館（W1 D5 MVP）
const ShowcaseHub = lazy(() => import("@/pages/ShowcaseHub"));
// 🎯 TemplateMarket 12 情境模板市集（W6 D1）
const TemplateMarket = lazy(() => import("@/pages/TemplateMarket"));
const TemplateMarketDetail = lazy(() => import("@/pages/TemplateMarketDetail"));
// 📄 ScenarioQrPrint QR 列印頁（W6 D4）
const ScenarioQrPrint = lazy(() => import("@/pages/ScenarioQrPrint"));
// 🧭 FindScenarioWizard 3 問找情境（W7 D3）
const FindScenarioWizard = lazy(() => import("@/pages/FindScenarioWizard"));
// 🎤 PitchDeck 客戶銷售簡報頁（W7 D4）
const PitchDeck = lazy(() => import("@/pages/PitchDeck"));
// 💳 Pricing 公開定價頁（W10 D1）
const Pricing = lazy(() => import("@/pages/Pricing"));
// 📖 ApiDocs 公開 API 文件頁（W11 D4）
const ApiDocs = lazy(() => import("@/pages/ApiDocs"));
// 📅 預約系統（Phase δ W1 — 2026-05-07）
const BookPage = lazy(() => import("@/pages/booking/BookPage"));
const BookDonePage = lazy(() => import("@/pages/booking/BookDonePage"));
const MyBookingsPage = lazy(() => import("@/pages/booking/MyBookingsPage"));
// 📱 PlayLiff LINE LIFF 玩家入口（W14 D1）
const PlayLiff = lazy(() => import("@/pages/PlayLiff"));
// ❓ Faq 公開常見問題頁（W17 D2）
const Faq = lazy(() => import("@/pages/Faq"));
// 💰 RoiCalculator 公開 ROI 試算頁（W17 D3）
const RoiCalculator = lazy(() => import("@/pages/RoiCalculator"));

// 📺 Admin Host Session 管理（W2 D5）
const AdminHostSessions = lazy(() => import("@/pages/admin/AdminHostSessions"));

// 📡 Admin Multi-Sessions 即時連線監控（Phase 0.1 / 2026-05-08）
const AdminMultiSessions = lazy(() => import("@/pages/admin/AdminMultiSessions"));

// 🎬 Admin Session Replay 完整時間軸（Phase 0.3 / 2026-05-08）
const AdminSessionReplay = lazy(() => import("@/pages/admin/AdminSessionReplay"));

// 📊 Admin Reports 活動結束報告（Phase 5 / 2026-05-10）
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));

// ⚙️ 場域行銷設定（Squad System Phase 12.6）
const AdminEngagementSettings = lazy(() => import("@/pages/admin/AdminEngagementSettings"));

// 📊 獎勵分析 Dashboard（Squad System Phase 12 加值）
const AdminRewardsAnalytics = lazy(() => import("@/pages/admin/AdminRewardsAnalytics"));

// 📈 推廣連結 Cohort 分析（Phase 17.1）
const AdminInvitesCohort = lazy(() => import("@/pages/admin/AdminInvitesCohort"));

// 📊 PWA 使用情境分析（Phase D — PWA 用戶流動線優化）
const PwaUsageAnalytics = lazy(() => import("@/pages/admin/PwaUsageAnalytics"));

// 🔬 A/B 實驗（P14-7 / Wave 2）
const AbExperiments = lazy(() => import("@/pages/admin/AbExperiments"));

// 🎬 遊戲預覽模式（草稿可預覽，不污染資料）
const GamePreview = lazy(() => import("@/pages/GamePreview"));

// 🤖 AI 實測清單（admin 內頁）
const AiTestChecklist = lazy(() => import("@/pages/admin/AiTestChecklist"));

// 🏢 場域總部 — 我的方案（v4.0 Phase 6）
const MySubscription = lazy(() => import("@/pages/field/MySubscription"));

/** 需要登入的對戰路由守衛 */
function AuthBattleRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!user) return <Redirect to="/battle" />;
  return <Component />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* 🏢 場域專屬路由 /f/:fieldCode/* — 明確場域路徑，方便分享 */}
        <Route path="/f" component={FieldEntry} />
        <Route path="/f/:fieldCode" component={Landing} />
        <Route path="/f/:fieldCode/home" component={Home} />
        <Route path="/f/:fieldCode/leaderboard" component={Leaderboard} />
        <Route path="/f/:fieldCode/game/:gameId/chapters/:chapterId" component={GamePlay} />
        <Route path="/f/:fieldCode/game/:gameId/chapters" component={ChapterSelect} />
        <Route path="/f/:fieldCode/game/:gameId" component={GamePlay} />
        <Route path="/f/:fieldCode/team/:gameId" component={TeamLobby} />
        <Route path="/f/:fieldCode/match/:gameId" component={MatchLobby} />
        <Route path="/f/:fieldCode/map/:gameId" component={MapView} />
        <Route path="/f/:fieldCode/purchase/gate/:gameId" component={PurchaseGate} />
        <Route path="/f/:fieldCode/purchase/success" component={PurchaseSuccess} />
        <Route path="/f/:fieldCode/purchases" component={MyPurchases} />
        <Route path="/f/:fieldCode/me" component={MeCenter} />
        <Route path="/f/:fieldCode/checkout/:productId" component={Checkout} />
        {/* 🆕 v2: Session 相簿（場域感知路徑 + legacy 相容路徑） */}
        <Route path="/f/:fieldCode/album/:sessionId" component={SessionAlbum} />
        <Route path="/album/:sessionId" component={SessionAlbum} />
        {/* 🆕 v2: 個人相簿 */}
        <Route path="/f/:fieldCode/me/photos" component={MyPhotos} />
        <Route path="/me/photos" component={MyPhotos} />
        <Route path="/f/:fieldCode/me/rewards" component={MyRewards} />
        <Route path="/me/rewards" component={MyRewards} />
        <Route path="/f/:fieldCode/me/inbox" component={MyInbox} />
        <Route path="/me/inbox" component={MyInbox} />
        {/* 📺 ADR-0004 HostScreen 軸線 — 大螢幕端與玩家端（無需 Firebase auth）*/}
        <Route path="/host/:sessionId" component={HostScreen} />
        <Route path="/play/:sessionId" component={HostPlay} />

        {/* 📅 預約系統 Phase δ W1 (2026-05-07) — 公開頁、LIFF 內運作 */}
        <Route path="/book/:fieldCode/done/:bookingCode" component={BookDonePage} />
        <Route path="/book/:fieldCode/mine" component={MyBookingsPage} />
        <Route path="/book/:fieldCode" component={BookPage} />

        {/* 🎬 元件展示館（公開頁，銷售工具）*/}
        <Route path="/showcase" component={ShowcaseHub} />

        {/* 🎯 12 情境模板市集（公開頁，銷售工具）*/}
        <Route path="/template-market/:scenarioId" component={TemplateMarketDetail} />
        <Route path="/template-market" component={TemplateMarket} />

        {/* 📄 情境實例 QR 列印頁（W6 D4，admin 用）*/}
        <Route path="/admin/scenario-qr-print" component={ScenarioQrPrint} />

        {/* 🧭 3 問找情境 wizard（W7 D3，公開頁）*/}
        <Route path="/find-scenario" component={FindScenarioWizard} />

        {/* 🎤 客戶銷售簡報頁（W7 D4，公開頁）*/}
        <Route path="/pitch" component={PitchDeck} />

        {/* 💳 公開定價頁（W10 D1）*/}
        <Route path="/pricing" component={Pricing} />

        {/* ❓ 公開常見問題頁（W17 D2）*/}
        <Route path="/faq" component={Faq} />

        {/* 💰 公開 ROI 試算頁（W17 D3）*/}
        <Route path="/roi" component={RoiCalculator} />

        {/* 📖 Public API 文件頁（W11 D4）*/}
        <Route path="/api-docs" component={ApiDocs} />

        {/* 📱 LINE LIFF 玩家入口（W14 D1）*/}
        <Route path="/liff/play/:sessionId" component={PlayLiff} />

        <Route path="/squad/create" component={SquadCreate} />
        <Route path="/squad/:squadId/settings" component={SquadSettings} />
        <Route path="/squad/:squadId" component={SquadPublic} />
        <Route path="/invite/squad/:token" component={SquadInvite} />
        <Route path="/squads/leaderboards" component={SquadLeaderboards} />
        <Route path="/me/squads" component={MySquads} />
        <Route path="/f/:fieldCode/me/squads" component={MySquads} />

        {/* 🌐 CHITO 平台智能入口：有上次場域自動導 /f/{code}，沒有則顯示 CHITO 品牌頁 */}
        <Route path="/" component={PlatformHome} />

        {/* 玩家端 — legacy 路徑自動 smart-redirect 到 /f/{code}/... 保持 URL 一致性 */}
        <Route path="/j/:code" component={JoinWalkie} />
        <Route path="/home">{() => <SmartRedirect to="/home" />}</Route>
        <Route path="/leaderboard">{() => <SmartRedirect to="/leaderboard" />}</Route>
        <Route path="/me">{() => <SmartRedirect to="/me" />}</Route>
        <Route path="/purchases">{() => <SmartRedirect to="/purchases" />}</Route>
        <Route path="/me/purchases">{() => <SmartRedirect to="/purchases" />}</Route>

        {/* 遊戲深連結 — 暫保留相容（Home/Team/Match 內部有 useCurrentField 兜底）*/}
        <Route path="/game/:gameId/chapters/:chapterId" component={GamePlay} />
        <Route path="/game/:gameId/chapters" component={ChapterSelect} />
        <Route path="/game/:gameId" component={GamePlay} />
        <Route path="/team/:gameId" component={TeamLobby} />
        <Route path="/match/:gameId" component={MatchLobby} />
        <Route path="/map/:gameId" component={MapView} />
        <Route path="/game/:gameId/purchase" component={PurchaseGate} />
        <Route path="/purchase/gate/:gameId" component={PurchaseGate} />
        <Route path="/purchase/success" component={PurchaseSuccess} />

        {/* 💳 統一結帳頁（v4.0 Phase 4）*/}
        <Route path="/checkout/:productId" component={Checkout} />

        {/* 水彈對戰 PK 擂台 */}
        <Route path="/battle" component={BattleHome} />
        <Route path="/battle/slot/:slotId" component={BattleSlotDetail} />
        <Route path="/battle/slot/:slotId/result" component={BattleResult} />
        <Route path="/battle/ranking" component={BattleRanking} />
        <Route path="/battle/history">{() => <AuthBattleRoute component={BattleHistory} />}</Route>
        <Route path="/battle/clan/create">{() => <AuthBattleRoute component={BattleClanCreate} />}</Route>
        <Route path="/battle/clan/:clanId" component={BattleClanDetail} />
        <Route path="/battle/my">{() => <AuthBattleRoute component={BattleMyProfile} />}</Route>
        <Route path="/battle/notifications">{() => <AuthBattleRoute component={BattleNotifications} />}</Route>
        <Route path="/battle/achievements">{() => <AuthBattleRoute component={BattleAchievements} />}</Route>
        <Route path="/battle/seasons">{() => <AuthBattleRoute component={BattleSeasonHistory} />}</Route>

        {/* 管理端登入 */}
        <Route path="/admin/login" component={FieldAdminLogin} />

        {/* 管理端 — 統一在 /admin/* 下（ProtectedAdminRoute 保護） */}
        <Route path="/admin">{() => <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games">{() => <ProtectedAdminRoute><AdminGames /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId">{() => <ProtectedAdminRoute><GameEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/sessions">{() => <ProtectedAdminRoute><AdminSessions /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/bookings">{() => <ProtectedAdminRoute><AdminBookings /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/live">{() => <ProtectedAdminRoute><AdminLive /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/suspicious-log">{() => <ProtectedAdminRoute><AdminSuspiciousLog /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/devices">{() => <ProtectedAdminRoute><AdminDevices /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/analytics">{() => <ProtectedAdminRoute><AdminAnalytics /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/leaderboard">{() => <ProtectedAdminRoute><AdminLeaderboard /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/settings">{() => <ProtectedAdminRoute><AdminSettings /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/templates">{() => <ProtectedAdminRoute><AdminTemplates /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/locations">{() => <ProtectedAdminRoute><LocationEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/items">{() => <ProtectedAdminRoute><ItemEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/achievements">{() => <ProtectedAdminRoute><AchievementEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/settings">{() => <ProtectedAdminRoute><GameSettings /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/tickets">{() => <ProtectedAdminRoute><AdminRedeemCodes /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/field-settings">{() => <ProtectedAdminRoute><FieldSettingsPage /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/tickets">{() => <ProtectedAdminRoute><TicketsOverview /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/exemplar-library">{() => <ProtectedAdminRoute><ExemplarLibrary /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/game-generator">{() => <ProtectedAdminRoute><GameGenerator /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/routes">{() => <ProtectedAdminRoute><GameRoutesEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/manual">{() => <ProtectedAdminRoute><ManualPage /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/dev-tools">{() => <ProtectedAdminRoute><DevTools /></ProtectedAdminRoute>}</Route>
        <Route path="/test-impersonate" component={TestImpersonate} />
        <Route path="/admin/fields">{() => <ProtectedAdminRoute><AdminStaffFields /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/roles">{() => <ProtectedAdminRoute><AdminStaffRoles /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/accounts">{() => <ProtectedAdminRoute><AdminStaffAccounts /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/audit-logs">{() => <ProtectedAdminRoute><AdminStaffAuditLogs /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/players">{() => <ProtectedAdminRoute><AdminStaffPlayers /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/qrcodes">{() => <ProtectedAdminRoute><AdminStaffQRCodes /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/battle/dashboard">{() => <ProtectedAdminRoute><AdminBattleDashboard /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/battle/venues">{() => <ProtectedAdminRoute><AdminBattleVenues /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/battle/slots">{() => <ProtectedAdminRoute><AdminBattleSlots /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/battle/rankings">{() => <ProtectedAdminRoute><AdminBattleRankings /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/battle/seasons">{() => <ProtectedAdminRoute><AdminBattleSeasons /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/rewards/rules">{() => <ProtectedAdminRoute><AdminRewardsRules /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/engagement">{() => <ProtectedAdminRoute><AdminEngagementSettings /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/ab-experiments">{() => <ProtectedAdminRoute><AbExperiments /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId/preview">{(params) => <ProtectedAdminRoute><GamePreview gameId={params.gameId} /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/ai-test-checklist">{() => <ProtectedAdminRoute><AiTestChecklist /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/rewards/analytics">{() => <ProtectedAdminRoute><AdminRewardsAnalytics /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/invites/cohort">{() => <ProtectedAdminRoute><AdminInvitesCohort /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/pwa-analytics">{() => <ProtectedAdminRoute><PwaUsageAnalytics /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/host-sessions">{() => <ProtectedAdminRoute><AdminHostSessions /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/multi-sessions">{() => <ProtectedAdminRoute><AdminMultiSessions /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/sessions/:sessionId/replay">{() => <ProtectedAdminRoute><AdminSessionReplay /></ProtectedAdminRoute>}</Route>

        {/* 🌐 SaaS 平台後台（限 super_admin / platform_admins）*/}
        <Route path="/platform">{() => <ProtectedAdminRoute><PlatformDashboard /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/fields">{() => <ProtectedAdminRoute><PlatformFields /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/plans">{() => <ProtectedAdminRoute><PlatformPlans /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/feature-flags">{() => <ProtectedAdminRoute><PlatformFeatureFlags /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/revenue">{() => <ProtectedAdminRoute><PlatformRevenue /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/applications">{() => <ProtectedAdminRoute><PlatformApplications /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/analytics">{() => <ProtectedAdminRoute><PlatformAnalytics /></ProtectedAdminRoute>}</Route>
        {/* 🆕 跨場域管理員 + 角色 + 稽核日誌 */}
        <Route path="/platform/admins">{() => <ProtectedAdminRoute><PlatformAdmins /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/roles">{() => <ProtectedAdminRoute><PlatformRoles /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/audit-logs">{() => <ProtectedAdminRoute><PlatformAuditLogs /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/tickets">{() => <ProtectedAdminRoute><PlatformTickets /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/billing-alerts">{() => <ProtectedAdminRoute><PlatformBillingAlerts /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/usage">{() => <ProtectedAdminRoute><PlatformUsage /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/bulk-ops">{() => <ProtectedAdminRoute><PlatformBulkOps /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/insights">{() => <ProtectedAdminRoute><PlatformInsights /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/ai-center">{() => <ProtectedAdminRoute><PlatformAiCenter /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/security">{() => <ProtectedAdminRoute><PlatformSecurity /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/errors">{() => <ProtectedAdminRoute><PlatformErrorLogs /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/health">{() => <ProtectedAdminRoute><PlatformHealth /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/ip-whitelist">{() => <ProtectedAdminRoute><PlatformIpWhitelist /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/api-keys">{() => <ProtectedAdminRoute><PlatformApiKeys /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/login-config">{() => <ProtectedAdminRoute><PlatformLoginConfig /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/pwa">{() => <ProtectedAdminRoute><PlatformPwa /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/notifications">{() => <ProtectedAdminRoute><PlatformNotifications /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/menu-management">{() => <ProtectedAdminRoute><PlatformMenu /></ProtectedAdminRoute>}</Route>
        <Route path="/platform/settings">{() => <ProtectedAdminRoute><PlatformSettingsPage /></ProtectedAdminRoute>}</Route>

        {/* 📝 公開場域申請（Phase 8）*/}
        <Route path="/apply" component={Apply} />

        {/* 🔑 平台擁有者緊急登入（OAuth 未配置時使用）*/}
        <Route path="/owner-login" component={OwnerLogin} />

        {/* 🏢 場域總部 / 我的方案（Phase 6）*/}
        <Route path="/admin/field/subscription">{() => <ProtectedAdminRoute><MySubscription /></ProtectedAdminRoute>}</Route>

        {/* 💰 財務中心（Phase 3）*/}
        <Route path="/admin/revenue">{() => <ProtectedAdminRoute><RevenueOverview /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/revenue/products">{() => <ProtectedAdminRoute><RevenueProducts /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/revenue/codes">{() => <ProtectedAdminRoute><RevenueCodes /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/revenue/transactions">{() => <ProtectedAdminRoute><RevenueTransactions /></ProtectedAdminRoute>}</Route>

        {/* /admin-staff/* 向後兼容 — 重導向到 /admin/* */}
        <Route path="/admin-staff">{() => <Redirect to="/admin/login" />}</Route>
        <Route path="/admin-staff/login">{() => <Redirect to="/admin/login" />}</Route>
        <Route path="/admin-staff/dashboard">{() => <Redirect to="/admin" />}</Route>
        <Route path="/admin-staff/fields">{() => <Redirect to="/admin/fields" />}</Route>
        <Route path="/admin-staff/games">{() => <Redirect to="/admin/games" />}</Route>
        <Route path="/admin-staff/templates">{() => <Redirect to="/admin/templates" />}</Route>
        <Route path="/admin-staff/roles">{() => <Redirect to="/admin/roles" />}</Route>
        <Route path="/admin-staff/accounts">{() => <Redirect to="/admin/accounts" />}</Route>
        <Route path="/admin-staff/audit-logs">{() => <Redirect to="/admin/audit-logs" />}</Route>
        <Route path="/admin-staff/players">{() => <Redirect to="/admin/players" />}</Route>
        <Route path="/admin-staff/qrcodes">{() => <Redirect to="/admin/qrcodes" />}</Route>
        <Route path="/admin-staff/field-settings">{() => <Redirect to="/admin/field-settings" />}</Route>
        <Route path="/admin-staff/tickets">{() => <Redirect to="/admin/tickets" />}</Route>

        {/* 玩家透過 QR Code / slug 進入遊戲 */}
        <Route path="/g/:slug" component={GameBySlug} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const { isOnline } = useOfflineSync();
  // 🆕 啟用前端錯誤全域上報（掛 window.error / unhandledrejection）
  // 2026-05-03：恢復啟用（4/24 hotfix 懷疑與 React error #310 相關但未確認、
  //   hook 程式碼已含 rate limit / dedup / fail-silent / keepalive 保險、
  //   後台 PlatformErrorLogs 等待此資料才能查 client crash）
  useErrorReport();
  // 🆕 2026-05-07：初始化文字大小縮放（從 localStorage 讀、套到 :root --font-scale）
  useFontScale();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WebSocketProvider>
          <FieldThemeProvider>
            <I18nProvider>
              <BgmPlayerProvider>
              <TooltipProvider>
                <ThemePreviewBanner />
                <OfflineBanner isOnline={isOnline} />
                <Toaster />
                <Router />
                <PlayerBottomNav />
                <FloatingHomeButton />
                <FloatingFontScale />
                <FloatingBgmMute />
                <PWAInstallPrompt />
                <AppUpdateChecker />
                <WelcomeSquadsTrigger />
              </TooltipProvider>
              </BgmPlayerProvider>
            </I18nProvider>
          </FieldThemeProvider>
          </WebSocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
