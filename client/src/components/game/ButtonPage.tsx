import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import * as LucideIcons from "lucide-react";
import { Clock, AlertTriangle, ChevronRight } from "lucide-react";
import type { ButtonConfig } from "@shared/schema";

interface ButtonPageProps {
  config: ButtonConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, unknown>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function ButtonPage({ config, onComplete }: ButtonPageProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ref 防連點 + 防 timer 與點擊競態（closure isSubmitting 可能 stale）
  const isSubmittingRef = useRef(false);

  // 洗牌時保留 originalIndex 對應，讓 defaultChoice 仍指向 admin 設定的那顆
  const buttons = useMemo(() => {
    const originalButtons = (config.buttons || []).map((b, i) => ({ ...b, _originalIndex: i }));
    if (config.randomizeOrder) {
      return [...originalButtons].sort(() => Math.random() - 0.5);
    }
    return originalButtons;
  }, [config.buttons, config.randomizeOrder]);

  // 不再產生 mock statistics（原本是每次 render 隨機假資料欺騙玩家）
  // 如需真實統計，應由後端 API 提供

  useEffect(() => {
    if (config.timeLimit && config.timeLimit > 0 && buttons.length > 0) {
      setTimeLeft(config.timeLimit);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            const defaultIdx = config.defaultChoice ?? 0;
            // 找回原本設定的按鈕（解決 randomizeOrder 後 buttons[defaultIdx] 對不上的 bug）
            const defaultButton = buttons.find((b) => b._originalIndex === defaultIdx) || buttons[0];
            if (defaultButton) {
              const actualIdx = buttons.indexOf(defaultButton);
              handleButtonClick(defaultButton, actualIdx);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.timeLimit, config.defaultChoice, buttons]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as Record<string, unknown>)[iconName] as React.ComponentType<{ className?: string }> | undefined;
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  const handleButtonClick = (button: ButtonConfig["buttons"][0], index: number) => {
    // ref 讀最新值，避免 stale closure（連點同顆按鈕 / timer 與點擊競態）
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSelectedIndex(index);

    setTimeout(() => {
      const reward: { points?: number; items?: string[] } = {};
      if (button.rewardPoints && button.rewardPoints !== 0) {
        reward.points = button.rewardPoints;
      }
      if (button.items && button.items.length > 0) {
        reward.items = button.items;
      }

      const nextPage = button.nextPageId === "_end" ? "_end" : button.nextPageId;
      onComplete(Object.keys(reward).length > 0 ? reward : undefined, nextPage);
    }, 300);
  };

  const getButtonVariant = (index: number, button: ButtonConfig["buttons"][0]) => {
    if (selectedIndex === index) return "default";
    if (button.color) return "outline";
    return index === 0 ? "default" : "outline";
  };

  const getTimeProgress = () => {
    if (!config.timeLimit || timeLeft === null) return 100;
    return (timeLeft / config.timeLimit) * 100;
  };

  const isUrgent = timeLeft !== null && timeLeft <= 10;

  // 空 buttons 陣列 fallback：避免玩家卡死
  if (buttons.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">本頁無可用選項</h2>
          <p className="text-sm text-muted-foreground">
            管理員尚未設定按鈕選項，請先繼續下一頁
          </p>
        </div>
        <Button onClick={() => onComplete()} data-testid="button-empty-fallback">
          繼續遊戲 <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      {config.timeLimit && timeLeft !== null && (
        <div className="w-full max-w-md mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className={`flex items-center gap-2 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
              <Clock className={`w-5 h-5 ${isUrgent ? "animate-pulse" : ""}`} />
              <span className="font-mono font-bold text-lg">
                {timeLeft}s
              </span>
            </div>
            {isUrgent && (
              <span className="text-sm text-destructive animate-pulse font-medium">
                快做決定！
              </span>
            )}
          </div>
          <Progress 
            value={getTimeProgress()} 
            className={`h-2 ${isUrgent ? "[&>div]:bg-destructive" : ""}`}
          />
        </div>
      )}

      <div className="w-full max-w-md space-y-4">
        {config.prompt && (
          <p className="text-center text-lg font-chinese text-muted-foreground mb-6">
            {config.prompt}
          </p>
        )}
        
        {buttons.map((button, index) => (
          <div key={index} className="relative">
            <Button
              onClick={() => handleButtonClick(button, index)}
              className={`w-full h-auto min-h-14 text-lg gap-3 font-display py-3 transition-all duration-200 ${
                selectedIndex === index ? "scale-95 ring-2 ring-primary" : ""
              } ${isUrgent && !selectedIndex ? "animate-pulse" : ""}`}
              variant={getButtonVariant(index, button)}
              style={button.color ? { 
                backgroundColor: selectedIndex === index ? button.color : undefined,
                borderColor: button.color,
                color: selectedIndex === index ? "white" : button.color
              } : undefined}
              disabled={isSubmitting}
              data-testid={`button-choice-${index}`}
            >
              <div className="flex items-center gap-3 flex-1">
                {getIcon(button.icon)}
                <span className="flex-1 text-left">{button.text}</span>
              </div>
              <div className="flex items-center gap-2">
                {button.rewardPoints != null && button.rewardPoints !== 0 && (
                  <span className={`text-sm opacity-70 px-2 py-0.5 rounded ${
                    button.rewardPoints > 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                  }`}>
                    {button.rewardPoints > 0 ? "+" : ""}{button.rewardPoints}分
                  </span>
                )}
                {button.items && button.items.length > 0 && (
                  <span className="text-sm opacity-70 bg-primary/10 px-2 py-0.5 rounded">
                    +{button.items.length}道具
                  </span>
                )}
              </div>
            </Button>
            
          </div>
        ))}

        {config.timeLimit && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            時間到將自動選擇第 {(config.defaultChoice ?? 0) + 1} 個選項
          </p>
        )}
      </div>
    </div>
  );
}
