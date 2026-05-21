import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, MessageCircle, Map, Backpack, Star, MoreVertical } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import FontScaleSwitcher from "./FontScaleSwitcher";

interface GameHeaderProps {
  title: string;
  score: number;
  onBack: () => void;
  onChat?: () => void;
  onMap?: () => void;
  onInventory?: () => void;
  inventoryCount?: number;
}

export default function GameHeader({
  title,
  score,
  onBack,
  onChat,
  onMap,
  onInventory,
  inventoryCount = 0,
}: GameHeaderProps) {
  const [scoreChange, setScoreChange] = useState<number | null>(null);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    const diff = score - prevScoreRef.current;
    if (diff !== 0) {
      setScoreChange(diff);
      const timer = setTimeout(() => setScoreChange(null), 1500);
      prevScoreRef.current = score;
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = score;
  }, [score]);

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border safe-top max-w-full overflow-hidden">
      {/* 🆕 2026-05-22 業主 docx #4：<380px 按鈕擠壓被裁
          - 外層 max-w-full overflow-hidden 防右側裁切
          - 左側群組 min-w-0 + flex-shrink 讓標題可縮
          - 右側 icon 群 flex-shrink-0 不縮、間距改 gap-0.5 sm:gap-1
          - h-9 w-9 sm:h-10 sm:w-10 縮小窄螢幕按鈕 */}
      <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1 sm:gap-2 max-w-full">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-sm truncate">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <div className="relative">
            <Badge variant="outline" className="gap-1 font-number">
              <Star className="w-3 h-3 text-primary" />
              {score}
            </Badge>
            {scoreChange !== null && (
              <span
                className={`absolute -top-5 left-1/2 -translate-x-1/2 font-bold text-sm pointer-events-none animate-score-float ${
                  scoreChange > 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {scoreChange > 0 ? "+" : ""}{scoreChange}
              </span>
            )}
          </div>

          {onInventory && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onInventory}
              className="relative h-9 w-9 sm:h-10 sm:w-10"
              data-testid="button-inventory"
            >
              <Backpack className="w-5 h-5" />
              {inventoryCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-number">
                  {inventoryCount}
                </span>
              )}
            </Button>
          )}

          {onMap && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onMap}
              data-testid="button-map"
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <Map className="w-5 h-5" />
            </Button>
          )}

          {onChat && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onChat}
              data-testid="button-chat"
              className="h-9 w-9 sm:h-10 sm:w-10"
            >
              <MessageCircle className="w-5 h-5" />
            </Button>
          )}

          {/* 🆕 2026-05-07：偏好設定 popover（文字大小切換、未來可加更多）*/}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-game-prefs"
                aria-label="偏好設定"
                className="h-9 w-9 sm:h-10 sm:w-10"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">文字大小</div>
                <FontScaleSwitcher showLabel />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>
  );
}
