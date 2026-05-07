import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipForward, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { VideoConfig } from "@shared/schema";
import GameErrorView from "../../photo-mission/GameErrorView";
import { useBgmPlayer } from "@/hooks/useBgmPlayer";

interface VideoPageProps {
  config: VideoConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function VideoPage({ config, onComplete }: VideoPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(config.autoPlay !== false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const retryCountRef = useRef(0);

  // 🆕 2026-05-07 K.3：影片播放時 BGM 自動減弱、影片結束/離開時恢復
  const bgm = useBgmPlayer();
  useEffect(() => {
    bgm.duck();
    return () => {
      bgm.unduck();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const videoUrl = (config.videoUrl || "").trim();
  const hasValidUrl = videoUrl.length > 0;
  // forceWatch=true 時禁止跳過（影片結束才能繼續）
  const skipEnabled = config.skipEnabled !== false && !config.forceWatch;
  // forceWatch 時預設 autoCompleteOnEnd=true（看完自動前進）
  const autoCompleteOnEnd = config.autoCompleteOnEnd ?? !!config.forceWatch;

  // 防重複 onComplete：rage-click 跳過 / ended + skip 競態
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete(
      config.rewardPoints ? { points: config.rewardPoints } : undefined,
      config.nextPageId,
    );
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasValidUrl) return;

    const handleTimeUpdate = () => {
      if (!video.duration || !Number.isFinite(video.duration)) return;
      const percent = (video.currentTime / video.duration) * 100;
      setProgress(percent);
    };

    const handleEnded = () => {
      setIsEnded(true);
      setIsPlaying(false);
      if (autoCompleteOnEnd) {
        // 延後 500ms 讓玩家看到結束狀態
        setTimeout(() => finish(), 500);
      }
    };

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      const code = video.error?.code;
      const msg =
        code === 1 ? "下載中止"
        : code === 2 ? "網路錯誤"
        : code === 3 ? "影片解碼失敗（codec 不支援）"
        : code === 4 ? "影片格式不支援或檔案不存在"
        : video.error?.message || "未知錯誤";
      console.error("[VideoPage] error event", {
        code,
        msg,
        src: video.src,
        currentSrc: video.currentSrc,
        networkState: video.networkState,
        readyState: video.readyState,
      });

      // 🔁 自動重試一次（避免暫時網路 hiccup 直接顯示錯誤）
      if (retryCountRef.current < 1 && code !== 4) {
        retryCountRef.current += 1;
        console.log("[VideoPage] auto retry", retryCountRef.current);
        setTimeout(() => {
          video.load(); // 重新載入
        }, 1000);
        return;
      }

      setErrorDetail(msg);
      setHasError(true);
      setIsLoading(false);
      setIsPlaying(false);
    };

    const handleVolumeChange = () => {
      setIsMuted(video.muted);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    video.addEventListener("volumechange", handleVolumeChange);

    if (config.autoPlay !== false) {
      // Promise.resolve 包裹避免 video.play() 在舊環境 / test 環境回 undefined 導致 .catch 爆
      Promise.resolve(video.play()).catch(() => setIsPlaying(false));
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.autoPlay, hasValidUrl, autoCompleteOnEnd]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || hasError) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      Promise.resolve(video.play())
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const handleSkip = () => {
    if (skipEnabled) finish();
  };

  // 影片 URL 無效 / 載入失敗 → 顯示錯誤但保留 title/description（讓玩家知道這是哪一段）
  if (!hasValidUrl || hasError) {
    return (
      <div className="min-h-full flex flex-col">
        {(config.title || config.description) && (
          <div className="bg-card/95 backdrop-blur border-b border-border p-4">
            {config.title && <h2 className="font-semibold">{config.title}</h2>}
            {config.description && (
              <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
            )}
          </div>
        )}
        <div className="flex-1">
          <GameErrorView
            title={!hasValidUrl ? "影片未設定" : "影片載入失敗"}
            message={
              !hasValidUrl
                ? "管理員尚未設定影片 URL，可跳過此關繼續"
                : errorDetail || "網路或來源問題，可跳過此關繼續"
            }
            hint={hasError ? "連 WiFi 或換個網路環境再試" : undefined}
            onRetry={hasError ? () => {
              retryCountRef.current = 0;
              setErrorDetail("");
              setHasError(false);
              setIsLoading(true);
              // 強制 reload video element
              videoRef.current?.load();
            } : undefined}
            onSkip={finish}
            skipLabel="繼續遊戲"
            testId="video-error"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-black">
      {(config.title || config.description) && (
        <div className="bg-card/95 backdrop-blur border-b border-border p-4">
          {config.title && <h2 className="font-semibold">{config.title}</h2>}
          {config.description && (
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          )}
        </div>
      )}

      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          src={videoUrl}
          poster={config.poster}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
          data-testid="video-player"
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isPlaying && !isEnded && !isLoading && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
            data-testid="button-play-overlay"
          >
            <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center hover:bg-primary transition-colors active:scale-95 shadow-2xl ring-4 ring-white/10">
              <Play className="w-10 h-10 text-primary-foreground ml-1" />
            </div>
          </button>
        )}

        {skipEnabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="absolute top-4 right-4 gap-1 bg-black/50 hover:bg-black/70 text-white transition-transform active:scale-[0.95]"
            data-testid="button-skip-video"
          >
            <SkipForward className="w-4 h-4" />
            跳過
          </Button>
        )}
      </div>

      <div className="bg-card/95 backdrop-blur border-t border-border p-4">
        {/* 🆕 Progress 加 transition-all 平滑播放進度（避免每秒跳動感）*/}
        <Progress
          value={Number.isFinite(progress) ? progress : 0}
          className="h-2 mb-4 transition-all"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="transition-transform active:scale-[0.92] hover:bg-primary/10"
              data-testid="button-toggle-play"
              aria-label={isPlaying ? "暫停" : "播放"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="transition-transform active:scale-[0.92] hover:bg-primary/10"
              data-testid="button-toggle-mute"
              aria-label={isMuted ? "取消靜音" : "靜音"}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>

            {/* 🆕 加上播放進度時間顯示（X% / 100%）— tabular-nums 不抖動 */}
            <span className="text-xs text-muted-foreground tabular-nums ml-1">
              {Math.round(Number.isFinite(progress) ? progress : 0)}%
            </span>
          </div>

          {isEnded && !autoCompleteOnEnd && (
            <Button
              onClick={finish}
              className="gap-2 transition-transform active:scale-[0.97] animate-in fade-in slide-in-from-right-2"
              data-testid="button-video-continue"
            >
              繼續
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
