import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gamepad2,
  Clock,
  Users,
  MapPin,
  Play,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Swords,
} from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Field {
  id: string;
  name: string;
  address: string | null;
}

interface Game {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  estimatedTime: number | null;
  maxPlayers: number | null;
  status: string | null;
  field: Field | null;
  isIsolated: boolean | null;
  locationLockEnabled: boolean | null;
  lockLocationName: string | null;
  gameMode: string | null;        // single / team / relay / competitive
  gameStructure: string | null;   // chapters / linear
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/10 text-green-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  hard: "bg-red-500/10 text-red-500",
};

export default function GameBySlug() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/g", slug],
    queryFn: async () => {
      const response = await fetch(`/api/g/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("遊戲不存在或已被移除");
        }
        throw new Error("無法載入遊戲資訊");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  // 🆕 2026-05-18 #6 / 2026-05-22 業主 docx #11：依 session.status 三態判斷
  //   - 沒玩過 → 開始遊戲
  //   - playing + 有 progress → 返回遊戲 + 重新開始
  //   - completed → 再玩一次
  const { data: activeSession } = useQuery<{
    session: { id: string; status: string } | null;
    progress: { currentPageId?: string } | null;
  } | null>({
    queryKey: ["/api/sessions/active", game?.id],
    queryFn: async () => {
      if (!game?.id) return null;
      const res = await fetch(`/api/sessions/active?gameId=${game.id}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.session ? data : null;
    },
    enabled: !!game?.id,
    retry: false,
    staleTime: 30_000,
  });

  const sessionStatus = activeSession?.session?.status ?? null;
  const hasResumablePlaying = sessionStatus === "playing" && !!activeSession?.progress?.currentPageId;
  const hasCompleted = sessionStatus === "completed";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">載入遊戲中...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>無法找到遊戲</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "此連結可能已失效或遊戲不存在"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (game.status !== "published") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            <CardTitle>遊戲尚未開放</CardTitle>
            <CardDescription>
              此遊戲目前尚未發布，請稍後再試
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {game.coverImageUrl && (
        // 🆕 2026-05-07 RWD：使用 aspect-video 避免不同設備裁切不同
        <div className="aspect-video sm:aspect-[21/9] relative bg-muted">
          <OptimizedImage
            src={game.coverImageUrl}
            alt={game.title}
            preset="cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}
      
      <div className="max-w-lg mx-auto p-4 -mt-8 relative">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-game-title">
              {game.title}
            </CardTitle>
            {game.field && (
              <CardDescription className="flex items-center justify-center gap-1">
                <MapPin className="w-4 h-4" />
                {game.field.name}
              </CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {game.description && (
              <p className="text-muted-foreground text-center" data-testid="text-game-description">
                {game.description}
              </p>
            )}
            
            <div className="flex justify-center gap-4 flex-wrap">
              {game.difficulty && (
                <Badge className={DIFFICULTY_COLORS[game.difficulty]} variant="secondary">
                  {DIFFICULTY_LABELS[game.difficulty]}
                </Badge>
              )}
              {game.estimatedTime && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {game.estimatedTime} 分鐘
                </Badge>
              )}
              {game.maxPlayers && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  最多 {game.maxPlayers} 人
                </Badge>
              )}
            </div>
            
            {/* 🔧 2026-07-05 UX：team 模式預告需登入組隊（原本進 GamePlay 才被踢、玩家措手不及）*/}
            {game.gameMode === "team" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2">
                  🔑 此為多人組隊遊戲，開始前需登入
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">登入後會自動回到這裡</p>
              </div>
            )}

            {game.locationLockEnabled && game.lockLocationName && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  需要在指定地點才能開始遊戲
                </p>
                <p className="font-medium mt-1">{game.lockLocationName}</p>
              </div>
            )}
            
            {/* 🆕 2026-05-02：QR 掃描進入後的按鈕依遊戲模式導向正確流程
                - chapters     → /game/:id/chapters（先選章節）
                - team         → /team/:id（先組隊 / 加入隊伍）
                - competitive  → /match/:id（先入競賽）
                - relay        → /match/:id（先入接力賽）
                - 其他（single）→ /game/:id（直接玩） */}
            <div className="pt-4 space-y-2">
              {(() => {
                const mode = game.gameMode;
                const structure = game.gameStructure;
                let label = "開始遊戲";
                let Icon = Play;
                let target = `/game/${game.id}`;
                let hint: string | null = null;

                if (structure === "chapters") {
                  label = "選擇章節";
                  Icon = BookOpen;
                  target = `/game/${game.id}/chapters`;
                  hint = "本遊戲分多個章節，請先選擇要挑戰的章節";
                } else if (mode === "team") {
                  label = "創建或加入隊伍";
                  Icon = Users;
                  target = `/team/${game.id}`;
                  hint = "本遊戲為多人隊伍模式，必須先組隊或加入既有隊伍才能開始";
                } else if (mode === "competitive" || mode === "relay") {
                  label = mode === "relay" ? "進入接力賽" : "進入競賽";
                  Icon = Swords;
                  target = `/match/${game.id}`;
                  hint = mode === "relay"
                    ? "本遊戲為接力賽，必須先進入賽事大廳"
                    : "本遊戲為競賽模式，必須先進入賽事大廳";
                }

                return (
                  <>
                    {hint && (
                      <p className="text-xs text-muted-foreground text-center px-2">
                        💡 {hint}
                      </p>
                    )}
                    {/* 🆕 2026-05-22 業主 docx #11：三態按鈕（never / playing / completed） */}
                    {hasResumablePlaying ? (
                      <>
                        {/* 進行中：返回遊戲 + 重新開始 */}
                        <Button
                          className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => setLocation(link(target))}
                          data-testid="button-resume-game"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          返回遊戲
                        </Button>
                        <Button
                          className="w-full h-12 text-lg"
                          variant="outline"
                          onClick={() => setLocation(link(target) + "?restart=1")}
                          data-testid="button-restart-game"
                        >
                          <Icon className="w-5 h-5 mr-2" />
                          重新開始（清除進度）
                        </Button>
                      </>
                    ) : hasCompleted ? (
                      /* 已完成過：再玩一次 */
                      <Button
                        className="w-full h-12 text-lg"
                        onClick={() => setLocation(link(target) + "?restart=1")}
                        data-testid="button-replay-game"
                      >
                        <Icon className="w-5 h-5 mr-2" />
                        🔁 再玩一次
                      </Button>
                    ) : (
                      /* 從沒玩過：開始遊戲 */
                      <Button
                        className="w-full h-12 text-lg"
                        onClick={() => setLocation(link(target))}
                        data-testid="button-start-game"
                      >
                        <Icon className="w-5 h-5 mr-2" />
                        {label}
                      </Button>
                    )}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
