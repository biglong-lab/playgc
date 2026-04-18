import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipForward, ChevronRight, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import type { VideoConfig } from "@shared/schema";

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

  const videoUrl = (config.videoUrl || "").trim();
  const hasValidUrl = videoUrl.length > 0;
  // forceWatch=true 時禁止跳過（影片結束才能繼續）
  const skipEnabled = config.skipEnabled !== false && !config.forceWatch;
  // forceWatch 時預設 autoCompleteOnEnd=true（看完自動前進）
  const autoCompleteOnEnd = config.autoCompleteOnEnd ?? !!config.forceWatch;

  const finish = () => {
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

  // 影片 URL 無效 / 載入失敗 → 不讓玩家卡死
  if (!hasValidUrl || hasError) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">
            {!hasValidUrl ? "影片未設定" : "影片載入失敗"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {!hasValidUrl
              ? "本頁面尚未設定影片 URL"
              : "無法播放影片，可能是網路或來源問題"}
          </p>
        </div>
        <Button onClick={finish} data-testid="button-video-fallback-continue">
          繼續遊戲 <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
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
            <div className="w-20 h-20 rounded-full bg-primary/80 flex items-center justify-center hover:bg-primary transition-colors">
              <Play className="w-10 h-10 text-primary-foreground ml-1" />
            </div>
          </button>
        )}

        {skipEnabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="absolute top-4 right-4 gap-1 bg-black/50 hover:bg-black/70 text-white"
            data-testid="button-skip-video"
          >
            <SkipForward className="w-4 h-4" />
            跳過
          </Button>
        )}
      </div>

      <div className="bg-card/95 backdrop-blur border-t border-border p-4">
        <Progress value={Number.isFinite(progress) ? progress : 0} className="h-2 mb-4" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              data-testid="button-toggle-play"
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
              data-testid="button-toggle-mute"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
          </div>

          {isEnded && !autoCompleteOnEnd && (
            <Button
              onClick={finish}
              className="gap-2"
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
