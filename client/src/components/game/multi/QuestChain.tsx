// ⛓ QuestChain — 任務鏈元件（W18 D4）
//
// 設計依據：docs/decisions/0013-w18-component-expansion.md
// pageType: quest_chain
//
// 玩法：
//   - 玩家依序解 N 個 stations（線性 chain）
//   - 解 task[i] 才解鎖 task[i+1]
//   - 完成全部 → 完成 banner + 隊伍勳章
//   - 適用：街區走讀、企業內訓、員工旅遊、解謎活動
//
// W18 D4 簡化版：local state（每位玩家獨立解、不接 team WS）
// 未來（W19+）：可加 team sync hook 讓隊員共享進度

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, ArrowRight, Trophy } from "lucide-react";
import { normalizeAnswer } from "@/lib/gameVerification";

export interface QuestStation {
  id: string;
  /** 站點名稱（如「後浦小鎮入口」）*/
  label: string;
  /** 任務題目 / 說明 */
  puzzle: string;
  /** 正解（normalizeAnswer 後比對；可選，無則只要送出就過）*/
  answer?: string;
  /** 提示（玩家答錯 N 次顯示）*/
  hint?: string;
}

export interface QuestChainConfig {
  title?: string;
  subtitle?: string;
  /** 站點清單（依序）*/
  stations?: QuestStation[];
  /** 完成全部後顯示的獎勵描述 */
  rewardOnComplete?: string;
  /** 答錯 N 次顯示 hint（預設 2）*/
  hintAfterFailures?: number;
}

export interface QuestChainProps {
  config: QuestChainConfig;
  /** 已解鎖到第幾個 index（0-based）*/
  currentIndex: number;
  /** 已完成的 station id 陣列 */
  completedIds: string[];
  /** 答錯次數（依站點 id）*/
  failureCount: Record<string, number>;
  /** 玩家送答案 */
  onSubmitAnswer: (stationId: string, answer: string) => void;
  /** 全部完成、玩家按繼續 */
  onComplete?: () => void;
}

/**
 * 純函式：判斷答案是否正確
 *
 * - station.answer 未設定 → 任何答案都過（純送出）
 * - station.answer 設定 → normalizeAnswer 後 case-insensitive 比對
 */
export function checkStationAnswer(station: QuestStation, answer: string): boolean {
  if (!station.answer) return true;
  return normalizeAnswer(answer) === normalizeAnswer(station.answer);
}

/**
 * 純函式：計算進度百分比
 */
export function calculateChainProgress(
  completedIds: string[],
  totalStations: number,
): number {
  if (totalStations <= 0) return 0;
  return Math.round((completedIds.length / totalStations) * 100);
}

export default function QuestChain({
  config,
  currentIndex,
  completedIds,
  failureCount,
  onSubmitAnswer,
  onComplete,
}: QuestChainProps) {
  const stations = config.stations ?? [];
  const totalStations = stations.length;
  const hintAfterFailures = config.hintAfterFailures ?? 2;
  const isAllComplete = completedIds.length >= totalStations && totalStations > 0;
  const progress = useMemo(
    () => calculateChainProgress(completedIds, totalStations),
    [completedIds, totalStations],
  );

  const [inputValue, setInputValue] = useState("");
  const currentStation = stations[currentIndex];

  if (totalStations === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        此任務鏈尚未設定站點、請聯繫 admin。
      </div>
    );
  }

  // ─── 全部完成 ───
  if (isAllComplete) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 space-y-4">
        <Card className="bg-gradient-to-br from-amber-100 to-orange-200 border-amber-400 border-2">
          <CardContent className="p-8 text-center space-y-4">
            <Trophy className="w-20 h-20 mx-auto text-amber-600" />
            <h2 className="text-3xl font-bold text-amber-900">🎉 全部完成！</h2>
            {config.rewardOnComplete && (
              <p className="text-lg text-amber-800">{config.rewardOnComplete}</p>
            )}
            <div className="text-sm text-amber-700">
              已完成 {totalStations} 個站點
            </div>
            {onComplete && (
              <Button onClick={onComplete} size="lg" data-testid="btn-quest-complete">
                繼續下一頁
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── 主流程：列表 + 當前站答題 ───
  const handleSubmit = () => {
    if (!currentStation) return;
    const answer = inputValue.trim();
    if (!answer) return;
    onSubmitAnswer(currentStation.id, answer);
    setInputValue("");
  };

  const showHint =
    currentStation && (failureCount[currentStation.id] ?? 0) >= hintAfterFailures;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
      {/* 標題 + 進度 */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">⛓ {config.title ?? "任務鏈"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
        <div className="flex items-center justify-center gap-2">
          <div className="text-sm font-medium text-muted-foreground">
            進度 {completedIds.length} / {totalStations}
          </div>
          <Badge variant="secondary">{progress}%</Badge>
        </div>
        {/* 進度條 */}
        <div className="w-full max-w-md mx-auto h-2 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
            data-testid="chain-progress-fill"
          />
        </div>
      </div>

      {/* 站點列表 */}
      <div className="space-y-2">
        {stations.map((station, idx) => {
          const isCompleted = completedIds.includes(station.id);
          const isLocked = idx > currentIndex;
          const isCurrent = idx === currentIndex && !isCompleted;

          return (
            <Card
              key={station.id}
              className={`${
                isCompleted
                  ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950"
                  : isCurrent
                  ? "bg-amber-50 border-amber-400 border-2 ring-2 ring-amber-300 dark:bg-amber-950"
                  : "opacity-60 border-zinc-300"
              } transition-all`}
              data-testid={`station-card-${station.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  ) : isLocked ? (
                    <Lock className="w-6 h-6 text-zinc-400 flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold">{station.label}</div>
                    {(isCurrent || isCompleted) && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {station.puzzle}
                      </div>
                    )}
                  </div>
                </div>

                {/* 當前站答題區 */}
                {isCurrent && (
                  <div className="mt-3 pl-9 space-y-2">
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="輸入答案..."
                      data-testid={`input-station-${station.id}`}
                    />
                    {showHint && station.hint && (
                      <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 p-2 rounded">
                        💡 提示：{station.hint}
                      </div>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={!inputValue.trim()}
                      className="w-full"
                      data-testid={`btn-submit-station-${station.id}`}
                    >
                      送出答案
                    </Button>
                    {failureCount[station.id] > 0 && (
                      <div className="text-xs text-zinc-500">
                        已嘗試 {failureCount[station.id]} 次
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
