import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, Clock, Volume2, VolumeX } from "lucide-react";
import type { TextCardConfig } from "@shared/schema";

interface TextCardPageProps {
  config: TextCardConfig;
  onComplete: (reward?: { points?: number; items?: string[] }) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
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

  useEffect(() => {
    if (useTypewriter && content) {
      setIsTyping(true);
      setDisplayedText("");
      let charIndex = 0;

      const intervalId = setInterval(() => {
        if (charIndex < content.length) {
          setDisplayedText(content.slice(0, charIndex + 1));
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
  }, [content, useTypewriter, typeSpeed]);

  useEffect(() => {
    if (config.timeLimit && config.timeLimit > 0) {
      setTimeLeft(config.timeLimit);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [config.timeLimit, onComplete]);

  useEffect(() => {
    if (config.backgroundAudio) {
      audioRef.current = new Audio(config.backgroundAudio);
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [config.backgroundAudio]);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const highlightedContent = useMemo(() => {
    if (!config.highlightKeywords?.length || !displayedText) {
      return displayedText;
    }
    let result = displayedText;
    config.highlightKeywords.forEach((keyword) => {
      const regex = new RegExp(`(${keyword})`, "gi");
      result = result.replace(regex, "%%HIGHLIGHT_START%%$1%%HIGHLIGHT_END%%");
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
      case "none":
        return "";
      default:
        return "animate-scaleIn";
    }
  };

  const handleContinue = () => {
    if (isTyping) {
      setDisplayedText(content);
      setIsTyping(false);
    } else {
      onComplete();
    }
  };

  const renderCenterLayout = () => (
    <div className="min-h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
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
          className="gap-2 min-w-[160px]"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderImageTopLayout = () => (
    <div className="min-h-full flex flex-col relative overflow-hidden">
      {config.backgroundImage && (
        <div className="relative h-48 md:h-64 w-full">
          <img 
            src={config.backgroundImage} 
            alt="" 
            className="w-full h-full object-cover"
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
          className="gap-2 min-w-[160px]"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderImageLeftLayout = () => (
    <div className="min-h-full flex flex-col md:flex-row relative overflow-hidden">
      {config.backgroundImage && (
        <div className="relative w-full md:w-1/2 h-48 md:h-full">
          <img 
            src={config.backgroundImage} 
            alt="" 
            className="w-full h-full object-cover"
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
          className="gap-2 min-w-[160px]"
          data-testid="button-continue"
        >
          {isTyping ? "顯示全部" : "繼續"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderFullscreenLayout = () => (
    <div className="min-h-full relative overflow-hidden">
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
          className="gap-2 min-w-[160px]"
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
