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

// 管理端（場主） — lazy import
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
const FieldAdminLogin = lazy(() => import("@/pages/FieldAdminLogin"));

// 管理端（場域管理員） — lazy import
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminStaffDashboard = lazy(() => import("@/pages/AdminStaffDashboard"));
const AdminStaffFields = lazy(() => import("@/pages/AdminStaffFields"));
const AdminStaffRoles = lazy(() => import("@/pages/AdminStaffRoles"));
const AdminStaffAccounts = lazy(() => import("@/pages/AdminStaffAccounts"));
const AdminStaffAuditLogs = lazy(() => import("@/pages/AdminStaffAuditLogs"));
const AdminStaffGames = lazy(() => import("@/pages/AdminStaffGames"));
const AdminStaffPlayers = lazy(() => import("@/pages/AdminStaffPlayers"));
const AdminStaffQRCodes = lazy(() => import("@/pages/AdminStaffQRCodes"));
const AdminStaffTemplates = lazy(() => import("@/pages/AdminStaffTemplates"));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/home" component={Home} />
        <Route path="/game/:gameId/chapters/:chapterId" component={GamePlay} />
        <Route path="/game/:gameId/chapters" component={ChapterSelect} />
        <Route path="/game/:gameId" component={GamePlay} />
        <Route path="/team/:gameId" component={TeamLobby} />
        <Route path="/map/:gameId" component={MapView} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/admin/login" component={FieldAdminLogin} />
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
        {/* Admin Staff Routes - 場域管理員登入系統 */}
        <Route path="/admin-staff">{() => <Redirect to="/admin-staff/login" />}</Route>
        <Route path="/admin-staff/login" component={AdminLogin} />
        <Route path="/admin-staff/dashboard" component={AdminStaffDashboard} />
        <Route path="/admin-staff/fields" component={AdminStaffFields} />
        <Route path="/admin-staff/games" component={AdminStaffGames} />
        <Route path="/admin-staff/templates" component={AdminStaffTemplates} />
        <Route path="/admin-staff/games/:gameId" component={GameEditor} />
        <Route path="/admin-staff/games/:gameId/items" component={ItemEditor} />
        <Route path="/admin-staff/games/:gameId/achievements" component={AchievementEditor} />
        <Route path="/admin-staff/games/:gameId/locations" component={LocationEditor} />
        <Route path="/admin-staff/games/:gameId/settings" component={GameSettings} />
        <Route path="/admin-staff/roles" component={AdminStaffRoles} />
        <Route path="/admin-staff/accounts" component={AdminStaffAccounts} />
        <Route path="/admin-staff/audit-logs" component={AdminStaffAuditLogs} />
        <Route path="/admin-staff/players" component={AdminStaffPlayers} />
        <Route path="/admin-staff/qrcodes" component={AdminStaffQRCodes} />
        {/* Game by Slug - 玩家透過 QR Code 進入遊戲 */}
        <Route path="/g/:slug" component={GameBySlug} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <TooltipProvider>
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
