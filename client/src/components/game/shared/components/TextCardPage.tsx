import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock, Volume2, VolumeX } from "lucide-react";
import type { TextCardConfig } from "@shared/schema";
import { createReliableAudio } from "@/lib/cloudinary-audio";
import OptimizedImage from "@/components/shared/OptimizedImage";
import { useTypewriterSound, type TypewriterSoundType } from "@/hooks/useTypewriterSound";

interface TextCardPageProps {
  config: TextCardConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function TextCardPage({ config, onComplete }: TextCardPageProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const content = config.content || "";
  const useTypewriter = config.typewriterEffect ?? false;
  const typeSpeed = config.typewriterSpeed ?? 30;
  // 🆕 2026-05-07 K.5：打字機音效（5 種預設、預設 none）
  const typewriterSoundType =
    ((config as unknown as { typewriterSoundType?: TypewriterSoundType }).typewriterSoundType ?? "none");
  const playCharSound = useTypewriterSound(typewriterSoundType);

  useEffect(() => {
    if (useTypewriter && content) {
      setIsTyping(true);
      setDisplayedText("");
      let charIndex = 0;

      const intervalId = setInterval(() => {
        if (charIndex < content.length) {
          setDisplayedText(content.slice(0, charIndex + 1));
          // 🆕 K.5：每打一字觸發音效
          playCharSound();
          charIndex++;
        } else {
          setIsTyping(false);
          clearInterval(intervalId);
        }
      }, typeSpeed);

      return () => clearInterval(intervalId);
    } else {
      setDisplayedText(content);
      setIsTyping(false);
    }
  }, [content, useTypewriter, typeSpeed, playCharSound]);

  // isTyping ref 避免 deps 變動觸發 effect 重跑時，cleanup 把 finishTimeoutId 清掉
  const isTypingRef = useRef(isTyping);
  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  useEffect(() => {
    if (config.timeLimit && config.timeLimit > 0) {
      setTimeLeft(config.timeLimit);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            // 若仍在打字，先補完並延遲 2 秒讓玩家至少讀完整內文才跳
            const stillTyping = useTypewriter && isTypingRef.current;
            const delay = stillTyping ? 2000 : 0;
            if (stillTyping) {
              setDisplayedText(content);
              setIsTyping(false);
            }
            // 注意：不存 ref 也不 clearTimeout，避免 re-render 時被清掉
            setTimeout(() => {
              onComplete(
                config.rewardPoints ? { points: config.rewardPoints } : undefined,
                config.nextPageId,
              );
            }, delay);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    // deps 不放 isTyping（改走 ref）避免打字過程 effect 反覆重跑
  }, [config.timeLimit, config.rewardPoints, config.nextPageId, onComplete, content, useTypewriter]);

  useEffect(() => {
    if (config.backgroundAudio) {
      // 🎵 用 createReliableAudio 處理 Cloudinary /video/upload/ URL
      //   會自動加 .mp3 副檔名強制 transcode，並在失敗時 fallback 原始 URL
      audioRef.current = createReliableAudio(config.backgroundAudio, {
        loop: true,
        volume: 0.3,
        onError: (err) => {
          console.error("[TextCard] 背景音訊載入失敗:", err);
        },
      });

      // 🎵 audioAutoplay (2026-05-07)：預設 true 進頁立即嘗試自動播放
      // 瀏覽器擋掉時依然靠 onClick={tryAutoPlayAudio} fallback
      // false 時玩家須手動點音訊按鈕才播
      const shouldAutoplay = config.audioAutoplay !== false;
      const audioEl = audioRef.current;
      if (shouldAutoplay && audioEl) {
        Promise.resolve(audioEl.play())
          .then(() => setAudioPlaying(true))
          .catch(() => {
            /* 被瀏覽器擋 — 等 user gesture（onClick）觸發 */
          });
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [config.backgroundAudio, config.audioAutoplay]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      Promise.resolve(audioRef.current.play())
        .then(() => setAudioPlaying(true))
        .catch(() => setAudioPlaying(false));
    }
  };

  /** 首次任何 user gesture（點擊頁面、按繼續等）嘗試自動播放背景音樂。
   * 瀏覽器政策：autoplay audio 必須在 user gesture 同步堆疊中觸發。
   * 無 backgroundAudio 或已播放則 no-op。
   * audioAutoplay = false 時不嘗試（玩家明確要關閉） */
  const tryAutoPlayAudio = () => {
    if (!audioRef.current || audioPlaying) return;
    if (config.audioAutoplay === false) return;
    Promise.resolve(audioRef.current.play())
      .then(() => setAudioPlaying(true))
      .catch(() => {
        /* 瀏覽器拒絕或被靜音，保持靜音狀態不干擾玩家 */
      });
  };

  const highlightedContent = useMemo(() => {
    if (!config.highlightKeywords?.length || !displayedText) {
      return displayedText;
    }
    let result = displayedText;
    // 關鍵：escape regex 元字符，避免 keyword 含 .*+?()[]|\ 等被當正則解析
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    config.highlightKeywords.forEach((keyword) => {
      if (!keyword) return;
      try {
        const regex = new RegExp(`(${escapeRegex(keyword)})`, "gi");
        result = result.replace(regex, "%%HIGHLIGHT_START%%$1%%HIGHLIGHT_END%%");
      } catch {
        // 防禦性：若 escape 後仍異常就跳過此 keyword
      }
    });
    return result;
  }, [displayedText, config.highlightKeywords]);

  const renderContent = () => {
    if (!config.highlightKeywords?.length) {
      return (
        <span>
          {displayedText}
          {isTyping && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
        </span>
      );
    }
    const parts = highlightedContent.split(/(%%HIGHLIGHT_START%%|%%HIGHLIGHT_END%%)/);
    let inHighlight = false;
    return (
      <>
        {parts.map((part, i) => {
          if (part === "%%HIGHLIGHT_START%%") {
            inHighlight = true;
            return null;
          }
          if (part === "%%HIGHLIGHT_END%%") {
            inHighlight = false;
            return null;
          }
          return inHighlight ? (
            <span key={i} className="text-primary font-bold bg-primary/20 px-1 rounded">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
        {isTyping && <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse" />}
      </>
    );
  };

  const getFontSize = () => {
    switch (config.fontSize) {
      case "small":
        return "text-base";
      case "large":
        return "text-xl";
      default:
        return "text-lg";
    }
  };

  const getAnimation = () => {
    switch (config.animation) {
      case "slide_in":
        return "animate-slideInUp";
      case "fade_in":
        return "animate-fadeIn";
      case "none":
        return "";
      default:
        return "animate-scaleIn";
    }
  };

  const handleContinue = () => {
    // 首次點擊繼續即 user gesture → 嘗試自動開始背景音樂（瀏覽器 autoplay 政策）
    tryAutoPlayAudio();

    if (isTyping) {
      setDisplayedText(content);
      setIsTyping(false);
    } else {
      onComplete(
        config.rewardPoints ? { points: config.rewardPoints } : undefined,
        config.nextPageId,
      );
    }
  };

  const renderCenterLayout = () => (
    // 🆕 D2-c+ (2026-05-09)：overflow-hidden → overflow-y-auto，長內容可 scroll、不再截斷
    <div className="min-h-full flex flex-col items-center justify-center p-6 py-12 relative overflow-y-auto overflow-x-hidden" onClick={tryAutoPlayAudio}>
      <div className="absolute inset-0 bg-tactical-gradient" />
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      
      {config.backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${config.backgroundImage})` }}
        />
      )}

      {renderControls()}

      <div className={`relative z-10 max-w-xl text-center ${getAnimation()}`}>
        {config.title && (
          <h1 
            className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wider mb-6 text-glow"
            style={{ color: config.textColor || "hsl(var(--primary))" }}
          >
            {config.title}
          </h1>
        )}
        
        <p 
          className={`font-chinese ${getFontSize()} leading-relaxed text-muted-foreground mb-8 whitespace-pre-wrap`}
          style={{ color: config.textColor ? `${config.textColor}cc` : undefined }}
        >
          {renderContent()}
        </p>
        
        <Button 
          onClick={handleContinue} 
          size="lg" 
          className="gap-2 w-full sm:w-auto sm:min-w-[160px] transition-transform active:scale-[0.97] hover:shadow-lg"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderImageTopLayout = () => (
    // 🆕 D2-c+ (2026-05-09)：overflow-hidden → overflow-y-auto
    <div className="min-h-full flex flex-col relative overflow-y-auto overflow-x-hidden pb-8" onClick={tryAutoPlayAudio}>
      {config.backgroundImage && (
        // 🆕 2026-05-07 RWD：用 aspect-ratio 取代固定 h-48、各設備比例一致不裁切
        <div className="relative aspect-video sm:aspect-[21/9] w-full bg-muted">
          <OptimizedImage
            src={config.backgroundImage}
            alt=""
            preset="cover"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}
      
      {renderControls()}
      
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${getAnimation()}`}>
        {config.title && (
          <h1 
            className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider mb-4 text-glow text-center"
            style={{ color: config.textColor || "hsl(var(--primary))" }}
          >
            {config.title}
          </h1>
        )}
        
        <p 
          className={`font-chinese ${getFontSize()} leading-relaxed text-muted-foreground mb-6 whitespace-pre-wrap text-center max-w-xl`}
          style={{ color: config.textColor ? `${config.textColor}cc` : undefined }}
        >
          {renderContent()}
        </p>
        
        <Button 
          onClick={handleContinue} 
          size="lg" 
          className="gap-2 w-full sm:w-auto sm:min-w-[160px] transition-transform active:scale-[0.97] hover:shadow-lg"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderImageLeftLayout = () => (
    <div className="min-h-full flex flex-col md:flex-row relative overflow-hidden" onClick={tryAutoPlayAudio}>
      {config.backgroundImage && (
        // 🆕 2026-05-07 RWD：手機 aspect-video 不裁切 / 桌面用 1/2 寬度填滿
        <div className="relative w-full md:w-1/2 aspect-video md:aspect-auto md:h-full bg-muted">
          <OptimizedImage
            src={config.backgroundImage}
            alt=""
            preset="cover"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background hidden md:block" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background md:hidden" />
        </div>
      )}
      
      {renderControls()}
      
      <div className={`flex-1 flex flex-col items-center justify-center p-6 ${getAnimation()}`}>
        {config.title && (
          <h1 
            className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wider mb-4 text-glow"
            style={{ color: config.textColor || "hsl(var(--primary))" }}
          >
            {config.title}
          </h1>
        )}
        
        <p 
          className={`font-chinese ${getFontSize()} leading-relaxed text-muted-foreground mb-6 whitespace-pre-wrap max-w-md`}
          style={{ color: config.textColor ? `${config.textColor}cc` : undefined }}
        >
          {renderContent()}
        </p>
        
        <Button 
          onClick={handleContinue} 
          size="lg" 
          className="gap-2 w-full sm:w-auto sm:min-w-[160px] transition-transform active:scale-[0.97] hover:shadow-lg"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderFullscreenLayout = () => (
    <div className="min-h-full relative overflow-hidden" onClick={tryAutoPlayAudio}>
      {config.backgroundImage && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${config.backgroundImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-black/60" />
      
      {renderControls()}
      
      <div className={`relative z-10 min-h-full flex flex-col items-center justify-center p-6 ${getAnimation()}`}>
        {config.title && (
          <h1 
            className="font-display text-3xl md:text-5xl font-bold uppercase tracking-wider mb-6 text-white text-glow text-center"
          >
            {config.title}
          </h1>
        )}
        
        <p 
          className={`font-chinese ${getFontSize()} leading-relaxed text-white/90 mb-8 whitespace-pre-wrap text-center max-w-2xl`}
        >
          {renderContent()}
        </p>
        
        <Button 
          onClick={handleContinue} 
          size="lg" 
          className="gap-2 w-full sm:w-auto sm:min-w-[160px] transition-transform active:scale-[0.97] hover:shadow-lg"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderControls = () => (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
      {timeLeft !== null && (
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 border border-border">
          <Clock className="w-4 h-4 text-primary" />
          <span className={`font-mono text-sm font-bold ${timeLeft <= 10 ? "text-destructive animate-pulse" : "text-foreground"}`}>
            {timeLeft}s
          </span>
        </div>
      )}
      {config.backgroundAudio && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleAudio}
          className="bg-background/80 backdrop-blur-sm"
          data-testid="button-toggle-audio"
        >
          {audioPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      )}
    </div>
  );

  switch (config.layout) {
    case "image_top":
      return renderImageTopLayout();
    case "image_left":
      return renderImageLeftLayout();
    case "fullscreen":
      return renderFullscreenLayout();
    default:
      return renderCenterLayout();
  }
}
