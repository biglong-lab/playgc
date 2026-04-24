import { useState, useEffect, useMemo } from "react";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import SearchKbdHint from "@/components/shared/SearchKbdHint";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { signOut, signInWithGoogle } from "@/lib/firebase";
import { apiRequest } from "@/lib/queryClient";
import type { Game, GameSession, BattleSlot } from "@shared/schema";
import {
  Gamepad2, Clock, Users, Zap, Search, Filter,
  Star, MapPin, Trophy, Play, LogOut, RotateCcw, CheckCircle2, Swords, TrendingUp, UserCircle,
  X, ArrowRight,
} from "lucide-react";
import AnnouncementBanner from "@/components/shared/AnnouncementBanner";
import { AnonymousNameDialog } from "@/components/shared/AnonymousNameDialog";
import { isAnonymousPlayer, getPlayerDisplayName } from "@shared/lib/playerDisplay";
import { useToast } from "@/hooks/use-toast";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import OptimizedImage from "@/components/shared/OptimizedImage";
import GenericCoverFallback from "@/components/shared/GenericCoverFallback";

interface UserGameStatus {
  gameId: string;
  status: "playing" | "completed";
  sessionId: string;
  score: number;
}

/** 🆕 依當前時段產生問候（早安 / 午安 / 晚安）— 呼應 CHITO 首頁 Hero 時段氛圍 */
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "☀️ 早安，準備出發";
  if (h >= 11 && h < 14) return "🌞 午安，來趟走踏";
  if (h >= 14 && h < 18) return "⛅ 午後好時光";
  if (h >= 18 && h < 22) return "🌅 傍晚遊歷";
  return "🌙 夜遊尋寶";
}

/** 批次遊戲統計 map: { [gameId]: { totalPlays, uniquePlayers, completedPlays } } */
type GameStatsMap = Record<
  string,
  { totalPlays: number; uniquePlayers: number; completedPlays: number }
>;

