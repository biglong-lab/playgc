// 🎮 玩家端路線選擇器（多腳本架構）
//
// 用法：玩家進入有多條路線的遊戲時顯示，選一條後才開始
// 整合到 PlayPage 或 GamePlay 啟動前
//
// 行為：
//   - 自動取得遊戲所有 isActive=true 的 routes
//   - 0 條路線 → 不顯示（玩家走預設流程）
//   - 1 條路線 → 自動套用，不顯示選擇 UI
//   - 多條路線 → 顯示 dialog 讓玩家選
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Compass, Clock } from "lucide-react";

interface GameRoute {
  id: string;
  routeName: string;
  startPageId: string | null;
  description: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  sortOrder: number | null;
}

interface PlayerRouteSelectorProps {
  gameId: string;
  /** 玩家選擇路線後的回呼（傳 routeId + startPageId） */
  onRouteSelected: (route: { routeId: string; startPageId: string | null }) => void;
  /** 玩家選擇「跳過/預設」的回呼 */
  onSkip?: () => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "🟢 簡單",
  medium: "🟡 中等",
  hard: "🔴 困難",
};

export default function PlayerRouteSelector({
  gameId,
  onRouteSelected,
  onSkip,
}: PlayerRouteSelectorProps) {
  // 取所有 active routes（GET 是 admin endpoint，但玩家也應該能看，這裡用 admin endpoint）
  // 實務上若有公開 GET 應改用，避免 401
  const { data, isLoading, isError } = useQuery<{ items: GameRoute[]; total: number }>({
    queryKey: ["/api/admin/games", gameId, "routes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/games/${gameId}/routes`);
      return res.json();
    },
    enabled: !!gameId,
    retry: false, // 401 直接放棄（玩家可能無權限），由 onSkip 處理
  });

  const activeRoutes = (data?.items ?? []).filter((r) => r.isActive);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // 無 route 或拉失敗（玩家無權限） → 直接 skip
  if (isError || activeRoutes.length === 0) {
    if (onSkip) {
      setTimeout(onSkip, 0); // 下一個 tick 觸發，避免 setState in render
    }
    return null;
  }

  // 只 1 條 → 自動套用
  if (activeRoutes.length === 1) {
    const r = activeRoutes[0];
    setTimeout(
      () => onRouteSelected({ routeId: r.id, startPageId: r.startPageId }),
      0,
    );
    return null;
  }

  // 多條路線 → 顯示選擇 UI
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
      <div className="max-w-2xl w-full space-y-4">
        <div className="text-center">
          <Compass className="w-12 h-12 mx-auto text-purple-500 mb-2" />
          <h2 className="text-2xl font-bold">選擇你的冒險路線</h2>
          <p className="text-sm text-muted-foreground mt-1">
            這個遊戲有 {activeRoutes.length} 條不同的故事線，挑一條開始
          </p>
        </div>

        <div className="space-y-3">
          {activeRoutes
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((route) => (
              <Card
                key={route.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() =>
                  onRouteSelected({ routeId: route.id, startPageId: route.startPageId })
                }
                data-testid={`route-${route.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{route.routeName}</h3>
                      {route.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {route.description}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRouteSelected({
                          routeId: route.id,
                          startPageId: route.startPageId,
                        });
                      }}
                    >
                      開始 →
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {route.difficulty && (
                      <Badge variant="outline" className="text-xs">
                        {DIFFICULTY_LABELS[route.difficulty] ?? route.difficulty}
                      </Badge>
                    )}
                    {route.estimatedMinutes && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {route.estimatedMinutes} 分鐘
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {onSkip && (
          <div className="text-center pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkip}
              data-testid="button-skip-route"
            >
              跳過，走預設流程
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
