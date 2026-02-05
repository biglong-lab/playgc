import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import * as LucideIcons from "lucide-react";
import { Clock, Users } from "lucide-react";
import type { ButtonConfig } from "@shared/schema";

interface ButtonPageProps {
  config: ButtonConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

export default function ButtonPage({ config, onComplete }: ButtonPageProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const buttons = useMemo(() => {
    const originalButtons = config.buttons || [];
    if (config.randomizeOrder) {
      return [...originalButtons].sort(() => Math.random() - 0.5);
    }
    return originalButtons;
  }, [config.buttons, config.randomizeOrder]);

  const mockStatistics = useMemo(() => {
    if (!config.showStatistics) return null;
    const total = 100;
    const percentages = buttons.map(() => Math.floor(Math.random() * 40) + 10);
    const sum = percentages.reduce((a, b) => a + b, 0);
    return percentages.map(p => Math.round((p / sum) * 100));
  }, [config.showStatistics, buttons.length]);

  useEffect(() => {
    if (config.timeLimit && config.timeLimit > 0) {
      setTimeLeft(config.timeLimit);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            const defaultIdx = config.defaultChoice ?? 0;
            const defaultButton = buttons[defaultIdx] || buttons[0];
            if (defaultButton) {
              handleButtonClick(defaultButton, defaultIdx);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [config.timeLimit, config.defaultChoice, buttons]);

  const getIcon = (iconName?: string) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : null;
  };

  const handleButtonClick = (button: ButtonConfig["buttons"][0], index: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSelectedIndex(index);

    setTimeout(() => {
      const reward: { points?: number; items?: string[] } = {};
      if (button.rewardPoints && button.rewardPoints > 0) {
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
              disabled={isSubmitting && selectedIndex !== index}
              data-testid={`button-choice-${index}`}
            >
              <div className="flex items-center gap-3 flex-1">
                {getIcon(button.icon)}
                <span className="flex-1 text-left">{button.text}</span>
              </div>
              <div className="flex items-center gap-2">
                {button.rewardPoints && button.rewardPoints > 0 && (
                  <span className="text-sm opacity-70 bg-primary/10 px-2 py-0.5 rounded">
                    +{button.rewardPoints}分
                  </span>
                )}
                {button.items && button.items.length > 0 && (
                  <span className="text-sm opacity-70 bg-primary/10 px-2 py-0.5 rounded">
                    +{button.items.length}道具
                  </span>
                )}
              </div>
            </Button>
            
            {config.showStatistics && mockStatistics && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>{mockStatistics[index]}% 的人選了這個</span>
              </div>
            )}
          </div>
        ))}

        {config.timeLimit && config.defaultChoice !== undefined && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            時間到將自動選擇第 {config.defaultChoice + 1} 個選項
          </p>
        )}
      </div>
    </div>
  );
}