export default function Home() {
  const { user, firebaseUser, isLoading: authLoading, isSignedIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  // 🆕 搜尋條件和 filter 存 localStorage，重整或切回頁保持使用者操作
  const [searchQuery, setSearchQuery] = useLocalStorageState("home_search_query", "");
  const [difficultyFilter, setDifficultyFilter] = useLocalStorageState<string | null>(
    "home_difficulty_filter",
    null,
  );

  // 🆕 匿名命名 Dialog 狀態
  const [anonymousNameOpen, setAnonymousNameOpen] = useState(false);
  const [pendingGameNavigation, setPendingGameNavigation] = useState<(() => void) | null>(null);

  // 使用者是否為匿名（Firebase 匿名登入 / 無名字）
  const isAnonymous = user
    ? isAnonymousPlayer({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      })
    : false;

  // 🆕 當前場域資料（name / logo / coverImage / welcome）
  const currentField = useCurrentField();
  const link = useFieldLink();
  const fieldName = currentField?.name || "CHITO";
  const fieldLogoUrl = currentField?.logoUrl || null;
  const fieldCoverUrl = currentField?.theme?.coverImageUrl || null;
  const welcomeMessage = currentField?.welcomeMessage || null;
  const announcement = currentField?.announcement || null;

  // 🔒 場域隔離：取當前場域 code 帶進 query，不讓跨場域遊戲混入
  // 🔧 bug 修 (2026-04-24)：優先從 URL :fieldCode 取值，不依賴 localStorage 同步的 useCurrentField
  //    原本 bug：首次載入時 useCurrentField 讀 localStorage 舊值 → games query 用舊 fieldCode
  //    → 顯示跨場域遊戲 (如賈村 URL 下顯示後浦遊戲)，重整才修復
  const urlParams = useParams<{ fieldCode?: string }>();
  const urlFieldCode = urlParams.fieldCode?.toUpperCase();
  const currentFieldCode = urlFieldCode || currentField?.code;
  const gamesQueryKey = currentFieldCode
    ? [`/api/games?fieldCode=${currentFieldCode}`]
    : ["/api/games"];
  const statsQueryKey = currentFieldCode
    ? [`/api/games-stats/public?fieldCode=${currentFieldCode}`]
    : ["/api/games-stats/public"];

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: gamesQueryKey,
    // 🔧 bug 修：無 fieldCode 時不 fetch，避免抓到跨場域全部遊戲
    enabled: !!currentFieldCode,
  });

  /** 🆕 批次拿所有遊戲的累計統計（60s 快取，不顯示即時人數避免資料不穩） */
  const { data: statsMap } = useQuery<GameStatsMap>({
    queryKey: statsQueryKey,
    staleTime: 60_000,
    enabled: !!currentFieldCode,   // 🔧 bug 修同上
  });

  const { data: userSessions } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch("/api/sessions", {
        credentials: 'include',
        headers,
      });
      if (response.ok) {
        return response.json();
      }
      return [];
    },
    enabled: !!user,
  });

  const gameStatusMap = new Map<string, UserGameStatus>();
  if (userSessions) {
    userSessions.forEach(session => {
      if (!session.gameId) return;
      if (session.status === "playing" || session.status === "completed") {
        const existing = gameStatusMap.get(session.gameId);
        if (!existing || (session.status === "playing" && existing.status === "completed")) {
          gameStatusMap.set(session.gameId, {
            gameId: session.gameId,
            status: session.status as "playing" | "completed",
            sessionId: session.id,
            score: session.score || 0,
          });
        }
      }
    });
  }

  const handleSignOut = async () => {
    // 🆕 登出前確認，避免誤按（尤其手機觸控）
    if (!window.confirm("確定要登出嗎？")) return;
    await signOut();
    setLocation("/");
  };

  // 🆕 顯示名稱（優先序：firstName > localStorage anon 名 > 預設）— memoize，避免每次 render 都讀 localStorage
  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    try {
      return localStorage.getItem("anonymous_player_name") || "玩家";
    } catch {
      return "玩家";
    }
  }, [user?.firstName]);

  // 🆕 匿名 dialog 的初始值（讀 localStorage 一次即可）
  const savedAnonName = useMemo(() => {
    try {
      return localStorage.getItem("anonymous_player_name") || "";
    } catch {
      return "";
    }
  }, []);

  // 🆕 玩家戰績摘要（已完成場次 + 累計分數 + 不重複遊戲數）
  const playerStats = useMemo(() => {
    if (!userSessions) return { completedCount: 0, totalScore: 0, uniqueGamesCount: 0 };
    const completed = userSessions.filter((s) => s.status === "completed");
    const uniqueGames = new Set<string>();
    let totalScore = 0;
    for (const s of completed) {
      totalScore += s.score || 0;
      if (s.gameId) uniqueGames.add(s.gameId);
    }
    return {
      completedCount: completed.length,
      totalScore,
      uniqueGamesCount: uniqueGames.size,
    };
  }, [userSessions]);

  // 🆕 搜尋框鍵盤 shortcut — 抽到共用 hook（`/` / `⌘K` / `Ctrl+K` / Esc 清空）
  const { inputRef: searchInputRef, isMac, handleEscape } = useSearchShortcut<HTMLInputElement>();

  // 🚨 2026-04-24 hotfix for React error #310：
  // 此 useMemo 原本在兩個 early return 之後（line 235），違反 hook 規則。
  // 當 authLoading: true → false 時，hook 數量從 17 變 18，React throw #310。
  // 修復：所有 hook 都必須在任何 return 之前宣告。
  const difficultyCount = useMemo(() => {
    const counts = { all: 0, easy: 0, medium: 0, hard: 0 };
    (games ?? []).forEach((g) => {
      counts.all++;
      const d = g.difficulty;
      if (d === "easy") counts.easy++;
      else if (d === "medium") counts.medium++;
      else if (d === "hard") counts.hard++;
    });
    return counts;
  }, [games]);

  // 🔥 改用 useEffect 確保跳轉在 render 之後執行
  // 避免「Login Dialog 剛關閉 → Firebase onAuthStateChanged 還沒跑 → isSignedIn=false → 立刻跳回首頁」
  // 的時序 bug。給 Firebase 一個 buffer 時間讓 auth state 同步。
  useEffect(() => {
    if (!authLoading && !isSignedIn) {
      // 延遲 200ms 再決定，確保 Firebase auth state 完全同步
      const timer = setTimeout(() => {
        if (!isSignedIn) setLocation("/");
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [authLoading, isSignedIn, setLocation]);

  // Loading 狀態：Firebase 還在 init、或剛登入等 auth state 同步
  if (authLoading || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">同步用戶資料...</p>
        </div>
      </div>
    );
  }

  const filteredGames = games?.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = !difficultyFilter || game.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  // difficultyCount 已在 early return 前宣告（React hook 規則）

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-success/20 text-success border-success/30";
      case "medium": return "bg-warning/20 text-warning border-warning/30";
      case "hard": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "簡單";
      case "medium": return "中等";
      case "hard": return "困難";
      default: return difficulty;
    }
  };

  // 🆕 CTA 文案依 gameStructure / gameMode 動態化
  const getStartLabel = (game: Game): string => {
    if (game.gameStructure === "chapters") return "選擇章節";
    if (game.gameMode === "team") return "創建或加入隊伍";
    if (game.gameMode === "relay") return "開始接力賽";
    if (game.gameMode === "competitive") return "開始競賽";
    return "開始遊戲";
  };

  const getReplayLabel = (game: Game): string => {
    if (game.gameStructure === "chapters") return "重新挑戰章節";
    if (game.gameMode === "team") return "重新組隊";
    return "再玩一次";
  };

  const getContinueLabel = (game: Game): string => {
    if (game.gameStructure === "chapters") return "繼續章節";
    if (game.gameMode === "team") return "返回隊伍";
    return "返回遊戲";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {fieldLogoUrl ? (
                <img
                  src={fieldLogoUrl}
                  alt={fieldName}
                  className="w-10 h-10 rounded-lg object-contain bg-primary/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-primary" />
                </div>
              )}
              <div>
                <h1 className="font-display font-bold text-lg truncate max-w-[200px]" title={fieldName}>
                  {fieldName}
                </h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="home-greeting">
                  {getTimeGreeting()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href={link("/leaderboard")}>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-leaderboard">
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">排行榜</span>
                </Button>
              </Link>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium hidden sm:inline">
                  {user.firstName || user.email?.split("@")[0] || displayName}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={firebaseUser?.photoURL || user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {(displayName[0] || user.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSignOut} data-testid="button-signout">
                      <LogOut className="w-4 h-4 mr-2" />
                      登出
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 🆕 場域公告 banner — info 可關 / urgent 不可關 */}
      <AnnouncementBanner announcement={announcement} severity={currentField?.announcementSeverity} />


      {/* 🆕 場域 Hero Banner（有 coverImageUrl 才顯示） */}
      {fieldCoverUrl && (
        <div className="relative w-full h-48 md:h-64 overflow-hidden">
          <img
            src={fieldCoverUrl}
            alt={fieldName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 flex items-end">
            <div className="container mx-auto px-4 pb-4">
              <h1 className="text-2xl md:text-4xl font-display font-bold text-white drop-shadow-lg">
                {fieldName}
              </h1>
              {welcomeMessage && (
                <p className="text-sm md:text-base text-white/90 mt-1 drop-shadow-md max-w-xl">
                  {welcomeMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
            歡迎回來, <span className="text-primary" data-testid="home-display-name">{displayName}</span>
          </h2>
          {/* 有場域歡迎訊息且上面沒有 hero banner 顯示過 → 這裡顯示 */}
          {welcomeMessage && !fieldCoverUrl && (
            <p className="text-base text-muted-foreground mb-1">{welcomeMessage}</p>
          )}
          {/* 🆕 玩家戰績摘要 — 有完成紀錄才顯示，給人成就感 */}
          {playerStats.completedCount > 0 ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap" data-testid="player-stats-summary">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-warning" />
                  已完成 <span className="font-number font-semibold text-foreground">{playerStats.completedCount}</span> 場
                </span>
                {playerStats.uniqueGamesCount > 1 && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                      挑戰 <span className="font-number font-semibold text-foreground">{playerStats.uniqueGamesCount}</span> 款遊戲
                    </span>
                  </>
                )}
                {playerStats.totalScore > 0 && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-success" />
                      累計 <span className="font-number font-semibold text-foreground">{playerStats.totalScore.toLocaleString()}</span> 分
                    </span>
                  </>
                )}
              </p>
              {/* 🆕 看排行榜快捷 — 鼓勵玩家查全站排名 */}
              <Link href={link("/leaderboard")}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  data-testid="link-player-leaderboard"
                >
                  看排行榜 <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground">選擇一個任務開始你的冒險</p>
          )}
        </div>

        {/* 對戰快速入口 — 僅在場域啟用對戰模組時顯示（後台 FieldSettings 設定） */}
        {currentField?.modules?.battle && <BattleQuickEntry />}

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="搜尋遊戲..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => handleEscape(e, searchQuery, setSearchQuery)}
              className="pl-10 pr-20"
              data-testid="input-search-games"
            />
            {/* 🆕 快速鍵提示（桌面端顯示 ⌘K / Ctrl K，focus 時隱藏） */}
            {!searchQuery && <SearchKbdHint isMac={isMac} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70" />}
            {/* 🆕 清除按鈕 — 有輸入內容時才顯示 */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                aria-label="清除搜尋"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={difficultyFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter(null)}
              data-testid="filter-all"
            >
              全部 <span className="ml-1 opacity-70 font-mono text-xs">{difficultyCount.all}</span>
            </Button>
            <Button
              variant={difficultyFilter === "easy" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("easy")}
              disabled={difficultyCount.easy === 0}
              className={difficultyFilter === "easy" ? "" : "text-success border-success/30"}
              data-testid="filter-easy"
            >
              簡單 <span className="ml-1 opacity-70 font-mono text-xs">{difficultyCount.easy}</span>
            </Button>
            <Button
              variant={difficultyFilter === "medium" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("medium")}
              disabled={difficultyCount.medium === 0}
              className={difficultyFilter === "medium" ? "" : "text-warning border-warning/30"}
              data-testid="filter-medium"
            >
              中等 <span className="ml-1 opacity-70 font-mono text-xs">{difficultyCount.medium}</span>
            </Button>
            <Button
              variant={difficultyFilter === "hard" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("hard")}
              disabled={difficultyCount.hard === 0}
              className={difficultyFilter === "hard" ? "" : "text-destructive border-destructive/30"}
              data-testid="filter-hard"
            >
              困難 <span className="ml-1 opacity-70 font-mono text-xs">{difficultyCount.hard}</span>
            </Button>
          </div>
        </div>

        {gamesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGames && filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <Card
                key={game.id}
                className="overflow-hidden group hover-elevate cursor-pointer"
                onClick={() => {
                  const navigate = () => {
                    if (game.gameStructure === "chapters") {
                      setLocation(link(`/game/${game.id}/chapters`));
                    } else if (game.gameMode === "competitive" || game.gameMode === "relay") {
                      setLocation(link(`/match/${game.id}`));
                    } else if (game.gameMode === "team") {
                      setLocation(link(`/team/${game.id}`));
                    } else {
                      setLocation(link(`/game/${game.id}`));
                    }
                  };
                  // 🆕 匿名玩家進入遊戲前，先跳暱稱 Dialog
                  if (isAnonymous) {
                    setPendingGameNavigation(() => navigate);
                    setAnonymousNameOpen(true);
                    return;
                  }
                  navigate();
                }}
                data-testid={`card-game-${game.id}`}
              >
                <div className="relative h-48 bg-card overflow-hidden">
                  {game.coverImageUrl ? (
                    <OptimizedImage
                      src={game.coverImageUrl}
                      alt={game.title}
                      preset="card"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallback={
                        <GenericCoverFallback
                          name={game.title}
                          badge={
                            game.gameMode === "team"
                              ? { icon: <Users className="w-3 h-3" />, label: "團隊" }
                              : game.gameMode === "competitive"
                              ? { icon: <Trophy className="w-3 h-3" />, label: "競賽" }
                              : undefined
                          }
                        />
                      }
                    />
                  ) : (
                    <GenericCoverFallback
                      name={game.title}
                      badge={
                        game.gameMode === "team"
                          ? { icon: <Users className="w-3 h-3" />, label: "團隊" }
                          : game.gameMode === "competitive"
                          ? { icon: <Trophy className="w-3 h-3" />, label: "競賽" }
                          : undefined
                      }
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <Badge
                    className={`absolute top-3 right-3 ${getDifficultyColor(game.difficulty || "medium")}`}
                  >
                    {getDifficultyLabel(game.difficulty || "medium")}
                  </Badge>
                  {/* 🆕 狀態徽章（進行中=脈動警示、已完成=綠勾） */}
                  {(() => {
                    const gs = gameStatusMap.get(game.id);
                    if (gs?.status === "playing") {
                      return (
                        <Badge
                          className="absolute top-3 left-3 gap-1 bg-warning text-warning-foreground border-warning shadow-md"
                          data-testid={`badge-status-playing-${game.id}`}
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-foreground/70 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-warning-foreground" />
                          </span>
                          進行中
                        </Badge>
                      );
                    }
                    if (gs?.status === "completed") {
                      return (
                        <Badge
                          className="absolute top-3 left-3 gap-1 bg-success text-white border-success shadow-md"
                          data-testid={`badge-status-completed-${game.id}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          已完成
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                    {game.title}
                  </h3>
                  <p
                    className="text-sm text-muted-foreground line-clamp-2 mb-4"
                    title={game.description || ""}
                  >
                    {game.description || "無描述"}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    {/* 🆕 沒設時長就不顯示，而不是預設 30 分鐘誤導玩家 */}
                    {game.estimatedTime ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>約 {game.estimatedTime} 分鐘</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {game.gameMode === "team" ? (
                        <span>{game.minTeamPlayers || 2}-{game.maxTeamPlayers || 6} 人組隊</span>
                      ) : (
                        <span>最多 {game.maxPlayers || 6} 人</span>
                      )}
                    </div>
                  </div>

                  {/* 🆕 累計遊玩次數 / 玩過人數（非即時） */}
                  {(() => {
                    const s = statsMap?.[game.id];
                    if (!s || (s.totalPlays === 0 && s.uniquePlayers === 0)) return null;
                    return (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t">
                        <div className="flex items-center gap-1" data-testid={`stats-plays-${game.id}`}>
                          <TrendingUp className="w-3.5 h-3.5 text-primary/70" />
                          <span>累計 <span className="font-number font-semibold text-foreground">{s.totalPlays}</span> 場</span>
                        </div>
                        <div className="flex items-center gap-1" data-testid={`stats-players-${game.id}`}>
                          <Star className="w-3.5 h-3.5 text-warning/80" />
                          <span><span className="font-number font-semibold text-foreground">{s.uniquePlayers}</span> 人玩過</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
                
                <CardFooter className="p-4 pt-0">
                  {(() => {
                    const gameStatus = gameStatusMap.get(game.id);
                    if (gameStatus?.status === "completed") {
                      return (
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-center gap-2 text-success py-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">遊戲已完成 - {gameStatus.score} 分</span>
                          </div>
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            data-testid={`button-replay-game-${game.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 🆕 章節遊戲再玩改回章節選擇，其他依原邏輯
                              if (game.gameStructure === "chapters") {
                                setLocation(link(`/game/${game.id}/chapters`));
                              } else if (game.gameMode === "team") {
                                setLocation(link(`/team/${game.id}`));
                              } else {
                                setLocation(link(`/game/${game.id}?replay=true`));
                              }
                            }}
                          >
                            <RotateCcw className="w-4 h-4" />
                            {getReplayLabel(game)}
                          </Button>
                        </div>
                      );
                    } else if (gameStatus?.status === "playing") {
                      return (
                        <Button className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90" data-testid={`button-continue-game-${game.id}`}>
                          <Play className="w-4 h-4" />
                          {getContinueLabel(game)}
                        </Button>
                      );
                    } else {
                      return (
                        <Button className="w-full gap-2" data-testid={`button-start-game-${game.id}`}>
                          {game.gameMode === "team" ? <Users className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {getStartLabel(game)}
                        </Button>
                      );
                    }
                  })()}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">
              {searchQuery || difficultyFilter ? "找不到符合的遊戲" : "目前沒有可用的遊戲"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || difficultyFilter ? "試試清除篩選條件或調整關鍵字" : "請稍後再回來查看"}
            </p>
            {/* 🆕 有 filter 條件時顯示「清除所有條件」按鈕 */}
            {(searchQuery || difficultyFilter) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setDifficultyFilter(null);
                }}
                className="gap-1.5"
                data-testid="btn-clear-all-filters"
              >
                <Filter className="w-3.5 h-3.5" />
                清除所有篩選條件
              </Button>
            )}
          </div>
        )}
      </main>

      {/* 🆕 匿名玩家暱稱 Dialog */}
      <AnonymousNameDialog
        open={anonymousNameOpen}
        onConfirm={(name) => {
          // 把暱稱存在 localStorage，session 建立時會帶過去
          try {
            localStorage.setItem("anonymous_player_name", name);
          } catch { /* ignore */ }
          setAnonymousNameOpen(false);
          // 執行 pending 的導航
          const nav = pendingGameNavigation;
          setPendingGameNavigation(null);
          nav?.();
        }}
        onGoogleLogin={async () => {
          try {
            await signInWithGoogle();
            setAnonymousNameOpen(false);
            toast({ title: "切換到 Google 帳號後請重新點擊遊戲" });
          } catch (err) {
            toast({
              title: "Google 登入失敗",
              description: err instanceof Error ? err.message : "請稍後再試",
              variant: "destructive",
            });
          }
        }}
        onClose={() => {
          setAnonymousNameOpen(false);
          setPendingGameNavigation(null);
        }}
        initialName={savedAnonName}
      />
    </div>
  );
}

/** 對戰快速入口卡片 — 顯示即將開打的 3 場 */
function BattleQuickEntry() {
  const { data: slots = [] } = useQuery<BattleSlot[]>({
    queryKey: ["/api/battle/slots/open"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      try {
        const res = await apiRequest("GET", `/api/battle/slots?fromDate=${today}`);
        const all: BattleSlot[] = await res.json();
        return all.filter((s) => s.status === "open" || s.status === "confirmed");
      } catch {
        return [];
      }
    },
  });

  // 🆕 排序後取前 3 場
  const upcoming = [...slots]
    .sort((a, b) => {
      const aKey = `${a.slotDate}T${a.startTime}`;
      const bKey = `${b.slotDate}T${b.startTime}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, 3);

  return (
    <Card className="mb-8 bg-card border-tactical-orange/30 hover-elevate group overflow-hidden">
      <Link href="/battle" className="block">
        <CardContent className="p-4 sm:p-6 cursor-pointer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-tactical-orange/20 flex items-center justify-center shrink-0">
                <Swords className="w-5 h-5 text-tactical-orange" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg group-hover:text-tactical-orange transition-colors">
                  水彈對戰 PK 擂台
                </h3>
                <p className="text-sm text-muted-foreground">
                  {slots.length > 0 ? `目前開放 ${slots.length} 場對戰` : "查看對戰時段與排行榜"}
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-tactical-orange/30 text-tactical-orange hover:bg-tactical-orange/10 shrink-0">
              前往對戰 →
            </Button>
          </div>
        </CardContent>
      </Link>

      {/* 🆕 近期場次預覽（最多 3 場）*/}
      {upcoming.length > 0 && (
        <div className="border-t border-border/50 bg-muted/20 px-4 sm:px-6 py-3">
          <p className="text-[11px] font-display uppercase tracking-wider text-muted-foreground mb-2">
            近期場次
          </p>
          <div className="space-y-1.5">
            {upcoming.map((slot) => {
              const max = slot.maxPlayersOverride ?? 8;
              const curr = slot.currentCount ?? 0;
              const isFull = curr >= max;
              return (
                <Link
                  key={slot.id}
                  href={`/battle/slot/${slot.id}`}
                  className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                  data-testid={`battle-quick-slot-${slot.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {formatSlotDate(slot.slotDate)}
                    </span>
                    <span className="text-xs text-foreground shrink-0">
                      {(slot.startTime || "").slice(0, 5)}–{(slot.endTime || "").slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-mono ${isFull ? "text-muted-foreground" : "text-tactical-orange"}`}>
                      {curr}/{max}
                    </span>
                    {isFull ? (
                      <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                        滿員
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-tactical-orange/40 text-tactical-orange">
                        開放
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

/** 🆕 把 YYYY-MM-DD 格式化為「4/25 週五」 */
function formatSlotDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}/${d.getDate()} 週${weekdays[d.getDay()]}`;
  } catch {
    return isoDate;
  }
}
