import { useState, useCallback, useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { queueProgressUpdate } from "@/lib/offlineStorage";
import { processOnCompleteActions, resolveFlowRouter } from "@/lib/flow-router";
import type { GameWithPages, Page, GameChapterWithPages, OnCompleteAction } from "@shared/schema";

import GameHeader from "@/components/shared/GameHeader";
import ChatPanel from "@/components/shared/ChatPanel";
import InventoryPanel from "@/components/shared/InventoryPanel";
import GamePageRenderer from "@/components/game/GamePageRenderer";
import GameCompletionScreen from "@/components/game/GameCompletionScreen";
import { useSessionManager } from "./hooks/useSessionManager";

import {
  ChevronLeft, ChevronRight, MessageCircle, Backpack,
  Map, AlertTriangle, Home
} from "lucide-react";

export default function GamePlay() {
  const { gameId, chapterId } = useParams<{ gameId: string; chapterId?: string }>();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const isChapterMode = !!chapterId;

  const isReplayMode = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("replay") === "true";
  }, [searchString]);

  const [showChat, setShowChat] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const { data: game, isLoading: gameLoading, error: gameError } = useQuery<GameWithPages>({
    queryKey: ["/api/games", gameId],
  });

  // 章節模式：載入章節頁面
  const { data: chapterData } = useQuery<GameChapterWithPages>({
    queryKey: ["/api/games", gameId, "chapters", chapterId],
    enabled: isChapterMode && !!gameId && !!chapterId,
  });

  // 章節模式下使用章節頁面，否則使用全部頁面
  const activePages: Page[] = useMemo(() => {
    if (isChapterMode && chapterData?.pages) {
      return [...chapterData.pages].sort((a, b) => a.pageOrder - b.pageOrder);
    }
    return game?.pages ?? [];
  }, [isChapterMode, chapterData?.pages, game?.pages]);

  const {
    sessionId, score, inventory, variables,
    currentPageIndex, isCompleted,
    stateRef, activePagesRef,
    setState, resetAndCreateNew,
  } = useSessionManager({
    gameId,
    userId: user?.id,
    isReplayMode,
    activePages,
    userName: user?.firstName || "玩家",
  });

  const currentPage = activePages[currentPageIndex];
  const totalPages = activePages.length;
  const progressPercent = totalPages > 0 ? ((currentPageIndex + 1) / totalPages) * 100 : 0;

  // === 遊戲/章節完成處理 ===
  const handleCompletion = useCallback((finalScore: number) => {
    const sid = stateRef.current.sessionId;
    if (!sid) return;
    if (isChapterMode) {
      apiRequest("PATCH", `/api/sessions/${sid}/chapter-complete`, { score: finalScore })
        .then(() => {
          setState(prev => ({ ...prev, isCompleted: true }));
          toast({ title: "章節完成!", description: `得分: ${finalScore} 分` });
        });
    } else {
      apiRequest("PATCH", `/api/sessions/${sid}`, { status: "completed", score: finalScore })
        .then(() => {
          setState(prev => ({ ...prev, isCompleted: true }));
          toast({ title: "恭喜通關!", description: `最終得分: ${finalScore} 分` });
        });
    }
  }, [isChapterMode, toast, stateRef, setState]);

  // === 頁面完成 → 更新分數/道具/變數 → 導航 ===
  const handlePageComplete = useCallback((reward?: { points?: number; items?: string[] }, nextPageId?: string) => {
    const currentState = stateRef.current;
    const pages = activePagesRef.current;
    let newScore = currentState.score;
    let newInventory = [...currentState.inventory];
    let newVariables = { ...currentState.variables };

    // 1. 處理 reward（現有邏輯）
    if (reward?.points) newScore += reward.points;
    if (reward?.items) newInventory = [...newInventory, ...reward.items];

    // 2. 處理 onCompleteActions（通用變數/道具/分數操作）
    const currentPage = pages[currentState.currentPageIndex];
    if (currentPage) {
      const cfg = currentPage.config as Record<string, unknown>;
      const actions = (cfg.onCompleteActions || []) as OnCompleteAction[];
      if (actions.length > 0) {
        const result = processOnCompleteActions(actions, newVariables, newInventory, newScore);
        newVariables = result.variables;
        newInventory = result.inventory;
        newScore = result.score;
      }
    }

    // 3. 遊戲結束特殊指令
    if (nextPageId === "_end") {
      setState(prev => ({ ...prev, score: newScore, inventory: newInventory, variables: newVariables }));
      handleCompletion(newScore);
      return;
    }

    // 4. 導航到下一頁（含 flow_router 解析）
    setState(prev => {
      let nextIndex = prev.currentPageIndex + 1;
      if (nextPageId && pages) {
        const foundIndex = pages.findIndex(p => p.id === nextPageId);
        if (foundIndex !== -1) nextIndex = foundIndex;
      }

      // 解析連續的 flow_router 頁面
      const resolvedIndex = resolveFlowRouter(pages, nextIndex, newVariables, newInventory, newScore);
      if (resolvedIndex === -1) {
        handleCompletion(newScore);
        return { ...prev, score: newScore, inventory: newInventory, variables: newVariables };
      }

      if (resolvedIndex < pages.length) {
        const nextPage = pages[resolvedIndex];
        if (nextPage && prev.sessionId) {
          const progressData = {
            sessionId: prev.sessionId,
            pageId: nextPage.id,
            score: newScore,
            inventory: newInventory,
            variables: newVariables,
          };
          if (navigator.onLine) {
            apiRequest("PATCH", `/api/sessions/${prev.sessionId}/progress`, {
              pageId: nextPage.id,
              score: newScore,
              inventory: newInventory,
              variables: newVariables,
            }).catch(() => queueProgressUpdate(progressData));
          } else {
            queueProgressUpdate(progressData);
          }
        }
        return { ...prev, score: newScore, inventory: newInventory, variables: newVariables, currentPageIndex: resolvedIndex };
      }
      handleCompletion(newScore);
      return { ...prev, score: newScore, inventory: newInventory, variables: newVariables };
    });
  }, [stateRef, activePagesRef, setState, handleCompletion]);

  const handleVariableUpdate = useCallback((key: string, value: unknown) => {
    setState(prev => ({ ...prev, variables: { ...prev.variables, [key]: value } }));
  }, [setState]);

  const goToMap = useCallback(() => {
    setLocation(`/map/${gameId}?session=${sessionId}`);
  }, [gameId, sessionId, setLocation]);

  // === 載入中/錯誤/完成 狀態 ===
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
    return (
      <GameCompletionScreen
        score={score}
        gameTitle={game.title}
        isChapterMode={isChapterMode}
        chapterTitle={chapterData?.title}
        gameId={gameId || ""}
        onPlayAgain={resetAndCreateNew}
        onNavigate={setLocation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GameHeader
        title={isChapterMode && chapterData?.title ? `${game.title} - ${chapterData.title}` : game.title}
        score={score}
        onBack={() => setLocation(isChapterMode ? `/game/${gameId}/chapters` : "/home")}
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
        {currentPage && (
          <GamePageRenderer
            page={currentPage}
            onComplete={handlePageComplete}
            onVariableUpdate={handleVariableUpdate}
            sessionId={sessionId || ""}
            gameId={gameId || ""}
            variables={variables}
            inventory={inventory}
            score={score}
          />
        )}
      </main>

      <nav className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-4 py-3 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setState(prev => ({ ...prev, currentPageIndex: Math.max(0, prev.currentPageIndex - 1) }))}
          disabled={currentPageIndex === 0}
          className="gap-1"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
          上一頁
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowChat(true)} data-testid="button-open-chat">
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
          <Button variant="ghost" size="icon" onClick={goToMap} data-testid="button-open-map">
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
