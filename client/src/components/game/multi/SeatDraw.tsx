// 🎲 SeatDraw — 多人抽位置 / 抽組別元件（純 UI）
// 大家同時抽籤，系統公平分配座位/組別/號碼
// 適用：研習分組、尾牙抽獎座位、活動分組、配對

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shuffle, Star } from "lucide-react";

export interface DrawSlot {
  id: string;
  label: string;
  emoji?: string;
  color?: string;
}

export interface SeatDrawConfig {
  title?: string;
  subtitle?: string;
  slots: DrawSlot[];
  shuffleText?: string;
}

export interface DrawResult {
  userId: string;
  userName: string;
  slotId: string;
  drawnAt: number;
}

export interface SeatDrawState extends Record<string, unknown> {
  results: DrawResult[];
  pool: string[];
}

interface SeatDrawProps {
  config: SeatDrawConfig;
  state: SeatDrawState;
  myUserId: string;
  myUserName: string;
  onDraw: () => Promise<void>;
}

export default function SeatDraw({ config, state, myUserId, onDraw }: SeatDrawProps) {
  const [isDrawing, setIsDrawing] = useState(false);

  const myResult = state.results.find((r) => r.userId === myUserId);
  const hasDrawn = !!myResult;
  const mySlot = myResult ? config.slots.find((s) => s.id === myResult.slotId) : undefined;
  const drawnCount = state.results.length;
  const totalSlots = config.slots.length;

  const handleDraw = async () => {
    if (isDrawing || hasDrawn) return;
    setIsDrawing(true);
    try {
      await onDraw();
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="seat-draw-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="seat-draw-title">
              <Shuffle className="w-5 h-5 text-violet-500" />
              {config.title ?? "🎲 抽籤"}
            </CardTitle>
            <Badge variant="outline" data-testid="draw-progress">
              {drawnCount}/{totalSlots}
            </Badge>
          </div>
          {config.subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="draw-subtitle">{config.subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasDrawn && mySlot ? (
            <div className="py-6 text-center space-y-3" data-testid="draw-result">
              <p className="text-sm text-muted-foreground">你的號碼是</p>
              <div className="text-6xl font-black" data-testid="draw-result-emoji">
                {mySlot.emoji ?? "🎲"}
              </div>
              <div
                className="text-3xl font-bold"
                data-testid="draw-result-label"
              >
                {mySlot.label}
              </div>
              <p className="text-xs text-green-600">✅ 抽籤完成</p>
            </div>
          ) : (
            <div className="py-4 text-center space-y-4">
              <p className="text-6xl animate-pulse">🎲</p>
              <Button
                size="lg"
                className="w-full"
                onClick={() => void handleDraw()}
                disabled={isDrawing || drawnCount >= totalSlots}
                data-testid="draw-btn"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                {isDrawing ? "抽籤中…" : (config.shuffleText ?? "我要抽！")}
              </Button>
              {drawnCount >= totalSlots && (
                <p className="text-xs text-muted-foreground">所有籤已抽完</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {state.results.length > 0 && (
        <Card className="border-violet-100">
          <CardContent className="pt-3 pb-3">
            <div className="space-y-1" data-testid="draw-list">
              {state.results
                .slice()
                .sort((a, b) => a.drawnAt - b.drawnAt)
                .map((r) => {
                  const slot = config.slots.find((s) => s.id === r.slotId);
                  return (
                    <div
                      key={r.userId}
                      className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-muted/50"
                      data-testid={`draw-row-${r.userId}`}
                    >
                      <span className="text-sm">{r.userName}</span>
                      <div className="flex items-center gap-1">
                        {slot?.emoji && <span>{slot.emoji}</span>}
                        <span className="text-sm font-semibold">{slot?.label ?? r.slotId}</span>
                        {r.userId === myUserId && (
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
