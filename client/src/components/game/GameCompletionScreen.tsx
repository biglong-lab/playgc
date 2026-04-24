// 🎉 遊戲/章節完成畫面 — 含煙火、星星、動畫分數遞增、分享戰績、紀念卡
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Trophy, Home, RefreshCw, Star, Sparkles, Share2,
  Image as ImageIcon, Download, Loader2, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { useFieldLink } from "@/hooks/useFieldLink";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface GameCompletionScreenProps {
  readonly score: number;
  readonly gameTitle: string;
  readonly isChapterMode: boolean;
  readonly chapterTitle?: string;
  readonly gameId: string;
  readonly sessionId?: string;   // 🆕 v2: 傳入以便顯示「看本場相簿」連結
  readonly onPlayAgain: () => void;
  readonly onNavigate: (path: string) => void;
}

// 依分數決定星數（1-3 顆）— 提供視覺化的「表現評等」
function starsByScore(score: number): number {
  if (score >= 100) return 3;
  if (score >= 50) return 2;
  if (score > 0) return 1;
  return 0;
}

// 分數從 0 遞增到 target 的動畫 hook
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    const startTime = performance.now();
    let rafId = 0;
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return value;
}

/**
 * 煙火粒子 — 從中心向外發散
 */
function Firework({ delay = 0 }: { delay?: number }) {
  const particles = Array.from({ length: 12 });
  return (
    <>
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const radius = 120 + Math.random() * 80;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const hue = Math.floor(Math.random() * 60) + 30; // 暖色系
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full pointer-events-none"
            style={{ backgroundColor: `hsl(${hue}, 95%, 65%)` }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1.5 }}
            animate={{ x, y, opacity: 0, scale: 0.2 }}
            transition={{ duration: 1.4, delay, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

export default function GameCompletionScreen({
  score,
  gameTitle,
  isChapterMode,
  chapterTitle,
  gameId,
  sessionId,
  onPlayAgain,
  onNavigate,
}: GameCompletionScreenProps) {
  const animatedScore = useCountUp(score);
  const starCount = starsByScore(score);
  const { toast } = useToast();
  const currentField = useCurrentField();
  // 🔧 場域感知 link — 避免「後浦玩家按返回大廳跑到賈村」的隔離 bug
  const link = useFieldLink();

  // 🆕 v2: 查本次 session 有無照片 — 有才顯示「看本場相簿」按鈕
  const { data: albumData } = useQuery<{ photos?: unknown[] }>({
    queryKey: [`/api/sessions/${sessionId}/album`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/album`);
      return res.json();
    },
    enabled: !!sessionId,
    staleTime: 60_000,
  });
  const hasAlbumPhotos = (albumData?.photos?.length ?? 0) > 0;

  // 🏆 成就卡 state
  const [cardOpen, setCardOpen] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);

  const handleGenerateCard = async () => {
    setCardOpen(true);
    if (cardUrl) return;  // 已生成過不重複打 API
    setCardLoading(true);
    try {
      // 🆕 v2: 帶 fieldCode 取場域自訂模板（沒設則 fallback 系統預設）
      const fieldCode = currentField?.code;
      const cfgUrl = fieldCode
        ? `/api/photo-composite/achievement-config?fieldCode=${encodeURIComponent(fieldCode)}`
        : "/api/photo-composite/achievement-config";
      const cfgRes = await fetch(cfgUrl);
      const { config } = await cfgRes.json();

      const fieldName = currentField?.name || "CHITO";
      const coverUrl = currentField?.theme?.coverImageUrl
        || currentField?.logoUrl
        || "https://res.cloudinary.com/demo/image/upload/sample.jpg";

      const res = await apiRequest("POST", "/api/cloudinary/composite-photo", {
        playerPhotoUrl: coverUrl,   // 用場域封面當底圖，fetch mode
        config,
        dynamicVars: {
          fieldName,
          gameTitle: isChapterMode ? (chapterTitle ?? "章節") : gameTitle,
          playerName: "挑戰者",
          score,
        },
      });
      const data = await res.json();
      if (data.compositeUrl) {
        setCardUrl(data.compositeUrl);
      } else {
        throw new Error("未取得紀念卡");
      }
    } catch (err) {
      toast({
        title: "紀念卡生成失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
      setCardOpen(false);
    } finally {
      setCardLoading(false);
    }
  };

  const handleDownloadCard = async () => {
    if (!cardUrl) return;
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-achievement-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "紀念卡已下載", duration: 1500 });
    } catch {
      toast({ title: "下載失敗", variant: "destructive" });
    }
  };

  const handleShareCard = async () => {
    if (!cardUrl) return;
    try {
      if (typeof navigator.share === "function") {
        const res = await fetch(cardUrl);
        const blob = await res.blob();
        const file = new File([blob], "achievement.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: `我在 ${currentField?.name || "CHITO"} 的紀念卡`,
            text: `${gameTitle} — 得 ${score} 分！`,
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: `我在 ${currentField?.name || "CHITO"} 的紀念卡`,
          text: `${gameTitle} — 得 ${score} 分！`,
          url: cardUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(cardUrl);
      toast({ title: "已複製紀念卡連結" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  const heading = isChapterMode ? "章節完成!" : "任務完成!";
  const subtitle = isChapterMode
    ? `恭喜完成 ${chapterTitle ?? "此章節"}`
    : `恭喜完成 ${gameTitle}`;

  // 🆕 F3: 分享戰績（Web Share API + clipboard fallback）
  const handleShareScore = async () => {
    const fieldCode = currentField?.code || "";
    const fieldName = currentField?.name || "CHITO";
    // 遊戲頁連結（場域格式）— OG meta 會讓 preview 顯示該遊戲封面 + 描述
    const shareUrl = fieldCode
      ? `https://game.homi.cc/f/${fieldCode}/game/${gameId}`
      : `https://game.homi.cc/`;
    const title = isChapterMode ? `我在 ${fieldName} 完成了章節「${chapterTitle}」` : `我在 ${fieldName} 完成了「${gameTitle}」`;
    const text = `${title}，得 ${score} 分！來挑戰看看：`;

    const shareData: ShareData = {
      title,
      text,
      url: shareUrl,
    };

    // 優先 Web Share API（手機好用）
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // 使用者取消 → AbortError，忽略
        if ((err as DOMException)?.name === "AbortError") return;
        // 其他錯誤 → fallback 複製
      }
    }

    // Fallback：複製到剪貼簿
    try {
      await navigator.clipboard.writeText(`${text}${shareUrl}`);
      toast({
        title: "已複製戰績連結",
        description: "可直接貼到 LINE / FB / Twitter 分享",
      });
    } catch {
      toast({
        title: "分享失敗",
        description: "請手動複製網址",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* 背景煙火層 */}
      <div className="absolute inset-0 pointer-events-none">
        <Firework delay={0.1} />
        <Firework delay={0.5} />
        <Firework delay={0.9} />
      </div>

      <motion.div
        className="text-center max-w-md px-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* 🏆 Trophy 圖示 + 發光光環 */}
        <motion.div
          className="relative mx-auto mb-6 w-28 h-28"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.2 }}
        >
          {/* 光環 */}
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 blur-xl opacity-60"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
            <Trophy className="w-14 h-14 text-white drop-shadow" />
          </div>
          {/* 周圍閃爍 */}
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-pulse" />
          <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-yellow-200 animate-pulse" />
        </motion.div>

        <motion.h2
          className="text-4xl font-display font-bold mb-2 bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {heading}
        </motion.h2>

        <motion.p
          className="text-muted-foreground mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {subtitle}
        </motion.p>

        {/* ⭐ 星評等 */}
        <motion.div
          className="flex items-center justify-center gap-2 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ scale: 0, rotate: -90 }}
              animate={{
                scale: i <= starCount ? 1 : 0.7,
                rotate: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.8 + i * 0.18,
              }}
            >
              <Star
                className={`w-10 h-10 ${
                  i <= starCount
                    ? "fill-yellow-400 text-yellow-400 drop-shadow-lg"
                    : "text-muted-foreground/30"
                }`}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* 💯 分數 — 遞增動畫 */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.0 }}
        >
          <p className="text-6xl font-number font-bold bg-gradient-to-br from-primary to-orange-500 bg-clip-text text-transparent tabular-nums">
            {animatedScore}
          </p>
          <p className="text-sm text-muted-foreground mt-1">分</p>
        </motion.div>

        {/* 🆕 F3: 分享戰績（獨立列，主要 CTA，金色 gradient 很顯眼） */}
        <motion.div
          className="flex flex-col sm:flex-row justify-center gap-2 mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <Button
            onClick={handleShareScore}
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white w-full sm:flex-1 font-semibold shadow-md h-11"
            data-testid="btn-share-score"
          >
            <Share2 className="w-4 h-4" />
            分享戰績
          </Button>
          {/* 🆕 v2: 生成紀念卡 */}
          <Button
            onClick={handleGenerateCard}
            variant="outline"
            className="gap-2 w-full sm:flex-1 h-11 font-semibold border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950/30"
            data-testid="btn-generate-achievement-card"
          >
            <ImageIcon className="w-4 h-4" />
            生成紀念卡
          </Button>
        </motion.div>

        {/* 按鈕群 */}
        <motion.div
          className="flex flex-col sm:flex-row gap-3 justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
        >
          <Button
            onClick={onPlayAgain}
            variant="outline"
            className="gap-2"
            data-testid="button-play-again"
          >
            <RefreshCw className="w-4 h-4" />
            {isChapterMode ? "重玩本章" : "再玩一次"}
          </Button>
          {isChapterMode ? (
            <Button
              onClick={() => onNavigate(link(`/game/${gameId}/chapters`))}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              返回章節列表
            </Button>
          ) : (
            <>
              <Button
                onClick={() => onNavigate(link("/home"))}
                variant="outline"
                className="gap-2"
                data-testid="button-return-home"
              >
                <Home className="w-4 h-4" />
                返回大廳
              </Button>
              <Button
                onClick={() => onNavigate(link("/leaderboard"))}
                className="gap-2"
                data-testid="button-view-leaderboard"
              >
                <Trophy className="w-4 h-4" />
                排行榜
              </Button>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* 🏆 成就卡 Dialog */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="max-w-md p-0 gap-0" data-testid="achievement-card-dialog">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Trophy className="w-5 h-5 text-amber-500" />
              紀念卡
            </DialogTitle>
            <DialogDescription className="text-xs">
              儲存或分享你的成就 — 可貼到 LINE / FB / IG 動態
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-square bg-muted">
            {cardLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在生成紀念卡...</p>
              </div>
            ) : cardUrl ? (
              <img
                src={cardUrl}
                alt="紀念卡"
                className="w-full h-full object-cover"
                data-testid="achievement-card-image"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <X className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex gap-2 p-4">
            <Button
              onClick={handleDownloadCard}
              variant="outline"
              className="flex-1 gap-1"
              disabled={!cardUrl}
              data-testid="btn-download-achievement-card"
            >
              <Download className="w-4 h-4" />
              下載
            </Button>
            <Button
              onClick={handleShareCard}
              className="flex-1 gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              disabled={!cardUrl}
              data-testid="btn-share-achievement-card"
            >
              <Share2 className="w-4 h-4" />
              分享
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
