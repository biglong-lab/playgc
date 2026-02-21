import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, SkipForward, ChevronRight, Volume2, VolumeX } from "lucide-react";
import type { VideoConfig } from "@shared/schema";

interface VideoPageProps {
  config: VideoConfig;
  onComplete: (reward?: { points?: number; items?: string[] }) => void;
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const percent = (video.currentTime / video.duration) * 100;
      setProgress(percent);
    };

    const handleEnded = () => {
      setIsEnded(true);
      setIsPlaying(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    if (config.autoPlay !== false) {
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [config.autoPlay]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSkip = () => {
    if (config.skipEnabled !== false) {
      onComplete();
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-black">
      <div className="flex-1 relative flex items-center justify-center">
        <video
          ref={videoRef}
          src={config.videoUrl}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
          data-testid="video-player"
        />

        {!isPlaying && !isEnded && (
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

        {config.skipEnabled !== false && (
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
        <Progress value={progress} className="h-1 mb-4" />

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

          {isEnded && (
            <Button 
              onClick={() => onComplete()} 
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
