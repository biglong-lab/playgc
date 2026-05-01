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

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface GamePreviewProps {
  gameId: string;
}

interface GameWithPages {
  id: string;
  title: string;
  pages?: Array<{
    id: string;
    pageOrder: number;
    pageType: string;
    customName: string | null;
  }>;
}

export default function GamePreview({ gameId }: GamePreviewProps) {
  // P1-1 階段：先做骨架 — 取遊戲資料 + 顯示 loading
  // 後續 phase 會接 PreviewProvider + PreviewBanner + PreviewNavBar + 實際渲染
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* P2-1 將加 PreviewBanner */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-2xl">
          <CardContent className="p-6 space-y-4">
            <div className="text-2xl font-bold">🎬 預覽模式（建置中）</div>
            <p className="text-sm text-muted-foreground">
              遊戲：<strong>{game.title}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              頁面數：{game.pages?.length ?? "?"}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Phase 1 骨架階段，後續 phase 會加 banner / 上下頁 / 實際渲染。
            </p>
          </CardContent>
        </Card>
      </div>
      {/* P2-2 將加 PreviewNavBar */}
    </div>
  );
}
