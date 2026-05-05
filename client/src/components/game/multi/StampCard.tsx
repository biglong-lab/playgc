// 🎴 StampCard — 多人集點卡元件（純 UI）
// 每人有一張集點卡，完成指定任務後蓋章，集滿兌換獎勵
// 適用：街區商圈闖關、園遊會集章、企業研習打卡

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Gift } from "lucide-react";

export interface StampSlot {
  id: string;
  label: string;
  emoji?: string;
}

export interface StampCardConfig {
  title?: string;
  subtitle?: string;
  slots: StampSlot[];
  rewardText?: string;
  celebrationText?: string;
}

export interface MyStamps {
  userId: string;
  userName: string;
  stampedIds: string[];
  completedAt?: number;
}

export interface StampCardState extends Record<string, unknown> {
  stamps: MyStamps[];
}

interface StampCardProps {
  config: StampCardConfig;
  state: StampCardState;
  myUserId: string;
  myUserName: string;
  onStamp: (slotId: string) => Promise<void>;
}

export default function StampCard({ config, state, myUserId, onStamp }: StampCardProps) {
  const myEntry = state.stamps.find((s) => s.userId === myUserId);
  const stampedIds = myEntry?.stampedIds ?? [];
  const total = config.slots.length;
  const collected = stampedIds.length;
  const isComplete = collected >= total;

  const completedCount = state.stamps.filter((s) => s.stampedIds.length >= total).length;

  return (
    <div className="space-y-4" data-testid="stamp-card-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="stamp-card-title">
              <Star className="w-5 h-5 text-amber-500" />
              {config.title ?? "🎴 集點卡"}
            </CardTitle>
            <Badge variant="outline" data-testid="stamp-progress">
              {collected}/{total}
            </Badge>
          </div>
          {config.subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="stamp-subtitle">{config.subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isComplete ? (
            <div className="py-4 text-center space-y-3" data-testid="stamp-completed">
              <p className="text-3xl">🎉</p>
              <p className="font-semibold text-green-600">
                {config.celebrationText ?? "恭喜集滿！"}
              </p>
              {config.rewardText && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 justify-center">
                  <Gift className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800">{config.rewardText}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2" data-testid="stamp-grid">
              {config.slots.map((slot) => {
                const stamped = stampedIds.includes(slot.id);
                return (
                  <Button
                    key={slot.id}
                    variant={stamped ? "default" : "outline"}
                    className={`h-20 flex-col gap-1 text-xs relative ${
                      stamped ? "bg-amber-500 hover:bg-amber-500 border-amber-600" : ""
                    }`}
                    onClick={() => !stamped && void onStamp(slot.id)}
                    disabled={stamped}
                    data-testid={`stamp-slot-${slot.id}`}
                  >
                    {stamped && (
                      <Check className="w-4 h-4 absolute top-1 right-1 text-white" />
                    )}
                    <span className="text-2xl">{slot.emoji ?? "⭐"}</span>
                    <span className={stamped ? "text-white" : "text-muted-foreground"}>
                      {slot.label}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {completedCount > 0 && (
        <Card className="border-amber-100 bg-amber-50/30">
          <CardContent className="pt-3 pb-3">
            <p className="text-sm text-amber-800 text-center" data-testid="stamp-completed-count">
              🏆 已有 <span className="font-semibold">{completedCount}</span> 人集滿！
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
