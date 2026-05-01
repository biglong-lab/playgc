// 🎬 遊戲預覽模式 — admin 預覽未發布遊戲
//
// 設計原則：
//   1. 不建立 session（不寫 sessions 表）
//   2. 不寫任何統計事件（player_event_logs / variant_feedback / leaderboard）
//   3. AI 任務 mock 直接 pass（不打 OpenRouter / Vision）
//   4. 自由上下頁（不檢查解鎖條件，避免設計者卡住）
//   5. 顯眼提醒「預覽模式」+「AI 已 mock，上線後需實測」
//
// 路由：/admin/games/:gameId/preview
// 權限：requireAdminAuth + game:view（在 App.tsx 用 ProtectedAdminRoute 包覆）

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PreviewProvider } from "@/contexts/PreviewContext";
import { PreviewBanner } from "@/components/preview/PreviewBanner";
import { PreviewNavBar } from "@/components/preview/PreviewNavBar";
import GamePageRenderer from "@/components/game/GamePageRenderer";
import type { Page } from "@shared/schema";

interface GamePreviewProps {
  gameId: string;
}

interface PreviewPage {
  id: string;
  pageOrder: number;
  pageType: string;
  customName: string | null;
  config: Record<string, unknown>;
}

interface GameWithPages {
  id: string;
  title: string;
  pages?: PreviewPage[];
}

export default function GamePreview({ gameId }: GamePreviewProps) {
  const [, setLocation] = useLocation();
  // 🔒 in-memory state — 完全不寫 DB（守則 9 資料隔離）
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: game, isLoading, error } = useQuery<GameWithPages>({
    queryKey: ["/api/admin/games", gameId, "preview"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/games/${gameId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">
              無法載入預覽：{error instanceof Error ? error.message : "未知錯誤"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pages = (game.pages ?? []).slice().sort((a, b) => a.pageOrder - b.pageOrder);
  const totalPages = pages.length;
  const currentPage = pages[currentIndex];

  if (totalPages === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            <Eye className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="font-medium">{game.title}</p>
            <p className="text-sm text-muted-foreground">
              此遊戲尚未建立任何頁面，無法預覽
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 🔒 sessionId='preview'（不建 session，純 sentinel 給下游元件辨識）
  const handleExit = () => setLocation(`/admin/games/${gameId}`);

  return (
    <PreviewProvider isPreview gameId={gameId}>
      <div className="min-h-screen flex flex-col bg-background">
        <PreviewBanner gameTitle={game.title} onExit={handleExit} />

        {/* P3-2 將替換為 <GamePageRenderer page={currentPage} ... /> */}
        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full" data-testid="preview-page-placeholder">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">第 {currentPage.pageOrder} 頁</Badge>
                <Badge variant="secondary">{currentPage.pageType}</Badge>
                {currentPage.customName && (
                  <span className="font-medium">{currentPage.customName}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Page ID: <code className="font-mono">{currentPage.id.slice(0, 8)}</code>
              </p>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {JSON.stringify(currentPage.config, null, 2)}
              </pre>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Phase 3 階段顯示 page metadata。Phase 後續會替換為實際遊戲元件渲染（GamePageRenderer）。
              </p>
            </CardContent>
          </Card>
        </main>

        <PreviewNavBar
          currentIndex={currentIndex}
          totalPages={totalPages}
          onJump={setCurrentIndex}
        />
      </div>
    </PreviewProvider>
  );
}
