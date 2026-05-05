// ✅ CheckIn — 多人數位簽到元件（純 UI）
// 玩家點擊「我到了！」即時登記，主持人一眼掌握到場狀況
// 適用：活動報到、任務集合點確認、出席率追蹤

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckInConfig {
  title?: string;
  message?: string;
  targetCount?: number;
  showNames?: boolean;
}

export interface ArrivalEntry {
  userId: string;
  userName: string;
  arrivedAt: number;
}

export interface CheckInState {
  arrivals: ArrivalEntry[];
}

interface CheckInProps {
  config: CheckInConfig;
  state: CheckInState;
  myUserId: string;
  myUserName: string;
  onCheckIn: () => Promise<void>;
}

export default function CheckIn({ config, state, myUserId, myUserName: _myUserName, onCheckIn }: CheckInProps) {
  const [isChecking, setIsChecking] = useState(false);

  const showNames = config.showNames !== false;
  const targetCount = config.targetCount;

  const myArrival = state.arrivals.find((a) => a.userId === myUserId);
  const hasCheckedIn = !!myArrival;
  const arrivedCount = state.arrivals.length;

  const pct = targetCount && targetCount > 0
    ? Math.min((arrivedCount / targetCount) * 100, 100)
    : null;

  const handleCheckIn = async () => {
    if (isChecking || hasCheckedIn) return;
    setIsChecking(true);
    try {
      await onCheckIn();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="check-in-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="check-in-title">
              {config.title ?? "✅ 活動簽到"}
            </CardTitle>
            <Badge
              variant={pct === 100 ? "default" : "outline"}
              data-testid="check-in-count"
            >
              {arrivedCount} {targetCount ? `/ ${targetCount}` : ""} 人到場
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 進度條 */}
          {pct !== null && (
            <div className="space-y-1" data-testid="check-in-progress">
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    pct >= 100 ? "bg-green-500" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                  data-testid="check-in-bar"
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{Math.round(pct)}% 到場</p>
            </div>
          )}

          {/* 按鈕 */}
          {hasCheckedIn ? (
            <div className="flex flex-col items-center gap-2 py-4" data-testid="check-in-done">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-sm font-medium text-green-600">已簽到！</p>
              <p className="text-xs text-muted-foreground">
                {new Date(myArrival.arrivedAt).toLocaleTimeString("zh-TW", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              {config.message && (
                <p className="text-sm text-muted-foreground text-center">{config.message}</p>
              )}
              <Button
                size="lg"
                className="w-full text-base"
                onClick={() => void handleCheckIn()}
                disabled={isChecking}
                data-testid="check-in-btn"
              >
                <Clock className="w-5 h-5 mr-2" />
                我到了！
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 到場名單 */}
      {showNames && state.arrivals.length > 0 && (
        <Card data-testid="check-in-list">
          <CardContent className="pt-4 space-y-1">
            <p className="text-xs text-muted-foreground mb-2">已到場名單</p>
            {state.arrivals
              .slice()
              .sort((a, b) => a.arrivedAt - b.arrivedAt)
              .map((a, idx) => (
                <div
                  key={a.userId}
                  className={cn(
                    "flex items-center justify-between text-sm px-2 py-1 rounded",
                    a.userId === myUserId ? "bg-primary/10 font-medium" : "",
                  )}
                  data-testid={`arrival-row-${a.userId}`}
                >
                  <span>
                    <span className="text-muted-foreground mr-2 text-xs">{idx + 1}.</span>
                    {a.userName}
                    {a.userId === myUserId && <span className="ml-1 text-xs text-primary">（你）</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.arrivedAt).toLocaleTimeString("zh-TW", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
