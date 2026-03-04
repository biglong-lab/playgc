import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedAdminRoute from "@/components/shared/ProtectedAdminRoute";
import PageLoader from "@/components/shared/PageLoader";
import OfflineBanner from "@/components/shared/OfflineBanner";
import { useOfflineSync } from "@/hooks/useOfflineSync";

// 首屏路由 — 靜態 import（不需 lazy）
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

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

// 水彈對戰 PK 擂台
const BattleHome = lazy(() => import("@/pages/BattleHome"));
const BattleSlotDetail = lazy(() => import("@/pages/BattleSlotDetail"));

// 管理端 — 統一在 /admin/* 下
const FieldAdminLogin = lazy(() => import("@/pages/FieldAdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminGames = lazy(() => import("@/pages/AdminGames"));
const AdminDevices = lazy(() => import("@/pages/admin-devices"));
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminSessions = lazy(() => import("@/pages/AdminSessions"));
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
const AdminStaffFields = lazy(() => import("@/pages/AdminStaffFields"));
const AdminStaffRoles = lazy(() => import("@/pages/AdminStaffRoles"));
const AdminStaffAccounts = lazy(() => import("@/pages/AdminStaffAccounts"));
const AdminStaffAuditLogs = lazy(() => import("@/pages/AdminStaffAuditLogs"));
const AdminStaffPlayers = lazy(() => import("@/pages/AdminStaffPlayers"));
const AdminStaffQRCodes = lazy(() => import("@/pages/AdminStaffQRCodes"));
const AdminBattleVenues = lazy(() => import("@/pages/AdminBattleVenues"));
const AdminBattleSlots = lazy(() => import("@/pages/AdminBattleSlots"));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* 玩家端 */}
        <Route path="/" component={Landing} />
        <Route path="/home" component={Home} />
        <Route path="/game/:gameId/chapters/:chapterId" component={GamePlay} />
        <Route path="/game/:gameId/chapters" component={ChapterSelect} />
        <Route path="/game/:gameId" component={GamePlay} />
        <Route path="/team/:gameId" component={TeamLobby} />
        <Route path="/match/:gameId" component={MatchLobby} />
        <Route path="/map/:gameId" component={MapView} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/game/:gameId/purchase" component={PurchaseGate} />
        <Route path="/purchase/gate/:gameId" component={PurchaseGate} />
        <Route path="/purchase/success" component={PurchaseSuccess} />
        <Route path="/purchases" component={MyPurchases} />

        {/* 管理端登入 */}
        <Route path="/admin/login" component={FieldAdminLogin} />

        {/* 管理端 — 統一在 /admin/* 下（ProtectedAdminRoute 保護） */}
        <Route path="/admin">{() => <ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games">{() => <ProtectedAdminRoute><AdminGames /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/games/:gameId">{() => <ProtectedAdminRoute><GameEditor /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/sessions">{() => <ProtectedAdminRoute><AdminSessions /></ProtectedAdminRoute>}</Route>
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
        <Route path="/admin/fields">{() => <ProtectedAdminRoute><AdminStaffFields /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/roles">{() => <ProtectedAdminRoute><AdminStaffRoles /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/accounts">{() => <ProtectedAdminRoute><AdminStaffAccounts /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/audit-logs">{() => <ProtectedAdminRoute><AdminStaffAuditLogs /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/players">{() => <ProtectedAdminRoute><AdminStaffPlayers /></ProtectedAdminRoute>}</Route>
        <Route path="/admin/qrcodes">{() => <ProtectedAdminRoute><AdminStaffQRCodes /></ProtectedAdminRoute>}</Route>

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

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <TooltipProvider>
              <OfflineBanner isOnline={isOnline} />
              <Toaster />
              <Router />
            </TooltipProvider>
          </I18nProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
