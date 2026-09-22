// 📱 QR 短連結 /g/:slug — 過場頁（2026-09-22 玩家動線優化 Phase 1）
//
// 業主需求：「掃描遊戲 QR，要直接進入遊戲，不是進入大廳又要找會迷路」
// 原本：遊戲介紹卡 → 按開始 → 未登入被丟回平台首頁 → 選場域 → 登入 → 大廳 → 回跳（最壞 12 步）
// 現在：讀到遊戲就 replace 導向正確入口（單人直接第一關、組隊→組隊大廳、章節→章節列表），
//       訪客身分由目的地路由的 GuestGate 背景建立，玩家不用點任何東西。
//
// QR 內容（/g/{slug}）不變 → 已印出的 QR 不需重印。
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { FullscreenSpinner } from "@/components/shared/GuestGate";
import { buildQrEntryTarget } from "@/lib/game-entry";

interface SlugGame {
  id: string;
  title: string;
  status: string | null;
  gameMode: string | null;
  gameStructure: string | null;
  field: { code?: string | null; name?: string | null } | null;
}

function SlugErrorCard({ title, message, homePath }: { title: string; message: string; homePath: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" onClick={() => setLocation(homePath)} data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首頁
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GameBySlug() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const { data: game, isLoading, error } = useQuery<SlugGame>({
    queryKey: ["/api/g", slug],
    queryFn: async () => {
      const response = await fetch(`/api/g/${slug}`);
      if (response.status === 404) throw new Error("遊戲不存在或尚未開放");
      if (!response.ok) throw new Error("無法載入遊戲資訊");
      return response.json();
    },
    enabled: !!slug,
    retry: 1,
  });

  const isPlayable = !!game && game.status === "published";

  useEffect(() => {
    if (!isPlayable || !game) return;
    // replace：玩家按返回不會回到這個過場頁再被轉走（避免返回鍵迴圈）
    setLocation(buildQrEntryTarget(game, search), { replace: true });
  }, [isPlayable, game, search, setLocation]);

  if (isLoading || isPlayable) {
    return <FullscreenSpinner label={game?.title ? `進入「${game.title}」...` : "載入遊戲中..."} />;
  }

  const fieldCode = game?.field?.code;
  const homePath = fieldCode ? `/f/${fieldCode.toUpperCase()}` : "/";
  if (game && game.status !== "published") {
    return <SlugErrorCard title="遊戲尚未開放" message="此遊戲目前尚未發布，請稍後再試" homePath={homePath} />;
  }
  return (
    <SlugErrorCard
      title="無法找到遊戲"
      message={error instanceof Error ? error.message : "此連結可能已失效或遊戲不存在"}
      homePath={homePath}
    />
  );
}
