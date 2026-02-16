import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedAdminRoute from "@/components/shared/ProtectedAdminRoute";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import GamePlay from "@/pages/GamePlay";
import MapView from "@/pages/MapView";
import Leaderboard from "@/pages/Leaderboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminGames from "@/pages/AdminGames";
import AdminDevices from "@/pages/admin-devices";
import AdminAnalytics from "@/pages/AdminAnalytics";
import AdminSessions from "@/pages/AdminSessions";
import AdminLeaderboard from "@/pages/AdminLeaderboard";
import AdminSettings from "@/pages/AdminSettings";
import GameEditor from "@/pages/game-editor";
import LocationEditor from "@/pages/LocationEditor";
import ItemEditor from "@/pages/ItemEditor";
import AchievementEditor from "@/pages/AchievementEditor";
import GameSettings from "@/pages/GameSettings";
import AdminLogin from "@/pages/AdminLogin";
import FieldAdminLogin from "@/pages/FieldAdminLogin";
import AdminStaffDashboard from "@/pages/AdminStaffDashboard";
import AdminStaffFields from "@/pages/AdminStaffFields";
import AdminStaffRoles from "@/pages/AdminStaffRoles";
import AdminStaffAccounts from "@/pages/AdminStaffAccounts";
import AdminStaffAuditLogs from "@/pages/AdminStaffAuditLogs";
import AdminStaffGames from "@/pages/AdminStaffGames";
import AdminStaffPlayers from "@/pages/AdminStaffPlayers";
import AdminStaffQRCodes from "@/pages/AdminStaffQRCodes";
import GameBySlug from "@/pages/GameBySlug";
import TeamLobby from "@/pages/TeamLobby";
import ChapterSelect from "@/pages/ChapterSelect";
import AdminTemplates from "@/pages/AdminTemplates";
import AdminStaffTemplates from "@/pages/AdminStaffTemplates";

function Router() {
  return (
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
