import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameWithPages, GameSession, Page } from "@shared/schema";

import TextCardPage from "@/components/game/TextCardPage";
import DialoguePage from "@/components/game/DialoguePage";
import VideoPage from "@/components/game/VideoPage";
import ButtonPage from "@/components/game/ButtonPage";
import TextVerifyPage from "@/components/game/TextVerifyPage";
import ChoiceVerifyPage from "@/components/game/ChoiceVerifyPage";
import ConditionalVerifyPage from "@/components/game/ConditionalVerifyPage";
import ShootingMissionPage from "@/components/game/ShootingMissionPage";
import PhotoMissionPage from "@/components/game/PhotoMissionPage";
import GpsMissionPage from "@/components/game/GpsMissionPage";
import QrScanPage from "@/components/game/QrScanPage";
import TimeBombPage from "@/components/game/TimeBombPage";
import LockPage from "@/components/game/LockPage";
import MotionChallengePage from "@/components/game/MotionChallengePage";
import VotePage from "@/components/game/VotePage";
import GameHeader from "@/components/shared/GameHeader";
import ChatPanel from "@/components/shared/ChatPanel";
import InventoryPanel from "@/components/shared/InventoryPanel";

import { 
  ChevronLeft, ChevronRight, MessageCircle, Backpack, 
  Map, AlertTriangle, Trophy, Home, RefreshCw 
} from "lucide-react";

