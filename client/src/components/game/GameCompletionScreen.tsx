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
import { savePhotoToAlbum, getSaveToastMessage } from "@/lib/photo-save";
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
    if (cardUrl) return;
    setCardLoading(true);
    try {
      // 🚀 Progressive Enhancement：
      //   Step 1: client canvas 立刻生成（< 100ms，100% 成功）
      //   Step 2: 背景呼叫 Cloudinary 真正合成炫版本（成功才替換）
      const { createAchievementCard } = await import(
        "@/lib/client-achievement-card"
      );
      const fieldName = currentField?.name || "CHITO";
      const primaryColor = currentField?.theme?.primaryColor || "#ea580c";
      const gameTitleResolved = isChapterMode ? chapterTitle ?? "章節" : gameTitle;
      const subtitleResolved = isChapterMode ? "章節完成" : "任務完成";

      // === Step 1: client canvas 立刻顯示 ===
      const dataUrl = await createAchievementCard({
        fieldName,
        gameTitle: gameTitleResolved,
        playerName: "挑戰者",
        score,
        subtitle: subtitleResolved,
        primaryColor,
      });
      setCardUrl(dataUrl);
      setCardLoading(false); // 立刻結束 loading，使用者已看到結果

      // === Step 2: 背景呼叫 Cloudinary 升級（失敗沒差，保留 canvas 版）===
      upgradeCardToCloudinary({
        dataUrl,
        fieldName,
        gameTitle: gameTitleResolved,
        score,
        subtitle: subtitleResolved,
        fieldCode: currentField?.code || "chito",
      }).catch((err) => {
        console.warn("[AchievementCard] Cloudinary 升級失敗（保留 canvas 版）:", err);
      });
    } catch (err) {
      console.error("[AchievementCard] client canvas 生成失敗:", err);
      toast({
        title: "紀念卡生成失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
      setCardOpen(false);
      setCardLoading(false);
    }
  };

  // 🎨 背景升級紀念卡：上傳 canvas base64 到 Cloudinary，套用酷效果（光暈、邊框、水印）
  const upgradeCardToCloudinary = async ({
    dataUrl,
    fieldName,
    gameTitle,
    score,
    subtitle,
    fieldCode,
  }: {
    dataUrl: string;
    fieldName: string;
    gameTitle: string;
    score: number;
    subtitle: string;
    fieldCode: string;
  }) => {
    // Cloudinary transformation — 真正發揮 server 合成酷效果
    const transformation = [
      // 基本：限定尺寸 + 優化
      { width: 1080, height: 1080, crop: "fill", quality: "auto:good" },
      // 🎨 加鋒利濾鏡
      { effect: "sharpen:30" },
      // 🎨 邊框（漸層白框）
      { border: "8px_solid_white", radius: 20 },
      // 🎨 光暈（微弱陰影）
      { effect: "shadow:30,x_0,y_0", color: "rgb:00000040" },
      // 🎨 CHITO 水印文字（右下角）
      {
        overlay: {
          font_family: "Arial",
          font_size: 32,
          font_weight: "bold",
          text: `CHITO%20%E2%80%A2%20${encodeURIComponent(fieldCode)}`,
        },
        color: "white",
        opacity: 70,
        gravity: "south_east",
        x: 40,
        y: 40,
      },
      // 格式輸出
      { fetch_format: "auto" },
    ];

    try {
      const res = await apiRequest("POST", "/api/cloudinary/composite-upload", {
        sourceImageUrl: dataUrl,
        transformation,
        folder: `achievements/${fieldCode.toLowerCase()}`,
        publicId: `${fieldCode.toLowerCase()}_${Date.now()}`,
      });
      const data = (await res.json()) as { success?: boolean; url?: string };
      if (data.success && data.url) {
        console.log("[AchievementCard] ✨ Cloudinary 升級完成，替換");
        setCardUrl(data.url); // 靜默替換（使用者不會察覺卡頓）
      }
    } catch (err) {
      console.warn("[AchievementCard] Cloudinary 升級失敗:", err);
      // 保留 canvas 版
    }
  };

  // 🆕 一鍵保存紀念卡到手機相簿
  const handleSaveCardToAlbum = async () => {
    if (!cardUrl) return;
    const result = await savePhotoToAlbum({
      url: cardUrl,
      filename: "chito-achievement",
      title: `我在 ${currentField?.name || "CHITO"} 的紀念卡`,
      text: `${gameTitle} — 得 ${score} 分！`,
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleDownloadCard = async () => {
    if (!cardUrl) return;
    const result = await savePhotoToAlbum({
      url: cardUrl,
      filename: "chito-achievement",
      forceMethod: "download",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const handleShareCard = async () => {
    if (!cardUrl) return;
    const result = await savePhotoToAlbum({
      url: cardUrl,
      filename: "chito-achievement",
      title: `我在 ${currentField?.name || "CHITO"} 的紀念卡`,
      text: `${gameTitle} — 得 ${score} 分！`,
      forceMethod: "share",
    });
    const msg = getSaveToastMessage(result);
    if (msg.title) toast(msg);
  };

  const heading = isChapterMode ? "章節完成!" : "任務完成!";
  const subtitle = isChapterMode
    ? `恭喜完成 ${chapterTitle ?? "此章節"}`
    : `恭喜完成 ${gameTitle}`;

  // 🆕 F3: 分享戰績（Web Share API + clipboard fallback）
  // 🐛 修：原本分享的是「遊戲邀請連結」(/f/xx/game/xxx)，收到者點開是玩自己的新遊戲
  //      → 他看本場相簿時看到的是自己的照片，不是分享者的 → 隱私誤會
  //   現在分享「本場 session 相簿 URL」(/f/xx/album/{sessionId})
  //   → 收到者點開直接看分享者的紀念照 + 底部「挑戰看看」按鈕才進遊戲
  const handleShareScore = async () => {
    const fieldCode = currentField?.code || "";
    const fieldName = currentField?.name || "CHITO";
    // ✅ 優先分享本場相簿（收到者直接看分享者紀念照）
    //    若沒 sessionId 或沒拍到照片，退回遊戲連結
    const shareUrl = (() => {
      if (sessionId && hasAlbumPhotos) {
        return fieldCode
          ? `https://game.homi.cc/f/${fieldCode}/album/${sessionId}`
          : `https://game.homi.cc/album/${sessionId}`;
      }
      return fieldCode
        ? `https://game.homi.cc/f/${fieldCode}/game/${gameId}`
        : `https://game.homi.cc/`;
    })();
    const title = isChapterMode ? `我在 ${fieldName} 完成了章節「${chapterTitle}」` : `我在 ${fieldName} 完成了「${gameTitle}」`;
    const text = `${title}，得 ${score} 分！來看我的紀念照：`;

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

        {/* 🆕 v2: 看本場相簿（僅本次 session 有拍照時顯示）*/}
        {hasAlbumPhotos && sessionId && (
          <motion.div
            className="flex justify-center mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25 }}
          >
            <Button
              onClick={() => onNavigate(link(`/album/${sessionId}`))}
              variant="ghost"
              className="gap-2 text-sm w-full sm:min-w-[200px]"
              data-testid="btn-view-session-album"
            >
              <ImageIcon className="w-4 h-4" />
              查看本場相簿（{albumData?.photos?.length ?? 0} 張）
            </Button>
          </motion.div>
        )}

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
                onError={(e) => {
                  // 載入失敗就把 img 藏起來顯示 fallback text
                  (e.target as HTMLImageElement).style.display = "none";
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent && !parent.querySelector(".card-error-fallback")) {
                    const div = document.createElement("div");
                    div.className =
                      "card-error-fallback absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center";
                    div.innerHTML = `
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground/60">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M3 15l6-6 6 6 4-4 2 2"/>
                      </svg>
                      <p class="text-sm text-muted-foreground">紀念卡暫時無法生成</p>
                      <p class="text-xs text-muted-foreground">你仍可下方繼續操作</p>
                    `;
                    parent.appendChild(div);
                  }
                }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <X className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  紀念卡生成失敗
                </p>
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
