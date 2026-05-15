import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, SkipForward, Smile, Angry, Frown, HelpCircle, Sparkles } from "lucide-react";
import type { DialogueConfig, DialogueMessage, DialogueChoice } from "@shared/schema";
import { useTypewriterSound, type TypewriterSoundType } from "@/hooks/useTypewriterSound";

interface DialoguePageProps {
  config: DialogueConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
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

export default function DialoguePage({ config, onComplete, onVariableUpdate }: DialoguePageProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // 🆕 2026-05-07：打字機音效
  const typewriterSoundType =
    ((config as unknown as { typewriterSoundType?: TypewriterSoundType }).typewriterSoundType ?? "none");
  const playCharSound = useTypewriterSound(typewriterSoundType);

  // 🆕 2026-05-07：對話音檔（角色配音）
  const messageAudioRef = useRef<HTMLAudioElement | null>(null);

  const messages = config?.messages || [];
  const currentMessage = messages[currentMessageIndex] as DialogueMessage | undefined;
  const isLastMessage = currentMessageIndex === messages.length - 1;
  const character = config?.character || { name: "???", avatar: null };
  const useBubbleAnimation = config?.bubbleAnimation ?? true;

  const currentEmotion = currentMessage?.emotion || "neutral";
  const EmotionIcon = EMOTION_ICONS[currentEmotion];

  // 🆕 speaker 邏輯（npc / player / system，預設 npc）
  const currentSpeaker = currentMessage?.speaker || "npc";
  const isPlayerMessage = currentSpeaker === "player";
  const isSystemMessage = currentSpeaker === "system";

  // 🆕 是否有玩家選項（有 choices → 不自動進下一句，等玩家選）
  const hasChoices = !!(currentMessage?.choices && currentMessage.choices.length > 0);

  // 🆕 頭像顯示模式：circle（小圓圈）/ portrait（大圖人像）
  // 從 config 讀取，預設 circle 維持向後相容
  const avatarDisplay = ((config as any)?.avatarDisplay ?? "circle") as
    | "circle"
    | "portrait";
  const usePortrait =
    avatarDisplay === "portrait" && !isPlayerMessage && !isSystemMessage;

  const getCurrentAvatar = () => {
    // 🆕 訊息層級的 speakerAvatar 優先
    if (currentMessage?.speakerAvatar) return currentMessage.speakerAvatar;
    if (isPlayerMessage) return (config as any).playerAvatar; // 玩家頭像
    if (character.emotionAvatars && currentEmotion !== "neutral") {
      const emotionAvatar = character.emotionAvatars[currentEmotion];
      if (emotionAvatar) return emotionAvatar;
    }
    return character.avatar;
  };

  // 🆕 取得發言者名稱（訊息層級 speakerName 優先，玩家用「你」）
  const getCurrentSpeakerName = () => {
    if (currentMessage?.speakerName) return currentMessage.speakerName;
    if (isPlayerMessage) return "你";
    if (isSystemMessage) return "旁白";
    return character.name;
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

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentMessage || !bubbleVisible) {
      return;
    }

    setDisplayedText("");
    setIsTyping(true);

    // 🆕 2026-05-07：訊息切換時播 audioUrl（角色配音）
    if (messageAudioRef.current) {
      try { messageAudioRef.current.pause(); } catch { /* noop */ }
      messageAudioRef.current = null;
    }
    const audioUrl = (currentMessage as { audioUrl?: string }).audioUrl;
    if (audioUrl) {
      try {
        const a = new Audio(audioUrl);
        a.volume = 0.9;
        void a.play().catch(() => { /* iOS autoplay 可能擋 */ });
        messageAudioRef.current = a;
      } catch { /* noop */ }
    }

    let charIndex = 0;
    const text = currentMessage.text || "";
    const typingSpeed = config?.typingSpeed ?? 30;

    const intervalId = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        // 🆕 2026-05-07：打字機音效
        playCharSound();
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(intervalId);

        // 🆕 有 choices 不自動進下一則（等玩家選）
        if (config?.autoAdvance && !isLastMessage && !hasChoices) {
          autoAdvanceRef.current = setTimeout(() => {
            setCurrentMessageIndex(prev => prev + 1);
            autoAdvanceRef.current = null;
          }, currentMessage.delay || 2000);
        }
      }
    }, typingSpeed);

    return () => {
      clearInterval(intervalId);
      // cleanup：玩家手動按「下一句」時 currentMessageIndex 變，effect 重跑前清掉 pending autoAdvance
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
  }, [currentMessageIndex, currentMessage, config?.autoAdvance, config?.typingSpeed, isLastMessage, bubbleVisible]);

  // 防 rage-click「結束對話」/ handleSkip 多次觸發 onComplete
  const finishedRef = useRef(false);
  const finishDialogue = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onComplete(
      config.rewardPoints ? { points: config.rewardPoints } : undefined,
      config.nextPageId,
    );
  };

  const handleNext = () => {
    if (!currentMessage) {
      finishDialogue();
      return;
    }

    if (isTyping) {
      setDisplayedText(currentMessage.text || "");
      setIsTyping(false);
      return;
    }

    if (isLastMessage) {
      finishDialogue();
    } else {
      setCurrentMessageIndex(prev => prev + 1);
    }
  };

  // 🆕 玩家選項處理（分支跳轉）
  const handleChoice = (choice: DialogueChoice) => {
    // 1. 設定變數（給 conditional_verify / flow_router 用）
    if (choice.setVariable) {
      onVariableUpdate(choice.setVariable.key, choice.setVariable.value);
    }
    // 2. 跳轉
    if (choice.nextPageId) {
      // 跳到指定 page → 觸發 onComplete + 帶 nextPageId
      finishedRef.current = true;
      onComplete(
        config.rewardPoints ? { points: config.rewardPoints } : undefined,
        choice.nextPageId,
      );
      return;
    }
    if (typeof choice.jumpToMessageIndex === "number") {
      // 🐛 2026-05-12 fix: admin 顯示 #1 #2 #3（1-based）、程式用 0-based
      //   原 bug：admin 寫 2 跳到 index=2 (#3、錯) / 寫 3 跳出範圍 (無跳)
      //   修：admin 寫 N 跳到 #N（index=N-1）
      const targetIndex = choice.jumpToMessageIndex - 1;
      if (targetIndex >= 0 && targetIndex < messages.length) {
        setCurrentMessageIndex(targetIndex);
        return;
      }
    }
    // 3. 沒指定跳轉 → 進下一則訊息
    if (isLastMessage) {
      finishDialogue();
    } else {
      setCurrentMessageIndex((prev) => prev + 1);
    }
  };

  // 🆕 鍵盤快速鍵：1-9 快速選擇對話選項（桌面玩家友善）
  useEffect(() => {
    if (!hasChoices || isTyping) return;
    const choices = currentMessage?.choices;
    if (!choices || choices.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // 排除 input / textarea 內按鍵
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= choices.length) {
        e.preventDefault();
        handleChoice(choices[num - 1]);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChoices, isTyping, currentMessage]);

  const [isConfirmingSkip, setIsConfirmingSkip] = useState(false);
  const skipConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSkip = () => {
    // 防止誤觸：第一次點僅進入「確認狀態」，3 秒內再點一次才真跳過
    if (!isConfirmingSkip) {
      setIsConfirmingSkip(true);
      if (skipConfirmTimerRef.current) clearTimeout(skipConfirmTimerRef.current);
      skipConfirmTimerRef.current = setTimeout(() => {
        setIsConfirmingSkip(false);
        skipConfirmTimerRef.current = null;
      }, 3000);
      return;
    }
    // 已在確認狀態 → 真跳過
    if (skipConfirmTimerRef.current) {
      clearTimeout(skipConfirmTimerRef.current);
      skipConfirmTimerRef.current = null;
    }
    finishDialogue();
  };

  if (!messages.length) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-4">
        <p className="text-muted-foreground mb-4">沒有對話內容</p>
        <Button onClick={finishDialogue} data-testid="button-continue">
          繼續
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col p-4">
      <div className="flex justify-end mb-4">
        <Button
          variant={isConfirmingSkip ? "destructive" : "ghost"}
          size="sm"
          onClick={handleSkip}
          className={`gap-1 ${isConfirmingSkip ? "" : "text-muted-foreground"}`}
          data-testid="button-skip-dialogue"
          aria-label={isConfirmingSkip ? "再按一次確認跳過對話" : "跳過對話"}
        >
          <SkipForward className="w-4 h-4" aria-hidden="true" />
          {isConfirmingSkip ? "再按一次確認跳過" : "跳過"}
        </Button>
      </div>

      <div className="flex-1 flex flex-col justify-end pb-4">
        {/* 🆕 system 旁白：置中、無頭像、灰色文字 */}
        {isSystemMessage ? (
          <div
            className={`max-w-md mx-auto text-center py-3 px-4 rounded-lg bg-muted/30 border border-border/50 ${bubbleVisible ? "animate-slideIn" : "opacity-0"}`}
            key={currentMessageIndex}
          >
            <p className="font-chinese text-sm text-muted-foreground italic leading-relaxed">
              {displayedText}
              {isTyping && (
                <span className="inline-block w-1 h-3 bg-muted-foreground ml-1 animate-pulse" />
              )}
            </p>
          </div>
        ) : usePortrait ? (
          /* 🆕 portrait 大圖模式：上方人像 + 下方對話框（電影感） */
          <div
            className={`flex flex-col gap-3 ${bubbleVisible ? "animate-slideIn" : "opacity-0"}`}
            key={currentMessageIndex}
            data-display="portrait"
          >
            {/* 大圖人像區（max-h 40vh，避免遮蓋對話）*/}
            <div className="relative w-full max-w-md mx-auto rounded-lg overflow-hidden bg-card/30 border shadow-2xl">
              <div
                className={`relative aspect-square w-full transition-all duration-300 ${
                  currentEmotion === "angry" ? "ring-2 ring-red-500/50" :
                  currentEmotion === "happy" ? "ring-2 ring-yellow-500/50" :
                  currentEmotion === "sad" ? "ring-2 ring-blue-500/50" :
                  currentEmotion === "surprised" ? "ring-2 ring-purple-500/50" :
                  currentEmotion === "thinking" ? "ring-2 ring-cyan-500/50" :
                  "ring-1 ring-primary/30"
                }`}
                style={{ maxHeight: "40vh" }}
              >
                {getCurrentAvatar() ? (
                  <img
                    src={getCurrentAvatar()!}
                    alt={getCurrentSpeakerName()}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="font-display text-6xl font-bold text-primary">
                      {getCurrentSpeakerName().charAt(0)}
                    </span>
                  </div>
                )}
                {/* 底部漸層融入背景 */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                {/* 角色名片（左下角） */}
                <div className="absolute left-3 bottom-3 flex items-center gap-2">
                  <p className="font-display text-base font-bold uppercase tracking-wider text-primary drop-shadow-lg">
                    {getCurrentSpeakerName()}
                  </p>
                  {config?.showEmotionIndicator && EMOTION_LABELS[currentEmotion] && (
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm ${EMOTION_COLORS[currentEmotion]}`}>
                      {EMOTION_LABELS[currentEmotion]}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* 對話框 */}
            <div className={`max-w-md mx-auto w-full bg-card border rounded-lg p-4 shadow-lg transition-all duration-300 ${
              currentEmotion === "angry" ? "border-red-500/50 shadow-red-500/20" :
              currentEmotion === "happy" ? "border-yellow-500/50 shadow-yellow-500/20" :
              currentEmotion === "sad" ? "border-blue-500/50 shadow-blue-500/20" :
              currentEmotion === "surprised" ? "border-purple-500/50 shadow-purple-500/20" :
              currentEmotion === "thinking" ? "border-cyan-500/50 shadow-cyan-500/20" :
              "border-border"
            }`}>
              <p className="font-chinese text-base leading-relaxed">
                {displayedText}
                {isTyping && (
                  <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        ) : (
          /* npc / player 氣泡：左右對齊 */
          <div
            className={`flex gap-4 ${isPlayerMessage ? "flex-row-reverse" : ""} ${bubbleVisible ? "animate-slideIn" : "opacity-0"}`}
            key={currentMessageIndex}
          >
            <div className="relative shrink-0">
              <Avatar className={`w-14 h-14 border-2 shadow-lg ring-2 transition-all duration-300 ${
                isPlayerMessage ? "border-blue-400 ring-blue-400/30" :
                currentEmotion === "angry" ? "border-red-500 ring-red-500/30" :
                currentEmotion === "happy" ? "border-yellow-500 ring-yellow-500/30" :
                currentEmotion === "sad" ? "border-blue-500 ring-blue-500/30" :
                currentEmotion === "surprised" ? "border-purple-500 ring-purple-500/30" :
                currentEmotion === "thinking" ? "border-cyan-500 ring-cyan-500/30" :
                "border-primary ring-primary/30"
              }`}>
                {getCurrentAvatar() ? (
                  <AvatarImage src={getCurrentAvatar()!} alt={getCurrentSpeakerName()} />
                ) : null}
                <AvatarFallback className={isPlayerMessage ? "bg-blue-400/20 text-blue-400 font-display font-bold" : "bg-primary/20 text-primary font-display font-bold"}>
                  {getCurrentSpeakerName().charAt(0)}
                </AvatarFallback>
              </Avatar>

              {config?.showEmotionIndicator && EmotionIcon && !isPlayerMessage && (
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-background border-2 ${EMOTION_COLORS[currentEmotion]}`}>
                  <EmotionIcon className="w-3 h-3" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className={`flex items-center gap-2 mb-2 ${isPlayerMessage ? "justify-end" : ""}`}>
                <p className={`font-display text-sm font-bold uppercase tracking-wider ${isPlayerMessage ? "text-blue-400" : "text-primary"}`}>
                  {getCurrentSpeakerName()}
                </p>
                {!isPlayerMessage && config?.showEmotionIndicator && EMOTION_LABELS[currentEmotion] && (
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-muted ${EMOTION_COLORS[currentEmotion]}`}>
                    {EMOTION_LABELS[currentEmotion]}
                  </span>
                )}
              </div>
              <div className={`bg-card border p-4 relative transition-all duration-300 ${
                isPlayerMessage ? "rounded-lg rounded-tr-none border-blue-400/50 shadow-blue-400/20 shadow-lg" :
                "rounded-lg rounded-tl-none " + (
                  currentEmotion === "angry" ? "border-red-500/50 shadow-red-500/20 shadow-lg" :
                  currentEmotion === "happy" ? "border-yellow-500/50 shadow-yellow-500/20 shadow-lg" :
                  currentEmotion === "sad" ? "border-blue-500/50 shadow-blue-500/20 shadow-lg" :
                  currentEmotion === "surprised" ? "border-purple-500/50 shadow-purple-500/20 shadow-lg" :
                  currentEmotion === "thinking" ? "border-cyan-500/50 shadow-cyan-500/20 shadow-lg" :
                  "border-border"
                )
              }`}>
                {/* 對話泡角（左 / 右） */}
                {isPlayerMessage ? (
                  <div className="absolute -right-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-card border-b-8 border-b-transparent" />
                ) : (
                  <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-card border-b-8 border-b-transparent" />
                )}
                <p className="font-chinese text-base leading-relaxed">
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 玩家選項按鈕（顯示後不能跳到下一句，等選擇）+ 動畫 + 鍵盤快速鍵 */}
        {hasChoices && !isTyping && currentMessage?.choices && (
          <div className="mt-4 flex flex-col gap-2 max-w-md mx-auto w-full animate-slideIn">
            <p className="text-xs text-muted-foreground text-center mb-1">
              請選擇 <span className="hidden md:inline text-[10px] opacity-60">（按 1-9 快速選）</span>
            </p>
            {currentMessage.choices.map((choice, idx) => (
              <Button
                key={idx}
                variant="outline"
                onClick={() => handleChoice(choice)}
                className="w-full justify-start text-left whitespace-normal h-auto py-3 hover:bg-primary/10 hover:border-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
                data-testid={`button-dialogue-choice-${idx}`}
              >
                <span className="text-primary mr-2 font-bold">{idx + 1}.</span>
                {choice.text}
              </Button>
            ))}
          </div>
        )}
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
        
        <div className="flex flex-col items-end gap-1">
          {/* 🆕 有 choices 時不顯示「下一句」（避免玩家跳過選項）*/}
          {!hasChoices && (
            <>
              <Button
                onClick={handleNext}
                className={`gap-2 ${isLastMessage && !isTyping ? "animate-pulse" : ""}`}
                data-testid="button-next-dialogue"
              >
                {isTyping ? "顯示全部" : isLastMessage ? "結束對話" : "下一句"}
                <ChevronRight className="w-4 h-4" />
              </Button>
              {config?.autoAdvance && isLastMessage && !isTyping && (
                <span className="text-[10px] text-muted-foreground">
                  劇情結束，點擊按鈕進入下一關
                </span>
              )}
            </>
          )}
          {hasChoices && !isTyping && (
            <span className="text-[11px] text-muted-foreground">
              👆 請從上方選項選擇
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
