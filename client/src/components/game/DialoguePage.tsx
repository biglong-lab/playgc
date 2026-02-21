import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, SkipForward, Smile, Angry, Frown, HelpCircle, Sparkles } from "lucide-react";
import type { DialogueConfig, DialogueMessage } from "@shared/schema";

interface DialoguePageProps {
  config: DialogueConfig;
  onComplete: (reward?: { points?: number; items?: string[] }) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

const EMOTION_ICONS = {
  neutral: null,
  happy: Smile,
  angry: Angry,
  surprised: Sparkles,
  sad: Frown,
  thinking: HelpCircle,
};

const EMOTION_COLORS = {
  neutral: "text-muted-foreground",
  happy: "text-yellow-500",
  angry: "text-red-500",
  surprised: "text-purple-500",
  sad: "text-blue-500",
  thinking: "text-cyan-500",
};

const EMOTION_LABELS = {
  neutral: "",
  happy: "開心",
  angry: "憤怒",
  surprised: "驚訝",
  sad: "難過",
  thinking: "思考中",
};

export default function DialoguePage({ config, onComplete }: DialoguePageProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const messages = config?.messages || [];
  const currentMessage = messages[currentMessageIndex] as DialogueMessage | undefined;
  const isLastMessage = currentMessageIndex === messages.length - 1;
  const character = config?.character || { name: "???", avatar: null };
  const useBubbleAnimation = config?.bubbleAnimation ?? true;

  const currentEmotion = currentMessage?.emotion || "neutral";
  const EmotionIcon = EMOTION_ICONS[currentEmotion];

  const getCurrentAvatar = () => {
    if (character.emotionAvatars && currentEmotion !== "neutral") {
      const emotionAvatar = character.emotionAvatars[currentEmotion];
      if (emotionAvatar) return emotionAvatar;
    }
    return character.avatar;
  };

  useEffect(() => {
    if (!currentMessage) {
      setDisplayedText("");
      setIsTyping(false);
      return;
    }

    if (useBubbleAnimation) {
      setBubbleVisible(false);
      const showTimer = setTimeout(() => setBubbleVisible(true), 100);
      return () => clearTimeout(showTimer);
    } else {
      setBubbleVisible(true);
    }
  }, [currentMessageIndex, useBubbleAnimation]);

  useEffect(() => {
    if (!currentMessage || !bubbleVisible) {
      return;
    }

    setDisplayedText("");
    setIsTyping(true);
    
    let charIndex = 0;
    const text = currentMessage.text || "";
    const typingSpeed = 30;

    const intervalId = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);
        
        if (config?.autoAdvance && !isLastMessage) {
          setTimeout(() => {
            setCurrentMessageIndex(prev => prev + 1);
          }, currentMessage.delay || 2000);
        }
      }
    }, typingSpeed);

    return () => clearInterval(intervalId);
  }, [currentMessageIndex, currentMessage, config?.autoAdvance, isLastMessage, bubbleVisible]);

  const handleNext = () => {
    if (!currentMessage) {
      onComplete();
      return;
    }
    
    if (isTyping) {
      setDisplayedText(currentMessage.text || "");
      setIsTyping(false);
      return;
    }

    if (isLastMessage) {
      onComplete();
    } else {
      setCurrentMessageIndex(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!messages.length) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">沒有對話內容</p>
        <Button onClick={() => onComplete()} data-testid="button-continue">
          繼續
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col p-4">
      <div className="flex justify-end mb-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleSkip}
          className="gap-1 text-muted-foreground"
          data-testid="button-skip-dialogue"
        >
          <SkipForward className="w-4 h-4" />
          跳過
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-4">
        <div 
          className={`flex gap-4 ${bubbleVisible ? "animate-slideIn" : "opacity-0"}`} 
          key={currentMessageIndex}
        >
          <div className="relative">
            <Avatar className={`w-14 h-14 border-2 shadow-lg ring-2 transition-all duration-300 ${
              currentEmotion === "angry" ? "border-red-500 ring-red-500/30" :
              currentEmotion === "happy" ? "border-yellow-500 ring-yellow-500/30" :
              currentEmotion === "sad" ? "border-blue-500 ring-blue-500/30" :
              currentEmotion === "surprised" ? "border-purple-500 ring-purple-500/30" :
              currentEmotion === "thinking" ? "border-cyan-500 ring-cyan-500/30" :
              "border-primary ring-primary/30"
            }`}>
              {getCurrentAvatar() ? (
                <AvatarImage src={getCurrentAvatar()!} alt={character.name} />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary font-display font-bold">
                {character.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            
            {config?.showEmotionIndicator && EmotionIcon && (
              <div className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-background border-2 ${EMOTION_COLORS[currentEmotion]}`}>
                <EmotionIcon className="w-3 h-3" />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-display text-sm font-bold text-primary uppercase tracking-wider">
                {character.name}
              </p>
              {config?.showEmotionIndicator && EMOTION_LABELS[currentEmotion] && (
                <span className={`text-xs px-2 py-0.5 rounded-full bg-muted ${EMOTION_COLORS[currentEmotion]}`}>
                  {EMOTION_LABELS[currentEmotion]}
                </span>
              )}
            </div>
            <div className={`bg-card border rounded-lg rounded-tl-none p-4 relative transition-all duration-300 ${
              currentEmotion === "angry" ? "border-red-500/50 shadow-red-500/20 shadow-lg" :
              currentEmotion === "happy" ? "border-yellow-500/50 shadow-yellow-500/20 shadow-lg" :
              currentEmotion === "sad" ? "border-blue-500/50 shadow-blue-500/20 shadow-lg" :
              currentEmotion === "surprised" ? "border-purple-500/50 shadow-purple-500/20 shadow-lg" :
              currentEmotion === "thinking" ? "border-cyan-500/50 shadow-cyan-500/20 shadow-lg" :
              "border-border"
            }`}>
              <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-card border-b-8 border-b-transparent" />
              <p className="font-chinese text-base leading-relaxed">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex gap-1">
          {messages.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentMessageIndex
                  ? "bg-primary"
                  : index < currentMessageIndex
                  ? "bg-primary/50"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
        
        <Button 
          onClick={handleNext} 
          className="gap-2"
          data-testid="button-next-dialogue"
        >
          {isTyping ? "顯示全部" : isLastMessage ? "繼續" : "下一句"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
