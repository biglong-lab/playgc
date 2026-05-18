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

import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Eye, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PreviewProvider } from "@/contexts/PreviewContext";
import { PreviewBanner } from "@/components/preview/PreviewBanner";
import { PreviewNavBar } from "@/components/preview/PreviewNavBar";
import GamePageRenderer from "@/components/game/GamePageRenderer";
import type { Page } from "@shared/schema";

interface GamePreviewProps {
  gameId: string;
}

interface GameWithPages {
  id: string;
  title: string;
  pages?: Page[];
}

// 🤖 7 種會走 AI 驗證的 page type — 預覽模式會 mock pass，需提示 admin 上線後實測
const AI_PAGE_TYPES = new Set([
  "photo_spot",
  "photo_compare",
  "photo_ocr",
  "photo_mission",
  "text_verify",
  "choice_verify",
  "conditional_verify",
]);

export default function GamePreview({ gameId }: GamePreviewProps) {
  const [, setLocation] = useLocation();
  // 🔒 in-memory state — 完全不寫 DB（守則 9 資料隔離）
  const [currentIndex, setCurrentIndex] = useState(0);

  // 🆕 2026-05-18 #4：預覽 sessionId（業主回報「拍照失敗 400: 缺少 Session ID」）
  // 用 `preview-` prefix 讓後端能判別、且滿足 zod min(1) 驗證
  const previewSessionId = useState(() => `preview-${gameId}-${Date.now()}`)[0];

  // 🎬 標記 preview 模式：apiRequest 看到 sessionStorage.previewMode='1' + AI endpoint 會 mock pass
  useEffect(() => {
    try {
      sessionStorage.setItem("previewMode", "1");
    } catch { /* ignore */ }
    return () => {
      try {
        sessionStorage.removeItem("previewMode");
      } catch { /* ignore */ }
    };
  }, []);

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

  // 計算 totalPages（hook 區塊內，不能放 if early return 後面）
  const totalPages = game?.pages?.length ?? 0;

  // ⌨️ 鍵盤快捷：← 上一頁 / → 下一頁 / Esc 退出
  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLocation(`/admin/games/${gameId}`);
        return;
      }
      // 在 input/textarea/contenteditable 內輸入時，忽略 ←/→（讓使用者正常打字 / 移動游標）
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, totalPages - 1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameId, setLocation, totalPages]);

  // 🐛 修 React #310（2026-05-13）：以下 hooks 必須在 early return 之前
  //   原本放在 isLoading/error/totalPages 條件 return 後面、違反 Rules of Hooks
  //   render 在 loading→loaded 切換時 hook count 不同 → 觸發 #310（30 次/7 天 ErrorBoundary）

  // 預覽用：onComplete 直接跳下一頁（不寫 chapter/score/inventory）
  const handlePreviewComplete = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalPages - 1));
  }, [totalPages]);

  // 預覽用：variable update 純 in-memory（不寫 DB）
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const handleVariableUpdate = useCallback((key: string, value: unknown) => {
    setVariables((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  // 🔒 sessionId='' （空字串）— 不建 session（守則 9 資料隔離）
  //   GamePageRenderer 子元件嘗試呼叫 /api/sessions/${sessionId}/... 時：
  //   - sessionId 空 → URL 變 /api/sessions//... → 後端 404 → mutation 失敗但不寫 DB
  //   - 正式版 GameStateMachine 才會建立真實 session，preview 完全跳過
  //   後續 P3-2 ~ P3-4 會在 apiRequest 層或子元件層加 isPreview 提早 return（避免 console error）
  const handleExit = () => setLocation(`/admin/games/${gameId}`);

  return (
    <PreviewProvider isPreview gameId={gameId}>
      <div className="min-h-screen flex flex-col bg-background">
        <PreviewBanner gameTitle={game.title} onExit={handleExit} />

        <main className="flex-1 relative overflow-hidden">
          {/* 🤖 AI 任務 inline 警告（preview only）— 提醒 admin AI 已 mock 上線後需實測 */}
          {AI_PAGE_TYPES.has(currentPage.pageType) && (
            <div
              className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 px-4 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-start gap-2"
              data-testid="ai-mock-warning"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>預覽模式：AI 驗證已自動通過</strong>
                <span className="ml-1 opacity-80">
                  · 此頁是 <code className="font-mono">{currentPage.pageType}</code> 任務，正式遊戲會實際呼叫 AI 判定（會收費）。
                  上線後請依{" "}
                  <a
                    href="/admin/ai-test-checklist"
                    target="_blank"
                    className="underline font-medium"
                  >
                    實測清單
                  </a>{" "}
                  實機驗證。
                </span>
              </div>
            </div>
          )}
          <GamePageRenderer
            key={currentPage.id}
            page={currentPage}
            onComplete={handlePreviewComplete}
            onVariableUpdate={handleVariableUpdate}
            sessionId={previewSessionId}
            gameId={gameId}
            variables={variables}
            inventory={[]}
            score={0}
            visitedLocations={[]}
          />

          {/* 🆕 2026-05-18：預覽「模擬通過」按鈕 — 業主測 GPS/QR/拍照/AI 等元件卡關時、一鍵跳下一頁 */}
          <button
            type="button"
            onClick={handlePreviewComplete}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold active:scale-95 transition-transform"
            title="預覽工具：跳過此元件、直接到下一頁（不寫資料、不計分）"
            data-testid="preview-skip-button"
          >
            ⏭️ 模擬通過此元件 → 下一頁
          </button>
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
