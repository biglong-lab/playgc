// ✅ TeamChecklist — 隊伍共同清單（純 UI 元件）
// 全隊協力勾選項目，任何人勾選即時同步
// 適用：Workshop 任務核對、訓練驗收、活動流程確認、參觀打卡

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";

export interface TeamChecklistConfig {
  title?: string;
  subtitle?: string;
  items: string[];
  celebrationText?: string;
  winOnComplete?: boolean;
}

export interface TeamChecklistState {
  checked: string[];
}

interface TeamChecklistProps {
  config: TeamChecklistConfig;
  state: TeamChecklistState;
  onToggle: (item: string) => Promise<void>;
}

export default function TeamChecklist({ config, state, onToggle }: TeamChecklistProps) {
  const items = config.items ?? [];
  const checkedSet = new Set(state.checked);
  const doneCount = items.filter((it) => checkedSet.has(it)).length;
  const isComplete = doneCount === items.length && items.length > 0;

  return (
    <div className="space-y-3" data-testid="team-checklist-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="team-checklist-title">
              {config.title ?? "✅ 隊伍清單"}
            </CardTitle>
            <Badge
              variant={isComplete ? "default" : "outline"}
              data-testid="team-checklist-progress"
            >
              {doneCount}/{items.length}
            </Badge>
          </div>
          {config.subtitle && (
            <p className="text-sm text-muted-foreground">{config.subtitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {/* 進度條 */}
          <div className="h-2 bg-muted rounded-full overflow-hidden" data-testid="team-checklist-bar">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: items.length > 0 ? `${(doneCount / items.length) * 100}%` : "0%" }}
            />
          </div>

          {isComplete && config.winOnComplete !== false ? (
            <div className="text-center py-6 space-y-2" data-testid="team-checklist-complete">
              <div className="text-4xl">🎉</div>
              <p className="text-lg font-bold text-green-600">全部完成！</p>
              <p className="text-sm text-muted-foreground">
                {config.celebrationText ?? "太棒了，全隊一起完成所有任務！"}
              </p>
            </div>
          ) : (
            <ul className="space-y-2 pt-1" data-testid="team-checklist-items">
              {items.map((item) => {
                const isDone = checkedSet.has(item);
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => void onToggle(item)}
                      data-testid={`checklist-item-${item}`}
                      className={cn(
                        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left",
                        "transition-all active:scale-[0.98]",
                        isDone
                          ? "bg-green-50 border-green-200"
                          : "bg-white border-gray-200 hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      {isDone
                        ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
                      }
                      <span className={cn(
                        "text-sm",
                        isDone ? "line-through text-muted-foreground" : "text-foreground",
                      )}>
                        {item}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