export default function GamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Parse query params to check for replay mode
  const isReplayMode = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("replay") === "true";
  }, [searchString]);
  
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [showChat, setShowChat] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [forceNewSession, setForceNewSession] = useState(isReplayMode);
  
  // Use refs to avoid stale closure issues
  const sessionIdRef = useRef(sessionId);
  const scoreRef = useRef(score);
  const inventoryRef = useRef(inventory);
  const variablesRef = useRef(variables);
  
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { variablesRef.current = variables; }, [variables]);

  const { data: game, isLoading: gameLoading, error: gameError } = useQuery<GameWithPages>({
    queryKey: ["/api/games", gameId],
  });

  const { data: existingSession } = useQuery<{ session: GameSession; progress: any } | null>({
    queryKey: ["/api/sessions/active", gameId],
    queryFn: async () => {
      try {
        const { getIdToken } = await import("@/lib/firebase");
        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const response = await fetch(`/api/sessions/active?gameId=${gameId}`, {
          credentials: 'include',
          headers,
        });
        if (response.ok) {
          return response.json();
        }
        return null;
      } catch {
        return null;
      }
    },
    enabled: !!user && !!gameId,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sessions", {
        gameId,
        teamName: `${user?.firstName || "玩家"}'s Team`,
        playerCount: 1,
      });
      return response.json();
    },
    onSuccess: (data: GameSession) => {
      // Reset all game state for fresh start
      setSessionId(data.id);
      sessionIdRef.current = data.id;
      setScore(0);
      scoreRef.current = 0;
      setInventory([]);
      inventoryRef.current = [];
      setVariables({});
      variablesRef.current = {};
      setCurrentPageIndex(0);
      setIsCompleted(false);
      // Clear forceNewSession and mark restoration complete
      setForceNewSession(false);
      setHasRestoredProgress(true);
      // Invalidate the existing session cache to prevent restoration
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/active", gameId] });
      toast({
        title: "遊戲開始",
        description: "祝你好運!",
      });
    },
    onError: () => {
      setForceNewSession(false);
      toast({
        title: "錯誤",
        description: "無法開始遊戲，請重試",
        variant: "destructive",
      });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { pageId: string; score: number; inventory: string[]; variables: Record<string, any> }) => {
      if (!sessionId) return;
      await apiRequest("PATCH", `/api/sessions/${sessionId}/progress`, data);
    },
  });

  const completeGameMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) return;
      await apiRequest("PATCH", `/api/sessions/${sessionId}`, {
        status: "completed",
        score,
      });
    },
    onSuccess: () => {
      setIsCompleted(true);
      toast({
        title: "恭喜通關!",
        description: `最終得分: ${score} 分`,
      });
    },
  });

  // Track if we've already restored progress to avoid multiple toasts
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  useEffect(() => {
    if (!user || !gameId) return;
    
    // If replay mode is triggered, force create a new session
    if (forceNewSession && !sessionId && !createSessionMutation.isPending) {
      // 清除 URL 參數（forceNewSession 在 onSuccess 中清除）
      if (isReplayMode) {
        setLocation(`/game/${gameId}`, { replace: true });
      }
      createSessionMutation.mutate();
      return;
    }
    
    // Skip restoration if forceNewSession is active (waiting for new session creation)
    if (forceNewSession || createSessionMutation.isPending) {
      return;
    }
    
    // If we have an existing session and haven't restored yet
    if (existingSession?.session && !hasRestoredProgress && game?.pages) {
      const newSessionId = existingSession.session.id;
      const newScore = existingSession.progress?.score || existingSession.session.score || 0;
      const newInventory = existingSession.progress?.inventory || [];
      const newVariables = existingSession.progress?.variables || {};
      
      // Update state and refs together
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      setScore(newScore);
      scoreRef.current = newScore;
      setInventory(newInventory);
      inventoryRef.current = newInventory;
      setVariables(newVariables);
      variablesRef.current = newVariables;
      
      // Check if the session is already completed
      if (existingSession.session.status === "completed") {
        setIsCompleted(true);
        setCurrentPageIndex(game.pages.length - 1);
        setHasRestoredProgress(true);
        toast({
          title: "遊戲已完成",
          description: `最終得分: ${newScore} 分`,
        });
        return;
      }
      
      if (existingSession.progress?.currentPageId) {
        const pageIndex = game.pages.findIndex(p => p.id === existingSession.progress.currentPageId);
        if (pageIndex !== -1) {
          setCurrentPageIndex(pageIndex);
        }
      }
      
      setHasRestoredProgress(true);
      toast({
        title: "繼續遊戲",
        description: "從上次進度繼續",
      });
    } else if (existingSession === null && !sessionId && !forceNewSession) {
      // No existing session, create a new one
      createSessionMutation.mutate();
    }
  }, [user, gameId, existingSession, game?.pages, sessionId, hasRestoredProgress, forceNewSession, isReplayMode]);

  const currentPage = game?.pages?.[currentPageIndex];
  const totalPages = game?.pages?.length || 0;
  const progressPercent = totalPages > 0 ? ((currentPageIndex + 1) / totalPages) * 100 : 0;

  const handlePageComplete = useCallback((reward?: { points?: number; items?: string[] }, nextPageId?: string) => {
    // Use refs to get the latest values and avoid stale closures
    const currentSessionId = sessionIdRef.current;
    let newScore = scoreRef.current;
    let newInventory = [...inventoryRef.current];
    const currentVars = variablesRef.current;
    const pages = game?.pages;
    const numPages = pages?.length || 0;
    
    if (reward?.points) {
      newScore = newScore + reward.points;
      setScore(newScore);
      scoreRef.current = newScore;
    }
    if (reward?.items) {
      newInventory = [...newInventory, ...reward.items];
      setInventory(newInventory);
      inventoryRef.current = newInventory;
    }

    if (nextPageId === "_end") {
      if (currentSessionId) {
        apiRequest("PATCH", `/api/sessions/${currentSessionId}`, {
          status: "completed",
          score: newScore,
        }).then(() => {
          setIsCompleted(true);
          toast({
            title: "恭喜通關!",
            description: `最終得分: ${newScore} 分`,
          });
        });
      }
      return;
    }

    // 使用 functional update 取得正確的當前頁面索引
    setCurrentPageIndex(prevIndex => {
      let nextIndex = prevIndex + 1;
      if (nextPageId && pages) {
        const foundIndex = pages.findIndex(p => p.id === nextPageId);
        if (foundIndex !== -1) {
          nextIndex = foundIndex;
        }
      }

      if (nextIndex < numPages) {
        const nextPage = pages?.[nextIndex];

        // 使用 ref 值儲存進度
        if (nextPage && currentSessionId) {
          apiRequest("PATCH", `/api/sessions/${currentSessionId}/progress`, {
            pageId: nextPage.id,
            score: newScore,
            inventory: newInventory,
            variables: currentVars,
          }).catch(() => {});
        }
        return nextIndex;
      } else {
        if (currentSessionId) {
          apiRequest("PATCH", `/api/sessions/${currentSessionId}`, {
            status: "completed",
            score: newScore,
          }).then(() => {
            setIsCompleted(true);
            toast({
              title: "恭喜通關!",
              description: `最終得分: ${newScore} 分`,
            });
          });
        }
        return prevIndex; // Stay on current page
      }
    });
  }, [game?.pages, toast]);

  const handleVariableUpdate = useCallback((key: string, value: any) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  }, []);

  const goToMap = useCallback(() => {
    setLocation(`/map/${gameId}?session=${sessionId}`);
  }, [gameId, sessionId, setLocation]);

  if (authLoading || gameLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">載入任務中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to landing page for login
    setLocation("/");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">請先登入...</p>
        </div>
      </div>
    );
  }

  if (gameError || !game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold mb-2">找不到遊戲</h2>
          <p className="text-muted-foreground mb-6">此遊戲可能已被刪除或不存在</p>
          <Button onClick={() => setLocation("/home")} className="gap-2">
            <Home className="w-4 h-4" />
            返回大廳
          </Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const handlePlayAgain = async () => {
      // Create a new session for replaying
      setIsCompleted(false);
      setCurrentPageIndex(0);
      setScore(0);
      setInventory([]);
      setVariables({});
      setHasRestoredProgress(false);
      setSessionId(null);
      sessionIdRef.current = null;
      scoreRef.current = 0;
      inventoryRef.current = [];
      variablesRef.current = {};
      // Trigger new session creation
      createSessionMutation.mutate();
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-glow">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-2 text-glow">任務完成!</h2>
          <p className="text-muted-foreground mb-2">恭喜完成 {game.title}</p>
          <p className="text-4xl font-number font-bold text-primary mb-8">{score} 分</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handlePlayAgain} variant="outline" className="gap-2" data-testid="button-play-again">
              <RefreshCw className="w-4 h-4" />
              再玩一次
            </Button>
            <Button onClick={() => setLocation("/home")} variant="outline" className="gap-2" data-testid="button-return-home">
              <Home className="w-4 h-4" />
              返回大廳
            </Button>
            <Button onClick={() => setLocation("/leaderboard")} className="gap-2" data-testid="button-view-leaderboard">
              <Trophy className="w-4 h-4" />
              查看排行榜
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    if (!currentPage) return null;

    const config = currentPage.config as any;
    const commonProps = {
      config,
      onComplete: handlePageComplete,
      onVariableUpdate: handleVariableUpdate,
      sessionId: sessionId || "",
      gameId: gameId || "",
      variables,
    };

    switch (currentPage.pageType) {
      case "text_card":
        return <TextCardPage {...commonProps} />;
      case "dialogue":
        return <DialoguePage {...commonProps} />;
      case "video":
        return <VideoPage {...commonProps} />;
      case "button":
        return <ButtonPage {...commonProps} />;
      case "text_verify":
        return <TextVerifyPage {...commonProps} />;
      case "choice_verify":
        return <ChoiceVerifyPage {...commonProps} />;
      case "conditional_verify":
        return (
          <ConditionalVerifyPage 
            {...commonProps} 
            inventory={inventory}
            score={score}
          />
        );
      case "shooting_mission":
        return <ShootingMissionPage {...commonProps} />;
      case "photo_mission":
        return <PhotoMissionPage {...commonProps} />;
      case "gps_mission":
        return <GpsMissionPage {...commonProps} />;
      case "qr_scan":
        return <QrScanPage {...commonProps} />;
      case "time_bomb":
        return <TimeBombPage {...commonProps} />;
      case "lock":
        return <LockPage {...commonProps} />;
      case "motion_challenge":
        return <MotionChallengePage {...commonProps} />;
      case "vote":
        return <VotePage {...commonProps} />;
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">未知頁面類型: {currentPage.pageType}</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader
        title={game.title}
        score={score}
        onBack={() => setLocation("/home")}
        onChat={() => setShowChat(true)}
        onMap={goToMap}
        onInventory={() => setShowInventory(true)}
        inventoryCount={inventory.length}
      />

      <div className="px-4 py-2 bg-card/50 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">
            進度: {currentPageIndex + 1} / {totalPages}
          </span>
          <span className="text-xs font-number text-primary">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
      </div>

      <main className="flex-1 relative overflow-hidden">
        {renderPage()}
      </main>

      <nav className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
          disabled={currentPageIndex === 0}
          className="gap-1"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
          上一頁
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowChat(true)}
            data-testid="button-open-chat"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowInventory(true)}
            className="relative"
            data-testid="button-open-inventory"
          >
            <Backpack className="w-5 h-5" />
            {inventory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                {inventory.length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToMap}
            data-testid="button-open-map"
          >
            <Map className="w-5 h-5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageComplete()}
          disabled={currentPageIndex >= totalPages - 1}
          className="gap-1"
          data-testid="button-next-page"
        >
          下一頁
          <ChevronRight className="w-4 h-4" />
        </Button>
      </nav>

      {showChat && sessionId && (
        <ChatPanel
          sessionId={sessionId}
          userId={user.id}
          userName={user.firstName || user.email?.split("@")[0] || "玩家"}
          onClose={() => setShowChat(false)}
        />
      )}

      {showInventory && (
        <InventoryPanel
          items={inventory}
          gameId={gameId}
          onClose={() => setShowInventory(false)}
        />
      )}
    </div>
  );
}
